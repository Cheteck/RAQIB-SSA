import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class SafeCommandExecutor {
  constructor(private allowedCommands: string[] = ["npm", "node", "git", "tsc", "pytest", "python", "python3"]) {}

  async execute(commandStr: string, cwd: string): Promise<CommandResult> {
    const base = commandStr.trim().split(/\s+/)[0];
    if (!this.allowedCommands.includes(base)) {
      throw new Error(`Command '${base}' is forbidden by execution safety policy.`);
    }

    const filteredEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMP: process.env.TMP,
      TEMP: process.env.TEMP,
      NODE_ENV: process.env.NODE_ENV,
    };

    try {
      const { stdout, stderr } = await execAsync(commandStr, {
        cwd,
        timeout: 30000,
        env: filteredEnv,
      });
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
