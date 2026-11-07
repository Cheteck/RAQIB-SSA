import crypto from 'crypto';
import Database from 'better-sqlite3';
import { AuditLedger } from '@raqib/audit-ledger';
import { MissionEngine } from './MissionEngine';
import { InvalidArgumentError, InvalidTransitionError, NotFoundError } from './errors';

export type SubagentRole = 'executor' | 'researcher' | 'verifier';
export type SubagentStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | 'FAILED';
export type SubagentState = 'available' | 'busy' | 'inactive' | 'error';

export interface SubagentMissionRef {
  id: string;
  name: string;
  status: string;
}

export interface Subagent {
  id: string;
  name: string;
  role: SubagentRole;
  specialty?: string;
  instructions?: string;
  /** Mission courante ('' lorsqu'aucune mission n'est affectée). */
  missionId: string;
  status: SubagentStatus;
  /** État de supervision dérivé : disponible / occupé / inactif / erreur. */
  state: SubagentState;
  mission?: SubagentMissionRef | null;
  stepsExecuted: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SubagentMissionHistoryEntry {
  id: string;
  missionId: string;
  missionName?: string;
  missionStatus?: string;
  assignedAt: string;
  unassignedAt?: string;
  assignedBy?: string;
}

export interface CreateSubagentInput {
  name: string;
  role?: SubagentRole;
  specialty?: string;
  instructions?: string;
  missionId?: string;
}

export interface RunSubagentOptions {
  maxSteps?: number;
}

/**
 * Sous-agent RAQIB : une unité d'exécution nommée, rattachée à une mission.
 *
 * Le sous-agent ne contourne aucune gouvernance : il démarre la mission si
 * elle est APPROVED, exécute ses étapes via MissionEngine (donc PolicyEngine,
 * budgets et audit s'appliquent), puis s'arrête sur VERIFYING / BLOCKED /
 * FAILED. Il ne déclare jamais une mission réussie à la place du
 * VerificationEngine.
 */
export class SubagentManager {
  private db: Database.Database;

