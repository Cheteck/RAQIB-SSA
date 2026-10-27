import { ValidationResult } from "../../core/src";
import { SafeCommandExecutor } from "../../execution/src";

export class ProjectValidator {
  constructor(private executor = new SafeCommandExecutor()) {}

  async validateTask(cwd: string): Promise<ValidationResult[]> {
    const res = await this.executor.execute("npm run build", cwd);
    return [
      {
        name: "Build Check",
        status: res.exitCode === 0 ? "passed" : "failed",
        exitCode: res.exitCode,
        summary: res.stdout || res.stderr,
      },
    ];
  }
}
