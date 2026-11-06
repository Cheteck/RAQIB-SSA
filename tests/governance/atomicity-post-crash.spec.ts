/**
 * G7 Lot 4 - Chantier 6: Preuve d'atomicite post-crash
 *
 * OBSERVATION CRITIQUE (nuance ChatGPT-web):
 * L'etat mission (SQLite, MissionEngine) et les evenements ledger (SQLite,
 * AuditLedger) sont ecris via DEUX CONNEXIONS DISTINCTES. Un crash entre
 * les deux ecritures produit un asynchrone LEGITIME.
 *
 * GARANTIE RAQIB: IDEMPOTENCE RESTAURATIVE via resumeMission() + runNextStep().
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MissionEngine } from '../../packages/mission-engine/src/MissionEngine';
import { AuditLedger } from '../../packages/audit-ledger/src/AuditLedger';
import { PolicyEngine } from '../../packages/policy-engine/src/PolicyEngine';

describe('G7 Lot 4 - Chantier 6: Atomicite post-crash', () => {
  let testDbPath: string;
  let testAuditDbPath: string;
  let ledger: AuditLedger;
  let policyEngine: PolicyEngine;
  let missionEngine: MissionEngine;
  const executedSteps = new Set<string>();

  const doneExecutor = async () => ({
    status: 'DONE' as const,
    result: { output: 'ok' },
    proof: 'proof',
  });

  // Throw on step-2 to simulate hard crash (no STEP_COMPLETED logged)
  const crashOnStep2 = async (_m: any, step: any) => {
    executedSteps.add(step.id);
    if (step.name === 'step-2') throw new Error('CRASH');
    return { status: 'DONE' as const, result: {}, proof: '' };
  };

  // Fail once then succeed (for recovery test)
  const failOnceThenDone = (() => {
    let n = 0;
    return async (_m: any, step: any) => {
      if (step.name === 'step-2') {
        n += 1;
        if (n === 1) return { status: 'FAILED' as const, error: 'fail1' };
      }
      return { status: 'DONE' as const, result: {}, proof: '' };
    };
  })();

  beforeEach(async () => {
    const rnd = Math.floor(Math.random() * 1e6);
    testDbPath = path.join(__dirname, `test-atomicity-${Date.now()}-${rnd}.db`);
    testAuditDbPath = path.join(__dirname, `test-atomicity-audit-${Date.now()}-${rnd}.db`);
    executedSteps.clear();
    ledger = new AuditLedger(testAuditDbPath);
    await ledger.init();
    policyEngine = new PolicyEngine({ dbPath: testDbPath });
    missionEngine = new MissionEngine({ dbPath: testDbPath, ledger, policy: policyEngine });
    missionEngine.setStepExecutor(doneExecutor);
  });

  afterEach(async () => {
    ledger.close();
    policyEngine.close();
    missionEngine.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testAuditDbPath)) fs.unlinkSync(testAuditDbPath);
  });

  it('INV-1: Etat mission coherent apres crash (RUNNING, executionRecorded=false)', async () => {
    const mission = await missionEngine.createMission({
      id: 'A1',
      name: 'A1',
      objective: 'x',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: [],
      steps: [{ name: 'step-1' }, { name: 'step-2' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'go');
    missionEngine.setStepExecutor(crashOnStep2);

    await missionEngine.runNextStep(mission.id); // step-1 OK
    await expect(missionEngine.runNextStep(mission.id)).rejects.toThrow(); // step-2 CRASH

    const m = await missionEngine.getMission(mission.id);
    expect(m!.status).toBe('RUNNING');
    expect(m!.steps[0].status).toBe('DONE');
    expect(m!.steps[0].executionRecorded).toBe(true);
    expect(m!.steps[1].status).toBe('RUNNING'); // persiste avant exec (l.377-380)
    expect(m!.steps[1].executionRecorded).toBe(false);
  });

  it('INV-2: Ledger gap coherent (STEP_STARTED sans STEP_COMPLETED)', async () => {
    const mission = await missionEngine.createMission({
      id: 'A2',
      name: 'A2',
      objective: 'x',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: [],
      steps: [{ name: 'step-1' }, { name: 'step-2' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'go');
    missionEngine.setStepExecutor(crashOnStep2);

    await missionEngine.runNextStep(mission.id);
    await expect(missionEngine.runNextStep(mission.id)).rejects.toThrow();

    const events = await ledger.query({ missionId: mission.id });
    const started = events.filter(e => e.type === 'STEP_STARTED');
    const completed = events.filter(e => e.type === 'STEP_COMPLETED');

    // step-0:Started + Completed
    expect(started.some(e => e.stepId === 'A2-step-0')).toBe(true);
    expect(completed.some(e => e.stepId === 'A2-step-0')).toBe(true);
    // step-1:Started SANS Completed (crash avant log)
    expect(started.some(e => e.stepId === 'A2-step-1')).toBe(true);
    expect(completed.some(e => e.stepId === 'A2-step-1')).toBe(false);
  });

  it('INV-3: Idempotence restaurative (resume + re-execute -> VERIFYING)', async () => {
    const mission = await missionEngine.createMission({
      id: 'A3',
      name: 'A3',
      objective: 'x',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: [],
      steps: [{ name: 'step-1' }, { name: 'step-2' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'go');
    await missionEngine.runNextStep(mission.id); // step-1 OK

    missionEngine.setStepExecutor(failOnceThenDone);
    await missionEngine.runNextStep(mission.id).catch(() => {}); // step-2 FAIL

    // Simule crash: RUNNING, executionRecorded=false
    const m = await missionEngine.getMission(mission.id);
    m!.steps[1].status = 'RUNNING';
    m!.steps[1].executionRecorded = false;
    missionEngine.persist(missionEngine.updateSteps(m!, m!.steps[1]));

    await missionEngine.resumeMission(mission.id); // RUNNING->PENDING

    const m2 = await missionEngine.getMission(mission.id);
    expect(m2!.steps[1].status).toBe('PENDING');

    await missionEngine.runNextStep(mission.id); // re-execute -> DONE

    const m3 = await missionEngine.getMission(mission.id);
    expect(m3!.status).toBe('VERIFYING');
    expect(m3!.steps[1].executionRecorded).toBe(true);

    const events = await ledger.query({ missionId: mission.id });
    expect(events.some(e => e.type === 'RECOVERY_TRIGGERED')).toBe(true);
    expect(events.some(e => e.type === 'STEP_COMPLETED' && e.stepId === 'A3-step-1')).toBe(true);
  });
});
