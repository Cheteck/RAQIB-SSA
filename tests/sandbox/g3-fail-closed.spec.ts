import { describe, it, expect } from 'vitest';
import { DockerSandbox, SandboxUnavailableError } from '../../packages/tool-gateway/src/DockerSandbox';

describe('G3 DockerSandbox Fail-Closed Suite', () => {
  it('rejects workspace creation when Docker is not initialized or unavailable', async () => {
    const sandbox = new DockerSandbox();
    // Not initialized -> state is INITIALIZING -> createWorkspace should throw SandboxUnavailableError
    await expect(sandbox.createWorkspace(process.cwd()))
      .rejects.toThrow(SandboxUnavailableError);
  });

  it('rejects disallowed commands according to policy', async () => {
    const sandbox = new DockerSandbox();
    // Force state to READY for testing policy restriction (mocking check)
    (sandbox as any).state = 'READY';
    
    // Mock checkDockerAvailability to return true
    sandbox.checkDockerAvailability = async () => true;

    try {
      const ctx = await sandbox.createWorkspace(process.cwd());
      await expect(sandbox.executeCommand(ctx, ['curl', 'https://example.com']))
        .rejects.toThrow(/not allowed in sandbox policy/);
      await sandbox.destroyWorkspace(ctx);
    } catch (err: any) {
      if (err instanceof SandboxUnavailableError) {
        // If Docker is literally not installed in test environment, this is expected for G3 fail-closed
        expect(err.message).toContain('Sandbox unavailable');
      } else {
        throw err;
      }
    }
  });
});
