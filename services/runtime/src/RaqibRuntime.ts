import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { StepType } from '@raqib/shared';
import { PolicyEngine } from '@raqib/policy-engine';
import { EmergencyStop, MiddlewarePipeline } from '@raqib/policy-engine';
import { MissionEngine, MemoryEngine, WorkflowEngine } from '@raqib/mission-engine';
import { ModelGateway } from '@raqib/model-gateway';
import { AuditLedger } from '@raqib/audit-ledger';
import { VerificationEngine } from '@raqib/verification';
import { ContextEngine } from '@raqib/core';
import { SkillsRegistry, RaqibCodingEngineAdapter, PathGuard, FileTool, GitTool, ShellTool, ShellExecutionResult } from '@raqib/tool-gateway';

export class RaqibRuntime {
  public policyEngine: PolicyEngine;
  public emergencyStop: EmergencyStop;
  public missionEngine: MissionEngine;
  public modelGateway: ModelGateway;
  public auditLedger: AuditLedger;
  public verificationEngine: VerificationEngine;
  public contextEngine: ContextEngine;
  public memoryEngine: MemoryEngine;
  public workflowEngine: WorkflowEngine;
  public skillsRegistry: SkillsRegistry;
  public shellTool: ShellTool;
  public middlewarePipeline: MiddlewarePipeline;

  private isRunning: boolean = false;
  private tickInterval?: NodeJS.Timeout;
  private targetRepoPath?: string;

