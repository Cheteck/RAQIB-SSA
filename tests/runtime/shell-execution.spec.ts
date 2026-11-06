import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setTimeout as sleep } from 'node:timers/promises';
import { RaqibRuntime } from '../../services/runtime/src/RaqibRuntime';
import { ShellPolicyError } from '../../packages/tool-gateway/src/ShellTool';

describe('RAQIB Runtime — shell gouverné (policy + audit)', () => {
  let runtime: RaqibRuntime;
  let dataDir: string;
  const prevReadOnly = process.env.RAQIB_READ_ONLY_MODE;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raqib-shell-'));
    process.env.RAQIB_READ_ONLY_MODE = 'false';
    runtime = new RaqibRuntime({ dataDir });
    await runtime.initialize();
  });

  afterAll(async () => {
    await runtime.stop();
    if (prevReadOnly === undefined) delete process.env.RAQIB_READ_ONLY_MODE;
    else process.env.RAQIB_READ_ONLY_MODE = prevReadOnly;
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
  });

  it('exécute une commande allowlistée et journalise ACTION_EXECUTED', async () => {
    const res = await runtime.executeShell({ command: ['node', '--version'] });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/^v\d+\./);

    await sleep(50);
    const events = await runtime.auditLedger.query({ missionId: 'shell', type: 'ACTION_EXECUTED' });
    const shellEvents = events.filter((e) => e.data?.command === 'node');
    expect(shellEvents.length).toBeGreaterThan(0);
    expect(shellEvents[0].data.exitCode).toBe(0);
    expect(shellEvents[0].data.args).toEqual(['--version']);
  });

  it('refuse une commande hors allowlist (ShellPolicyError)', async () => {
    await expect(runtime.executeShell({ command: ['rm', '-rf', '.'] }))
      .rejects.toBeInstanceOf(ShellPolicyError);
  });

  it('est refusé par le PolicyEngine en mode read-only', async () => {
    process.env.RAQIB_READ_ONLY_MODE = 'true';
    try {
      await expect(runtime.executeShell({ command: ['node', '--version'] }))
        .rejects.toThrow(/Read-only mode active/);

      await sleep(50);
      const decisions = await runtime.auditLedger.query({ missionId: 'shell', type: 'POLICY_DECISION' });
      const denied = decisions.filter((e) => e.data?.verdict === 'DENY');
      expect(denied.length).toBeGreaterThan(0);
      expect(denied[denied.length - 1].data.actionType).toBe('EXECUTE');
    } finally {
      process.env.RAQIB_READ_ONLY_MODE = 'false';
    }
  });

  it('expose le skill shell_exec dans le registre', async () => {
    const skills = runtime.skillsRegistry.list();
    expect(skills.map((s) => s.name)).toContain('shell_exec');
    const result: any = await runtime.skillsRegistry.execute('shell_exec', { command: ['node', '--version'] });
    expect(result.exitCode).toBe(0);
  });
});
