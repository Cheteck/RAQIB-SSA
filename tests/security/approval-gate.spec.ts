/**
 * Security Test — Approval Gate Enforcement (SEC-11)
 * 
 * Validates that missions with approvalRequired: true CANNOT execute
 * without explicit human approval. Locks in the T1 fix and verifies
 * that API routes enforce Constitution §2.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { RaqibRuntime } from '../../services/runtime/src/RaqibRuntime';
import { createRuntimeServer } from '../../services/runtime/src/api/server';

describe('SEC-11: Approval Gate Enforcement', () => {
  const testDataDir = path.join(process.cwd(), 'data', 'test-approval-gate');
  const dbPath = path.join(testDataDir, 'approval-gate-test.db');
  let runtime: RaqibRuntime;
  let app: any;

  beforeEach(async () => {
    if (fs.existsSync(testDataDir)) {
      try { fs.rmSync(testDataDir, { recursive: true, force: true }); } catch {}
    }
    fs.mkdirSync(testDataDir, { recursive: true });

    runtime = new RaqibRuntime({ dbPath, dataDir: testDataDir });
    await runtime.initialize();
    app = createRuntimeServer(runtime);
  });

  afterEach(async () => {
    if (runtime) {
      await runtime.stop();
    }
    if (fs.existsSync(testDataDir)) {
      try { fs.rmSync(testDataDir, { recursive: true, force: true }); } catch {}
    }
  });

  it('SEC-11.1: Mission with approvalRequired=true starts in PLANNED status', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({
        id: 'M-APPROVAL-TEST-01',
        name: 'Approval Gate Test Mission',
        objective: 'Verify approval workflow',
        autonomyLevel: 'A2',
        constraints: ['Test constraint'],
        successCriteria: ['Test passes'],
        steps: [{ name: 'Test step' }],
        approvalRequired: true,
        budgetLimitEur: 10.0,
        maxDurationMs: 60000,
        maxAttempts: 1
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.mission.status).toBe('PLANNED');
    expect(createRes.body.mission.approvalRequired).toBe(true);
  });

  it('SEC-11.2: Mission with approvalRequired=false starts in APPROVED status', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({
        id: 'M-NO-APPROVAL-TEST-01',
        name: 'No Approval Test Mission',
        objective: 'Verify auto-approval workflow',
        autonomyLevel: 'A1',
        constraints: [],
        successCriteria: ['Test passes'],
        steps: [{ name: 'Test step' }],
        approvalRequired: false,
        budgetLimitEur: 10.0,
        maxDurationMs: 60000,
        maxAttempts: 1
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.mission.status).toBe('APPROVED');
    expect(createRes.body.mission.approvalRequired).toBe(false);
  });

  it('SEC-11.3: Direct transition from PLANNED to RUNNING is rejected (400)', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({
        id: 'M-BLOCKED-01',
        name: 'Blocked Without Approval',
        objective: 'Should not run directly',
        autonomyLevel: 'A2',
        constraints: [],
        successCriteria: ['N/A'],
        steps: [{ name: 'Test step' }],
        approvalRequired: true,
        budgetLimitEur: 10.0,
        maxDurationMs: 60000,
        maxAttempts: 1
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.mission.status).toBe('PLANNED');

    // Attempt direct transition PLANNED -> RUNNING (violates State Machine)
    const transitionRes = await request(app)
      .post(`/api/missions/${createRes.body.mission.id}/transition`)
      .send({ status: 'RUNNING', reason: 'Attempt bypass' });

    expect(transitionRes.status).toBe(400);
    expect(transitionRes.body.error).toMatch(/Invalid transition/);

    // Verify mission remains PLANNED
    const getRes = await request(app).get(`/api/missions/${createRes.body.mission.id}`);
    expect(getRes.body.mission.status).toBe('PLANNED');
  });

  it('SEC-11.4: Mission transitions to RUNNING only after PLANNED -> APPROVED -> RUNNING', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({
        id: 'M-APPROVED-01',
        name: 'Approved After Review',
        objective: 'Should run after proper approval sequence',
        autonomyLevel: 'A2',
        constraints: [],
        successCriteria: ['Test passes'],
        steps: [{ name: 'Inventory codebase' }],
        approvalRequired: true,
        budgetLimitEur: 10.0,
        maxDurationMs: 120000,
        maxAttempts: 1
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.mission.status).toBe('PLANNED');

    // Step 1: Transition PLANNED -> APPROVED (Human Approval)
    const approveRes = await request(app)
      .post(`/api/missions/${createRes.body.mission.id}/transition`)
      .send({ status: 'APPROVED', reason: 'Human approval granted by lead' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.mission.status).toBe('APPROVED');

    // Step 2: Transition APPROVED -> RUNNING (Start execution)
    const startRes = await request(app)
      .post(`/api/missions/${createRes.body.mission.id}/transition`)
      .send({ status: 'RUNNING', reason: 'Operator started approved mission' });

    expect(startRes.status).toBe(200);
    expect(startRes.body.mission.status).toBe('RUNNING');
  });

  it('SEC-11.5: POST /api/missions/self-improve creates PLANNED mission needing approval (T1 Fix)', async () => {
    const createRes = await request(app)
      .post('/api/missions/self-improve');

    expect(createRes.status).toBe(201);
    expect(createRes.body.mission.status).toBe('PLANNED');
    expect(createRes.body.mission.approvalRequired).toBe(true);
    expect(createRes.body.pendingApproval).toBe(true);

    // Verify it is in PLANNED state in the database
    const getRes = await request(app).get(`/api/missions/${createRes.body.mission.id}`);
    expect(getRes.body.mission.status).toBe('PLANNED');
  });

  it('SEC-11.6: Audit log records status transition events', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({
        id: 'M-AUDIT-01',
        name: 'Audit Trail Test',
        objective: 'Verify approval is logged',
        autonomyLevel: 'A2',
        constraints: [],
        successCriteria: ['Audit OK'],
        steps: [{ name: 'Test step' }],
        approvalRequired: true,
        budgetLimitEur: 10.0,
        maxDurationMs: 60000,
        maxAttempts: 1
      });

    // Transition PLANNED -> APPROVED
    await request(app)
      .post(`/api/missions/${createRes.body.mission.id}/transition`)
      .send({ status: 'APPROVED', reason: 'Approved in audit test' });

    // Query audit log
    const auditRes = await request(app)
      .get(`/api/audit?missionId=${createRes.body.mission.id}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.events.length).toBeGreaterThan(0);

    const transitionEvents = auditRes.body.events.filter(
      (e: any) => e.data && e.data.to === 'APPROVED'
    );
    expect(transitionEvents.length).toBe(1);
    expect(transitionEvents[0].data.from).toBe('PLANNED');
    expect(transitionEvents[0].data.reason).toBe('Approved in audit test');
  });
});