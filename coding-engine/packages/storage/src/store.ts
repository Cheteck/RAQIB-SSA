import Database from 'better-sqlite3';
import { CodingTask, TaskResult } from "../../core/src";

export interface TaskRecord {
  task: CodingTask;
  result?: TaskResult;
  updatedAt: string;
}

export class SQLiteTaskStore {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id          TEXT PRIMARY KEY,
        task_json   TEXT NOT NULL,
        result_json TEXT,
        updated_at  TEXT NOT NULL
      )
    `);
  }

  async create(task: CodingTask): Promise<void> {
    const id = task.id || `task-${Date.now()}`;
    task.id = id;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO tasks (id, task_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_json = excluded.task_json,
        updated_at = excluded.updated_at
    `).run(id, JSON.stringify(task), now);
  }

  async get(taskId: string): Promise<TaskRecord | undefined> {
    const row = this.db.prepare('SELECT task_json, result_json, updated_at FROM tasks WHERE id = ?').get(taskId) as {
      task_json: string;
      result_json: string | null;
      updated_at: string;
    } | undefined;

    if (!row) return undefined;
    return {
      task: JSON.parse(row.task_json),
      result: row.result_json ? JSON.parse(row.result_json) : undefined,
      updatedAt: row.updated_at,
    };
  }

  async update(record: TaskRecord): Promise<void> {
    this.db.prepare(`
      UPDATE tasks SET result_json = ?, updated_at = ? WHERE id = ?
    `).run(record.result ? JSON.stringify(record.result) : null, record.updatedAt || new Date().toISOString(), record.task.id!);
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

export class InMemoryTaskStore {
  private records = new Map<string, TaskRecord>();

  async create(task: CodingTask): Promise<void> {
    const id = task.id || `task-${Date.now()}`;
    task.id = id;
    this.records.set(id, { task, updatedAt: new Date().toISOString() });
  }

  async get(taskId: string): Promise<TaskRecord | undefined> {
    return this.records.get(taskId);
  }

  async update(record: TaskRecord): Promise<void> {
    this.records.set(record.task.id!, record);
  }
}
