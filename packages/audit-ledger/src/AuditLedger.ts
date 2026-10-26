import Database from 'better-sqlite3';
import { AuditEvent } from '@raqib/shared';

export interface AuditFilters {
  missionId?: string;
  actor?: string;
  type?: string;
  limit?: number;
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
        actor       TEXT NOT NULL,
        data        TEXT NOT NULL,
        created_at  INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_mission ON audit_events(mission_id);
    `);
  }

  async log(event: AuditEvent): Promise<void> {
    if (!this.db) throw new Error('AuditLedger not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO audit_events (id, timestamp, type, mission_id, actor, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.timestamp,
      event.type,
      event.missionId || null,
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

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      type: r.type,
      missionId: r.mission_id,
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
