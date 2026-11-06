import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PathGuard } from '../../packages/tool-gateway/src/PathGuard';
import { FileTool } from '../../packages/tool-gateway/src/FileTool';

describe('PathGuard — résolution des symlinks (CWE-59)', () => {
  let root: string;
  let outside: string;
  let linkType: 'junction' | 'dir' | null = null;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-sym-root-'));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-sym-outside-'));
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'TOP-SECRET', 'utf8');

    const linkPath = path.join(root, 'escape');
    const type = process.platform === 'win32' ? 'junction' : 'dir';
    try {
      fs.symlinkSync(outside, linkPath, type as any);
      linkType = type as any;
    } catch {
      linkType = null; // privilèges insuffisants sur cette machine
    }

    // Symlink interne légitime : root/inside -> root/data
    fs.mkdirSync(path.join(root, 'data'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data', 'ok.txt'), 'OK', 'utf8');
    try {
      fs.symlinkSync(path.join(root, 'data'), path.join(root, 'inside'), process.platform === 'win32' ? 'junction' as any : 'dir' as any);
    } catch {
      /* optionnel */
    }
  });

  afterAll(() => {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(outside, { recursive: true, force: true }); } catch {}
  });

  it('refuse un symlink sortant du root', () => {
    // Preuve non vacueuse : si le lien n'a pas pu être créé, le test échoue
    // au lieu de passer silencieusement.
    expect(linkType).not.toBeNull();
    const guard = new PathGuard(root);
    const check = guard.validate('escape/secret.txt');
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/outside allowed root/);
  });

  it('refuse la lecture via un symlink sortant', async () => {
    expect(linkType).not.toBeNull();
    const tool = new FileTool(new PathGuard(root));
    await expect(tool.readFile('escape/secret.txt')).rejects.toThrow(/outside allowed root/);
  });

  it('refuse le symlink sortant lui-même', () => {
    expect(linkType).not.toBeNull();
    const guard = new PathGuard(root);
    expect(guard.validate('escape').allowed).toBe(false);
  });

  it('autorise un symlink interne au root', () => {
    // Le lien interne est créé dans beforeAll ; on exige sa présence.
    expect(fs.existsSync(path.join(root, 'inside'))).toBe(true);
    const guard = new PathGuard(root);
    const check = guard.validate('inside/ok.txt');
    expect(check.allowed).toBe(true);
  });

  it('autorise un chemin inexistant sous le root (création future)', () => {
    const guard = new PathGuard(root);
    expect(guard.validate('new-dir/new-file.txt').allowed).toBe(true);
  });

  it('refuse un chemin inexistant dont un ancêtre est un symlink sortant', () => {
    expect(linkType).not.toBeNull();
    const guard = new PathGuard(root);
    expect(guard.validate('escape/not-yet-created.txt').allowed).toBe(false);
  });
});
