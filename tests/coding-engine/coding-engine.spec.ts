import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import request from 'supertest';
import { SDKCodingEngine } from '../../coding-engine/packages/runtime/src/engine';
import { LocalWorkspace } from '../../coding-engine/packages/project/src/workspace';
import { FreeLLMAPIProvider } from '../../coding-engine/packages/providers/src/freellmapi';
import { createCodingEngineServer } from '../../coding-engine/packages/server/src/server';

describe('Coding Engine SDK Architecture Suite', () => {
  const testDir = path.join(process.cwd(), 'data', 'test-coding-engine');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'sample.ts'), 'console.log("hello");', 'utf8');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('runs Embedded SDK with LocalWorkspace and FreeLLMAPIProvider', async () => {
    const workspace = new LocalWorkspace({ id: 'ws-1', root: testDir });
    const provider = new FreeLLMAPIProvider({
      baseURL: 'https://freellmapi.com/api/v1',
      apiKey: 'test-key',
      defaultModel: 'auto',
    });

    const engine = new SDKCodingEngine(provider, workspace);
    const result = await engine.execute({
      kind: 'modify',
      instruction: 'Add logging statement',
      workspaceId: 'ws-1',
      mode: 'propose',
    });

    expect(result.status).toBe('needs_approval');
    expect(result.pendingApproval).toBeDefined();

    const files = await workspace.listFiles();
    expect(files.some((f) => f.path === 'sample.ts')).toBe(true);
  });

  it('exposes HTTP REST API Server (/v1/tasks and /v1/tasks/:id/approve)', async () => {
    const engine = new SDKCodingEngine();
    const server = createCodingEngineServer(engine);

    const postRes = await request(server)
      .post('/v1/tasks')
      .send({
        kind: 'refactor',
        instruction: 'Clean up imports',
        workspaceId: 'ws-demo',
        mode: 'propose',
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.result.status).toBe('needs_approval');

    const taskId = postRes.body.result.taskId;
    const approveRes = await request(server)
      .post(`/v1/tasks/${taskId}/approve`)
      .send({ approvalId: 'appr-01' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.result.status).toBe('completed');
  });
});
