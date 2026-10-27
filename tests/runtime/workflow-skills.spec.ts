import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { WorkflowEngine } from '../../packages/mission-engine/src/WorkflowEngine';
import { SkillsRegistry } from '../../packages/tool-gateway/src/SkillsRegistry';
import { z } from 'zod';

describe('WorkflowEngine & SkillsRegistry Suite', () => {
  const testDataDir = path.join(process.cwd(), 'data', 'test-workflow-skills');
  const dbPath = path.join(testDataDir, 'workflow-test.db');

  beforeEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('WorkflowEngine', () => {
    it('executes state transitions based on priorities and conditions', async () => {
      const engine = new WorkflowEngine({ dbPath });

      engine.addNode({
        id: 'start',
        name: 'Start Step',
        execute: async (state) => ({ ...state, val: 10 }),
      });

      engine.addNode({
        id: 'high-branch',
        name: 'High Branch',
        execute: async (state) => ({ ...state, branch: 'high' }),
      });

      engine.addNode({
        id: 'low-branch',
        name: 'Low Branch',
        execute: async (state) => ({ ...state, branch: 'low' }),
      });

      engine.addEdge('start', 'high-branch', (state) => Number(state.val) > 5, 10);
      engine.addEdge('start', 'low-branch', (state) => Number(state.val) <= 5, 1);

      const finalState = await engine.run('wf-01', 'start');
      expect(finalState.branch).toBe('high');

      const saved = await engine.getSavedState('wf-01');
      expect(saved).not.toBeNull();
      expect(saved?.currentNodeId).toBe('high-branch');
    });

    it('throws error when max steps limit is exceeded', async () => {
      const engine = new WorkflowEngine({ maxSteps: 3 });

      engine.addNode({
        id: 'loop-a',
        name: 'Loop A',
        execute: async (state) => ({ ...state, step: Number(state.step || 0) + 1 }),
      });

      engine.addNode({
        id: 'loop-b',
        name: 'Loop B',
        execute: async (state) => ({ ...state, step: Number(state.step || 0) + 1 }),
      });

      engine.addEdge('loop-a', 'loop-b');
      engine.addEdge('loop-b', 'loop-a');

      await expect(engine.run('wf-loop', 'loop-a')).rejects.toThrow('exceeded max steps limit');
    });
  });

  describe('SkillsRegistry', () => {
    it('registers builtin skills and executes custom skill with Zod validation', async () => {
      const registry = new SkillsRegistry();
      const list = registry.list();
      expect(list.some((s) => s.name === 'codebase_audit')).toBe(true);

      registry.register({
        name: 'custom_calculator',
        description: 'Multiplies two numbers',
        parameters: z.object({ a: z.number(), b: z.number() }),
        handler: async (args) => ({ result: args.a * args.b }),
      });

      const res = (await registry.execute('custom_calculator', { a: 6, b: 7 })) as { result: number };
      expect(res.result).toBe(42);
    });

    it('throws error when executing un registered or invalid skill args', async () => {
      const registry = new SkillsRegistry();
      await expect(registry.execute('non_existent_skill', {})).rejects.toThrow('not found in registry');

      registry.register({
        name: 'strict_skill',
        description: 'Requires string',
        parameters: z.object({ input: z.string() }),
        handler: async (args) => args,
      });

      await expect(registry.execute('strict_skill', { input: 123 })).rejects.toThrow();
    });
  });
});
