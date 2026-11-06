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

  it('trace les refus et qualifie l’issue avec corrélation mission/étape', async () => {
    // Refus hors allowlist : aucun processus lancé, mais un POLICY_DECISION DENY tracé.
    await expect(
      runtime.executeShell({
        command: ['rm', '-rf', '.'],
        missionId: 'mission-corr',
        stepId: 'step-corr',
        correlationId: 'corr-1',
      }),
    ).rejects.toThrow(/allowlist/);

    await sleep(50);
    const denials = await runtime.auditLedger.query({
      missionId: 'mission-corr',
      type: 'POLICY_DECISION',
    });
    expect(denials.length).toBeGreaterThan(0);
    expect(denials[0].stepId).toBe('step-corr');
    expect(denials[0].correlationId).toBe('corr-1');
    expect(denials[0].data.verdict).toBe('DENY');
    expect(denials[0].data.phase).toBe('SHELL_ALLOWLIST');

    // Exécution en échec : l'issue est qualifiée `failure`, pas confondue avec un succès.
    const res = await runtime.executeShell({
      command: ['node', '-e', 'process.exit(4)'],
      missionId: 'mission-corr',
      stepId: 'step-corr',
      correlationId: 'corr-2',
    });
    expect(res.exitCode).toBe(4);

    await sleep(50);
    const executed = await runtime.auditLedger.query({
      missionId: 'mission-corr',
      type: 'ACTION_EXECUTED',
    });
    expect(executed).toHaveLength(1);
    expect(executed[0].stepId).toBe('step-corr');
    expect(executed[0].correlationId).toBe('corr-2');
    expect(executed[0].data.outcome).toBe('failure');
    expect(executed[0].data.exitCode).toBe(4);
  });

  it('ne donne pas accès shell à un dépôt cible externe (targetRepoPath)', async () => {
    const externalRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'raqib-external-'));
    const otherData = fs.mkdtempSync(path.join(os.tmpdir(), 'raqib-shell2-'));
    const externalRuntime = new RaqibRuntime({ dataDir: otherData, targetRepoPath: externalRepo });
    try {
      await externalRuntime.initialize();
      // cwd = dépôt externe : refusé, le shell reste confiné au workspace runtime.
      await expect(
        externalRuntime.executeShell({ command: ['node', '--version'], cwd: externalRepo }),
      ).rejects.toThrow(/Working directory refused/);

      // cwd relatif reste dans le workspace du runtime.
      const ok = await externalRuntime.executeShell({ command: ['node', '--version'] });
      expect(ok.exitCode).toBe(0);
      expect(path.resolve(ok.cwd)).toBe(path.resolve(process.cwd()));
    } finally {
      await externalRuntime.stop();
      try { fs.rmSync(externalRepo, { recursive: true, force: true }); } catch {}
      try { fs.rmSync(otherData, { recursive: true, force: true }); } catch {}
    }
  });
});
