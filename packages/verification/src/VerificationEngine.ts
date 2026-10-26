import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VerificationCheck {
  id: string;
  type: 'FILE_EXISTS' | 'GIT_UNCHANGED' | 'COMMAND_EXIT_CODE' | 'BUDGET_BOUND' | 'CUSTOM';
  target: string;
  expected?: unknown;
}

export interface VerificationResult {
  checkId: string;
  passed: boolean;
  evidence: string;
  method: string;
  timestamp: string;
  uncertainty?: string;
}

export interface VerificationReport {
  missionId: string;
  passed: boolean;
  timestamp: string;
  results: VerificationResult[];
}

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

  async verifyMission(missionId: string, checks: VerificationCheck[]): Promise<VerificationReport> {
    const results: VerificationResult[] = [];
    let overallPassed = true;

    for (const check of checks) {
      let res: VerificationResult;
      switch (check.type) {
        case 'FILE_EXISTS':
          res = await this.verifyFileExists(check.target, check.expected);
          break;
        case 'GIT_UNCHANGED':
          res = await this.verifyGitUnchanged(check.target, String(check.expected ?? ''));
          break;
        case 'COMMAND_EXIT_CODE':
          res = await this.verifyCommandResult(Number(check.target), Number(check.expected ?? 0));
          break;
        default:
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
      }
      results.push(res);
    }

    return {
      missionId,
      passed: overallPassed,
      timestamp: new Date().toISOString(),
      results
    };
  }
}
