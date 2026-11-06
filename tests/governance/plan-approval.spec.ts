import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MissionEngine } from '../../packages/mission-engine/src/MissionEngine';
import { AuditLedger } from '@raqib/audit-ledger';
import { PolicyEngine } from '@raqib/policy-engine';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('G4 Plan Approval & Integrity Suite', () => {
  let missionEngine: MissionEngine;
  let ledger: AuditLedger;
  let policy: PolicyEngine;
  let tmpDir: string;
  let dbPath: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g4-test-'));
    dbPath = path.join(tmpDir, 'g4-test.db');
    ledger = new AuditLedger(dbPath);
    await ledger.init();
    policy = new PolicyEngine({ dbPath });
    missionEngine = new MissionEngine({ dbPath, ledger, policy });
  });

  afterEach(async () => {
    missionEngine.close();
    (policy as any).db.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should generate MissionPlanArtifact with contentHash on mission creation when approvalRequired=true', async () => {
    const mission = await missionEngine.createMission({
      id: 'm-g4-1',
      name: 'Test Plan Mission',
      autonomyLevel: 'A2',
      objective: 'Test plan generation',
      constraints: ['file:src/index.ts'],
      successCriteria: ['All tests pass'],
      steps: [{ name: 'Step 1: Test', maxAttempts: 1 }],
      approvalRequired: true,
      budgetLimitEur: 50,
      maxDurationMs: 60000,
      maxAttempts: 1,
    });

    expect(mission.status).toBe('PLANNED');
    expect(mission.planArtifact).toBeDefined();
    expect(mission.planArtifact?.contentHash).toBeDefined();
    expect(mission.planArtifact?.estimatedBudgetCents).toBe(5000);
  });

  it('should allow transition to APPROVED when plan artifact is intact and valid', async () => {
    const mission = await missionEngine.createMission({
      id: 'm-g4-2',
      name: 'Test Approval',
      autonomyLevel: 'A2',
      objective: 'Approve mission',
      constraints: [],
      successCriteria: [],
      steps: [{ name: 'Build', maxAttempts: 1 }],
      approvalRequired: true,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 1,
    });

    const approved = await missionEngine.transitionStatus('m-g4-2', 'APPROVED', 'Human approved');
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedPlanHash).toBe(mission.planArtifact?.contentHash);
  });

  it('should reject transition to APPROVED if plan content has been tampered with', async () => {
    const mission = await missionEngine.createMission({
      id: 'm-g4-3',
      name: 'Tamper Test',
      autonomyLevel: 'A2',
      objective: 'Tamper test',
      constraints: [],
      successCriteria: [],
      steps: [{ name: 'Step 1', maxAttempts: 1 }],
      approvalRequired: true,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 1,
    });

    // Tamper with plan summary
    mission.planArtifact!.summary = 'Tampered objective';
    // Persist tampered mission directly
    (missionEngine as any).persist(mission);

    await expect(missionEngine.transitionStatus('m-g4-3', 'APPROVED', 'Trying to approve tampered plan'))
      .rejects.toThrow(/G4 Violation: Plan content hash mismatch/);
  });
});
