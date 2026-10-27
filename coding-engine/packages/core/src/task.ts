export type TaskMode = "analyze" | "propose" | "apply";

export type TaskKind =
  | "generate"
  | "modify"
  | "refactor"
  | "debug"
  | "test"
  | "document"
  | "implement";

export interface CodingTask {
  id?: string;
  kind: TaskKind;
  instruction: string;
  workspaceId: string;
  mode: TaskMode;
  constraints?: {
    allowedPaths?: string[];
    forbiddenPaths?: string[];
    maxFilesChanged?: number;
    maxIterations?: number;
    timeoutMs?: number;
  };
  acceptanceCriteria?: string[];
  metadata?: Record<string, unknown>;
}