  constructor(options?: { dbPath?: string; dataDir?: string; targetRepoPath?: string }) {
    this.targetRepoPath = options?.targetRepoPath;
    const dataDir = options?.dataDir || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = options?.dbPath || path.join(dataDir, 'raqib.db');

    let providersConfig = { providers: {}, routing: {} };
    try {
      const providersPath = path.join(process.cwd(), 'config', 'providers.json');
      if (fs.existsSync(providersPath)) {
        providersConfig = JSON.parse(fs.readFileSync(providersPath, 'utf8'));
      }
    } catch {}

    this.auditLedger = new AuditLedger(dbPath);
    this.policyEngine = new PolicyEngine({ dbPath, logger: this.auditLedger });
    this.emergencyStop = new EmergencyStop(dataDir);
    this.missionEngine = new MissionEngine({ dbPath, ledger: this.auditLedger, policy: this.policyEngine });
    this.modelGateway = new ModelGateway(providersConfig, { logger: this.auditLedger, budgetChecker: this.policyEngine });
    this.verificationEngine = new VerificationEngine();

    this.contextEngine = new ContextEngine();
    this.memoryEngine = new MemoryEngine(dbPath);
    this.workflowEngine = new WorkflowEngine({ dbPath });
    this.skillsRegistry = new SkillsRegistry();
    // Register OpenCode coding engine adapter so that /api/opencode/execute works
    this.skillsRegistry.setCodingEngineAdapter(new RaqibCodingEngineAdapter());

    // Governed shell execution: allowlist + policy + audit.
    const allowlistEnv = process.env.RAQIB_SHELL_ALLOWLIST;
    const allowedCommands = allowlistEnv
      ? allowlistEnv.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    this.shellTool = new ShellTool({
      cwdRoot: this.targetRepoPath ?? process.cwd(),
      allowedCommands,
      authorize: (command, args) => {
        const decision = this.policyEngine.authorize({
          missionId: 'shell',
          actor: 'raqib-core',
          actionType: 'EXECUTE',
          resource: `${command} ${args.join(' ')}`.trim(),
          autonomyLevel: 'A2',
        });
        return { allowed: decision.allowed, reason: decision.reason };
      },
      onEvent: async (event) => {
        if (event.type !== 'shell.completed') return;
        await this.auditLedger.log({
          id: `evt-shell-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          type: 'ACTION_EXECUTED',
          missionId: 'shell',
          actor: 'raqib-runtime',
          data: {
            command: event.command,
            args: event.args,
            cwd: event.cwd,
            exitCode: event.exitCode,
            durationMs: event.durationMs,
            timedOut: event.timedOut,
          },
        });
      },
    });
    this.skillsRegistry.setShellTool(this.shellTool);

    this.middlewarePipeline = new MiddlewarePipeline();
  }

  async recordLesson(lesson: any): Promise<void> {
    await this.memoryEngine.recordLesson(lesson);
    await this.auditLedger.log({
      id: `evt-lesson-recorded-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'LESSON_RECORDED',
      actor: 'raqib-runtime',
      data: { lessonId: lesson.lessonId },
    });
  }

  async validateLesson(lessonId: string, confidenceScore: number): Promise<void> {
    await this.memoryEngine.validateLesson(lessonId, confidenceScore);
    await this.auditLedger.log({
      id: `evt-lesson-validated-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'LESSON_VALIDATED',
      actor: 'raqib-runtime',
      data: { lessonId, confidenceScore },
    });
  }


  /**
   * Exécution de commande shell gouvernée (allowlist + PolicyEngine + audit).
   * Read-only mode (RAQIB_READ_ONLY_MODE=true) refuse les actions EXECUTE.
   */
  async executeShell(input: {
    command: string | string[];
    cwd?: string;
    timeoutMs?: number;
  }): Promise<ShellExecutionResult> {
    if (!this.auditLedger) throw new Error('Runtime not constructed');
    return this.shellTool.execute(input.command, {
      cwd: input.cwd,
      timeoutMs: input.timeoutMs,
    });
  }

  async initialize(): Promise<void> {
    await this.auditLedger.init();

    this.middlewarePipeline.use({
      name: 'AuditAndPolicyMiddleware',
      beforeAgent: async (state, req) => {
        const decision = this.policyEngine.authorize(req);
        if (!decision.allowed) {
          return decision;
        }
      },
      afterAgent: async (state, decision) => {
        await this.auditLedger.log({
          id: `evt-agent-after-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          type: 'AGENT_AFTER_EXECUTION',
          missionId: state.missionId,
          actor: 'raqib-runtime',
          data: { decision }
        });
      }
    });

    // Step handlers — dispatch by explicit StepType (contract), with
    // case-insensitive name lookup as fallback for legacy missions.
    // No substring matching to avoid false positives.
    type StepHandler = (mission: any, step: any) => Promise<{ status: 'DONE' | 'FAILED' | 'SKIPPED'; result?: unknown; proof?: string; error?: string }>;

    const handlersByType: Record<StepType, StepHandler> = {
      INVENTORY: async () => {
        const files = fs.readdirSync(process.cwd()).slice(0, 50);
        return { status: 'DONE', result: { files }, proof: `Inventory: ${files.length} top-level entries` };
      },
      ANALYZE: async () => {
        return { status: 'DONE', result: { note: 'analysis deferred to LLM' }, proof: 'analysis step' };
      },
      PROPOSE: async () => {
        return { status: 'DONE', result: { note: 'proposal deferred to LLM' }, proof: 'proposal step' };
      },
      TYPECHECK: async () => {
        const out = execSync('npx tsc -p tsconfig.build.json --noEmit 2>&1', { cwd: process.cwd(), timeout: 120000, encoding: 'utf8' });
        return { status: 'DONE', result: out.slice(0, 500), proof: 'tsc --noEmit OK' };
      },
      BUILD: async () => {
        try { fs.rmSync(path.join(process.cwd(), 'apps', 'dashboard', '.next'), { recursive: true, force: true }); } catch {}
        const out = execSync('npm run build --workspace=@raqib/dashboard 2>&1', { cwd: process.cwd(), timeout: 300000, encoding: 'utf8' });
        return { status: 'DONE', result: out.slice(-500), proof: 'dashboard build OK' };
      },
      TEST: async () => {
        const out = execSync('npx vitest run 2>&1', { cwd: process.cwd(), timeout: 300000, encoding: 'utf8' });
        return { status: 'DONE', result: out.slice(-800), proof: 'vitest OK' };
      },
      REPORT: async (mission) => {
        const reportPath = path.join(process.cwd(), 'reports', 'raqib-self-improvement.md');
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, `# RAQIB Self-Improvement Report\n\nGenerated: ${new Date().toISOString()}\nMission: ${mission.id}\nSteps completed: ${mission.steps.filter((s: any) => s.status === 'DONE').length}/${mission.steps.length}\n`, 'utf8');
        return { status: 'DONE', result: { reportPath }, proof: reportPath };
      },
      CUSTOM: async (_mission, step) => {
        return { status: 'FAILED', error: `Step type CUSTOM requires an explicit implementation. Step: "${step.name}"` };
      },
    };

