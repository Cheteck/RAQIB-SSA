import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { VerificationEngine } from '../../packages/verification/src/VerificationEngine';

describe('VerificationEngine — GIT_STATUS_UNCHANGED (MOSAIX-001 v2)', () => {
  let tmpDir: string;
  const engine = new VerificationEngine();

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-git-status-'));
    execSync('git init -q', { cwd: tmpDir });
    execSync('git config user.email test@example.com', { cwd: tmpDir });
    execSync('git config user.name Test', { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'tracked.txt'), 'hello', 'utf8');
    execSync('git add .', { cwd: tmpDir });
    execSync('git commit -q -m init', { cwd: tmpDir });
  });

  afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('PASS lorsque le working tree reste identique au baseline', async () => {
    // Baseline volontairement sale : le check ne demande pas un arbre propre,
    // seulement l'absence de modification par la mission.
    fs.writeFileSync(path.join(tmpDir, 'untracked.txt'), 'baseline dirt', 'utf8');
    const baseline = execSync('git status --porcelain', { cwd: tmpDir, encoding: 'utf8' });

    const res = await engine.verifyGitStatusUnchanged(tmpDir, baseline);
    expect(res.passed).toBe(true);
    expect(res.checkId).toBe('GIT_STATUS_UNCHANGED');
  });

  it('FAIL lorsqu’un fichier est ajouté pendant la mission', async () => {
    const baseline = execSync('git status --porcelain', { cwd: tmpDir, encoding: 'utf8' });
    fs.writeFileSync(path.join(tmpDir, 'added-during-run.txt'), 'mutation', 'utf8');

    const res = await engine.verifyGitStatusUnchanged(tmpDir, baseline);
    expect(res.passed).toBe(false);
    expect(res.uncertainty).toMatch(/changed/i);

    fs.unlinkSync(path.join(tmpDir, 'added-during-run.txt'));
  });

  it('FAIL lorsqu’un fichier est supprimé pendant la mission', async () => {
    const baseline = execSync('git status --porcelain', { cwd: tmpDir, encoding: 'utf8' });
    const target = path.join(tmpDir, 'untracked.txt');
    const backup = fs.readFileSync(target, 'utf8');
    fs.unlinkSync(target);

    const res = await engine.verifyGitStatusUnchanged(tmpDir, baseline);
    expect(res.passed).toBe(false);

    fs.writeFileSync(target, backup, 'utf8');
  });

  it('produit PASS via verifyMission avec le type GIT_STATUS_UNCHANGED', async () => {
    const baseline = execSync('git status --porcelain', { cwd: tmpDir, encoding: 'utf8' });
    const report = await engine.verifyMission('m-git', [
      { id: 'c1', type: 'GIT_STATUS_UNCHANGED', target: tmpDir, expected: baseline },
    ]);
    expect(report.verdict).toBe('PASS');
  });

  it('produit FAIL via verifyMission si le baseline ne correspond plus', async () => {
    const report = await engine.verifyMission('m-git', [
      { id: 'c1', type: 'GIT_STATUS_UNCHANGED', target: tmpDir, expected: '## phantom-baseline' },
    ]);
    expect(report.verdict).toBe('FAIL');
  });
});
