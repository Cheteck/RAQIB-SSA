import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface RepoInfo {
  root: string;
  branch: string;
  remote: string;
}

export class GitTool {
  constructor(private repoPath: string) {}

  async getRepoRoot(): Promise<string> {
    const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd: this.repoPath });
    return stdout.trim();
  }

  async listTrackedFiles(): Promise<string[]> {
    const { stdout } = await execAsync('git ls-tree -r --name-only HEAD', { cwd: this.repoPath });
    return stdout.split('\n').filter(Boolean);
  }

  async getStatus(): Promise<string> {
    const { stdout } = await execAsync('git status --porcelain', { cwd: this.repoPath });
    return stdout;
  }
}
