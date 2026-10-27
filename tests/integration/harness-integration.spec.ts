import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { RaqibRuntime } from '../../services/runtime/src/RaqibRuntime';

describe('RaqibRuntime LLM Harness Integration Suite', () => {
  const testDataDir = path.join(process.cwd(), 'data', 'test-harness-integration');
  const dbPath = path.join(testDataDir, 'raqib-test.db');
  let runtime: RaqibRuntime;

  beforeEach(async () => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDataDir, { recursive: true });

    runtime = new RaqibRuntime({ dbPath, dataDir: testDataDir });
    await runtime.initialize();
  });

  afterEach(async () => {
    await runtime.stop();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  it('instantiates all Harness components in RaqibRuntime', () => {
    expect(runtime.contextEngine).toBeDefined();
    expect(runtime.memoryEngine).toBeDefined();
    expect(runtime.workflowEngine).toBeDefined();
    expect(runtime.skillsRegistry).toBeDefined();
    expect(runtime.middlewarePipeline).toBeDefined();
  });

  it('executes middleware pipeline before and after agent execution', async () => {
    const state = { missionId: 'm-test-01', context: {}, history: [] };
    const req = {
      actionType: 'READ' as const,
      resource: 'test.txt',
      actor: 'test-agent',
      missionId: 'm-test-01',
    };

    const blocked = await runtime.middlewarePipeline.runBefore(state, req);
    expect(blocked).toBeNull();

    await runtime.middlewarePipeline.runAfter(state, {
      allowed: true,
      reason: 'Authorized',
      timestamp: new Date().toISOString(),
    });

    const events = await runtime.auditLedger.query({ missionId: 'm-test-01' });
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'AGENT_AFTER_EXECUTION')).toBe(true);
  });
});