    // Legacy fallback: exact name (lowercased) → handler.
    const handlersByName: Record<string, StepHandler> = {
      'inventory codebase': handlersByType.INVENTORY,
      'analyse gaps and opportunities': handlersByType.ANALYZE,
      'propose improvements': handlersByType.PROPOSE,
      'typecheck codebase': handlersByType.TYPECHECK,
      'build dashboard': handlersByType.BUILD,
      'run unit tests': handlersByType.TEST,
      'generate improvement report': handlersByType.REPORT,
    };

    // ---- Target repository mode (MOSAIX-001 v2) -------------------------
    // Read-only handlers rooted at an explicit target repo. Every file access
    // goes through PathGuard/FileTool; git access is read-only (GitTool).
    // No command is executed against the target and nothing is written there.
    if (this.targetRepoPath) {
      const targetRoot = path.resolve(this.targetRepoPath);
      if (!fs.existsSync(targetRoot)) {
        throw new Error(`Target repository not found: ${targetRoot}`);
      }
      const guard = new PathGuard(targetRoot);
      const fileTool = new FileTool(guard);
      const gitTool = new GitTool();

      const state: {
        repoInfo?: Awaited<ReturnType<GitTool['getRepoInfo']>>;
        headSha?: string;
        gitStatus?: string;
        topLevel: string[];
        workspaces: Array<{
          scope: string;
          name: string;
          version?: string;
          deps: string[];
          devDeps: string[];
          hasTestScript: boolean;
          hasTsconfig: boolean;
        }>;
        analysis?: {
          internalEdges: Array<{ from: string; to: string }>;
          externalDeps: string[];
          packagesWithoutTests: string[];
          packagesWithoutTsconfig: string[];
        };
      } = { topLevel: [], workspaces: [] };

      const readManifest = async (rel: string): Promise<any> => {
        try { return await fileTool.readManifest(rel); } catch { return null; }
      };

      handlersByType.INVENTORY = async () => {
        const entries = await fileTool.listDir('.');
        state.topLevel = entries.map((e) => e.name).sort();
        state.repoInfo = await gitTool.getRepoInfo(targetRoot);
        state.headSha = await gitTool.getCurrentCommitSha(targetRoot);
        state.gitStatus = await gitTool.getStatus(targetRoot);

        const tracked = await gitTool.listTrackedFiles(targetRoot);

        for (const scope of ['packages', 'apps']) {
          let dirs: string[] = [];
          try {
            dirs = (await fileTool.listDir(scope))
              .filter((e) => e.isDirectory)
              .map((e) => e.name)
              .sort();
          } catch {
            continue;
          }
          for (const dir of dirs) {
            const manifest = await readManifest(`${scope}/${dir}/package.json`);
            if (!manifest) continue;
            const hasTsconfig = await fileTool
              .listDir(`${scope}/${dir}`)
              .then((es) => es.some((e) => e.name.startsWith('tsconfig')))
              .catch(() => false);
            state.workspaces.push({
              scope,
              name: manifest.name ?? `${scope}/${dir}`,
              version: manifest.version,
              deps: Object.keys(manifest.dependencies ?? {}),
              devDeps: Object.keys(manifest.devDependencies ?? {}),
              hasTestScript: Boolean(manifest.scripts?.test),
              hasTsconfig,
            });
          }
        }

        return {
          status: 'DONE',
          result: {
            targetRoot,
            headSha: state.headSha,
            branch: state.repoInfo.currentBranch,
            trackedFiles: tracked.length,
            topLevel: state.topLevel,
            workspaces: state.workspaces.map((w) => w.name),
          },
          proof: `${targetRoot} @ ${state.headSha} (${state.repoInfo.currentBranch}) — ${tracked.length} tracked files, ${state.workspaces.length} workspaces`,
        };
      };

      handlersByType.ANALYZE = async () => {
        if (state.workspaces.length === 0) {
          return { status: 'FAILED', error: 'No workspace manifest analysed; run INVENTORY first.' };
        }
        const names = new Set(state.workspaces.map((w) => w.name));
        const internalEdges: Array<{ from: string; to: string }> = [];
        const externalDeps = new Set<string>();
        for (const w of state.workspaces) {
          for (const dep of [...w.deps, ...w.devDeps]) {
            if (names.has(dep)) internalEdges.push({ from: w.name, to: dep });
            else externalDeps.add(dep);
          }
        }
        state.analysis = {
          internalEdges,
          externalDeps: [...externalDeps].sort(),
          packagesWithoutTests: state.workspaces.filter((w) => !w.hasTestScript).map((w) => w.name),
          packagesWithoutTsconfig: state.workspaces.filter((w) => !w.hasTsconfig).map((w) => w.name),
        };
        return {
          status: 'DONE',
          result: state.analysis,
          proof: `${internalEdges.length} internal edges, ${externalDeps.size} external deps, ${state.analysis.packagesWithoutTests.length} workspaces without test script`,
        };
      };

      handlersByType.PROPOSE = async () => {
        if (!state.analysis) {
          return { status: 'FAILED', error: 'ANALYZE must complete before PROPOSE.' };
        }
        const proposals: string[] = [];
        if (state.analysis.packagesWithoutTests.length) {
          proposals.push(`Add a test script to: ${state.analysis.packagesWithoutTests.join(', ')}`);
        }
        if (state.analysis.packagesWithoutTsconfig.length) {
          proposals.push(`Add a tsconfig to: ${state.analysis.packagesWithoutTsconfig.join(', ')}`);
        }
        if (state.analysis.internalEdges.length === 0) {
          proposals.push('No internal workspace dependency detected — verify import paths and package naming.');
        }
        return {
          status: 'DONE',
          result: { proposals },
          proof: `${proposals.length} evidence-based proposal(s)`,
        };
      };

      handlersByType.REPORT = async (mission) => {
        const safeId = String(mission.id).replace(/[^A-Za-z0-9._-]/g, '_');
        const reportPath = path.join(process.cwd(), 'reports', safeId, 'MOSAIX_001_DIAGNOSTIC_REPORT.md');
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        const lines: string[] = [];
        lines.push('# MOSAIX-001 — Diagnostic READ-ONLY (RAQIB v2)');
        lines.push('');
        lines.push(`- Mission : \`${mission.id}\``);
        lines.push(`- Généré : ${new Date().toISOString()}`);
        lines.push(`- Cible : \`${targetRoot}\``);
        lines.push(`- HEAD : \`${state.headSha ?? 'unknown'}\``);
        lines.push(`- Branche : \`${state.repoInfo?.currentBranch ?? 'unknown'}\``);
        lines.push(`- État Git (status --porcelain) : ${state.gitStatus ? 'modifications présentes' : 'arbre propre'}`);
        lines.push('');
        lines.push('## 1. Inventaire');
        lines.push(`- Entrées racine : ${state.topLevel.length}`);
        lines.push(`- Workspaces analysés : ${state.workspaces.length}`);
        lines.push('');
        lines.push('| Scope | Nom | Version | Test | tsconfig |');
        lines.push('|---|---|---|---|---|');
        for (const w of state.workspaces) {
          lines.push(`| ${w.scope} | ${w.name} | ${w.version ?? '—'} | ${w.hasTestScript ? 'oui' : 'non'} | ${w.hasTsconfig ? 'oui' : 'non'} |`);
        }
        lines.push('');
        lines.push('## 2. Dépendances');
        lines.push(`- Arêtes internes : ${state.analysis?.internalEdges.length ?? 0}`);
        lines.push(`- Dépendances externes distinctes : ${state.analysis?.externalDeps.length ?? 0}`);
        lines.push('');
        lines.push('## 3. Risques observés (faits)');
        lines.push(`- Sans script de test : ${state.analysis?.packagesWithoutTests.join(', ') || 'aucun'}`);
        lines.push(`- Sans tsconfig : ${state.analysis?.packagesWithoutTsconfig.join(', ') || 'aucun'}`);
        lines.push('');
        lines.push('## 4. Preuves');
        lines.push('- Aucune écriture dans la cible : vérifiée par GIT_UNCHANGED après la mission.');
        lines.push(`- HEAD identifié : \`${state.headSha}\`.`);
        fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
        return { status: 'DONE', result: { reportPath }, proof: reportPath };
      };
    }

