import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class SafeCommandExecutor {
  constructor(private allowedCommands: string[] = ["npm", "node", "git", "tsc"]) {}

  async execute(commandStr: string, cwd: string): Promise<CommandResult> {
    const base = commandStr.trim().split(/\s+/)[0];
    if (!this.allowedCommands.includes(base)) {
      throw new Error(`Command '${base}' is forbidden by execution safety policy.`);
    }

    try {
      const { stdout, stderr } = await execAsync(commandStr, { cwd, timeout: 30000 });
      return { exitCode: 0, stdout, stderr };
    } catch (err: any) {
      return {
        exitCode: err.code || 1,
        stdout: err.stdout || "",
        stderr: err.stderr || err.message,
      };
    }
  }
}
