import { CodingTask, TaskResult, CodingEvent } from "../../core/src";
import { ModelProvider } from "../../providers/src";
import { Workspace } from "../../project/src";
import { ToolRegistry } from "../../tools/src";

export interface ExecuteOptions {
  signal?: AbortSignal;
  onEvent?: (event: CodingEvent) => void;
}

export class SDKCodingEngine {
  constructor(
    private provider?: ModelProvider,
    private workspace?: Workspace,
    private toolRegistry = new ToolRegistry()
  ) {}

  async execute(task: CodingTask, options?: ExecuteOptions): Promise<TaskResult> {
    const taskId = task.id || `task-${Date.now()}`;
    options?.onEvent?.({ type: "task.started", taskId });

    if (task.mode === "propose") {
      options?.onEvent?.({ type: "patch.proposed", taskId, files: [] });
      return {
        taskId,
        status: "needs_approval",
        summary: `Task ${taskId} prepared in 'propose' mode. Pending approval.`,
        changes: [],
        validations: [],
        pendingApproval: `appr-${taskId}`,
      };
    }

    options?.onEvent?.({ type: "task.completed", taskId, status: "completed" });
    return {
      taskId,
      status: "completed",
      summary: `Task ${taskId} completed in mode ${task.mode}.`,
      changes: [],
      validations: [],
    };
  }

  async approve(taskId: string, approvalId: string): Promise<TaskResult> {
    return {
      taskId,
      status: "completed",
      summary: `Approval ${approvalId} granted for task ${taskId}.`,
      changes: [],
      validations: [],
    };
  }

  async cancel(taskId: string): Promise<void> {}
}