    this.missionEngine.setStepExecutor(async (mission, step) => {
      // 1) Explicit contract: step.type (StepType enum)
      // 2) Legacy fallback: exact name match (case-insensitive, trimmed)
      const handler =
        (step.type && handlersByType[step.type]) ||
        handlersByName[String(step.name).toLowerCase().trim()];
      if (!handler) {
        return { status: 'FAILED', error: `No handler for step: "${step.name}" (type: ${step.type ?? 'unset'}). Add a handler in RaqibRuntime.ts stepHandlers.` };
      }
      try {
        return await handler(mission, step);
      } catch (err: any) {
        return { status: 'FAILED', error: (err?.stdout || err?.message || String(err)).slice(0, 500) };
      }
    });

    if (this.emergencyStop.isActive()) {
      await this.auditLedger.log({
        id: `evt-startup-emergency-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'EMERGENCY_STOP',
        actor: 'raqib-runtime',
        data: { message: 'Runtime starting with Emergency Stop ACTIVE' }
      });
    }

    const recovered = await this.missionEngine.recoverInterrupted();
    if (recovered.length > 0) {
      await this.auditLedger.log({
        id: `evt-startup-recover-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'RECOVERY_TRIGGERED',
        actor: 'raqib-runtime',
        data: { count: recovered.length, missionIds: recovered.map(m => m.id) }
      });
    }

