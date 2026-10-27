import { CodingTask, TaskResult } from "../../core/src";

export interface TaskRecord {
  task: CodingTask;
  result?: TaskResult;
  updatedAt: string;
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
