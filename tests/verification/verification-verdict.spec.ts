import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MissionEngine } from '../../packages/mission-engine/src/MissionEngine';
import { AuditLedger } from '@raqib/audit-ledger';
import { PolicyEngine } from '@raqib/policy-engine';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('G1 Verification Engine Verdict Enforcement', () => {
  let missionEngine: MissionEngine;
  let ledger: AuditLedger;
  let policy: PolicyEngine;
  let tmpDir: string;
  const testDb = path.join(__dirname, 'g1-test.db');

  const baseMission = {
    id: 'm1',
    name: 'test mission',
    status: 'VERIFYING' as const,
    autonomyLevel: 'A2',
    objective: 'unit test objective',
    constraints: [],
    successCriteria: [],
    steps: [],
    currentStepIndex: 0,
    approvalRequired: false,
    budgetLimitEur: 100,
    budgetUsedEur: 0,
    maxDurationMs: 60000,
    maxAttempts: 1,
    timeoutAt: '2026-11-06T12:00:00Z',
    createdAt: '2026-11-06T11:00:00Z',
    evidences: [],
  };

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-test-'));
    const dbPath = path.join(tmpDir, 'g1-test.db');
    ledger = new AuditLedger(dbPath);
    await ledger.init();
    policy = new PolicyEngine({ dbPath });
    missionEngine = new MissionEngine({ dbPath, ledger, policy });
    // Insert mission directly (bypass createMission to start in VERIFYING)
    (missionEngine as any).db.prepare(
      'INSERT INTO missions (id, status, data) VALUES (?, ?, ?)',
    ).run('m1', 'VERIFYING', JSON.stringify(baseMission));
  });

  afterEach(async () => {
    missionEngine.close();
    (policy as any).db.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should reject SUCCEEDED transition without report (G1 violation)', async () => {
    await expect(missionEngine.transitionStatus('m1', 'SUCCEEDED', 'test'))
      .rejects.toThrow(/G1 Violation/);
    const m = await missionEngine.getMission('m1');
    expect(m!.status).toBe('VERIFYING'); // unchanged
  });

  it('should transition to SUCCEEDED with PASS report', async () => {
    const report = {
      missionId: 'm1',
      verdict: 'PASS' as const,
      passed: true,
      timestamp: new Date().toISOString(),
      results: [{ checkId: 'c1', passed: true, evidence: 'ok', method: 'test', timestamp: new Date().toISOString() }],
      summary: 'All checks passed',
    };
    const m = await missionEngine.transitionStatus('m1', 'SUCCEEDED', 'ok', report);
    expect(m.status).toBe('SUCCEEDED');
    expect(m.verificationReport?.verdict).toBe('PASS');
    expect(m.completedAt).toBeDefined();
  });

  it('should redirect to FAILED when SUCCEEDED requested with FAIL report', async () => {
    const report = {
      missionId: 'm1',
      verdict: 'FAIL' as const,
      passed: false,
      timestamp: new Date().toISOString(),
      results: [],
      summary: 'Check failed',
    };
    const m = await missionEngine.transitionStatus('m1', 'SUCCEEDED', 'ok', report);
    expect(m.status).toBe('FAILED');
    expect(m.verificationReport?.verdict).toBe('FAIL');
    expect(m.failedAt).toBeDefined();
  });

  it('should redirect to BLOCKED when SUCCEEDED requested with BLOCKED report', async () => {
    const report = {
      missionId: 'm1',
      verdict: 'BLOCKED' as const,
      passed: false,
      timestamp: new Date().toISOString(),
      results: [],
      summary: 'Resource inaccessible',
    };
    const m = await missionEngine.transitionStatus('m1', 'SUCCEEDED', 'ok', report);
    expect(m.status).toBe('BLOCKED');
    expect(m.verificationReport?.verdict).toBe('BLOCKED');
  });

  it('should log VERIFICATION_RESULT in AuditLedger', async () => {
    const report = {
      missionId: 'm1',
      verdict: 'PASS' as const,
      passed: true,
      timestamp: new Date().toISOString(),
      results: [],
      summary: 'ok',
    };
    await missionEngine.transitionStatus('m1', 'SUCCEEDED', 'ok', report);
    const events = await missionEngine.getAuditTrail('m1');
    const verificationEvents = events.filter(e => e.type === 'VERIFICATION_RESULT');
    expect(verificationEvents.length).toBe(1);
    expect(verificationEvents[0].data.verdict).toBe('PASS');
  });
});
