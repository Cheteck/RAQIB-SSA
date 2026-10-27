import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { ContextEngine, MessageItem } from '../../packages/core/src/ContextEngine';
import { MemoryEngine } from '../../packages/mission-engine/src/MemoryEngine';

describe('ContextEngine & MemoryEngine Test Suite', () => {
  const testDataDir = path.join(process.cwd(), 'data', 'test-context-memory');
  const dbPath = path.join(testDataDir, 'memory-test.db');

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

  describe('ContextEngine', () => {
    it('calculates metrics and respects budget reserves', () => {
      const engine = new ContextEngine({ maxTokens: 1000, reserveForResponse: 200 });
      const messages: MessageItem[] = [
        { role: 'system', content: 'You are RAQIB system agent.' },
        { role: 'user', content: 'Hello RAQIB' },
      ];

      const metrics = engine.getMetrics(messages, 'tool_definitions_here');
      expect(metrics.totalBudget).toBe(1000);
      expect(metrics.responseReserve).toBe(200);
      expect(metrics.usedTokens).toBeGreaterThan(0);
      expect(metrics.availableTokens).toBe(1000 - 200 - metrics.usedTokens);
    });

    it('prunes oldest non-system messages when exceeding tight budget while preserving system prompts', () => {
      const engine = new ContextEngine({ maxTokens: 25, reserveForResponse: 5 });
      const messages: MessageItem[] = [
        { role: 'system', content: 'System Prompt Invariant' },
        { role: 'user', content: 'Very long old message '.repeat(10) },
        { role: 'user', content: 'Newer message' },
      ];

      const pruned = engine.pruneMessages(messages);
      expect(pruned.some((m) => m.role === 'system')).toBe(true);
      expect(pruned.length).toBeLessThan(messages.length);
    });

    it('truncates content using compressContent', () => {
      const engine = new ContextEngine();
      const longText = 'A'.repeat(500);
      const compressed = engine.compressContent(longText, 100);
      expect(compressed.length).toBeLessThan(longText.length);
      expect(compressed).toContain('truncated');
    });
  });

  describe('MemoryEngine', () => {
    it('supports short-term checkpointing by threadId and retrieval', async () => {
      const memory = new MemoryEngine(dbPath);
      await memory.checkpoint('thread-100', 'mission-state', 'step-1', { progress: 50 });

      const state = await memory.getLatestCheckpoint<{ progress: number }>('thread-100', 'mission-state', 'step-1');
      expect(state).toEqual({ progress: 50 });
    });

    it('isolates memories across different threads and namespaces', async () => {
      const memory = new MemoryEngine(dbPath);
      await memory.put('ns-1', 'key-a', 'val-thread-1', { threadId: 't-1' });
      await memory.put('ns-1', 'key-a', 'val-thread-2', { threadId: 't-2' });

      const val1 = await memory.get('ns-1', 'key-a', 't-1');
      const val2 = await memory.get('ns-1', 'key-a', 't-2');

      expect(val1).toBe('val-thread-1');
      expect(val2).toBe('val-thread-2');
    });

    it('searches episodic and semantic memories with filters', async () => {
      const memory = new MemoryEngine(dbPath);
      await memory.put('audit-logs', 'entry-1', 'Critical security finding', { type: 'EPISODIC' });
      await memory.put('audit-logs', 'entry-2', 'Normal operation tick', { type: 'WORKING' });

      const results = await memory.search({ namespace: 'audit-logs', type: 'EPISODIC', query: 'security' });
      expect(results.length).toBe(1);
      expect(results[0].key).toBe('entry-1');
    });
  });
});
