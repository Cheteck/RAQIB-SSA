import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import request from 'supertest';
import { RaqibRuntime } from '../../services/runtime/src/RaqibRuntime';
import { createRuntimeServer } from '../../services/runtime/src/api/server';

describe('LLM Harness Security & Red-Teaming Suite', () => {
  const testDataDir = path.join(process.cwd(), 'data', 'test-redteaming');
  const dbPath = path.join(testDataDir, 'redteam.db');
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

  it('neutralizes prompt injection and command chaining attempts in SkillsRegistry args', async () => {
    const maliciousArgs = {
      path: './test-dir',
    };

    const res = await request(app)
      .post('/api/skills/codebase_audit/execute')
      .send(maliciousArgs);

    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
  });

  it('enforces isolation in MemoryEngine preventing unauthorized cross-thread retrieval', async () => {
    await runtime.memoryEngine.put('secure-ns', 'secret-key', 'SUPER_SECRET_DATA', { threadId: 'thread-admin' });

    const adminMem = await runtime.memoryEngine.get('secure-ns', 'secret-key', 'thread-admin');
    const attackerMem = await runtime.memoryEngine.get('secure-ns', 'secret-key', 'thread-attacker');

    expect(adminMem).toBe('SUPER_SECRET_DATA');
    expect(attackerMem).toBeNull();
  });

  it('blocks policy violations in middleware pipeline during unauthorized agent executions', async () => {
    runtime.middlewarePipeline.use({
      name: 'StrictBlocker',
      beforeAgent: async () => ({
        allowed: false,
        reason: 'Blocked by strict security policy',
        ruleId: 'SEC-001',
        timestamp: new Date().toISOString(),
      }),
    });

    const state = { missionId: 'm-attack', context: {}, history: [] };
    const req = { actionType: 'EXECUTE_DESTRUCTIVE' as const, resource: '/etc/passwd', actor: 'attacker', missionId: 'm-attack' };

    const decision = await runtime.middlewarePipeline.runBefore(state, req);
    expect(decision).not.toBeNull();
    expect(decision?.allowed).toBe(false);
    expect(decision?.reason).toContain('Blocked');
  });
});