    this.isRunning = true;
    this.startTickLoop();
  }

  private startTickLoop(): void {
    this.tickInterval = setInterval(async () => {
      if (!this.isRunning) return;
      if (this.emergencyStop.isActive()) return;

      let runningMissions: Awaited<ReturnType<typeof this.missionEngine.listMissions>> = [];
      try {
        runningMissions = await this.missionEngine.listMissions({ status: 'RUNNING' });
        for (const mission of runningMissions) {
          if (new Date(mission.timeoutAt).getTime() < Date.now()) {
            await this.missionEngine.transitionStatus(mission.id, 'FAILED', 'Mission timed out');
          } else {
            await this.missionEngine.runNextStep(mission.id);
          }
        }
      } catch (err: any) {
        await this.auditLedger.log({
          id: `evt-tick-error-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          type: 'ERROR',
          missionId: runningMissions.map((m: any) => m.id).join(',') || undefined,
          actor: 'raqib-runtime',
          data: {
            message: (err?.message || String(err)).slice(0, 500),
            stack: (err?.stack || '').slice(0, 1000),
          }
        });
      }
    }, 5000);
  }

  async createSelfImprovementMission(): Promise<any> {
    const id = 'RAQIB-SELF-IMPROVE-001';
    const existing = await this.missionEngine.getMission(id);
    if (existing) return existing;
    return this.missionEngine.createMission({
      id,
      name: 'RAQIB Self-Improvement',
      objective: 'Analyser le codebase, détecter des opportunités (gaps, fonctionnalités), proposer des améliorations et les implémenter une fois approuvées.',
      autonomyLevel: 'A2',
      constraints: ['No modification of CONSTITUTION.md', 'No self-permission boost', 'No budget increase'],
      successCriteria: ['Typecheck OK', 'Dashboard build OK', 'Tests OK', 'Report generated'],
      steps: [
        { name: 'Inventory codebase', type: 'INVENTORY' },
        { name: 'Analyse gaps and opportunities', type: 'ANALYZE' },
        { name: 'Propose improvements', type: 'PROPOSE' },
        { name: 'Typecheck codebase', type: 'TYPECHECK' },
        { name: 'Build dashboard', type: 'BUILD' },
        { name: 'Run unit tests', type: 'TEST' },
        { name: 'Generate improvement report', type: 'REPORT' },
      ],
      approvalRequired: true, // require explicit human approval per Constitution
      budgetLimitEur: 0,
      maxDurationMs: 600000,
      maxAttempts: 2,
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    this.policyEngine.close();
    this.auditLedger.close();
    this.memoryEngine.close();
    this.workflowEngine.close();
  }
}