  constructor(
    dbPath: string,
    private missionEngine: MissionEngine,
    private ledger: AuditLedger,
  ) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subagents (
        id             TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        role           TEXT NOT NULL,
        specialty      TEXT,
        instructions   TEXT,
        mission_id     TEXT NOT NULL DEFAULT '',
        status         TEXT NOT NULL,
        steps_executed INTEGER NOT NULL DEFAULT 0,
        last_error     TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        started_at     TEXT,
        completed_at   TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_subagents_mission ON subagents(mission_id);
      CREATE INDEX IF NOT EXISTS idx_subagents_status ON subagents(status);

      CREATE TABLE IF NOT EXISTS subagent_missions (
        id            TEXT PRIMARY KEY,
        subagent_id   TEXT NOT NULL,
        mission_id    TEXT NOT NULL,
        assigned_at   TEXT NOT NULL,
        unassigned_at TEXT,
        assigned_by   TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_subagent_missions_agent ON subagent_missions(subagent_id, assigned_at);
    `);

    // Migration douce : bases existantes sans les colonnes de supervision.
    this.ensureColumn('subagents', 'specialty', 'TEXT');
    this.ensureColumn('subagents', 'instructions', 'TEXT');
  }

  private ensureColumn(table: string, column: string, ddl: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  }

  private rowToSubagent(row: any): Subagent {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      specialty: row.specialty ?? undefined,
      instructions: row.instructions ?? undefined,
      missionId: row.mission_id ?? '',
      status: row.status,
      state: deriveState(row.status, row.mission_id),
      stepsExecuted: row.steps_executed,
      lastError: row.last_error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
    };
  }

  /** Enrichit un sous-agent avec sa mission courante (lecture MissionEngine). */
  private async withMission(subagent: Subagent): Promise<Subagent> {
    if (!subagent.missionId) return { ...subagent, mission: null };
    const mission = await this.missionEngine.getMission(subagent.missionId);
    return {
      ...subagent,
      mission: mission
        ? { id: mission.id, name: mission.name, status: mission.status }
        : { id: subagent.missionId, name: subagent.missionId, status: 'NOT_FOUND' },
    };
  }

  async create(input: CreateSubagentInput): Promise<Subagent> {
    const name = input.name?.trim();
    if (!name) throw new Error('Subagent name is required');

    const missionId = input.missionId?.trim() || '';
    let missionName: string | undefined;
    if (missionId) {
      const mission = await this.missionEngine.getMission(missionId);
      if (!mission) throw new Error(`Mission ${missionId} not found`);
      missionName = mission.name;
    }

    const now = new Date().toISOString();
    const subagent: Subagent = {
      id: crypto.randomUUID(),
      name,
      role: input.role ?? 'executor',
      specialty: input.specialty?.trim() || undefined,
      instructions: input.instructions?.trim() || undefined,
      missionId,
      status: 'IDLE',
      state: missionId ? 'available' : 'available',
      stepsExecuted: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO subagents
          (id, name, role, specialty, instructions, mission_id, status, steps_executed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        subagent.id,
        subagent.name,
        subagent.role,
        subagent.specialty ?? null,
        subagent.instructions ?? null,
        subagent.missionId,
        subagent.status,
        subagent.stepsExecuted,
        subagent.createdAt,
        subagent.updatedAt,
      );

    if (missionId) {
      await this.recordAssignment(subagent.id, missionId, 'raqib-core');
      await this.missionEngine.assignMission(missionId, {
        subagentId: subagent.id,
        subagentName: subagent.name,
        assignedBy: 'raqib-core',
      });
    }

    await this.ledger.log({
      id: `evt-subagent-created-${subagent.id}`,
      timestamp: now,
      type: 'SUBAGENT_CREATED',
      missionId: missionId || undefined,
      actor: 'raqib-core',
      data: {
        subagentId: subagent.id,
        name: subagent.name,
        role: subagent.role,
        specialty: subagent.specialty,
        missionId: missionId || null,
        missionName,
      },
    });

    return this.withMission(subagent);
  }

  async list(): Promise<Subagent[]> {
    const rows = this.db
      .prepare('SELECT * FROM subagents ORDER BY created_at DESC')
      .all() as any[];
    return Promise.all(rows.map((row) => this.withMission(this.rowToSubagent(row))));
  }

  async get(id: string): Promise<Subagent | null> {
    const row = this.db.prepare('SELECT * FROM subagents WHERE id = ?').get(id) as
      | any
      | undefined;
    if (!row) return null;
    return this.withMission(this.rowToSubagent(row));
  }

  /** Attribue une mission (réattribution incluse) et clôt l'affectation précédente. */
  async assign(id: string, missionId: string, assignedBy = 'operator'): Promise<Subagent> {
    // ---- Phase 1 : prévalidation intégrale, AUCUNE écriture ----
    // Toute requête rejetée doit laisser la base strictement inchangée (3a).
    if (!missionId) throw new InvalidArgumentError('missionId is required');

    const subagent = await this.get(id);
    if (!subagent) throw new NotFoundError(`Subagent ${id} not found`);

    const mission = await this.missionEngine.getMission(missionId);
    if (!mission) throw new NotFoundError(`Mission ${missionId} not found`);

    if (subagent.status === 'RUNNING') {
      throw new InvalidTransitionError(`Subagent ${id} is already running`);
    }
    if (['SUCCEEDED', 'FAILED', 'CANCELLED', 'REJECTED'].includes(mission.status)) {
      throw new InvalidTransitionError(
        `Cannot assign mission ${missionId} in terminal status ${mission.status}`,
      );
    }

    const previousMissionId = subagent.missionId || '';
    const isReassignment = !!previousMissionId && previousMissionId !== missionId;

    // ---- Phase 2 : mutations, avec compensation si une étape échoue ----
    let insertedAssignmentId: string | null = null;
    let closedPrevious = false;

    try {
      if (isReassignment) {
        closedPrevious = this.closeAssignment(id, previousMissionId);
      }

      this.db
        .prepare('UPDATE subagents SET mission_id = ?, updated_at = ? WHERE id = ?')
        .run(missionId, new Date().toISOString(), id);

      insertedAssignmentId = this.recordAssignment(id, missionId, assignedBy);

      // Échoue uniquement sur erreur inattendue : la prévalidation a déjà
      // écarté les missions terminales et les ressources inexistantes.
      await this.missionEngine.assignMission(missionId, {
        subagentId: id,
        subagentName: subagent.name,
        assignedBy,
      });
    } catch (err) {
      this.rollbackAssign({
        subagentId: id,
        missionId,
        previousMissionId,
        isReassignment,
        insertedAssignmentId,
        closedPrevious,
      });
      throw err;
    }

    await this.ledger.log({
      id: `evt-subagent-assigned-${id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'SUBAGENT_UPDATED',
      missionId,
      actor: assignedBy,
      data: {
        subagentId: id,
        action: 'assign',
        missionId,
        missionName: mission.name,
        previousMissionId: previousMissionId || undefined,
      },
    });

    return (await this.get(id)) as Subagent;
  }

