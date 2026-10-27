import { CodingTask } from "../../core/src";
import { ModelProvider } from "../../providers/src";

export interface ExecutionStep {
  id: string;
  description: string;
  status: "pending" | "running" | "done" | "failed";
}

export class Planner {
  constructor(private provider?: ModelProvider) {}

  async createPlan(task: CodingTask): Promise<ExecutionStep[]> {
    return [
      { id: "step-1", description: `Analyze workspace for instruction: ${task.instruction}`, status: "pending" },
      { id: "step-2", description: `Generate patch for task ${task.kind}`, status: "pending" },
      { id: "step-3", description: "Validate changes and run tests", status: "pending" },
    ];
  }
}
