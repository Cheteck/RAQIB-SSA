import Database from 'better-sqlite3';
import crypto from 'crypto';
import { Mission, MissionStep, Evidence, MissionResult } from '@raqib/core';
import { MissionExecutionContext, MissionPriority } from '@raqib/core';
import { MissionSchema } from '@raqib/core';
import { AuditLedger, AuditFilters } from '@raqib/audit-ledger';
import { PolicyEngine, PolicyRequest } from '@raqib/policy-engine';
import { MissionStatus, AuditEvent, AuditEventType, StepType, VerificationVerdict, StructuredVerificationReport } from '@raqib/shared';
import { assertTransition } from './StateMachine';
import { InvalidArgumentError, InvalidTransitionError, NotFoundError } from './errors';
import { VerificationEngine } from '@raqib/verification';

export interface MissionSpec {
  id: string;
  name: string;
  title?: string;
  description?: string;
  priority?: MissionPriority;
  objective: string;
  autonomyLevel: 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
  constraints: string[];
  successCriteria: string[];
  steps: Array<{ name: string; type?: StepType; maxAttempts?: number }>;
  approvalRequired: boolean;
  budgetLimitEur: number;
  maxDurationMs: number;
  maxAttempts: number;
  executionContext?: Partial<MissionExecutionContext>;
  dependsOn?: string[];
  assignedSubagentId?: string;
  assignedSubagentName?: string;
  assignedBy?: string;
}

export interface MissionFilters {
  status?: MissionStatus;
  subagentId?: string;
}

export interface StepResult {
  missionId: string;
  stepIndex: number;
  stepName: string;
  status: 'DONE' | 'FAILED' | 'BLOCKED' | 'SKIPPED' | 'UNKNOWN';
  executed: boolean;
  detail?: string;
}

interface StepExecutor {
  (mission: Mission, step: MissionStep): Promise<{
    status: 'DONE' | 'FAILED' | 'SKIPPED' | 'UNKNOWN';
    result?: unknown;
    proof?: string;
    error?: string;
  }>;
}

export class MissionEngine {
  private db: Database.Database;
  private ledger: AuditLedger;
  private policy: PolicyEngine;
  private verificationEngine: VerificationEngine;
  private executor: StepExecutor | null = null;

