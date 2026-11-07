import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MissionEngine } from '../../packages/mission-engine/src/MissionEngine';
import { AuditLedger } from '../../packages/audit-ledger/src/AuditLedger';
import { PolicyEngine } from '../../packages/policy-engine/src/PolicyEngine';
import { MissionStatus, AutonomyLevel } from '../../packages/shared/src/types';

describe('MissionEngine Crash Recovery & Idempotence', () => {
  let testDbPath: string;
  let testAuditDbPath: string;
  let ledger: AuditLedger;
  let policyEngine: PolicyEngine;
  let missionEngine: MissionEngine;

  // Simulated executor that tracks side effects
  const executedSteps: Map<string, number> = new Map();
  let executorCalls: Array<{ missionId: string; stepId: string; callCount: number }> = [];

  const mockExecutor = async (mission: any, step: any) => {
    const key = `${mission.id}:${step.id}`;
    const count = (executedSteps.get(key) || 0) + 1;
    executedSteps.set(key, count);

    executorCalls.push({ missionId: mission.id, stepId: step.id, callCount: count });

    // Simulate step that succeeds
    return {
      status: 'DONE' as const,
      result: { output: `Step ${step.name} executed` },
      proof: `Proof for ${step.name}`,
    };
  };

  beforeEach(async () => {
    testDbPath = path.join(__dirname, `test-mission-${Date.now()}.db`);
    testAuditDbPath = path.join(__dirname, `test-audit-${Date.now()}.db`);

    executedSteps.clear();
    executorCalls = [];

    ledger = new AuditLedger(testAuditDbPath);
    await ledger.init();

    policyEngine = new PolicyEngine({ dbPath: testDbPath });

    missionEngine = new MissionEngine({
      dbPath: testDbPath,
      ledger,
      policy: policyEngine,
    });

    missionEngine.setStepExecutor(mockExecutor);
  });

  afterEach(async () => {
    await ledger.close();
    policyEngine.close();
    missionEngine.close();

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testAuditDbPath)) fs.unlinkSync(testAuditDbPath);
  });

  it('should create mission with idempotencyKey on each step', async () => {
    const mission = await missionEngine.createMission({
      id: 'CRASH-TEST-001',
      name: 'Crash Recovery Test',
      objective: 'Verify idempotency keys are generated',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Steps have idempotencyKey'],
      steps: [{ name: 'step-one' }, { name: 'step-two' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    expect(mission.steps[0].idempotencyKey).toBe('CRASH-TEST-001:CRASH-TEST-001-step-0');
    expect(mission.steps[1].idempotencyKey).toBe('CRASH-TEST-001:CRASH-TEST-001-step-1');
    expect(mission.steps[0].executionRecorded).toBe(false);
    expect(mission.steps[1].executionRecorded).toBe(false);
  });

  it('should NOT re-execute a step already marked executionRecorded=true after resume', async () => {
    // Create and run a mission fully
    const mission = await missionEngine.createMission({
      id: 'CRASH-TEST-002',
      name: 'Idempotence After Full Run',
      objective: 'Step recorded then resume should skip',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['No duplicate execution'],
      steps: [{ name: 'step-one' }, { name: 'step-two' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    // Transition to RUNNING
    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'test');

    // Execute step 1
    await missionEngine.runNextStep(mission.id);
    // Execute step 2
    await missionEngine.runNextStep(mission.id);

    // Verify both steps marked executionRecorded=true
    const completedMission = await missionEngine.getMission(mission.id);
    expect(completedMission!.steps[0].executionRecorded).toBe(true);
    expect(completedMission!.steps[1].executionRecorded).toBe(true);
    expect(completedMission!.steps[0].status).toBe('DONE');
    expect(completedMission!.steps[1].status).toBe('DONE');

    // Simulate crash + resume: call recoverInterrupted (would find RUNNING missions)
    // Here we manually test resumeMission on a completed mission
    await missionEngine.resumeMission(mission.id);

    // Re-get mission
    const resumedMission = await missionEngine.getMission(mission.id);

    // Steps should remain DONE, currentStepIndex should not advance further
    expect(resumedMission!.steps[0].status).toBe('DONE');
    expect(resumedMission!.steps[1].status).toBe('DONE');

    // Key: executor should NOT have been called again
    const step0Calls = executorCalls.filter(c => c.stepId === 'CRASH-TEST-002-step-0');
    const step1Calls = executorCalls.filter(c => c.stepId === 'CRASH-TEST-002-step-1');
    expect(step0Calls.length).toBe(1);
    expect(step1Calls.length).toBe(1);
  });

  it('should re-execute a step that was RUNNING but NOT executionRecorded after crash', async () => {
    // Create mission
    await missionEngine.createMission({
      id: 'CRASH-TEST-003',
      name: 'Crash Mid-Execution',
      objective: 'Step was RUNNING, not recorded -> should re-execute',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Re-execute crashed step'],
      steps: [{ name: 'step-one' }, { name: 'step-two' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    // Transition to RUNNING
    await missionEngine.transitionStatus('CRASH-TEST-003', 'RUNNING', 'test');

    // Manually set step 0 to RUNNING (simulating crash during execution, before persist of DONE)
    const mission = await missionEngine.getMission('CRASH-TEST-003');
    mission!.steps[0].status = 'RUNNING';
    mission!.steps[0].startedAt = new Date().toISOString();
    mission!.steps[0].attempts = 1;
    mission!.steps[0].executionRecorded = false; // NOT recorded yet!
    missionEngine.persist(missionEngine.updateSteps(mission!, mission!.steps[0]));

    // Now simulate resume after crash
    await missionEngine.resumeMission('CRASH-TEST-003');

    // Step should be back to PENDING (ready for re-execution)
    const afterResume = await missionEngine.getMission('CRASH-TEST-003');
    expect(afterResume!.steps[0].status).toBe('PENDING');
    expect(afterResume!.steps[0].startedAt).toBeUndefined();
    expect(afterResume!.steps[0].executionRecorded).toBe(false);

    // Now run it -> should execute
    await missionEngine.runNextStep('CRASH-TEST-003');

    // Verify it was executed once
    const finalMission = await missionEngine.getMission('CRASH-TEST-003');
    expect(finalMission!.steps[0].executionRecorded).toBe(true);
    expect(finalMission!.steps[0].status).toBe('DONE');

    const step0Calls = executorCalls.filter(c => c.stepId === 'CRASH-TEST-003-step-0');
    expect(step0Calls.length).toBe(1);
  });

  it('should handle multiple resume calls idempotently', async () => {
    await missionEngine.createMission({
      id: 'CRASH-TEST-004',
      name: 'Multiple Resume',
      objective: 'Multiple resume calls should not cause duplicates',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Idempotent resume'],
      steps: [{ name: 'step-one' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus('CRASH-TEST-004', 'RUNNING', 'test');

    // Simulate crash during step execution (RUNNING, not recorded)
    const mission = await missionEngine.getMission('CRASH-TEST-004');
    mission!.steps[0].status = 'RUNNING';
    mission!.steps[0].startedAt = new Date().toISOString();
    mission!.steps[0].attempts = 1;
    mission!.steps[0].executionRecorded = false;
    missionEngine.persist(missionEngine.updateSteps(mission!, mission!.steps[0]));

    // First resume
    await missionEngine.resumeMission('CRASH-TEST-004');
    // Second resume (simulating double startup)
    await missionEngine.resumeMission('CRASH-TEST-004');
    // Third resume
    await missionEngine.resumeMission('CRASH-TEST-004');

    // Should still be PENDING, not DONE
    const afterResumes = await missionEngine.getMission('CRASH-TEST-004');
    expect(afterResumes!.steps[0].status).toBe('PENDING');
    expect(afterResumes!.steps[0].executionRecorded).toBe(false);
  });

  it('recoverInterrupted should find RUNNING missions and resume them', async () => {
    await missionEngine.createMission({
      id: 'CRASH-TEST-005',
      name: 'Recover Interrupted',
      objective: 'recoverInterrupted finds RUNNING missions',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Mission recovered'],
      steps: [{ name: 'step-one' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus('CRASH-TEST-005', 'RUNNING', 'test');

    // Simulate crash mid-step
    const mission = await missionEngine.getMission('CRASH-TEST-005');
    mission!.steps[0].status = 'RUNNING';
    mission!.steps[0].startedAt = new Date().toISOString();
    mission!.steps[0].attempts = 1;
    mission!.steps[0].executionRecorded = false;
    missionEngine.persist(missionEngine.updateSteps(mission!, mission!.steps[0]));

    // Call recoverInterrupted
    const recovered = await missionEngine.recoverInterrupted();

    expect(recovered.length).toBe(1);
    expect(recovered[0].id).toBe('CRASH-TEST-005');

    const afterRecover = await missionEngine.getMission('CRASH-TEST-005');
    expect(afterRecover!.steps[0].status).toBe('PENDING');
  });

  it('G7: should emit correct audit events without duplicates on recovery', async () => {
    // Create mission
    await missionEngine.createMission({
      id: 'G7-AUDIT-001',
      name: 'G7 Audit Events Test',
      objective: 'Verify audit events on recovery',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Correct events emitted'],
      steps: [{ name: 'step-one' }, { name: 'step-two' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    // Transition to RUNNING (should emit MISSION_STARTED)
    await missionEngine.transitionStatus('G7-AUDIT-001', 'RUNNING', 'test start');

    // Query ledger for MISSION_STARTED events
    let events = await ledger.query({ missionId: 'G7-AUDIT-001' });
    const missionStartedEvents = events.filter(e => e.type === 'MISSION_STARTED');
    expect(missionStartedEvents.length).toBe(1);
    expect(missionStartedEvents[0].data).toEqual({ from: 'APPROVED', to: 'RUNNING', reason: 'test start' });

    // Execute first step (should emit STEP_STARTED and STEP_COMPLETED)
    await missionEngine.runNextStep('G7-AUDIT-001');

    events = await ledger.query({ missionId: 'G7-AUDIT-001' });
    const stepStartedEvents = events.filter(e => e.type === 'STEP_STARTED');
    const stepCompletedEvents = events.filter(e => e.type === 'STEP_COMPLETED' && e.data?.status === 'DONE');
    expect(stepStartedEvents.length).toBe(1);
    expect(stepCompletedEvents.length).toBe(1);
    expect(stepStartedEvents[0].stepId).toBe('G7-AUDIT-001-step-0');
    expect(stepCompletedEvents[0].stepId).toBe('G7-AUDIT-001-step-0');

    // Simulate crash on second step (RUNNING but not recorded)
    const mission = await missionEngine.getMission('G7-AUDIT-001');
    mission!.steps[1].status = 'RUNNING';
    mission!.steps[1].startedAt = new Date().toISOString();
    mission!.steps[1].attempts = 1;
    mission!.steps[1].executionRecorded = false;
    missionEngine.persist(missionEngine.updateSteps(mission!, mission!.steps[1]));

    // Call resumeMission (should emit RECOVERY_TRIGGERED, NOT another MISSION_STARTED)
    await missionEngine.resumeMission('G7-AUDIT-001');

    events = await ledger.query({ missionId: 'G7-AUDIT-001' });
    const recoveryEvents = events.filter(e => e.type === 'RECOVERY_TRIGGERED');
    const missionStartedAfterRecovery = events.filter(e => e.type === 'MISSION_STARTED');
    expect(recoveryEvents.length).toBe(1);
    expect(missionStartedAfterRecovery.length).toBe(1); // Still only the original one

    // Verify no duplicate STEP_STARTED from resume (step was reset to PENDING, not re-executed yet)
    const stepStartedAfterRecovery = events.filter(e => e.type === 'STEP_STARTED' && e.stepId === 'G7-AUDIT-001-step-1');
    expect(stepStartedAfterRecovery.length).toBe(0); // Not started yet, just reset to PENDING
  });
});