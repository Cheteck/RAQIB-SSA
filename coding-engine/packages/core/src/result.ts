export type TaskStatus =
  | "completed"
  | "needs_approval"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface FileChange {
  path: string;
  operation: "create" | "modify" | "delete";
  diff: string;
}

export interface ValidationResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  summary?: string;
  exitCode?: number;
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  summary: string;
  changes: FileChange[];
  validations: ValidationResult[];
  pendingApproval?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
    provider?: string;
  };
}
