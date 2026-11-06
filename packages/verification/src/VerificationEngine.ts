import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { VerificationResult, StructuredVerificationReport, VerificationVerdict } from '@raqib/shared';

const execAsync = promisify(exec);

export interface VerificationCheck {
  id: string;
  type: 'FILE_EXISTS' | 'GIT_UNCHANGED' | 'GIT_STATUS_UNCHANGED' | 'COMMAND_EXIT_CODE' | 'BUDGET_BOUND' | 'CUSTOM';
  target: string;
  expected?: unknown;
}

// Re-export shared type for backward compatibility
export type { VerificationResult } from '@raqib/shared';
export type VerificationReport = StructuredVerificationReport;

export class VerificationEngine {
  async verifyFileExists(filePath: string, schema?: unknown): Promise<VerificationResult> {
    const timestamp = new Date().toISOString();
    try {
      if (!fs.existsSync(filePath)) {
        return {
          checkId: 'FILE_EXISTS_' + path.basename(filePath),
          passed: false,
          evidence: `File not found: ${filePath}`,
          method: 'fs.existsSync',
          timestamp
        };
      }
      const stats = fs.statSync(filePath);
      return {
        checkId: 'FILE_EXISTS_' + path.basename(filePath),
        passed: stats.size > 0,
        evidence: `File exists, size: ${stats.size} bytes`,
        method: 'fs.statSync',
        timestamp,
        uncertainty: stats.size === 0 ? 'File is empty' : undefined
      };
    } catch (err: any) {
      return {
        checkId: 'FILE_EXISTS_' + path.basename(filePath),
        passed: false,
        evidence: `Error checking file: ${err.message}`,
        method: 'fs.statSync',
        timestamp
      };
    }
  }

  async verifyGitUnchanged(repoPath: string, beforeSha: string): Promise<VerificationResult> {
    const timestamp = new Date().toISOString();
    try {
      const { stdout: currentSha } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
      const { stdout: diffStatus } = await execAsync('git status --porcelain', { cwd: repoPath });

      const shaMatch = currentSha.trim() === beforeSha.trim();
      const cleanWorkingTree = diffStatus.trim() === '';

      const passed = shaMatch && cleanWorkingTree;
      return {
        checkId: 'GIT_UNCHANGED',
        passed,
        evidence: `SHA match: ${shaMatch} (${currentSha.trim()} vs ${beforeSha.trim()}), Clean tree: ${cleanWorkingTree}`,
        method: 'git rev-parse & status',
        timestamp,
        uncertainty: !passed ? 'Git state modified during run' : undefined
      };
    } catch (err: any) {
      return {
        checkId: 'GIT_UNCHANGED',
        passed: false,
        evidence: `Failed to query git state: ${err.message}`,
        method: 'git CLI',
        timestamp,
        uncertainty: 'Git command failure'
      };
    }
  }

  async verifyGitStatusUnchanged(repoPath: string, beforePorcelain: string): Promise<VerificationResult> {
    const timestamp = new Date().toISOString();
    try {
      const { stdout: currentPorcelain } = await execAsync('git status --porcelain', { cwd: repoPath });
      const normalize = (s: string) =>
        s.split('\n').filter(Boolean).map((l) => l.trimEnd()).sort().join('\n');
      const passed = normalize(currentPorcelain) === normalize(beforePorcelain);
      return {
        checkId: 'GIT_STATUS_UNCHANGED',
        passed,
        evidence: passed
          ? 'git status --porcelain identical to baseline (no modification by mission)'
          : `git status --porcelain changed. Baseline lines: ${beforePorcelain.split('\n').filter(Boolean).length}, current lines: ${currentPorcelain.split('\n').filter(Boolean).length}`,
        method: 'git status --porcelain (baseline diff)',
        timestamp,
        uncertainty: !passed ? 'Working tree changed during run' : undefined
      };
    } catch (err: any) {
      return {
        checkId: 'GIT_STATUS_UNCHANGED',
        passed: false,
        evidence: `Failed to query git status: ${err.message}`,
        method: 'git CLI',
        timestamp,
        uncertainty: 'Git command failure'
      };
    }
  }

  async verifyCommandResult(exitCode: number, expected: number = 0): Promise<VerificationResult> {
    const timestamp = new Date().toISOString();
    const passed = exitCode === expected;
    return {
      checkId: 'COMMAND_EXIT_CODE',
      passed,
      evidence: `Exit code: ${exitCode}, Expected: ${expected}`,
      method: 'exitCode assertion',
      timestamp
    };
  }

  async verifyMission(missionId: string, checks: VerificationCheck[]): Promise<StructuredVerificationReport> {
    const results: VerificationResult[] = [];
    let overallPassed = true;
    let hasBlocked = false;

    for (const check of checks) {
      let res: VerificationResult;
      switch (check.type) {
        case 'FILE_EXISTS':
          res = await this.verifyFileExists(check.target, check.expected);
          break;
        case 'GIT_UNCHANGED':
          res = await this.verifyGitUnchanged(check.target, String(check.expected ?? ''));
          break;
        case 'GIT_STATUS_UNCHANGED':
          res = await this.verifyGitStatusUnchanged(check.target, String(check.expected ?? ''));
          break;
        case 'COMMAND_EXIT_CODE':
          res = await this.verifyCommandResult(Number(check.target), Number(check.expected ?? 0));
          break;
        default:
          hasBlocked = true;
          res = {
            checkId: check.id,
            passed: false,
            evidence: 'Unsupported check type',
            method: 'none',
            timestamp: new Date().toISOString(),
            uncertainty: 'Unknown check type'
          };
      }
      if (!res.passed) {
        overallPassed = false;
        if (res.uncertainty?.includes('failure') || res.uncertainty?.includes('Unknown')) {
          hasBlocked = true;
        }
      }
      results.push(res);
    }

    let verdict: VerificationVerdict = 'PASS';
    if (!overallPassed) {
      verdict = hasBlocked ? 'BLOCKED' : 'FAIL';
    }

    const summary = overallPassed
      ? `All ${checks.length} verification checks passed successfully.`
      : `Verification failed: ${results.filter(r => !r.passed).length}/${checks.length} checks failed. Verdict: ${verdict}`;

    return {
      missionId,
      verdict,
      passed: overallPassed,
      timestamp: new Date().toISOString(),
      results,
      summary,
    };
  }
}
