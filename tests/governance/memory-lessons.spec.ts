import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryEngine } from '../../packages/mission-engine/src/MemoryEngine';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('G2 MemoryEngine Lessons Suite', () => {
  let memoryEngine: MemoryEngine;
  let tmpDir: string;
  let dbPath: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g2-test-'));
    dbPath = path.join(tmpDir, 'g2-test.db');
    memoryEngine = new MemoryEngine(dbPath);
  });

  afterEach(async () => {
    (memoryEngine as any).db.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should record and retrieve a capitalized lesson', async () => {
    const lesson = {
      lessonId: 'l-001',
      missionId: 'm-001',
      context: 'Docker startup',
      observation: 'Docker takes 5s to init',
      learning: 'Pre-warm docker info check',
      confidenceScore: 0.8,
      validatedByHuman: false,
      createdAt: new Date().toISOString(),
    };

    await memoryEngine.recordLesson(lesson);
    const lessons = await memoryEngine.getLessons();
    expect(lessons).toHaveLength(1);
    expect(lessons[0].learning).toBe('Pre-warm docker info check');
  });

  it('should filter lessons by confidence score', async () => {
    await memoryEngine.recordLesson({
      lessonId: 'l-001',
      missionId: 'm-001',
      context: 'c', observation: 'o', learning: 'low',
      confidenceScore: 0.3,
      validatedByHuman: false,
      createdAt: new Date().toISOString(),
    });
    await memoryEngine.recordLesson({
      lessonId: 'l-002',
      missionId: 'm-001',
      context: 'c', observation: 'o', learning: 'high',
      confidenceScore: 0.9,
      validatedByHuman: false,
      createdAt: new Date().toISOString(),
    });

    const lessons = await memoryEngine.getLessons({ minConfidence: 0.5 });
    expect(lessons).toHaveLength(1);
    expect(lessons[0].learning).toBe('high');
  });

  it('should validate a lesson and update confidence', async () => {
    await memoryEngine.recordLesson({
      lessonId: 'l-001',
      missionId: 'm-001',
      context: 'c', observation: 'o', learning: 'l',
      confidenceScore: 0.4,
      validatedByHuman: false,
      createdAt: new Date().toISOString(),
    });

    await memoryEngine.validateLesson('l-001', 0.95);
    const lessons = await memoryEngine.getLessons({ minConfidence: 0.9 });
    expect(lessons).toHaveLength(1);
    expect(lessons[0].validatedByHuman).toBe(true);
    expect(lessons[0].confidenceScore).toBe(0.95);
  });
});
