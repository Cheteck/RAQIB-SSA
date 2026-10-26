import Database from 'better-sqlite3';
import { Mission, MissionStep, Evidence } from '@raqib/core';
import { MissionSchema } from '@raqib/core';
import { AuditLedger, AuditFilters } from '@raqib/audit-ledger';
import { PolicyEngine, PolicyRequest } from '@raqib/policy-engine';
import { MissionStatus, AuditEvent } from '@raqib/shared';
import { assertTransition } from './StateMachine';

export interface MissionSpec {
  id: string;
  name: string;
  objective: string;
  autonomyLevel: 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
  constraints: string[];
  successCriteria: string[];
  steps: Array<{ name: string; maxAttempts?: number }>;
  approvalRequired: boolean;
  budgetLimitEur: number;
  maxDurationMs: number;
  maxAttempts: number;
}

export interface MissionFilters {
  status?: MissionStatus;
}

export interface StepResult {
  missionId: string;
  stepIndex: number;
  stepName: string;
  status: 'DONE' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
  executed: boolean;
  detail?: string;
}

interface StepExecutor {
  (mission: Mission, step: MissionStep): Promise<{
    status: 'DONE' | 'FAILED' | 'SKIPPED';
    result?: unknown;
    proof?: string;
    error?: string;
  }>;
}

export class MissionEngine {
  private db: Database.Database;
  private ledger: AuditLedger;
  private policy: PolicyEngine;
  private executor: StepExecutor | null = null;

  constructor(options: {
    dbPath: string;
    ledger: AuditLedger;
    policy: PolicyEngine;
  }) {
    this.ledger = options.ledger;
    this.policy = options.policy;
    this.db = new Database(options.dbPath);
    this.db.pragma('journal_mode = WAL');
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

  async createMission(spec: MissionSpec): Promise<Mission> {
    if (this.db.prepare('SELECT 1 FROM missions WHERE id = ?').get(spec.id)) {
      throw new Error(`Mission ${spec.id} already exists`);
    }

    const now = new Date().toISOString();
    const steps: MissionStep[] = spec.steps.map((s, i) => ({
      id: `${spec.id}-step-${i}`,
      name: s.name,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: s.maxAttempts ?? spec.maxAttempts,
    }));

    const mission: Mission = {
      id: spec.id,
      name: spec.name,
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
    };

    this.persist(mission);
    await this.ledger.log({
      id: `evt-mission-created-${spec.id}-${Date.now()}`,
      timestamp: now,
      type: 'MISSION_CREATED',
      missionId: spec.id,
      actor: 'raqib-core',
      data: { status: mission.status, steps: steps.length },
    });

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
    return rows.map((r) => this.validateAndReturn(JSON.parse(r.data)));
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
      await this.transitionStatus(missionId, 'BLOCKED', `Policy denied step ${step.id}: ${decision.reason}`);
      this.persist(this.updateSteps(mission, step));
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

    step.status = 'RUNNING';
    step.startedAt = step.startedAt ?? new Date().toISOString();
    step.attempts += 1;
    this.persist(this.updateSteps(mission, step));

    const outcome = await this.executor(mission, step);

    if (outcome.status === 'DONE') {
      step.status = 'DONE';
      step.completedAt = new Date().toISOString();
      step.result = outcome.result;
      step.proof = outcome.proof;
      if (outcome.proof) {
        mission.evidences.push({
          type: 'COMMAND_OUTPUT',
          description: `Proof for step ${step.name}`,
          value: outcome.proof,
          timestamp: new Date().toISOString(),
          verified: true,
        });
      }
      this.persist(this.updateSteps(mission, step));
      mission.currentStepIndex += 1;

      await this.ledger.log({
        id: `evt-step-done-${missionId}-${step.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'ACTION_EXECUTED',
        missionId,
        actor: 'raqib-core',
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
      this.persist(this.updateSteps(mission, step));
      mission.currentStepIndex += 1;
      return {
        missionId,
        stepIndex: mission.currentStepIndex - 1,
        stepName: step.name,
        status: 'SKIPPED',
        executed: false,
        detail: 'Skipped',
      };
    }

    // FAILED
    step.status = 'FAILED';
    step.error = outcome.error ?? 'Step execution failed';
    this.persist(this.updateSteps(mission, step));

    if (step.attempts >= step.maxAttempts) {
      await this.transitionStatus(
        missionId,
        'BLOCKED',
        `Step ${step.id} failed ${step.attempts}/${step.maxAttempts} attempts`,
      );
    }

    await this.ledger.log({
      id: `evt-step-failed-${missionId}-${step.id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'ERROR',
      missionId,
      actor: 'raqib-core',
      data: { step: step.id, error: step.error, attempts: step.attempts },
    });

    return {
      missionId,
      stepIndex: mission.currentStepIndex,
      stepName: step.name,
      status: 'FAILED',
      executed: true,
      detail: step.error,
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
        id: `evt-resume-${missionId}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'ACTION_EXECUTED',
        missionId,
        actor: 'raqib-core',
        data: { action: 'resume', stepIndex: mission.currentStepIndex },
      });
    }
  }

  async transitionStatus(
    id: string,
    newStatus: MissionStatus,
    reason: string,
  ): Promise<Mission> {
    const mission = await this.getMission(id);
    if (!mission) throw new Error(`Mission ${id} not found`);

    assertTransition(mission.status, newStatus);

    const fromStatus = mission.status;
    const now = new Date().toISOString();
    mission.status = newStatus;
    if (newStatus === 'RUNNING') mission.startedAt = mission.startedAt ?? now;
    if (newStatus === 'SUCCEEDED') mission.completedAt = now;
    if (newStatus === 'FAILED') mission.failedAt = now;

    this.persist(mission);

    await this.ledger.log({
      id: `evt-transition-${id}-${Date.now()}`,
      timestamp: now,
      type: 'ACTION_EXECUTED',
      missionId: id,
      actor: 'raqib-core',
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

  // ----------------------------------------------------------- Audit helpers

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
