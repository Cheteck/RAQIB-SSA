import Database from 'better-sqlite3';
import { AuditEvent } from '@raqib/shared';

export interface AuditFilters {
  missionId?: string;
  actor?: string;
  type?: string;
  limit?: number;
  /** Décalage de pagination (à utiliser avec `limit`). */
  offset?: number;
  /**
   * Ordre chronologique : `asc` (par défaut, ordre causal d'insertion) ou
   * `desc` (les plus récents d'abord, pour la supervision temps réel).
   */
  order?: 'asc' | 'desc';
}

export class AuditLedger {
  private db: Database.Database | null = null;

  constructor(private dbPath: string) {}

  async init(): Promise<void> {
    this.db = new Database(this.dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id          TEXT PRIMARY KEY,
        timestamp   TEXT NOT NULL,
        type        TEXT NOT NULL,
        mission_id  TEXT,
        step_id     TEXT,
        actor       TEXT NOT NULL,
        data        TEXT NOT NULL,
        created_at  INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_mission ON audit_events(mission_id);
    `);
    // Migration for databases created before step_id existed (G7)
    const hasStepId = this.db
      .prepare("SELECT 1 FROM pragma_table_info('audit_events') WHERE name = 'step_id'")
      .get();
    if (!hasStepId) {
      this.db.exec('ALTER TABLE audit_events ADD COLUMN step_id TEXT');
    }

    // Migration for databases created before correlation_id existed.
    const hasCorrelationId = this.db
      .prepare("SELECT 1 FROM pragma_table_info('audit_events') WHERE name = 'correlation_id'")
      .get();
    if (!hasCorrelationId) {
      this.db.exec('ALTER TABLE audit_events ADD COLUMN correlation_id TEXT');
    }
  }

  async log(event: AuditEvent): Promise<void> {
    if (!this.db) throw new Error('AuditLedger not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO audit_events (id, timestamp, type, mission_id, step_id, correlation_id, actor, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.timestamp,
      event.type,
      event.missionId || null,
      event.stepId || null,
      event.correlationId || null,
      event.actor,
      JSON.stringify(event.data)
    );
  }

  async query(filters: AuditFilters = {}): Promise<AuditEvent[]> {
    if (!this.db) throw new Error('AuditLedger not initialized');

    let sql = 'SELECT * FROM audit_events WHERE 1=1';
    const params: unknown[] = [];

    if (filters.missionId) {
      sql += ' AND mission_id = ?';
      params.push(filters.missionId);
    }
    if (filters.actor) {
      sql += ' AND actor = ?';
      params.push(filters.actor);
    }
    if (filters.type) {
      sql += ' AND type = ?';
      params.push(filters.type);
    }

    // Causal ordering: created_at is second-resolution (unixepoch), so rowid
    // (insertion order) is the deterministic tiebreak within the same second.
    // Défaut : DESC (supervision temps réel, contrat historique de l'API) ;
    // `order: 'asc'` rétablit l'ordre chronologique d'insertion.
    const descending = filters.order !== 'asc';
    sql += descending
      ? ' ORDER BY created_at DESC, rowid DESC'
      : ' ORDER BY created_at ASC, rowid ASC';

    if (filters.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters.offset) {
      // SQLite exige un LIMIT pour utiliser OFFSET.
      if (filters.limit === undefined) {
        sql += ' LIMIT -1';
      }
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      type: r.type,
      missionId: r.mission_id,
      stepId: r.step_id ?? undefined,
      correlationId: r.correlation_id ?? undefined,
      actor: r.actor,
      data: JSON.parse(r.data)
    }));
  }

  async export(missionId: string): Promise<AuditEvent[]> {
    return this.query({ missionId });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