  /**
   * Retire la mission courante ; la mission et son historique sont conservés.
   *
   * Un agent COMPLETED (mission terminée côté exécution) redevient IDLE — donc
   * à nouveau affectable — uniquement s'il n'est pas en cours d'exécution.
   * Un agent RUNNING est refusé (transition invalide) pour ne jamais couper
   * une exécution active.
   */
  async unassign(id: string, reason = 'Désattribution manuelle'): Promise<Subagent> {
    const subagent = await this.get(id);
    if (!subagent) throw new NotFoundError(`Subagent ${id} not found`);

    // Agent déjà sans mission : on normalise tout de même un état COMPLETED
    // résiduel vers IDLE (aucune exécution active), sinon il resterait
    // définitivement « inactive » et donc non affectable.
    if (!subagent.missionId) {
      if (subagent.status !== 'COMPLETED') return subagent;
      this.db
        .prepare(
          `UPDATE subagents
           SET status = 'IDLE', started_at = NULL, completed_at = NULL,
               last_error = NULL, updated_at = ?
           WHERE id = ?`,
        )
        .run(new Date().toISOString(), id);

      await this.ledger.log({
        id: `evt-subagent-unassigned-${id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'SUBAGENT_UPDATED',
        actor: 'operator',
        data: { subagentId: id, action: 'reset-idle', reason },
      });

      return (await this.get(id)) as Subagent;
    }

    if (subagent.status === 'RUNNING') {
      throw new InvalidTransitionError(`Subagent ${id} is running; unassign is not allowed`);
    }

    const previousMissionId = subagent.missionId;
    const previous = {
      status: subagent.status,
      startedAt: subagent.startedAt,
      completedAt: subagent.completedAt,
      lastError: subagent.lastError,
    };
    const becomesIdle = subagent.status === 'COMPLETED';

    let closed = false;
    try {
      closed = this.closeAssignment(id, previousMissionId);

      const now = new Date().toISOString();
      this.db
        .prepare(
          `UPDATE subagents
           SET mission_id = '',
               status = ?,
               started_at = ?,
               completed_at = ?,
               last_error = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(
          becomesIdle ? 'IDLE' : subagent.status,
          becomesIdle ? null : subagent.startedAt ?? null,
          becomesIdle ? null : subagent.completedAt ?? null,
          becomesIdle ? null : subagent.lastError ?? null,
          now,
          id,
        );

      await this.missionEngine.unassignMission(previousMissionId, {
        reason,
        unassignedBy: 'operator',
      });
    } catch (err) {
      // Compensation : restaure l'affectation et l'historique ouverts.
      this.db
        .prepare(
          `UPDATE subagents
           SET mission_id = ?, status = ?, started_at = ?, completed_at = ?, last_error = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          previousMissionId,
          previous.status,
          previous.startedAt ?? null,
          previous.completedAt ?? null,
          previous.lastError ?? null,
          new Date().toISOString(),
          id,
        );
      if (closed) this.reopenAssignment(id, previousMissionId);
      throw err;
    }

    await this.ledger.log({
      id: `evt-subagent-unassigned-${id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'SUBAGENT_UPDATED',
      missionId: previousMissionId,
      actor: 'operator',
      data: { subagentId: id, action: 'unassign', missionId: previousMissionId, reason },
    });

    return (await this.get(id)) as Subagent;
  }

  /**
   * Annule les écritures d'une affectation qui a échoué en cours de route :
   * historique rouvert/fermé, mission_id restauré et affectation mission
   * défaite si elle avait déjà été persistée.
   */
  private rollbackAssign(params: {
    subagentId: string;
    missionId: string;
    previousMissionId: string;
    isReassignment: boolean;
    insertedAssignmentId: string | null;
    closedPrevious: boolean;
  }): void {
    const { subagentId, missionId, previousMissionId, isReassignment, insertedAssignmentId, closedPrevious } = params;

    try {
      this.db
        .prepare('UPDATE subagents SET mission_id = ?, updated_at = ? WHERE id = ?')
        .run(previousMissionId, new Date().toISOString(), subagentId);

      if (insertedAssignmentId) {
        this.db.prepare('DELETE FROM subagent_missions WHERE id = ?').run(insertedAssignmentId);
      }
      if (isReassignment && closedPrevious) {
        this.reopenAssignment(subagentId, previousMissionId);
      }
    } catch {
      // La compensation ne doit jamais masquer l'erreur d'origine.
    }

    // Compensation best-effort côté mission (écriture déjà persistée).
    void (async () => {
      try {
        if (isReassignment && previousMissionId) {
          await this.missionEngine.assignMission(previousMissionId, {
            subagentId,
            assignedBy: 'rollback',
          });
        } else {
          await this.missionEngine.unassignMission(missionId, {
            reason: 'Rollback : affectation échouée',
            unassignedBy: 'rollback',
          });
        }
      } catch {
        // Best-effort uniquement.
      }
    })();
  }

  /** Historique complet des missions affectées à cet agent (y compris passées). */
  async history(id: string): Promise<SubagentMissionHistoryEntry[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM subagent_missions
         WHERE subagent_id = ?
         ORDER BY assigned_at DESC`,
      )
      .all(id) as any[];

    const entries: SubagentMissionHistoryEntry[] = [];
    for (const row of rows) {
      const mission = await this.missionEngine.getMission(row.mission_id);
      entries.push({
        id: row.id,
        missionId: row.mission_id,
        missionName: mission?.name,
        missionStatus: mission?.status,
        assignedAt: row.assigned_at,
        unassignedAt: row.unassigned_at ?? undefined,
        assignedBy: row.assigned_by ?? undefined,
      });
    }
    return entries;
  }

  /**
   * Ouvre une affectation dans l'historique si elle n'existe pas déjà.
   * Retourne l'identifiant de la ligne d'historique ouverte (existante ou créée).
   */
  private recordAssignment(subagentId: string, missionId: string, assignedBy: string): string {
    const open = this.db
      .prepare(
        `SELECT id FROM subagent_missions
         WHERE subagent_id = ? AND mission_id = ? AND unassigned_at IS NULL
         LIMIT 1`,
      )
      .get(subagentId, missionId) as { id: string } | undefined;
    if (open) return open.id;
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO subagent_missions (id, subagent_id, mission_id, assigned_at, assigned_by)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, subagentId, missionId, new Date().toISOString(), assignedBy);
    return id;
  }

  /** Clôt l'affectation ouverte ; retourne true si une ligne a été modifiée. */
  private closeAssignment(subagentId: string, missionId: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE subagent_missions
         SET unassigned_at = ?
         WHERE subagent_id = ? AND mission_id = ? AND unassigned_at IS NULL`,
      )
      .run(new Date().toISOString(), subagentId, missionId);
    return result.changes > 0;
  }

  /** Réouvre une affectation clôturée (compensation de rollback). */
  private reopenAssignment(subagentId: string, missionId: string): void {
    this.db
      .prepare(
        `UPDATE subagent_missions
         SET unassigned_at = NULL
         WHERE subagent_id = ? AND mission_id = ?
           AND id = (
             SELECT id FROM subagent_missions
             WHERE subagent_id = ? AND mission_id = ?
             ORDER BY assigned_at DESC, rowid DESC
             LIMIT 1
           )`,
      )
      .run(subagentId, missionId, subagentId, missionId);
  }

  private async update(
    id: string,
    patch: Partial<
      Pick<
        Subagent,
        | 'status'
        | 'stepsExecuted'
        | 'lastError'
        | 'startedAt'
        | 'completedAt'
        | 'specialty'
        | 'instructions'
      >
    >,
  ): Promise<Subagent> {
    const current = await this.get(id);
    if (!current) throw new Error(`Subagent ${id} not found`);
    const next: Subagent = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    next.state = deriveState(next.status, next.missionId);
    this.db
      .prepare(
        `UPDATE subagents
         SET status = ?, steps_executed = ?, last_error = ?,
             specialty = ?, instructions = ?,
             started_at = ?, completed_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.status,
        next.stepsExecuted,
        next.lastError ?? null,
        next.specialty ?? null,
        next.instructions ?? null,
        next.startedAt ?? null,
        next.completedAt ?? null,
        next.updatedAt,
        id,
      );
    return next;
  }

  /**
   * Exécute la mission assignée, étape par étape, sous gouvernance.
   * Retourne l'état final du sous-agent (jamais un succès simulé).
   */
  async run(id: string, options: RunSubagentOptions = {}): Promise<Subagent> {
    const subagent = await this.get(id);
    if (!subagent) throw new Error(`Subagent ${id} not found`);
    if (subagent.status === 'RUNNING') {
      throw new Error(`Subagent ${id} is already running`);
    }
    if (!subagent.missionId) {
      throw new Error(`Subagent ${id} has no assigned mission`);
    }

    const maxSteps = Math.max(1, Math.min(options.maxSteps ?? 50, 200));
    const mission = await this.missionEngine.getMission(subagent.missionId);
    if (!mission) {
      return this.update(id, {
        status: 'FAILED',
        lastError: `Mission ${subagent.missionId} not found`,
        completedAt: new Date().toISOString(),
      });
    }

    if (mission.status === 'PLANNED' || mission.status === 'APPROVAL_REQUIRED') {
      return this.update(id, {
        status: 'BLOCKED',
        lastError:
          'Mission en attente d’approbation humaine (statut ' + mission.status + ').',
        completedAt: new Date().toISOString(),
      });
    }

    if (mission.status === 'SUCCEEDED') {
      return this.update(id, {
        status: 'COMPLETED',
        lastError: undefined,
        completedAt: new Date().toISOString(),
      });
    }

    if (mission.status === 'FAILED' || mission.status === 'BLOCKED' || mission.status === 'CANCELLED' || mission.status === 'REJECTED') {
      return this.update(id, {
        status: mission.status === 'BLOCKED' ? 'BLOCKED' : 'FAILED',
        lastError: `Mission déjà terminée avec le statut ${mission.status}.`,
        completedAt: new Date().toISOString(),
      });
    }

    if (mission.status === 'APPROVED') {
      await this.missionEngine.transitionStatus(
        mission.id,
        'RUNNING',
        `Démarrage par le sous-agent ${subagent.name} (${subagent.id})`,
      );
    }

    const currentMission = await this.missionEngine.getMission(mission.id);
    if (!currentMission || (currentMission.status !== 'RUNNING' && currentMission.status !== 'VERIFYING')) {
      return this.update(id, {
        status: 'BLOCKED',
        lastError: `Mission non exécutable (statut ${currentMission?.status ?? 'inconnu'}).`,
        completedAt: new Date().toISOString(),
      });
    }

    const startedAt = new Date().toISOString();
    await this.update(id, {
      status: 'RUNNING',
      startedAt,
      lastError: undefined,
      completedAt: undefined,
    });
    await this.ledger.log({
      id: `evt-subagent-started-${id}-${Date.now()}`,
      timestamp: startedAt,
      type: 'SUBAGENT_STARTED',
      missionId: subagent.missionId,
      actor: 'raqib-subagent',
      data: { subagentId: id, name: subagent.name, role: subagent.role },
    });

    let stepsExecuted = 0;
    let lastError: string | undefined;

    while (stepsExecuted < maxSteps) {
      const before = await this.missionEngine.getMission(mission.id);
      if (!before || before.status !== 'RUNNING') break;

      const result = await this.missionEngine.runNextStep(mission.id);
      stepsExecuted += 1;

      if (result.status === 'BLOCKED' || result.status === 'FAILED' || result.status === 'UNKNOWN') {
        lastError = result.detail || `Étape « ${result.stepName} » : ${result.status}`;
        break;
      }
      if (!result.executed && result.status === 'DONE' && result.stepName === '<verification>') {
        break;
      }
    }

    const finalMission = await this.missionEngine.getMission(mission.id);
    const finalStatus = finalMission?.status;
    const completedAt = new Date().toISOString();

    let status: SubagentStatus;
    switch (finalStatus) {
      case 'SUCCEEDED':
      case 'VERIFYING':
        status = 'COMPLETED';
        lastError = undefined;
        break;
      case 'BLOCKED':
        status = 'BLOCKED';
        break;
      case 'FAILED':
      case 'CANCELLED':
      case 'REJECTED':
        status = 'FAILED';
        break;
      case 'RUNNING':
        // Limite de pas atteinte : la mission peut reprendre, aucun succès simulé.
        status = 'IDLE';
        lastError =
          lastError ?? `Limite de ${maxSteps} étape(s) atteinte ; la mission est toujours RUNNING.`;
        break;
      default:
        status = 'BLOCKED';
        lastError = lastError ?? `Statut de mission inattendu : ${finalStatus ?? 'inconnu'}`;
    }

    const updated = await this.update(id, {
      status,
      stepsExecuted: subagent.stepsExecuted + stepsExecuted,
      lastError,
      completedAt: status === 'IDLE' ? undefined : completedAt,
    });

    // Remontée des résultats au coordinateur (jamais un succès simulé).
    const deliverables = (finalMission?.evidences ?? [])
      .map((e) => e.value)
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .slice(0, 50);
    await this.missionEngine.recordResult(
      mission.id,
      {
        summary:
          status === 'COMPLETED'
            ? `Sous-agent ${subagent.name} : ${stepsExecuted} étape(s) exécutée(s), mission en attente de vérification.`
            : `Sous-agent ${subagent.name} : ${stepsExecuted} étape(s) exécutée(s), arrêt avec l'état ${status}.`,
        success: finalStatus === 'SUCCEEDED',
        artifacts: deliverables,
        reports: (finalMission?.steps ?? []).map((s) => `${s.name}: ${s.status}`),
        modifiedFiles: extractModifiedFiles(finalMission?.steps ?? []),
        errors: lastError ? [lastError] : [],
      },
      { recordedBy: `subagent:${id}` },
    );

    await this.ledger.log({
      id: `evt-subagent-${status.toLowerCase()}-${id}-${Date.now()}`,
      timestamp: completedAt,
      type: status === 'FAILED' || status === 'BLOCKED' ? 'SUBAGENT_FAILED' : 'SUBAGENT_COMPLETED',
      missionId: subagent.missionId,
      actor: 'raqib-subagent',
      data: {
        subagentId: id,
        stepsExecuted,
        missionStatus: finalStatus,
        status,
        error: lastError,
      },
    });

    return this.withMission(updated);
  }

  close(): void {
    this.db.close();
  }
}

function deriveState(status: SubagentStatus, missionId: string): SubagentState {
  if (status === 'RUNNING') return 'busy';
  if (status === 'BLOCKED' || status === 'FAILED') return 'error';
  if (status === 'COMPLETED') return 'inactive';
  return missionId ? 'available' : 'available';
}

/** Extrait les fichiers modifiés remontés dans les résultats d'étapes. */
function extractModifiedFiles(steps: Array<{ result?: unknown }>): string[] {
  const files = new Set<string>();
  for (const step of steps) {
    const result = step.result;
    if (!result || typeof result !== 'object') continue;
    const candidate = (result as Record<string, unknown>).modifiedFiles;
    if (Array.isArray(candidate)) {
      for (const file of candidate) {
        if (typeof file === 'string' && file.trim()) files.add(file);
      }
    }
  }
  return Array.from(files);
}