  constructor(options: {
    dbPath: string;
    ledger: AuditLedger;
    policy: PolicyEngine;
  }) {
    this.ledger = options.ledger;
    this.policy = options.policy;
    this.verificationEngine = new VerificationEngine();
    this.db = new Database(options.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS missions (
        id        TEXT PRIMARY KEY,
        status    TEXT NOT NULL,
        data      TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );
      CREATE TABLE IF NOT EXISTS mission_steps (
        id         TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id),
        step_index INTEGER NOT NULL,
        status     TEXT NOT NULL,
        data       TEXT NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_steps_mission ON mission_steps(mission_id);
    `);
  }

  /** Enregistre la fonction qui exécute concrètement une étape (injectée par le runtime). */
  setStepExecutor(executor: StepExecutor): void {
    this.executor = executor;
  }

  // ------------------------------------------------------------------ CRUD

  /**
   * G4 — Canonicalisation déterministe d'un plan de mission.
   * Trie les clés des objets (pas les tableaux dont l'ordre est significatif).
   */
  private canonicalizeMissionPlan(plan: {
    missionId: string;
    planId: string;
    version: number;
    summary: string;
    scope: { targetFiles: string[]; allowedActions: string[] };
    stepPlan: Array<{ stepIndex: number; name: string; type?: string; riskLevel: string; expectedOutput: string }>;
    riskAnalysis: string[];
    successCriteria: string[];
    estimatedBudgetCents: number;
  }): string {
    const sorted = {
      missionId: plan.missionId,
      planId: plan.planId,
      version: plan.version,
      summary: plan.summary,
      scope: {
        targetFiles: [...plan.scope.targetFiles].sort(),
        allowedActions: [...plan.scope.allowedActions].sort(),
      },
      stepPlan: plan.stepPlan.map((s) => ({
        stepIndex: s.stepIndex,
        name: s.name,
        type: s.type ?? '',
        riskLevel: s.riskLevel,
        expectedOutput: s.expectedOutput,
      })),
      riskAnalysis: [...plan.riskAnalysis].sort(),
      successCriteria: [...plan.successCriteria].sort(),
      estimatedBudgetCents: plan.estimatedBudgetCents,
    };
    return JSON.stringify(sorted, Object.keys(sorted).sort());
  }

  /**
   * G4 — Calcul du hash SHA-256 d'un plan canonicalisé.
   */
  private computePlanHash(canonicalized: string): string {
    return crypto.createHash('sha256').update(canonicalized, 'utf8').digest('hex');
  }

  async createMission(spec: MissionSpec): Promise<Mission> {
    if (this.db.prepare('SELECT 1 FROM missions WHERE id = ?').get(spec.id)) {
      throw new Error(`Mission ${spec.id} already exists`);
    }

    const now = new Date().toISOString();
    const steps: MissionStep[] = spec.steps.map((s, i) => {
      const stepId = `${spec.id}-step-${i}`;
      return {
        id: stepId,
        name: s.name,
        type: s.type,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: s.maxAttempts ?? spec.maxAttempts,
        idempotencyKey: `${spec.id}:${stepId}`,
        executionRecorded: false,
      };
    });

    const normalizedContext: MissionExecutionContext = {
      projectPath: spec.executionContext?.projectPath,
      files: [...(spec.executionContext?.files ?? [])],
      instructions: [...(spec.executionContext?.instructions ?? [])],
      constraints: [
        ...(spec.executionContext?.constraints ?? []),
        // Les contraintes de haut niveau restent visibles dans le contexte agent.
        ...spec.constraints,
      ],
      inheritedContext: spec.executionContext?.inheritedContext,
    };

    const mission: Mission = {
      id: spec.id,
      name: spec.name,
      title: spec.title ?? spec.name,
      description: spec.description,
      priority: spec.priority ?? 'MEDIUM',
      status: spec.approvalRequired ? 'PLANNED' : 'APPROVED',
      autonomyLevel: spec.autonomyLevel,
      objective: spec.objective,
      constraints: spec.constraints,
      successCriteria: spec.successCriteria,
      steps,
      currentStepIndex: 0,
      approvalRequired: spec.approvalRequired,
      budgetLimitEur: spec.budgetLimitEur,
      budgetUsedEur: 0,
      maxDurationMs: spec.maxDurationMs,
      maxAttempts: spec.maxAttempts,
      timeoutAt: new Date(Date.now() + spec.maxDurationMs).toISOString(),
      createdAt: now,
      evidences: [],
      executionContext: normalizedContext,
      contextLog: [],
      dependsOn: spec.dependsOn ?? [],
      statusHistory: [{ status: spec.approvalRequired ? 'PLANNED' : 'APPROVED', timestamp: now, reason: 'Mission créée', actor: 'raqib-core' }],
    };

    if (spec.executionContext) {
      mission.contextLog = [
        {
          version: 1,
          timestamp: now,
          updatedBy: spec.assignedBy ?? 'raqib-core',
          note: 'Contexte initial de la mission',
          patch: normalizedContext,
        },
      ];
    }

    if (spec.assignedSubagentId) {
      mission.assignedSubagentId = spec.assignedSubagentId;
      mission.assignedSubagentName = spec.assignedSubagentName;
      mission.assignedAt = now;
      mission.assignedBy = spec.assignedBy ?? 'raqib-core';
    }

    // G4 — Génération automatique de l'artefact de plan si approvalRequired
    if (spec.approvalRequired) {
      const planId = `plan-${spec.id}-v1`;
      const planPayload = {
        missionId: spec.id,
        planId,
        version: 1,
        createdAt: now,
        summary: spec.objective,
        scope: {
          targetFiles: spec.constraints.filter((c) => c.startsWith('file:')).map((c) => c.replace('file:', '')),
          allowedActions: ['TYPECHECK', 'BUILD', 'TEST'],
        },
        stepPlan: steps.map((s, i) => ({
          stepIndex: i,
          name: s.name,
          type: s.type,
          riskLevel: 'MEDIUM' as const,
          expectedOutput: `Completion of ${s.name}`,
        })),
        riskAnalysis: ['Dependency resolution may fail', 'Docker sandbox may be unavailable'],
        successCriteria: spec.successCriteria,
        estimatedBudgetCents: Math.round(spec.budgetLimitEur * 100),
      };
      const canonicalized = this.canonicalizeMissionPlan(planPayload);
      const contentHash = this.computePlanHash(canonicalized);
      mission.planArtifact = { ...planPayload, contentHash };
    }

    this.persist(mission);
    await this.ledger.log({
      id: `evt-mission-created-${spec.id}-${Date.now()}`,
      timestamp: now,
      type: 'MISSION_CREATED',
      missionId: spec.id,
      actor: 'raqib-core',
      data: { status: mission.status, steps: steps.length, planGenerated: !!mission.planArtifact },
    });

    if (mission.planArtifact) {
      await this.ledger.log({
        id: `evt-plan-generated-${spec.id}-${Date.now()}`,
        timestamp: now,
        type: 'PLAN_GENERATED',
        missionId: spec.id,
        schemaVersion: 1,
        actor: 'raqib-core',
        data: { planId: mission.planArtifact.planId, contentHash: mission.planArtifact.contentHash },
      });
    }

    return mission;
  }

  async getMission(id: string): Promise<Mission | null> {
    const row = this.db
      .prepare('SELECT data FROM missions WHERE id = ?')
      .get(id) as { data: string } | undefined;
    if (!row) return null;
    return this.validateAndReturn(JSON.parse(row.data));
  }

  async listMissions(filters: MissionFilters = {}): Promise<Mission[]> {
    let rows: Array<{ data: string }>;
    if (filters.status) {
      rows = this.db
        .prepare('SELECT data FROM missions WHERE status = ?')
        .all(filters.status) as Array<{ data: string }>;
    } else {
      rows = this.db.prepare('SELECT data FROM missions').all() as Array<{
        data: string;
      }>;
    }
    const missions = rows.map((r) => this.validateAndReturn(JSON.parse(r.data)));
    if (filters.subagentId) {
      return missions.filter((m) => m.assignedSubagentId === filters.subagentId);
    }
    return missions;
  }

  async listBySubagent(subagentId: string): Promise<Mission[]> {
    return this.listMissions({ subagentId });
  }

  // -------------------------------------------------- Affectation & contexte

  /**
   * Attribue (ou réattribue) la mission à un sous-agent.
   * L'affectation est tracée dans l'audit et dans le journal de statut.
   */
  async assignMission(
    missionId: string,
    input: { subagentId: string; subagentName?: string; assignedBy?: string },
  ): Promise<Mission> {
    const mission = await this.getMission(missionId);
    if (!mission) throw new NotFoundError(`Mission ${missionId} not found`);
    if (!input.subagentId) throw new InvalidArgumentError('subagentId is required');
    if (['SUCCEEDED', 'FAILED', 'CANCELLED', 'REJECTED'].includes(mission.status)) {
      throw new InvalidTransitionError(
        `Cannot assign mission ${missionId} in terminal status ${mission.status}`,
      );
    }

    const now = new Date().toISOString();
    const previous = mission.assignedSubagentId;
    mission.assignedSubagentId = input.subagentId;
    mission.assignedSubagentName = input.subagentName;
    mission.assignedAt = now;
    mission.assignedBy = input.assignedBy ?? 'operator';
    mission.statusHistory = [
      ...(mission.statusHistory ?? []),
      {
        status: mission.status,
        timestamp: now,
        reason: previous && previous !== input.subagentId
          ? `Réattribution de ${previous} vers ${input.subagentId}`
          : `Attribution à ${input.subagentId}`,
        actor: mission.assignedBy,
      },
    ];
    this.persist(mission);

    await this.ledger.log({
      id: `evt-mission-assigned-${missionId}-${Date.now()}`,
      timestamp: now,
      type: 'MISSION_ASSIGNED',
      missionId,
      actor: mission.assignedBy,
      schemaVersion: 1,
      data: {
        subagentId: input.subagentId,
        subagentName: input.subagentName,
        previousSubagentId: previous,
      },
    });

    return mission;
  }

  /** Retire l'affectation sans supprimer la mission ni son historique. */
  async unassignMission(
    missionId: string,
    input: { reason?: string; unassignedBy?: string } = {},
  ): Promise<Mission> {
    const mission = await this.getMission(missionId);
    if (!mission) throw new NotFoundError(`Mission ${missionId} not found`);

    const previous = mission.assignedSubagentId;
    if (!previous) return mission;

    const now = new Date().toISOString();
    const actor = input.unassignedBy ?? 'operator';
    mission.assignedSubagentId = undefined;
    mission.assignedSubagentName = undefined;
    mission.assignedAt = undefined;
    mission.assignedBy = undefined;
    mission.statusHistory = [
      ...(mission.statusHistory ?? []),
      {
        status: mission.status,
        timestamp: now,
        reason: input.reason ?? `Désattribution de ${previous}`,
        actor,
      },
    ];
    this.persist(mission);

    await this.ledger.log({
      id: `evt-mission-unassigned-${missionId}-${Date.now()}`,
      timestamp: now,
      type: 'MISSION_UNASSIGNED',
      missionId,
      actor,
      schemaVersion: 1,
      data: { previousSubagentId: previous, reason: input.reason },
    });

    return mission;
  }

  /**
   * Complète le contexte d'exécution sans perdre l'historique.
   * Chaque appel ajoute une entrée versionnée (append-only) et fusionne
   * les tableaux en dédupliquant les valeurs déjà présentes.
   */
  async updateContext(
    missionId: string,
    patch: Partial<MissionExecutionContext>,
    options: { updatedBy?: string; note?: string } = {},
  ): Promise<Mission> {
    const mission = await this.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    const current: MissionExecutionContext = {
      projectPath: mission.executionContext?.projectPath,
      files: [...(mission.executionContext?.files ?? [])],
      instructions: [...(mission.executionContext?.instructions ?? [])],
      constraints: [...(mission.executionContext?.constraints ?? [])],
      inheritedContext: mission.executionContext?.inheritedContext,
    };

    const merged: MissionExecutionContext = {
      projectPath: patch.projectPath ?? current.projectPath,
      files: dedupe([...current.files, ...(patch.files ?? [])]),
      instructions: dedupe([...current.instructions, ...(patch.instructions ?? [])]),
      constraints: dedupe([...current.constraints, ...(patch.constraints ?? [])]),
      inheritedContext: patch.inheritedContext
        ? [current.inheritedContext, patch.inheritedContext].filter(Boolean).join('\n\n')
        : current.inheritedContext,
    };

    const log = mission.contextLog ?? [];
    const entry = {
      version: log.length + 1,
      timestamp: new Date().toISOString(),
      updatedBy: options.updatedBy ?? 'operator',
      note: options.note,
      patch: normalizePatch(patch),
    };

    mission.executionContext = merged;
    mission.contextLog = [...log, entry];
    this.persist(mission);

    await this.ledger.log({
      id: `evt-mission-context-${missionId}-${Date.now()}`,
      timestamp: entry.timestamp,
      type: 'MISSION_CONTEXT_UPDATED',
      missionId,
      actor: entry.updatedBy,
      schemaVersion: 1,
      data: { version: entry.version, note: entry.note, patch: entry.patch },
    });

    return mission;
  }

  /** Enregistre les résultats/livrables remontés par le sous-agent. */
  async recordResult(
    missionId: string,
    result: Partial<MissionResult> & { summary?: string },
    options: { recordedBy?: string } = {},
  ): Promise<Mission> {
    const mission = await this.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    const previous = mission.result;
    mission.result = {
      summary: result.summary ?? previous?.summary ?? 'Résultats enregistrés',
      success: result.success ?? previous?.success ?? false,
      artifacts: mergeUnique(previous?.artifacts, result.artifacts),
      metrics: { ...(previous?.metrics ?? {}), ...(result.metrics ?? {}) },
      modifiedFiles: mergeUnique(previous?.modifiedFiles, result.modifiedFiles),
      reports: mergeUnique(previous?.reports, result.reports),
      errors: mergeUnique(previous?.errors, result.errors),
    };
    this.persist(mission);

    const now = new Date().toISOString();
    await this.ledger.log({
      id: `evt-mission-result-${missionId}-${Date.now()}`,
      timestamp: now,
      type: 'MISSION_RESULT_RECORDED',
      missionId,
      actor: options.recordedBy ?? 'raqib-subagent',
      schemaVersion: 1,
      data: {
        success: mission.result.success,
        artifacts: mission.result.artifacts?.length ?? 0,
        modifiedFiles: mission.result.modifiedFiles?.length ?? 0,
        reports: mission.result.reports?.length ?? 0,
        errors: mission.result.errors ?? [],
      },
    });

    return mission;
  }

  // -------------------------------------------------------------- Exécution

  /**
   * Exécute la prochaine étape de la mission.
   * Politique vérifiée AVANT chaque étape ; aucune exécution sans autorisation.
   */
  async runNextStep(missionId: string): Promise<StepResult> {
    const mission = await this.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    if (mission.status !== 'RUNNING') {
      return {
        missionId,
        stepIndex: mission.currentStepIndex,
        stepName: mission.steps[mission.currentStepIndex]?.name ?? 'none',
        status: 'SKIPPED',
        executed: false,
        detail: `Mission not RUNNING (status=${mission.status})`,
      };
    }

    // Timeout global de la mission
    if (Date.now() > new Date(mission.timeoutAt).getTime()) {
      await this.transitionStatus(
        missionId,
        'FAILED',
        'Mission timeout: timeoutAt exceeded',
      );
      return {
        missionId,
        stepIndex: mission.currentStepIndex,
        stepName: mission.steps[mission.currentStepIndex]?.name ?? 'none',
        status: 'BLOCKED',
        executed: false,
        detail: 'Mission timeout exceeded → FAILED',
      };
    }

    const step = mission.steps[mission.currentStepIndex];
    if (!step) {
      // Toutes les étapes sont terminées → VERIFYING
      await this.transitionStatus(
        missionId,
        'VERIFYING',
        'All steps completed → verification',
      );
      return {
        missionId,
        stepIndex: mission.steps.length,
        stepName: '<verification>',
        status: 'DONE',
        executed: false,
        detail: 'All steps done → VERIFYING',
      };
    }

    // Politique : chaque étape est une action soumise au PolicyEngine
    const decision = this.policy.authorize({
      missionId,
      actor: 'raqib-core',
      actionType: mission.autonomyLevel === 'A0' ? 'READ_ONLY_INVENTORY' : 'EXECUTE',
      resource: step.name,
      autonomyLevel: mission.autonomyLevel,
    });

    await this.ledger.log({
      id: `evt-step-policy-${missionId}-${step.id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'POLICY_DECISION',
      missionId,
      actor: 'raqib-core',
      data: { step: step.id, decision: { allowed: decision.allowed, reason: decision.reason } },
    });

    if (!decision.allowed) {
      step.status = 'FAILED';
      step.error = `Policy denied: ${decision.reason}`;
      // Persister l'étape AVANT la transition : transitionStatus relit la
      // mission en base et doit voir l'échec de l'étape (sinon le statut
      // BLOCKED serait écrasé par une copie obsolète encore RUNNING).
      this.persist(this.updateSteps(mission, step));
      await this.transitionStatus(missionId, 'BLOCKED', `Policy denied step ${step.id}: ${decision.reason}`);
      return {
        missionId,
        stepIndex: mission.currentStepIndex,
        stepName: step.name,
        status: 'BLOCKED',
        executed: false,
        detail: decision.reason,
      };
    }

    if (!this.executor) {
      throw new Error('No step executor registered (runtime not initialized)');
    }

    // --- Idempotency guard: if this step was already executed (recorded in
    // audit/ledger), never re-run it even after a crash recovery. ---
    if (step.executionRecorded) {
      step.status = 'DONE';
      // step should already be DONE + currentStepIndex advanced; just skip
      await this.ledger.log({
        id: `evt-step-idempotent-skip-${missionId}-${step.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'ACTION_EXECUTED',
        missionId,
        actor: 'raqib-core',
        data: { step: step.id, status: 'DONE', detail: 'Already recorded — skipped duplicate' },
      });
      mission.currentStepIndex += 1;
      this.persist(this.updateSteps(mission, step));

      if (mission.currentStepIndex >= mission.steps.length) {
        await this.transitionStatus(missionId, 'VERIFYING', 'All steps completed (idempotent)');
      }

      return {
        missionId,
        stepIndex: mission.currentStepIndex - 1,
        stepName: step.name,
        status: 'DONE',
        executed: false,
        detail: 'Already recorded — duplicate execution skipped',
      };
    }

    step.status = 'RUNNING';
    step.startedAt = step.startedAt ?? new Date().toISOString();
    step.attempts += 1;
    this.persist(this.updateSteps(mission, step));

    await this.ledger.log({
      id: `evt-step-started-${missionId}-${step.id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'STEP_STARTED',
      missionId,
      stepId: step.id,
      actor: 'raqib-core',
      schemaVersion: 1,
      data: { step: step.id, attempt: step.attempts },
    });

    const outcome = await this.executor(mission, step);

    if (outcome.status === 'DONE') {
      step.status = 'DONE';
      step.completedAt = new Date().toISOString();
      step.result = outcome.result;
      step.proof = outcome.proof;
      step.executionRecorded = true;  // Mark as durably recorded
      if (outcome.proof) {
        mission.evidences.push({
          type: 'COMMAND_OUTPUT',
          description: `Proof for step ${step.name}`,
          value: outcome.proof,
          timestamp: new Date().toISOString(),
          verified: true,
        });
      }
      mission.currentStepIndex += 1;
      this.persist(this.updateSteps(mission, step));

      await this.ledger.log({
        id: `evt-step-done-${missionId}-${step.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'STEP_COMPLETED',
        missionId,
        stepId: step.id,
        actor: 'raqib-core',
        schemaVersion: 1,
        data: { step: step.id, status: 'DONE', proof: step.proof },
      });

      if (mission.currentStepIndex >= mission.steps.length) {
        await this.transitionStatus(missionId, 'VERIFYING', 'All steps completed');
      }

      return {
        missionId,
        stepIndex: mission.currentStepIndex - 1,
        stepName: step.name,
        status: 'DONE',
        executed: true,
        detail: outcome.proof,
      };
    }

    if (outcome.status === 'SKIPPED') {
      step.status = 'SKIPPED';
      step.completedAt = new Date().toISOString();
      mission.currentStepIndex += 1;
      this.persist(this.updateSteps(mission, step));

      await this.ledger.log({
        id: `evt-step-skipped-${missionId}-${step.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'STEP_COMPLETED',
        missionId,
        stepId: step.id,
        actor: 'raqib-core',
        schemaVersion: 1,
        data: { step: step.id, status: 'SKIPPED' },
      });

      return {
        missionId,
        stepIndex: mission.currentStepIndex - 1,
        stepName: step.name,
        status: 'SKIPPED',
        executed: false,
        detail: 'Skipped',
      };
    }

    // FAILED / UNKNOWN
    if (outcome.status === 'FAILED' || outcome.status === 'UNKNOWN') {
      step.status = outcome.status;
      step.error = outcome.error ?? (outcome.status === 'UNKNOWN' ? 'Step state unknown' : 'Step execution failed');
      this.persist(this.updateSteps(mission, step));

      if (outcome.status === 'UNKNOWN') {
        await this.ledger.log({
          id: `evt-step-unknown-${missionId}-${step.id}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'ERROR',
          missionId,
          actor: 'raqib-core',
          data: { step: step.id, status: 'UNKNOWN', detail: 'Recovery required' },
        });
      } else if (step.attempts >= step.maxAttempts) {
        await this.transitionStatus(
          missionId,
          'BLOCKED',
          `Step ${step.id} failed ${step.attempts}/${step.maxAttempts} attempts`,
        );
      }

      await this.ledger.log({
        id: `evt-step-failed-${missionId}-${step.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'STEP_COMPLETED',
        missionId,
        stepId: step.id,
        actor: 'raqib-core',
        schemaVersion: 1,
        data: { step: step.id, status: outcome.status, error: step.error, attempts: step.attempts },
      });

      return {
        missionId,
        stepIndex: mission.currentStepIndex,
        stepName: step.name,
        status: outcome.status,
        executed: true,
        detail: step.error,
      };
    }

    return {
      missionId,
      stepIndex: mission.currentStepIndex,
      stepName: step.name,
      status: 'SKIPPED',
      executed: false,
      detail: 'Unhandled outcome status',
    };
  }

  /** Reprise après crash : idempotent, repart du currentStepIndex persisté. */
  async resumeMission(missionId: string): Promise<void> {
    const mission = await this.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    if (mission.status === 'RUNNING') {
      // Re-référence l'étape en cours (idempotence : on ne relance jamais une étape DONE)
      const current = mission.steps[mission.currentStepIndex];
      if (current && current.status === 'RUNNING') {
        current.status = 'PENDING';
        current.startedAt = undefined;
        this.persist(this.updateSteps(mission, current));
      }
      await this.ledger.log({
        id: `evt-recovery-${missionId}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'RECOVERY_TRIGGERED',
        missionId,
        actor: 'raqib-core',
        schemaVersion: 1,
        data: { action: 'resume', stepIndex: mission.currentStepIndex },
      });
    }
  }

  async transitionStatus(
    id: string,
    newStatus: MissionStatus,
    reason: string,
    verificationReport?: StructuredVerificationReport,
  ): Promise<Mission> {
    const mission = await this.getMission(id);
    if (!mission) throw new Error(`Mission ${id} not found`);

    // G1 Rule: reaching SUCCEEDED from VERIFYING strictly requires PASS verdict
    if (newStatus === 'SUCCEEDED') {
      if (!verificationReport) {
        throw new Error(`G1 Violation: Cannot transition mission ${id} to SUCCEEDED without a VerificationReport.`);
      }
      if (verificationReport.verdict !== 'PASS') {
        // Automatically redirect to FAILED or BLOCKED based on verdict
        const targetFailStatus = verificationReport.verdict === 'BLOCKED' ? 'BLOCKED' : 'FAILED';
        mission.verificationReport = verificationReport;
        this.persist(mission);
        
        await this.ledger.log({
          id: `evt-verification-result-${id}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'VERIFICATION_RESULT',
          missionId: id,
          actor: 'raqib-verification-engine',
          data: { verdict: verificationReport.verdict, summary: verificationReport.summary, results: verificationReport.results },
        });

        return this.transitionStatus(id, targetFailStatus, `Verification failed with verdict ${verificationReport.verdict}: ${verificationReport.summary}`, verificationReport);
      }
    }

    // G4 Rule: reaching APPROVED from PLANNED / APPROVAL_REQUIRED strictly requires valid plan artifact hash
    if (newStatus === 'APPROVED') {
      if (!mission.planArtifact) {
        throw new Error(`G4 Violation: Cannot approve mission ${id} without a MissionPlanArtifact.`);
      }
      // Re-verify plan integrity hash
      const canonical = this.canonicalizeMissionPlan(mission.planArtifact);
      const recomputedHash = this.computePlanHash(canonical);
      if (recomputedHash !== mission.planArtifact.contentHash) {
        throw new Error(`G4 Violation: Plan content hash mismatch! The plan has been tampered with or modified post-generation.`);
      }
      mission.approvedPlanHash = recomputedHash;
    }

    assertTransition(mission.status, newStatus);

    const fromStatus = mission.status;
    const now = new Date().toISOString();
    mission.status = newStatus;
    if (verificationReport) {
      mission.verificationReport = verificationReport;
    }
    if (newStatus === 'RUNNING') mission.startedAt = mission.startedAt ?? now;
    if (newStatus === 'SUCCEEDED') mission.completedAt = now;
    if (newStatus === 'FAILED') mission.failedAt = now;

    mission.statusHistory = [
      ...(mission.statusHistory ?? []),
      { status: newStatus, timestamp: now, reason, actor: 'raqib-core' },
    ];

    this.persist(mission);

    if (verificationReport) {
      await this.ledger.log({
        id: `evt-verification-result-${id}-${Date.now()}`,
        timestamp: now,
        type: 'VERIFICATION_RESULT',
        missionId: id,
        actor: 'raqib-verification-engine',
        data: { verdict: verificationReport.verdict, summary: verificationReport.summary, results: verificationReport.results },
      });
    }

    let eventType: AuditEventType = 'ACTION_EXECUTED';
    if (newStatus === 'RUNNING') eventType = 'MISSION_STARTED';
    else if (newStatus === 'SUCCEEDED') eventType = 'MISSION_SUCCEEDED';
    else if (newStatus === 'FAILED') eventType = 'MISSION_FAILED';
    else if (newStatus === 'BLOCKED') eventType = 'MISSION_BLOCKED';
    else if (newStatus === 'APPROVED') eventType = 'PLAN_APPROVED';
    else if (newStatus === 'REJECTED') eventType = 'PLAN_REJECTED';

    await this.ledger.log({
      id: `evt-transition-${id}-${Date.now()}`,
      timestamp: now,
      type: eventType,
      missionId: id,
      actor: 'raqib-core',
      schemaVersion: 1,
      data: { from: fromStatus, to: newStatus, reason },
    });

    return mission;
  }

  async cancelMission(missionId: string, reason: string): Promise<void> {
    const mission = await this.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);
    if (mission.status === 'CANCELLED') return; // idempotent
    await this.transitionStatus(missionId, 'CANCELLED', reason);
  }

  /** Au démarrage du runtime : récupère les missions RUNNING interrompues. */
  async recoverInterrupted(): Promise<Mission[]> {
    const missions = await this.listMissions({ status: 'RUNNING' });
    for (const m of missions) {
      await this.resumeMission(m.id);
    }
    return missions;
  }

  async runMissionVerification(missionId: string, checks?: Array<{ id: string; type: 'FILE_EXISTS' | 'GIT_UNCHANGED' | 'COMMAND_EXIT_CODE' | 'BUDGET_BOUND' | 'CUSTOM'; target: string; expected?: unknown }>): Promise<StructuredVerificationReport> {
    const mission = await this.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    // F-03 — ne jamais fabriquer un couple (target, expected) tautologique.
    // Sans check explicite, la vérification est BLOCKED (cf. VerificationEngine).
    const verificationChecks = checks && checks.length > 0 ? checks : [];

    const report = await this.verificationEngine.verifyMission(missionId, verificationChecks);
    return report;
  }

  async verifyAndTransition(missionId: string, checks?: any): Promise<Mission> {
    const report = await this.runMissionVerification(missionId, checks);
    if (report.verdict === 'PASS') {
      return this.transitionStatus(missionId, 'SUCCEEDED', 'Verification passed (PASS verdict)', report);
    } else if (report.verdict === 'BLOCKED') {
      return this.transitionStatus(missionId, 'BLOCKED', `Verification blocked: ${report.summary}`, report);
    } else {
      return this.transitionStatus(missionId, 'FAILED', `Verification failed: ${report.summary}`, report);
    }
  }

  async getAuditTrail(missionId: string, filters?: AuditFilters): Promise<AuditEvent[]> {
    return this.ledger.query({ missionId, ...filters });
  }

  // ------------------------------------------------------------ Persistance

  private persist(mission: Mission): void {
    const validated = MissionSchema.parse(mission);
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO missions (id, status, data, updated_at)
           VALUES (@id, @status, @data, unixepoch())
           ON CONFLICT(id) DO UPDATE SET status=@status, data=@data, updated_at=unixepoch()`,
        )
        .run({
          id: validated.id,
          status: validated.status,
          data: JSON.stringify(validated),
        });

      const upsertStep = this.db.prepare(
        `INSERT INTO mission_steps (id, mission_id, step_index, status, data, updated_at)
         VALUES (@id, @missionId, @stepIndex, @status, @data, unixepoch())
         ON CONFLICT(id) DO UPDATE SET status=@status, data=@data, updated_at=unixepoch()`,
      );

      validated.steps.forEach((s, i) => {
        upsertStep.run({
          id: s.id,
          missionId: validated.id,
          stepIndex: i,
          status: s.status,
          data: JSON.stringify(s),
        });
      });
    });
    tx();
  }

  private validateAndReturn(raw: unknown): Mission {
    return MissionSchema.parse(raw);
  }

  private updateSteps(mission: Mission, step: MissionStep): Mission {
    const idx = mission.steps.findIndex((s) => s.id === step.id);
    if (idx === -1) throw new Error(`Unknown step ${step.id}`);
    mission.steps[idx] = { ...step };
    return mission;
  }

  close(): void {
    this.db.close();
  }
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => typeof v === 'string' && v.trim().length > 0)));
}

function mergeUnique(a?: string[], b?: string[]): string[] | undefined {
  const merged = dedupe([...(a ?? []), ...(b ?? [])]);
  return merged.length > 0 ? merged : undefined;
}

function normalizePatch(patch: Partial<MissionExecutionContext>): Partial<MissionExecutionContext> {
  const normalized: Partial<MissionExecutionContext> = {};
  if (patch.projectPath !== undefined) normalized.projectPath = patch.projectPath;
  if (patch.files !== undefined) normalized.files = dedupe(patch.files);
  if (patch.instructions !== undefined) normalized.instructions = dedupe(patch.instructions);
  if (patch.constraints !== undefined) normalized.constraints = dedupe(patch.constraints);
  if (patch.inheritedContext !== undefined) normalized.inheritedContext = patch.inheritedContext;
  return normalized;
}

