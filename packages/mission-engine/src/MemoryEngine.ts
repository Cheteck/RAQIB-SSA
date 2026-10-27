import Database from 'better-sqlite3';

export interface MemoryRecord {
  id: string;
  namespace: string;
  key: string;
  value: string;
  updatedAt: string;
}

export class MemoryEngine {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id          TEXT PRIMARY KEY,
        namespace   TEXT NOT NULL,
        key         TEXT NOT NULL,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ns_key ON memories(namespace, key);
    `);
  }

  async put(namespace: string, key: string, value: unknown): Promise<void> {
    const id = `mem-${namespace}-${key}`;
    const now = new Date().toISOString();
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);

    this.db.prepare(`
      INSERT INTO memories (id, namespace, key, value, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(namespace, key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(id, namespace, key, strValue, now);
  }

  async get<T = unknown>(namespace: string, key: string): Promise<T | null> {
    const row = this.db.prepare(`
      SELECT value FROM memories WHERE namespace = ? AND key = ?
    `).get(namespace, key) as { value: string } | undefined;

    if (!row) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  }

  async list(namespace: string): Promise<MemoryRecord[]> {
    const rows = this.db.prepare(`
      SELECT id, namespace, key, value, updated_at as updatedAt
      FROM memories WHERE namespace = ? ORDER BY updated_at DESC
    `).all(namespace) as MemoryRecord[];

    return rows;
  }
}
