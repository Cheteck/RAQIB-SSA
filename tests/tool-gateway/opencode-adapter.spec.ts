import { describe, it, expect } from 'vitest';
import { OpenCodeAdapter } from '../../packages/tool-gateway/src/adapters/OpenCodeAdapter';
import type { DockerSandbox, SandboxContext } from '../../packages/tool-gateway/src/DockerSandbox';

/**
 * F-12 — l'adaptateur ne doit jamais fabriquer un succès sans exécution réelle.
 */

const req = {
  taskId: 'f12',
  projectPath: 'D:/workspace',
  prompt: 'fais quelque chose',
};

const ctx = { taskId: 'f12', workspaceDir: 'D:/workspace' } as unknown as SandboxContext;

describe('F-12 — OpenCodeAdapter fail-closed', () => {
  it('refuse sans sandbox configurée', async () => {
    const adapter = new OpenCodeAdapter();
    const result = await adapter.executeTask(req);

    expect(result.success).toBe(false);
    expect(result.output).toMatch(/BLOCKED/);
    expect(result.output).toMatch(/aucune sandbox/i);
  });

  it('refuse si le contexte de sandbox est absent', async () => {
    const sandbox = {
      executeCommand: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }),
    } as unknown as DockerSandbox;

    const result = await new OpenCodeAdapter(sandbox).executeTask(req);

    expect(result.success).toBe(false);
    expect(result.output).toMatch(/contexte de sandbox absent/);
  });

  it('rapporte le succès uniquement quand la commande réussit réellement', async () => {
    const calls: any[] = [];
    const sandbox = {
      executeCommand: async (...args: any[]) => {
        calls.push(args);
        return { exitCode: 0, stdout: 'réel', stderr: '' };
      },
    } as unknown as DockerSandbox;

    const result = await new OpenCodeAdapter(sandbox).executeTask(req, ctx);

    expect(result.success).toBe(true);
    expect(result.output).toBe('réel');
    expect(calls).toHaveLength(1);
  });

  it('rapporte un échec quand la commande échoue', async () => {
    const sandbox = {
      executeCommand: async () => ({ exitCode: 1, stdout: '', stderr: 'boom' }),
    } as unknown as DockerSandbox;

    const result = await new OpenCodeAdapter(sandbox).executeTask(req, ctx);

    expect(result.success).toBe(false);
    expect(result.output).toBe('boom');
  });

  it('rapporte un échec quand la sandbox lève une erreur', async () => {
    const sandbox = {
      executeCommand: async () => {
        throw new Error('docker indisponible');
      },
    } as unknown as DockerSandbox;

    const result = await new OpenCodeAdapter(sandbox).executeTask(req, ctx);

    expect(result.success).toBe(false);
    expect(result.output).toMatch(/docker indisponible/);
  });
});
