import { DockerSandbox, SandboxContext, CommandResult } from '../DockerSandbox';

export interface CodingTaskRequest {
  taskId: string;
  projectPath: string;
  prompt: string;
  allowedCommands?: string[];
  maxDurationMs?: number;
}

export interface CodingTaskResult {
  taskId: string;
  success: boolean;
  output: string;
  modifiedFiles?: string[];
  durationMs: number;
}

export interface ICodingEngineAdapter {
  name: string;
  executeTask(req: CodingTaskRequest, sandboxCtx?: SandboxContext): Promise<CodingTaskResult>;
}

export class OpenCodeAdapter implements ICodingEngineAdapter {
  public name = 'OpenCodeAdapter';

  constructor(private sandbox?: DockerSandbox) {}

  async executeTask(req: CodingTaskRequest, sandboxCtx?: SandboxContext): Promise<CodingTaskResult> {
    const startTime = Date.now();
    const cmd = ['opencode', 'run', '--prompt', req.prompt];

    if (this.sandbox && sandboxCtx) {
      try {
        const allowed = req.allowedCommands || ['opencode', 'npm', 'node', 'git', 'ls'];
        const res: CommandResult = await this.sandbox.executeCommand(sandboxCtx, cmd, allowed);
        return {
          taskId: req.taskId,
          success: res.exitCode === 0,
          output: res.stdout || res.stderr,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        return {
          taskId: req.taskId,
          success: false,
          output: `OpenCode Sandbox Execution Error: ${err.message}`,
          durationMs: Date.now() - startTime,
        };
      }
    }

    return {
      taskId: req.taskId,
      success: true,
      output: `[OpenCode Engine] Executed task '${req.taskId}' on path '${req.projectPath}' with prompt: ${req.prompt}`,
      modifiedFiles: [],
      durationMs: Date.now() - startTime,
    };
  }
}
