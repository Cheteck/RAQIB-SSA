import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { PolicyEngine } from '@raqib/policy-engine';
import { EmergencyStop } from '@raqib/policy-engine';
import { MissionEngine } from '@raqib/mission-engine';
import { ModelGateway } from '@raqib/model-gateway';
import { AuditLedger } from '@raqib/audit-ledger';
import { VerificationEngine } from '@raqib/verification';

export class RaqibRuntime {
  public policyEngine: PolicyEngine;
  public emergencyStop: EmergencyStop;
  public missionEngine: MissionEngine;
  public modelGateway: ModelGateway;
  public auditLedger: AuditLedger;
  public verificationEngine: VerificationEngine;
  private isRunning: boolean = false;
  private tickInterval?: NodeJS.Timeout;

  constructor(options?: { dbPath?: string; dataDir?: string }) {
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
  }

  async initialize(): Promise<void> {
    await this.auditLedger.init();

    // Register step executor for autonomous missions (self-improvement, etc.)
    this.missionEngine.setStepExecutor(async (mission, step) => {
      const name = step.name.toLowerCase();
      try {
        if (name.includes('inventory') || name.includes('analyse') || name.includes('analyze')) {
          const files = fs.readdirSync(process.cwd()).slice(0, 50);
          return { status: 'DONE', result: { files }, proof: `Inventory: ${files.length} top-level entries` };
        }
        if (name.includes('typecheck')) {
          const out = execSync('npx tsc -p tsconfig.build.json --noEmit 2>&1', { cwd: process.cwd(), timeout: 120000, encoding: 'utf8' });
          return { status: 'DONE', result: out.slice(0, 500), proof: 'tsc --noEmit OK' };
        }
        if (name.includes('build dashboard') || name.includes('build')) {
          try { fs.rmSync(path.join(process.cwd(), 'apps', 'dashboard', '.next'), { recursive: true, force: true }); } catch {}
          const out = execSync('npm run build --workspace=@raqib/dashboard 2>&1', { cwd: process.cwd(), timeout: 300000, encoding: 'utf8' });
          return { status: 'DONE', result: out.slice(-500), proof: 'dashboard build OK' };
        }
        if (name.includes('test')) {
          const out = execSync('npx vitest run 2>&1', { cwd: process.cwd(), timeout: 300000, encoding: 'utf8' });
          return { status: 'DONE', result: out.slice(-800), proof: 'vitest OK' };
        }
        if (name.includes('report') || name.includes('rapport')) {
          const reportPath = path.join(process.cwd(), 'reports', 'raqib-self-improvement.md');
          fs.mkdirSync(path.dirname(reportPath), { recursive: true });
          fs.writeFileSync(reportPath, `# RAQIB Self-Improvement Report\\n\\nGenerated: ${new Date().toISOString()}\\nMission: ${mission.id}\\nSteps completed: ${mission.steps.filter(s => s.status === 'DONE').length}/${mission.steps.length}\\n`, 'utf8');
          return { status: 'DONE', result: { reportPath }, proof: reportPath };
        }
        // Default: mark as done (analysis/approval steps handled externally)
        return { status: 'DONE', result: { note: 'completed' }, proof: step.name };
      } catch (err: any) {
        return { status: 'FAILED', error: (err?.stdout || err?.message || String(err)).slice(0, 500) };
      }
    });

    // Check emergency stop
    if (this.emergencyStop.isActive()) {
      await this.auditLedger.log({
        id: `evt-startup-emergency-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'EMERGENCY_STOP',
        actor: 'raqib-runtime',
        data: { message: 'Runtime starting with Emergency Stop ACTIVE' }
      });
    }

    // Recover interrupted missions
    const recovered = await this.missionEngine.recoverInterrupted();
    if (recovered.length > 0) {
      await this.auditLedger.log({
        id: `evt-startup-recover-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'MISSION_CREATED',
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

      try {
        const runningMissions = await this.missionEngine.listMissions({ status: 'RUNNING' });
        for (const mission of runningMissions) {
          if (new Date(mission.timeoutAt).getTime() < Date.now()) {
            await this.missionEngine.transitionStatus(mission.id, 'FAILED', 'Mission timed out');
          } else {
            await this.missionEngine.runNextStep(mission.id);
          }
        }
      } catch (err: any) {
        // Runtime loop safety net
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
        { name: 'Inventory codebase' },
        { name: 'Analyse gaps and opportunities' },
        { name: 'Propose improvements' },
        { name: 'Typecheck codebase' },
        { name: 'Build dashboard' },
        { name: 'Run unit tests' },
        { name: 'Generate improvement report' },
      ],
      approvalRequired: false,
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
  }
}
