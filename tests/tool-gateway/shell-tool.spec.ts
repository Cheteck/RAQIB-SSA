import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ShellTool, ShellPolicyError } from '../../packages/tool-gateway/src/ShellTool';

describe('ShellTool — exécution gouvernée (allowlist, cwd, timeout, env)', () => {
  let tmpDir: string;
  let outsideDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-root-'));
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-outside-'));
  });

  afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(outsideDir, { recursive: true, force: true }); } catch {}
  });

  it('exécute une commande autorisée et capture stdout + exitCode 0', async () => {
    const tool = new ShellTool({ cwdRoot: tmpDir });
    const res = await tool.execute(['node', '--version']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/^v\d+\./);
    expect(res.timedOut).toBe(false);
  });

  it('refuse une commande hors allowlist sans l’exécuter', async () => {
    const tool = new ShellTool({ cwdRoot: tmpDir });
    await expect(tool.execute(['rm', '-rf', '.'])).rejects.toBeInstanceOf(ShellPolicyError);
    await expect(tool.execute(['powershell', '-Command', 'echo pwned'])).rejects.toThrow(/not in the shell allowlist/);
  });

  it('refuse les métacaractères shell dans la forme chaîne', async () => {
    const tool = new ShellTool({ cwdRoot: tmpDir });
    await expect(tool.execute('node --version; rm -rf .')).rejects.toThrow(/metacharacters/);
    await expect(tool.execute('node --version && echo pwned')).rejects.toThrow(/metacharacters/);
    await expect(tool.execute('node "$(whoami)"')).rejects.toThrow(/metacharacters/);
  });

  it('accepte une chaîne simple sans métacaractère', async () => {
    const tool = new ShellTool({ cwdRoot: tmpDir });
    const res = await tool.execute('node --version');
    expect(res.exitCode).toBe(0);
  });

  it('confine le cwd au root du PathGuard', async () => {
    const tool = new ShellTool({ cwdRoot: tmpDir });
    const ok = await tool.execute(['node', '-e', 'console.log(process.cwd())'], { cwd: '.' });
    expect(path.resolve(ok.stdout.trim())).toBe(path.resolve(tmpDir));

    await expect(
      tool.execute(['node', '--version'], { cwd: outsideDir }),
    ).rejects.toThrow(/Working directory refused/);

    await expect(
      tool.execute(['node', '--version'], { cwd: '..' }),
    ).rejects.toThrow(/Working directory refused/);
  });

  it('capture un code de sortie non nul sans lever d’exception', async () => {
    const tool = new ShellTool({ cwdRoot: tmpDir });
    const res = await tool.execute(['node', '-e', 'process.exit(3)']);
    expect(res.exitCode).toBe(3);
    expect(res.timedOut).toBe(false);
  });

  it('applique un timeout et marque timedOut', async () => {
    const tool = new ShellTool({ cwdRoot: tmpDir, defaultTimeoutMs: 5000 });
    const res = await tool.execute(['node', '-e', 'setTimeout(() => {}, 5000)'], { timeoutMs: 300 });
    expect(res.timedOut).toBe(true);
    expect(res.durationMs).toBeLessThan(5000);
  });

  it('applique le hook authorize (refus PolicyEngine)', async () => {
    const tool = new ShellTool({
      cwdRoot: tmpDir,
      authorize: () => ({ allowed: false, reason: 'Denied by test policy' }),
    });
    await expect(tool.execute(['node', '--version'])).rejects.toThrow(/Denied by test policy/);
  });

  it('émet les événements started/completed/denied', async () => {
    const events: string[] = [];
    const tool = new ShellTool({
      cwdRoot: tmpDir,
      onEvent: (e) => { events.push(e.type); },
    });
    await tool.execute(['node', '--version']);
    await expect(tool.execute(['rm', '-rf', '.'])).rejects.toThrow();
    expect(events).toContain('shell.started');
    expect(events).toContain('shell.completed');
    expect(events).toContain('shell.denied');
  });

  it('filtre les secrets de l’environnement enfant', async () => {
    const prev = process.env.FREE_LLM_API_KEY;
    process.env.FREE_LLM_API_KEY = 'super-secret-value';
    try {
      const tool = new ShellTool({ cwdRoot: tmpDir });
      const res = await tool.execute(['node', '-e', 'console.log(process.env.FREE_LLM_API_KEY || "absent")']);
      expect(res.stdout.trim()).toBe('absent');
    } finally {
      if (prev === undefined) delete process.env.FREE_LLM_API_KEY;
      else process.env.FREE_LLM_API_KEY = prev;
    }
  });
});
