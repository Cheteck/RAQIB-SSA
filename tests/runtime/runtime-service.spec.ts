import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { RaqibRuntime } from '../../services/runtime/src/RaqibRuntime';
import { createRuntimeServer } from '../../services/runtime/src/api/server';

describe('RaqibRuntime Service Suite', () => {
  let runtime: RaqibRuntime;
  let app: any;
  let testDbPath: string;
  let testDataDir: string;

  beforeEach(async () => {
    testDataDir = path.join(__dirname, 'data-' + Date.now());
    testDbPath = path.join(testDataDir, 'test-runtime.db');
    runtime = new RaqibRuntime({ dbPath: testDbPath, dataDir: testDataDir });
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

  it('provides /api/status endpoint', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.emergencyStop).toBe(false);
  });

  it('toggles emergency stop via /api/emergency-stop', async () => {
    const actRes = await request(app)
      .post('/api/emergency-stop')
      .send({ action: 'activate', reason: 'Testing API' });
    expect(actRes.status).toBe(200);
    expect(actRes.body.active).toBe(true);

    const statusRes = await request(app).get('/api/status');
    expect(statusRes.body.emergencyStop).toBe(true);

    const deactRes = await request(app)
      .post('/api/emergency-stop')
      .send({ action: 'deactivate', confirmedBy: 'admin' });
    expect(deactRes.status).toBe(200);
    expect(deactRes.body.active).toBe(false);
  });

  it('manages missions and budgets via API', async () => {
    const createRes = await request(app)
      .post('/api/missions')
      .send({
        id: 'M-API-01',
        name: 'API Test Mission',
        objective: 'Test endpoint behavior',
        autonomyLevel: 'A1',
        constraints: [],
        successCriteria: ['API OK'],
        steps: [{ name: 'Init check' }],
        approvalRequired: false,
        budgetLimitEur: 15.0,
        maxDurationMs: 60000,
        maxAttempts: 3
      });
    if (createRes.status !== 201) {
      console.error('Create mission error:', createRes.body);
    }
    expect(createRes.status).toBe(201);
    expect(createRes.body.mission.id).toBe('M-API-01');

    const listRes = await request(app).get('/api/missions');
    expect(listRes.status).toBe(200);
    expect(listRes.body.missions.length).toBeGreaterThanOrEqual(1);

    runtime.policyEngine.setBudget('M-API-01', 15.0);
    const budgetRes = await request(app).get('/api/budget/M-API-01');
    expect(budgetRes.status).toBe(200);
    expect(budgetRes.body.limitEur).toBe(15.0);
  });
});
