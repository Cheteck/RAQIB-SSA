import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface RepoInfo {
  toplevel: string;
  currentBranch: string;
  branches: string[];
  remotes: Record<string, string>;
}

export interface CommitInfo {
  sha: string;
  author: string;
  date: string;
  message: string;
}

/**
 * GitTool — Actions en lecture seule uniquement.
 * INTERDIT : commit, push, checkout -b, merge, reset --hard.
 * Seules les commandes git de lecture sont autorisées (rev-parse, branch,
 * remote, ls-tree, log, diff, status).
 */
export class GitTool {
  private async git(repoPath: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', ['-C', repoPath, ...args], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }

  /** git rev-parse --show-toplevel */
  async getRepoRoot(repoPath: string): Promise<string> {
    return (await this.git(repoPath, ['rev-parse', '--show-toplevel'])).trim();
  }

  /** git branch -v + git remote -v + git branch --show-current */
  async getRepoInfo(repoPath: string): Promise<RepoInfo> {
    const toplevel = (await this.git(repoPath, ['rev-parse', '--show-toplevel'])).trim();

    const branchLines = (await this.git(repoPath, ['branch', '-v']))
      .split('\n')
      .filter(Boolean);
    const currentBranch = (await this.git(repoPath, ['branch', '--show-current'])).trim();

    const remoteLines = (await this.git(repoPath, ['remote', '-v'])).split('\n').filter(Boolean);
    const remotes: Record<string, string> = {};
    for (const line of remoteLines) {
      const [name, url, direction] = line.split(/\s+/);
      if (name && url && direction !== '(push)') {
        remotes[name] = url;
      }
    }

    return { toplevel, currentBranch, branches: branchLines, remotes };
  }

  /** git ls-tree -r --name-only HEAD */
  async listTrackedFiles(repoPath: string): Promise<string[]> {
    const out = await this.git(repoPath, ['ls-tree', '-r', '--name-only', 'HEAD']);
    return out.split('\n').filter(Boolean);
  }

  /** git log --pretty=format:%H|%an|%ad|%s -n {n} */
  async getRecentCommits(repoPath: string, n: number = 10): Promise<CommitInfo[]> {
    const out = await this.git(repoPath, [
      'log',
      `--pretty=format:%H%x1f%an%x1f%ad%x1f%s`,
      `--date=iso-strict`,
      `-n`,
      String(n),
    ]);
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, author, date, message] = line.split('\x1f');
        return { sha, author, date, message: message ?? '' };
      });
  }

  /** git diff (doit être VIDE après audit) */
  async getDiff(repoPath: string): Promise<string> {
    return await this.git(repoPath, ['diff']);
  }

  /** git status --porcelain */
  async getStatus(repoPath: string): Promise<string> {
    return await this.git(repoPath, ['status', '--porcelain']);
  }

  /** git rev-parse HEAD */
  async getCurrentCommitSha(repoPath: string): Promise<string> {
    return (await this.git(repoPath, ['rev-parse', 'HEAD'])).trim();
  }
}
