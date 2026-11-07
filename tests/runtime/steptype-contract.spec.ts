/**
 * StepType Contract & Executor Test Suite
 * 
 * Verifies that step execution dispatches cleanly via explicit StepType enums
 * or falls back gracefully to exact step names.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { RaqibRuntime } from '../../services/runtime/src/RaqibRuntime';
import { createRuntimeServer } from '../../services/runtime/src/api/server';

describe('StepType Contract Suite', () => {
  const testDataDir = path.join(process.cwd(), 'data', 'test-steptype-contract');
  const dbPath = path.join(testDataDir, 'steptype-test.db');
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

  it('executes steps dispatched via explicit StepType (INVENTORY)', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({
        id: 'M-STEPTYPE-01',
        name: 'Typed Step Mission',
        objective: 'Test StepType dispatch',
        autonomyLevel: 'A1',
        constraints: [],
        successCriteria: ['DONE'],
        steps: [{ name: 'Custom Name For Inventory', type: 'INVENTORY' }],
        approvalRequired: false,
        budgetLimitEur: 10.0,
        maxDurationMs: 60000,
        maxAttempts: 1,
      });

    expect(createRes.status).toBe(201);

    // Transition to RUNNING
    await request(app)
      .post('/api/missions/M-STEPTYPE-01/transition')
      .send({ status: 'RUNNING', reason: 'Start step test' });

    // Run step
    const runRes = await request(app).post('/api/missions/M-STEPTYPE-01/run');
    expect(runRes.status).toBe(200);
    expect(runRes.body.result.status).toBe('DONE');
    expect(runRes.body.result.detail).toMatch(/Inventory:/);
  });

  it('fails gracefully when an unknown CUSTOM step type has no implementation', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({
        id: 'M-STEPTYPE-02',
        name: 'Unknown Custom Step',
        objective: 'Test failure handling',
        autonomyLevel: 'A1',
        constraints: [],
        successCriteria: ['FAILED'],
        steps: [{ name: 'Unimplemented Step', type: 'CUSTOM' }],
        approvalRequired: false,
        budgetLimitEur: 10.0,
        maxDurationMs: 60000,
        maxAttempts: 1,
      });

    expect(createRes.status).toBe(201);

    // Transition to RUNNING
    await request(app)
      .post('/api/missions/M-STEPTYPE-02/transition')
      .send({ status: 'RUNNING', reason: 'Start step test' });

    const runRes = await request(app).post('/api/missions/M-STEPTYPE-02/run');
    expect(runRes.status).toBe(200);
    expect(runRes.body.result.status).toBe('FAILED');
    expect(runRes.body.result.detail).toMatch(/requires an explicit implementation/);
  });
});