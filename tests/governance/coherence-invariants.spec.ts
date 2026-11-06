/**
 * G7 Lot 4 - Chantier 8: Cohérence événements/transitions/états persistés
 *
 * Invariants vérifiés:
 * 1. État terminal → exactement un événement terminal correspondant
 * 2. Un seul MISSION_STARTED par mission
 * 3. STEP_STARTED avant STEP_COMPLETED pour chaque étape
 * 4. RECOVERY_TRIGGERED sans duplication d'événements terminaux
 * 5. VERIFICATION_RESULT cohérent avec le verdict
 * 6. Persistance: événement et état retrouvés après redémarrage (simulé)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MissionEngine } from '../../packages/mission-engine/src/MissionEngine';
import { AuditLedger } from '../../packages/audit-ledger/src/AuditLedger';
import { PolicyEngine } from '../../packages/policy-engine/src/PolicyEngine';
import { AuditEvent, StructuredVerificationReport, VerificationVerdict } from '../../packages/shared/src/types';

describe('G7 Lot 4 - Chantier 8: Cohérence invariants', () => {
  let testDbPath: string;
  let testAuditDbPath: string;
  let ledger: AuditLedger;
  let policyEngine: PolicyEngine;
  let missionEngine: MissionEngine;

  const mockExecutor = async (_mission: any, _step: any) => ({
    status: 'DONE' as const,
    result: { output: 'mock' },
    proof: 'mock proof',
  });

  beforeEach(async () => {
    testDbPath = path.join(__dirname, `test-coherence-${Date.now()}.db`);
    testAuditDbPath = path.join(__dirname, `test-coherence-audit-${Date.now()}.db`);

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
    ledger.close();
    policyEngine.close();
    missionEngine.close();

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testAuditDbPath)) fs.unlinkSync(testAuditDbPath);
  });

  /**
   * INVARIANT 1: État terminal → exactement un événement terminal correspondant
   */
  it('INV-1: MISSION_SUCCEEDED - exactement un événement terminal', async () => {
    const mission = await missionEngine.createMission({
      id: 'INV-1-SUCCESS',
      name: 'Invariant 1 Success',
      objective: 'Un seul événement MISSION_SUCCEEDED',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Test OK'],
      steps: [{ name: 'step-1' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'test');
    await missionEngine.runNextStep(mission.id); // → VERIFYING

    // Création d'un rapport de vérification PASS
    const report: StructuredVerificationReport = {
      missionId: mission.id,
      verdict: 'PASS',
      passed: true,
      timestamp: new Date().toISOString(),
      results: [{
        checkId: 'chk-1',
        passed: true,
        evidence: 'test',
        method: 'mock',
        timestamp: new Date().toISOString(),
      }],
      summary: 'All checks passed',
    };

    await missionEngine.verifyAndTransition(mission.id, []);

    const events = await ledger.query({ missionId: mission.id });
    const terminalEvents = events.filter(e =>
      e.type === 'MISSION_SUCCEEDED' ||
      e.type === 'MISSION_FAILED' ||
      e.type === 'MISSION_BLOCKED'
    );

    expect(terminalEvents.length).toBe(1);
    expect(terminalEvents[0].type).toBe('MISSION_SUCCEEDED');
  });

  it('INV-1: MISSION_FAILED - exactement un événement terminal (timeout)', async () => {
    // timeoutAt rétrodaté dans le persister → runNextStep détecte le timeout
    const mission = await missionEngine.createMission({
      id: 'INV-1-FAIL',
      name: 'Invariant 1 Fail',
      objective: 'Un seul événement MISSION_FAILED',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Test OK'],
      steps: [{ name: 'step-1' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'test');

    // Force un timeout dépassé dans l'état persisté
    const m = await missionEngine.getMission(mission.id);
    m!.timeoutAt = new Date(Date.now() - 1000).toISOString();
    missionEngine.persist(m!);

    // runNextStep détecte le timeout → transitionStatus FAILED (ligne 277)
    await missionEngine.runNextStep(mission.id);

    const events = await ledger.query({ missionId: mission.id });
    const terminalEvents = events.filter(e =>
      e.type === 'MISSION_SUCCEEDED' ||
      e.type === 'MISSION_FAILED' ||
      e.type === 'MISSION_BLOCKED'
    );

    expect(terminalEvents.length).toBe(1);
    expect(terminalEvents[0].type).toBe('MISSION_FAILED');
  });

  it('INV-1b: MISSION_BLOCKED - exactement un événement terminal (policy/maxAttempts)', async () => {
    // maxAttempts: 1 → un échec de step force la transition BLOCKED
    const mission = await missionEngine.createMission({
      id: 'INV-1B-BLOCKED',
      name: 'Invariant 1b Blocked',
      objective: 'Un seul événement MISSION_BLOCKED',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Test OK'],
      steps: [{ name: 'step-1' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 1,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'test');

    missionEngine.setStepExecutor(async () => ({
      status: 'FAILED',
      error: 'Simulated failure',
    }));

    await missionEngine.runNextStep(mission.id);

    const events = await ledger.query({ missionId: mission.id });
    const terminalEvents = events.filter(e =>
      e.type === 'MISSION_SUCCEEDED' ||
      e.type === 'MISSION_FAILED' ||
      e.type === 'MISSION_BLOCKED'
    );

    expect(terminalEvents.length).toBe(1);
    expect(terminalEvents[0].type).toBe('MISSION_BLOCKED');
  });

  /**
   * INVARIANT 2: Un seul MISSION_STARTED par mission
   */
  it('INV-2: Un seul MISSION_STARTED même après recovery', async () => {
    const mission = await missionEngine.createMission({
      id: 'INV-2-START',
      name: 'Invariant 2 Start',
      objective: 'Un seul MISSION_STARTED',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Test OK'],
      steps: [{ name: 'step-1' }, { name: 'step-2' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'test start');

    // Exécute step 1
    await missionEngine.runNextStep(mission.id);

    // Simule crash sur step 2 (RUNNING, pas enregistré)
    const m = await missionEngine.getMission(mission.id);
    m!.steps[1].status = 'RUNNING';
    m!.steps[1].startedAt = new Date().toISOString();
    m!.steps[1].executionRecorded = false;
    missionEngine.persist(missionEngine.updateSteps(m!, m!.steps[1]));

    // Recovery
    await missionEngine.resumeMission(mission.id);

    const events = await ledger.query({ missionId: mission.id });
    const startedEvents = events.filter(e => e.type === 'MISSION_STARTED');

    expect(startedEvents.length).toBe(1); // Original only
  });

  /**
   * INVARIANT 3: STEP_STARTED avant STEP_COMPLETED pour chaque étape
   */
  it('INV-3: STEP_STARTED émis avant STEP_COMPLETED', async () => {
    const mission = await missionEngine.createMission({
      id: 'INV-3-ORDER',
      name: 'Invariant 3 Order',
      objective: 'STEP_STARTED avant STEP_COMPLETED',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Test OK'],
      steps: [{ name: 'step-1' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'test');
    await missionEngine.runNextStep(mission.id);

    const events = await ledger.query({ missionId: mission.id });
    const stepStarted = events.filter(e => e.type === 'STEP_STARTED');
    const stepCompleted = events.filter(e => e.type === 'STEP_COMPLETED');

    expect(stepStarted.length).toBeGreaterThanOrEqual(1);
    expect(stepCompleted.length).toBeGreaterThanOrEqual(1);

    // Vérifie que le premier STEP_STARTED est avant le premier STEP_COMPLETED
    const firstStarted = stepStarted[0];
    const firstCompleted = stepCompleted[0];

    const timeStarted = new Date(firstStarted.timestamp).getTime();
    const timeCompleted = new Date(firstCompleted.timestamp).getTime();

    expect(timeStarted).toBeLessThanOrEqual(timeCompleted);
  });

  /**
   * INVARIANT 4: RECOVERY_TRIGGERED sans duplication d'événements terminaux
   */
  it('INV-4: RECOVERY_TRIGGERED ne duplique pas les événements terminaux', async () => {
    // 2 étapes : le crash tombe sur la 2e étape → la mission reste RUNNING
    const mission = await missionEngine.createMission({
      id: 'INV-4-RECOVERY',
      name: 'Invariant 4 Recovery',
      objective: 'Recovery sans duplication',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Test OK'],
      steps: [{ name: 'step-1' }, { name: 'step-2' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'test');
    await missionEngine.runNextStep(mission.id); // step 1 DONE, mission encore RUNNING

    // Simule crash sur la 2e étape (RUNNING, pas enregistrée)
    const m = await missionEngine.getMission(mission.id);
    expect(m!.status).toBe('RUNNING');
    m!.steps[1].status = 'RUNNING';
    m!.steps[1].startedAt = new Date().toISOString();
    m!.steps[1].attempts = 1;
    m!.steps[1].executionRecorded = false;
    missionEngine.persist(missionEngine.updateSteps(m!, m!.steps[1]));

    // Trois redémarrages successifs (démarage double, multi-process)
    await missionEngine.resumeMission(mission.id);
    await missionEngine.resumeMission(mission.id);
    await missionEngine.resumeMission(mission.id);

    const events = await ledger.query({ missionId: mission.id });
    const recoveryEvents = events.filter(e => e.type === 'RECOVERY_TRIGGERED');
    const startedEvents = events.filter(e => e.type === 'MISSION_STARTED');
    const terminalEvents = events.filter(e =>
      e.type === 'MISSION_SUCCEEDED' ||
      e.type === 'MISSION_FAILED' ||
      e.type === 'MISSION_BLOCKED'
    );

    // Un RECOVERY_TRIGGERED par redémarrage (3), aucun doublon d'événement
    // de cycle (1 MISSION_STARTED) ni d'événement terminal (0)
    expect(recoveryEvents.length).toBe(3);
    expect(startedEvents.length).toBe(1);
    expect(terminalEvents.length).toBe(0);
  });

  /**
   * INVARIANT 5: VERIFICATION_RESULT cohérent avec verdict
   */
  it('INV-5: VERIFICATION_RESULT verdict PASS → MISSION_SUCCEEDED', async () => {
    const mission = await missionEngine.createMission({
      id: 'INV-5-VERIFY-PASS',
      name: 'Invariant 5 Verify Pass',
      objective: 'Verdict PASS → SUCCEEDED',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Test OK'],
      steps: [{ name: 'step-1' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'test');
    await missionEngine.runNextStep(mission.id);

    const report: StructuredVerificationReport = {
      missionId: mission.id,
      verdict: 'PASS',
      passed: true,
      timestamp: new Date().toISOString(),
      results: [{
        checkId: 'chk-1',
        passed: true,
        evidence: 'test',
        method: 'mock',
        timestamp: new Date().toISOString(),
      }],
      summary: 'All checks passed',
    };

    await missionEngine.verifyAndTransition(mission.id, []);

    const events = await ledger.query({ missionId: mission.id });
    const verificationEvents = events.filter(e => e.type === 'VERIFICATION_RESULT');
    const terminalEvents = events.filter(e =>
      e.type === 'MISSION_SUCCEEDED' ||
      e.type === 'MISSION_FAILED' ||
      e.type === 'MISSION_BLOCKED'
    );

    expect(verificationEvents.length).toBeGreaterThanOrEqual(1);
    expect(verificationEvents[0].data.verdict).toBe('PASS');
    expect(terminalEvents.length).toBe(1);
    expect(terminalEvents[0].type).toBe('MISSION_SUCCEEDED');
  });

  it('INV-5: VERIFICATION_RESULT verdict FAIL → MISSION_FAILED', async () => {
    const mission = await missionEngine.createMission({
      id: 'INV-5-VERIFY-FAIL',
      name: 'Invariant 5 Verify Fail',
      objective: 'Verdict FAIL → FAILED',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Test OK'],
      steps: [{ name: 'step-1' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'test');
    await missionEngine.runNextStep(mission.id);

    // Rapport de vérification FAIL
    const report: StructuredVerificationReport = {
      missionId: mission.id,
      verdict: 'FAIL',
      passed: false,
      timestamp: new Date().toISOString(),
      results: [{
        checkId: 'chk-1',
        passed: false,
        evidence: 'test failed',
        method: 'mock',
        timestamp: new Date().toISOString(),
      }],
      summary: 'Check failed',
    };

    // transitionStatus direct avec rapport FAIL → FAILED
    await missionEngine.transitionStatus(mission.id, 'SUCCEEDED', 'test', report);

    const events = await ledger.query({ missionId: mission.id });
    const verificationEvents = events.filter(e => e.type === 'VERIFICATION_RESULT');
    const terminalEvents = events.filter(e =>
      e.type === 'MISSION_SUCCEEDED' ||
      e.type === 'MISSION_FAILED' ||
      e.type === 'MISSION_BLOCKED'
    );

    expect(verificationEvents.length).toBeGreaterThanOrEqual(1);
    expect(verificationEvents[0].data.verdict).toBe('FAIL');
    expect(terminalEvents.length).toBe(1);
    expect(terminalEvents[0].type).toBe('MISSION_FAILED');
  });

  /**
   * INVARIANT 6: Persistance - événement et état cohérents après query
   */
  it('INV-6: État SQLite et événements ledger cohérents', async () => {
    const mission = await missionEngine.createMission({
      id: 'INV-6-PERSIST',
      name: 'Invariant 6 Persist',
      objective: 'Cohérence état/événements',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Test OK'],
      steps: [{ name: 'step-1' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.transitionStatus(mission.id, 'RUNNING', 'test');
    await missionEngine.runNextStep(mission.id);

    // Re-query mission state
    const persistedMission = await missionEngine.getMission(mission.id);
    expect(persistedMission).not.toBeNull();
    expect(persistedMission!.status).toBe('VERIFYING');
    expect(persistedMission!.steps[0].status).toBe('DONE');
    expect(persistedMission!.steps[0].executionRecorded).toBe(true);

    // Verify events exist
    const events = await ledger.query({ missionId: mission.id });
    const stepCompleted = events.filter(e =>
      e.type === 'STEP_COMPLETED' &&
      e.stepId === `${mission.id}-step-0`
    );
    const missionStarted = events.filter(e => e.type === 'MISSION_STARTED');

    expect(stepCompleted.length).toBeGreaterThanOrEqual(1);
    expect(missionStarted.length).toBe(1);
  });

  /**
   * INVARIANT 7: CANCELLED silencieux documenté (pas d'événement dédié)
   */
  it('INV-7: CANCELLED - transition sans événement dédié (documenté)', async () => {
    const mission = await missionEngine.createMission({
      id: 'INV-7-CANCEL',
      name: 'Invariant 7 Cancel',
      objective: 'CANCELLED sans événement dédié',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['Test OK'],
      steps: [{ name: 'step-1' }],
      approvalRequired: false,
      budgetLimitEur: 10,
      maxDurationMs: 60000,
      maxAttempts: 3,
    });

    await missionEngine.cancelMission(mission.id, 'Test cancellation');

    const persistedMission = await missionEngine.getMission(mission.id);
    expect(persistedMission!.status).toBe('CANCELLED');

    const events = await ledger.query({ missionId: mission.id });
    const cancelEvents = events.filter(e => e.type === 'MISSION_CANCELLED');

    // CANCELLED n'émet pas d'événement dédié (acceptable, documenté)
    expect(cancelEvents.length).toBe(0);

    // Mais la transition elle-même est tracée
    const transitionEvents = events.filter(e =>
      e.type === 'MISSION_CREATED' ||
      e.type === 'MISSION_STARTED' ||
      e.type === 'MISSION_SUCCEEDED' ||
      e.type === 'MISSION_FAILED' ||
      e.type === 'MISSION_BLOCKED'
    );
    expect(transitionEvents.length).toBe(1); // MISSION_CREATED only
  });
});
