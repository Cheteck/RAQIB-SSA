import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import request from 'supertest';
import { RaqibRuntime } from '../../services/runtime/src/RaqibRuntime';
import { createRuntimeServer } from '../../services/runtime/src/api/server';

describe('Runtime API Harness Endpoints Suite', () => {
  const testDataDir = path.join(process.cwd(), 'data', 'test-api-endpoints');
  const dbPath = path.join(testDataDir, 'api-test.db');
  let runtime: RaqibRuntime;
  let app: any;

  beforeEach(async () => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDataDir, { recursive: true });

    runtime = new RaqibRuntime({ dbPath, dataDir: testDataDir });
    await runtime.initialize();
    app = createRuntimeServer(runtime);
  });

  afterEach(async () => {
    await runtime.stop();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  it('GET /api/context returns context budget metrics', async () => {
    const res = await request(app).get('/api/context');
    expect(res.status).toBe(200);
    expect(res.body.totalBudget).toBeGreaterThan(0);
    expect(res.body.responseReserve).toBeDefined();
  });

  it('POST /api/memory and GET /api/memory manages memory records', async () => {
    const postRes = await request(app)
      .post('/api/memory')
      .send({ namespace: 'api-test', key: 'usr-pref', value: { theme: 'dark' }, threadId: 't-99' });

    expect(postRes.status).toBe(200);

    const getRes = await request(app).get('/api/memory?namespace=api-test&threadId=t-99');
    expect(getRes.status).toBe(200);
    expect(getRes.body.memories.length).toBe(1);
    expect(getRes.body.memories[0].key).toBe('usr-pref');
  });

  it('GET /api/skills lists available skills and POST /api/skills/:name/execute executes authorized skill', async () => {
    const listRes = await request(app).get('/api/skills');
    expect(listRes.status).toBe(200);
    expect(listRes.body.skills.some((s: any) => s.name === 'git_status_check')).toBe(true);

    const execRes = await request(app)
      .post('/api/skills/git_status_check/execute')
      .send({ repoPath: '.' });

    expect(execRes.status).toBe(200);
    expect(execRes.body.result.status).toBe('clean');
  });
});
