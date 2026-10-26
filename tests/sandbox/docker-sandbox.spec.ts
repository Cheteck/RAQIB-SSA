import { describe, it, expect } from 'vitest';
import { DockerSandbox } from '../../packages/tool-gateway/src/DockerSandbox';

describe('DockerSandbox Suite', () => {
  it('creates workspace and executes command in appropriate mode', async () => {
    const sandbox = new DockerSandbox();
    const isDockerAvailable = await sandbox.checkDockerAvailability();

    const ctx = await sandbox.createWorkspace(process.cwd());
    expect(ctx.mode).toBe(isDockerAvailable && process.env.RAQIB_DOCKER_ENABLED === 'true' ? 'DOCKER' : 'FALLBACK_LOCAL');

    const cmdRes = await sandbox.executeCommand(ctx, ['node', '-v']);
    expect(cmdRes.exitCode).toBe(0);
    expect(cmdRes.stdout).toMatch(/v\d+/);

    await sandbox.destroyWorkspace(ctx);
  });

  it('rejects disallowed commands according to policy', async () => {
    const sandbox = new DockerSandbox();
    const ctx = await sandbox.createWorkspace(process.cwd());

    await expect(sandbox.executeCommand(ctx, ['curl', 'https://example.com']))
      .rejects.toThrow(/not allowed in sandbox policy/);

    await sandbox.destroyWorkspace(ctx);
  });
});
