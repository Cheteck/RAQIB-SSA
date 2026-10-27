import { CodingTask, TaskResult, CodingEvent } from "../../core/src";
import { ModelProvider } from "../../providers/src";
import { Workspace } from "../../project/src";
import { ToolRegistry } from "../../tools/src";
import { Planner } from "./planner";
import { BudgetTracker } from "./budget";

export interface ExecuteOptions {
  signal?: AbortSignal;
  onEvent?: (event: CodingEvent) => void;
}

export class SDKCodingEngine {
  private planner: Planner;

  constructor(
    private provider?: ModelProvider,
    private workspace?: Workspace,
    private toolRegistry = new ToolRegistry()
  ) {
    this.planner = new Planner(provider);
  }

  async execute(task: CodingTask, options?: ExecuteOptions): Promise<TaskResult> {
    const taskId = task.id || `task-${Date.now()}`;
    const budget = new BudgetTracker(task.constraints);

    options?.onEvent?.({ type: "task.started", taskId });

    const steps = await this.planner.createPlan(task);
    options?.onEvent?.({ type: "plan.created", taskId, steps: steps.map((s) => s.description) });

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

    budget.incrementIteration();
    const budgetCheck = budget.isExceeded();
    if (budgetCheck.exceeded) {
      return {
        taskId,
        status: "timed_out",
        summary: `Task failed: ${budgetCheck.reason}`,
        changes: [],
        validations: [],
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
