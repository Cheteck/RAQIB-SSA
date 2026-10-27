import Database from 'better-sqlite3';

export type MemoryType = 'EPISODIC' | 'SEMANTIC' | 'WORKING';

export interface MemoryRecord {
  id: string;
  namespace: string;
  threadId?: string;
  type: MemoryType;
  key: string;
  value: string;
  sensitivity?: string;
  updatedAt: string;
}

export interface SearchOptions {
  namespace: string;
  threadId?: string;
  type?: MemoryType;
  query?: string;
  limit?: number;
}

export class MemoryEngine {
  private db: Database.Database | null = null;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id          TEXT PRIMARY KEY,
        namespace   TEXT NOT NULL,
        thread_id   TEXT,
        type        TEXT NOT NULL DEFAULT 'WORKING',
        key         TEXT NOT NULL,
        value       TEXT NOT NULL,
        sensitivity TEXT DEFAULT 'PUBLIC',
        updated_at  TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ns_thread_key ON memories(namespace, COALESCE(thread_id, ''), key);
      CREATE INDEX IF NOT EXISTS idx_type ON memories(type);
    `);
  }

  async checkpoint(threadId: string, namespace: string, key: string, state: unknown): Promise<void> {
    await this.put(namespace, key, state, { threadId, type: 'WORKING' });
  }

  async getLatestCheckpoint<T = unknown>(threadId: string, namespace: string, key: string): Promise<T | null> {
    return this.get<T>(namespace, key, threadId);
  }

  async put(
    namespace: string,
    key: string,
    value: unknown,
    options: { threadId?: string; type?: MemoryType; sensitivity?: string } = {}
  ): Promise<void> {
    if (!this.db) throw new Error('MemoryEngine database connection closed');
    const threadId = options.threadId || null;
    const type = options.type || 'WORKING';
    const sensitivity = options.sensitivity || 'PUBLIC';
    const id = `mem-${namespace}-${threadId || 'global'}-${key}`;
    const now = new Date().toISOString();
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);

    const tx = this.db.transaction(() => {
      this.db!.prepare(`
        INSERT INTO memories (id, namespace, thread_id, type, key, value, sensitivity, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(namespace, COALESCE(thread_id, ''), key) DO UPDATE SET
          value = excluded.value,
          type = excluded.type,
          sensitivity = excluded.sensitivity,
          updated_at = excluded.updated_at
      `).run(id, namespace, threadId, type, key, strValue, sensitivity, now);
    });
    tx();
  }

  async get<T = unknown>(namespace: string, key: string, threadId?: string): Promise<T | null> {
    if (!this.db) throw new Error('MemoryEngine database connection closed');
    let row: { value: string } | undefined;
    if (threadId) {
      row = this.db.prepare(`
        SELECT value FROM memories WHERE namespace = ? AND thread_id = ? AND key = ?
      `).get(namespace, threadId, key) as { value: string } | undefined;
    } else {
      row = this.db.prepare(`
        SELECT value FROM memories WHERE namespace = ? AND thread_id IS NULL AND key = ?
      `).get(namespace, key) as { value: string } | undefined;
    }

    if (!row) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  }

  async search(opts: SearchOptions): Promise<MemoryRecord[]> {
    if (!this.db) throw new Error('MemoryEngine database connection closed');
    let sql = 'SELECT id, namespace, thread_id as threadId, type, key, value, sensitivity, updated_at as updatedAt FROM memories WHERE namespace = ?';
    const params: unknown[] = [opts.namespace];

    if (opts.threadId) {
      sql += ' AND thread_id = ?';
      params.push(opts.threadId);
    }
    if (opts.type) {
      sql += ' AND type = ?';
      params.push(opts.type);
    }
    if (opts.query) {
      sql += ' AND (key LIKE ? OR value LIKE ?)';
      params.push(`%${opts.query}%`, `%${opts.query}%`);
    }

    sql += ' ORDER BY updated_at DESC';

    if (opts.limit) {
      sql += ' LIMIT ?';
      params.push(opts.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as MemoryRecord[];
    return rows;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
