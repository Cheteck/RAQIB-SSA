import { TaskStatus, ValidationResult } from "./result";

export type CodingEvent =
  | { type: "task.started"; taskId: string }
  | { type: "plan.created"; taskId: string; steps: string[] }
  | { type: "tool.started"; taskId: string; toolName: string }
  | { type: "tool.completed"; taskId: string; toolName: string; durationMs: number }
  | { type: "patch.proposed"; taskId: string; files: string[] }
  | { type: "validation.completed"; taskId: string; result: ValidationResult }
  | { type: "task.completed"; taskId: string; status: TaskStatus };
