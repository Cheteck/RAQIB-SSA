import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { VerificationEngine } from '../../packages/verification/src/VerificationEngine';

describe('VerificationEngine Suite', () => {
  let engine: VerificationEngine;
  let testFilePath: string;

  beforeEach(() => {
    engine = new VerificationEngine();
    testFilePath = path.join(__dirname, 'test-file-' + Date.now() + '.txt');
  });

  afterEach(() => {
    if (fs.existsSync(testFilePath)) {
      try { fs.unlinkSync(testFilePath); } catch {}
    }
  });

  it('verifies existing non-empty file correctly', async () => {
    fs.writeFileSync(testFilePath, 'Sample evidence data');
    const result = await engine.verifyFileExists(testFilePath);
    expect(result.passed).toBe(true);
    expect(result.evidence).toMatch(/size: \d+ bytes/);
  });

  it('fails verification if file does not exist', async () => {
    const result = await engine.verifyFileExists('/non/existent/path/file.txt');
    expect(result.passed).toBe(false);
    expect(result.evidence).toMatch(/File not found/);
  });

  it('verifies command exit codes', async () => {
    const resPass = await engine.verifyCommandResult(0, 0);
    expect(resPass.passed).toBe(true);

    const resFail = await engine.verifyCommandResult(1, 0);
    expect(resFail.passed).toBe(false);
  });

  it('evaluates composite mission verification report', async () => {
    fs.writeFileSync(testFilePath, 'Valid evidence content');
    const report = await engine.verifyMission('M-TEST-01', [
      { id: 'CHK-1', type: 'FILE_EXISTS', target: testFilePath },
      { id: 'CHK-2', type: 'COMMAND_EXIT_CODE', target: '0', expected: 0 }
    ]);

    expect(report.passed).toBe(true);
    expect(report.results.length).toBe(2);
  });
});
