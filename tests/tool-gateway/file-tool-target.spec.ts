import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PathGuard } from '../../packages/tool-gateway/src/PathGuard';
import { FileTool } from '../../packages/tool-gateway/src/FileTool';

/**
 * Régression MOSAIX-001 v2 : FileTool validait via PathGuard mais lisait le
 * chemin relatif contre process.cwd(), donc il inspectait le mauvais dépôt
 * quand le root du guard n'était pas le cwd.
 */
describe('FileTool — confinement réel au root (MOSAIX-001 v2)', () => {
  let rootA: string;
  let rootB: string;

  beforeAll(() => {
    rootA = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-rootA-'));
    rootB = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-rootB-'));

    fs.mkdirSync(path.join(rootA, 'packages', 'alpha'), { recursive: true });
    fs.writeFileSync(path.join(rootA, 'packages', 'alpha', 'package.json'), '{"name":"@target/alpha"}');
    fs.writeFileSync(path.join(rootA, 'root-marker.txt'), 'A');

    // Le cwd contient un "packages/beta" leurre, comme RAQIB-SSA pendant le bug.
    fs.mkdirSync(path.join(rootB, 'packages', 'beta'), { recursive: true });
    fs.writeFileSync(path.join(rootB, 'packages', 'beta', 'package.json'), '{"name":"@decoy/beta"}');
    fs.writeFileSync(path.join(rootB, 'root-marker.txt'), 'B');
  });

  afterAll(() => {
    try { fs.rmSync(rootA, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(rootB, { recursive: true, force: true }); } catch {}
  });

  it('listDir(".") liste le root du guard, pas le cwd', async () => {
    const tool = new FileTool(new PathGuard(rootA));
    const names = (await tool.listDir('.')).map((e) => e.name).sort();
    expect(names).toContain('root-marker.txt');
    expect(names).toContain('packages');
  });

  it('readFile lit dans le root du guard, pas le cwd', async () => {
    const tool = new FileTool(new PathGuard(rootA));
    expect(await tool.readFile('root-marker.txt')).toBe('A');
  });

  it('readManifest lit le manifeste de la cible', async () => {
    const tool = new FileTool(new PathGuard(rootA));
    const manifest = await tool.readManifest('packages/alpha/package.json') as any;
    expect(manifest.name).toBe('@target/alpha');
  });

  it('listDir("packages") liste les packages de la cible', async () => {
    const tool = new FileTool(new PathGuard(rootA));
    const dirs = (await tool.listDir('packages')).map((e) => e.name);
    expect(dirs).toContain('alpha');
    expect(dirs).not.toContain('beta');
  });

  it('findByPattern renvoie des chemins absolus dans le root du guard', async () => {
    const tool = new FileTool(new PathGuard(rootA));
    const found = await tool.findByPattern('.', ['package.json']);
    expect(found).toHaveLength(1);
    expect(found[0].startsWith(rootA)).toBe(true);
    expect(found[0]).toContain(path.join('packages', 'alpha'));
  });

  it('refuse toujours une évasion hors du root', async () => {
    const tool = new FileTool(new PathGuard(rootA));
    await expect(tool.readFile('../ft-rootB/root-marker.txt')).rejects.toThrow(/outside allowed root/);
  });
});
