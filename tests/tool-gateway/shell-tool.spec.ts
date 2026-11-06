import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ShellTool, ShellPolicyError, matchesArgumentPattern } from '../../packages/tool-gateway/src/ShellTool';

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

  it('propage la corrélation et qualifie l’issue (success/failure/denied)', async () => {    const events: any[] = [];
    const tool = new ShellTool({
      cwdRoot: tmpDir,
      onEvent: (e) => { events.push(e); },
    });

    await tool.execute(['node', '--version'], { missionId: 'm1', stepId: 's1', correlationId: 'c1' });
    await tool.execute(['node', '-e', 'process.exit(2)'], { missionId: 'm1', stepId: 's2', correlationId: 'c2' });
    await expect(
      tool.execute(['rm', '-rf', '.'], { missionId: 'm1', stepId: 's3', correlationId: 'c3' }),
    ).rejects.toThrow(/allowlist/);

    const completed = events.filter((e) => e.type === 'shell.completed');
    expect(completed).toHaveLength(2);
    expect(completed[0].outcome).toBe('success');
    expect(completed[1].outcome).toBe('failure');
    expect(completed[0].correlation).toEqual({ missionId: 'm1', stepId: 's1', correlationId: 'c1' });

    const denied = events.find((e) => e.type === 'shell.denied');
    expect(denied).toBeDefined();
    expect(denied.correlation).toEqual({ missionId: 'm1', stepId: 's3', correlationId: 'c3' });
    expect(denied.reason).toMatch(/allowlist/);
  });

  it('mode read-only : autorise les commandes d’inspection', async () => {
    const tool = new ShellTool({ cwdRoot: tmpDir });
    const git = await tool.execute(['git', '--version'], { readOnly: true });
    expect(git.exitCode).toBe(0);
    const node = await tool.execute(['node', '--version'], { readOnly: true });
    expect(node.exitCode).toBe(0);
  });

  it('mode read-only : refuse toute commande capable d’écrire', async () => {
    const tool = new ShellTool({ cwdRoot: tmpDir });
    const denied = [
      ['git', 'commit', '-m', 'x'],
      ['git', 'push'],
      ['git', 'reset', '--hard'],
      ['git', 'checkout', '--', '.'],
      ['npm', 'install'],
      ['npx', 'tsc'],
      ['tsc'],
      ['vitest', 'run'],
      ['docker', 'run', 'alpine'],
      ['node', '-e', 'require("fs").writeFileSync("pwn.txt","x")'],
    ];
    for (const argv of denied) {
      await expect(tool.execute(argv, { readOnly: true })).rejects.toThrow(
        /Arguments not allowed|no allowed argument profile/,
      );
    }
    // Aucun fichier n'a été créé par ces tentative refusées.
    expect(fs.existsSync(path.join(tmpDir, 'pwn.txt'))).toBe(false);
  });

  it('profils personnalisés : fail-closed si la commande n’a pas de profil', async () => {
    const tool = new ShellTool({
      cwdRoot: tmpDir,
      enforceArgumentProfiles: true,
      argumentProfiles: {
        node: [{ args: ['--version'], description: 'version seule' }],
      },
    });
    await expect(tool.execute(['node', '--version'])).resolves.toMatchObject({ exitCode: 0 });
    await expect(tool.execute(['node', '-e', 'console.log(1)'])).rejects.toThrow(/Arguments not allowed/);
    await expect(tool.execute(['git', 'status'])).rejects.toThrow(/no allowed argument profile/);
  });

  it('matchesArgumentPattern gère * et **', () => {
    expect(matchesArgumentPattern(['status', '--porcelain'], ['status', '**'])).toBe(true);
    expect(matchesArgumentPattern(['status'], ['status', '**'])).toBe(true);
    expect(matchesArgumentPattern(['status', 'a', 'b'], ['status', '*'])).toBe(false);
    expect(matchesArgumentPattern(['--version'], ['--version'])).toBe(true);
    expect(matchesArgumentPattern([], [])).toBe(true);
    expect(matchesArgumentPattern(['--version', '--extra'], ['--version'])).toBe(false);
  });

  it('refuse un cwd qui est un symlink sortant du root', async () => {
    const escapeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-sym-root-'));
    const escapeTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-sym-out-'));
    let created = false;
    try {
      fs.symlinkSync(escapeTarget, path.join(escapeRoot, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
      created = true;
    } catch {
      created = false;
    }
    try {
      // Preuve non vacueuse : le lien doit exister pour que le refus soit testé.
      expect(created).toBe(true);
      const tool = new ShellTool({ cwdRoot: escapeRoot });
      await expect(
        tool.execute(['node', '--version'], { cwd: 'escape' }),
      ).rejects.toThrow(/Working directory refused/);
    } finally {
      try { fs.rmSync(escapeRoot, { recursive: true, force: true }); } catch {}
      try { fs.rmSync(escapeTarget, { recursive: true, force: true }); } catch {}
    }
  });
});
