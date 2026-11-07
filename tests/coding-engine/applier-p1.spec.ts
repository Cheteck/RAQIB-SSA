import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LocalWorkspace } from '../../coding-engine/packages/project/src/workspace';
import {
  CodingLoop,
  computePatchHash,
  createIsolatedWorkspace,
  type PatchProposal,
  type PlanStep,
  type VerificationOutcome,
} from '../../coding-engine/packages/runtime/src/loop';
import {
  captureWorkspaceContext,
  computeContextDigest,
  createWorkspaceApplier,
} from '../../coding-engine/packages/runtime/src/applier';

/**
 * P1 (a) — applier confiné.
 *
 * Vérifie les trois garanties : patch identique à l'approbation, CAS par
 * fichier avant écriture, postcondition relue + rollback sur échec partiel.
 */

const plan: PlanStep[] = [{ id: 's1', description: 'Appliquer le patch approuvé' }];

describe('P1 — applier confiné', () => {
  const baseDir = path.join(process.cwd(), 'data', 'test-p1-applier');
  const root = path.join(baseDir, 'workspace');
  const outside = path.join(baseDir, 'outside');
  let workspace: LocalWorkspace;

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    workspace = new LocalWorkspace({ id: 'ws-p1', root });
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  function write(rel: string, content: string) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    return full;
  }

  function read(rel: string): string {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  }

  function patchOf(files: Array<{ path: string; content: string | null }>): PatchProposal {
    return { files };
  }

  describe('capture du contexte', () => {
    it('enregistre existence et empreinte de contenu sans rien modifier', async () => {
      write('existing.ts', 'export const a = 1;');
      const patch = patchOf([
        { path: 'existing.ts', content: 'export const a = 2;' },
        { path: 'new.ts', content: 'export const b = 1;' },
      ]);

      const ctx = await captureWorkspaceContext(workspace, root, patch);

      expect(ctx.patchHash).toBe(computePatchHash(patch));
      expect(ctx.files).toEqual([
        { path: 'existing.ts', exists: true, contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
        { path: 'new.ts', exists: false, contentHash: null },
      ]);
      expect(ctx.digest).toBe(computeContextDigest(ctx.patchHash, ctx.files));
      // Aucune écriture.
      expect(read('existing.ts')).toBe('export const a = 1;');
      expect(fs.existsSync(path.join(root, 'new.ts'))).toBe(false);
    });

    it('refuse un chemin hors racine', async () => {
      await expect(
        captureWorkspaceContext(workspace, root, patchOf([{ path: '../outside/x.ts', content: 'x' }]))
      ).rejects.toThrow(/sort du workspace/);
    });

    it('refuse une racine incohérente avec le workspace', async () => {
      await expect(
        captureWorkspaceContext(workspace, outside, patchOf([{ path: 'a.ts', content: 'x' }]))
      ).rejects.toThrow(/racine incohérente/);
    });

    it('refuse un symlink qui sort de la racine', async () => {
      const link = path.join(root, 'escape');
      try {
        fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
      } catch {
        return; // environnement sans symlink : pas de simulation
      }

      await expect(
        captureWorkspaceContext(workspace, root, patchOf([{ path: 'escape/x.ts', content: 'x' }]))
      ).rejects.toThrow(/outside workspace root/);
    });
  });

  describe('application nominale', () => {
    it('crée un fichier et vérifie son contenu après écriture', async () => {
      const applier = createWorkspaceApplier({ workspace, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = patchOf([{ path: 'src/new.ts', content: 'export const n = 1;' }]);
      const ctx = await captureWorkspaceContext(workspace, root, patch);

      await applier.apply(patch, {
        missionId: 'm',
        workspaceRoot: root,
        patchHash: ctx.patchHash,
        approvalId: 'apr-1',
        context: ctx,
      });

      expect(read('src/new.ts')).toBe('export const n = 1;');
    });

    it('modifie un fichier existant', async () => {
      write('a.ts', 'v1');
      const applier = createWorkspaceApplier({ workspace, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = patchOf([{ path: 'a.ts', content: 'v2' }]);
      const ctx = await captureWorkspaceContext(workspace, root, patch);

      await applier.apply(patch, {
        missionId: 'm',
        workspaceRoot: root,
        patchHash: ctx.patchHash,
        approvalId: 'apr-1',
        context: ctx,
      });

      expect(read('a.ts')).toBe('v2');
    });

    it('supprime un fichier et vérifie son absence', async () => {
      write('obsolete.ts', 'x');
      const applier = createWorkspaceApplier({ workspace, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = patchOf([{ path: 'obsolete.ts', content: null }]);
      const ctx = await captureWorkspaceContext(workspace, root, patch);

      await applier.apply(patch, {
        missionId: 'm',
        workspaceRoot: root,
        patchHash: ctx.patchHash,
        approvalId: 'apr-1',
        context: ctx,
      });

      expect(fs.existsSync(path.join(root, 'obsolete.ts'))).toBe(false);
    });
  });

  describe('refus avant écriture', () => {
    async function prepared() {
      write('a.ts', 'v1');
      const applier = createWorkspaceApplier({ workspace, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = patchOf([{ path: 'a.ts', content: 'v2' }]);
      const ctx = await captureWorkspaceContext(workspace, root, patch);
      const context = {
        missionId: 'm',
        workspaceRoot: root,
        patchHash: ctx.patchHash,
        approvalId: 'apr-1',
        context: ctx,
      };
      return { applier, patch, ctx, context };
    }

    it('refuse un patch différent de celui approuvé', async () => {
      const { applier, context } = await prepared();
      const other = patchOf([{ path: 'a.ts', content: 'evil' }]);

      // Le hash d'approbation reste celui du patch initial : le patch fourni
      // ne peut donc pas être celui qui a été approuvé.
      await expect(applier.apply(other, context))
        .rejects.toThrow(/n'est pas celui qui a été approuvé/);
      expect(read('a.ts')).toBe('v1');
    });

    it('refuse une empreinte de contexte falsifiée', async () => {
      const { applier, patch, ctx, context } = await prepared();
      const tampered = { ...ctx, digest: 'f'.repeat(64) };

      await expect(applier.apply(patch, { ...context, context: tampered }))
        .rejects.toThrow(/empreinte de contexte incohérente/);
      expect(read('a.ts')).toBe('v1');
    });

    it('refuse si le fichier a été modifié après l’approbation', async () => {
      const { applier, patch, context } = await prepared();
      write('a.ts', 'modified-by-someone-else');

      await expect(applier.apply(patch, context)).rejects.toThrow(
        /a changé depuis l'approbation/
      );
      expect(read('a.ts')).toBe('modified-by-someone-else');
    });

    it('refuse si un fichier a été créé après l’approbation', async () => {
      const applier = createWorkspaceApplier({ workspace, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = patchOf([{ path: 'new.ts', content: 'x' }]);
      const ctx = await captureWorkspaceContext(workspace, root, patch);
      write('new.ts', 'apparu entre-temps');

      await expect(
        applier.apply(patch, {
          missionId: 'm',
          workspaceRoot: root,
          patchHash: ctx.patchHash,
          approvalId: 'apr-1',
          context: ctx,
        })
      ).rejects.toThrow(/a changé depuis l'approbation/);
      expect(read('new.ts')).toBe('apparu entre-temps');
    });

    it('refuse si un fichier a été supprimé après l’approbation', async () => {
      const { applier, patch, context } = await prepared();
      fs.rmSync(path.join(root, 'a.ts'));

      await expect(applier.apply(patch, context)).rejects.toThrow(
        /a changé depuis l'approbation/
      );
    });

    it('refuse un symlink créé après l’approbation (TOCTOU)', async () => {
      const applier = createWorkspaceApplier({ workspace, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = patchOf([{ path: 'escape/inside.ts', content: 'x' }]);
      const ctx = await captureWorkspaceContext(workspace, root, patch);

      const link = path.join(root, 'escape');
      try {
        fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
      } catch {
        return;
      }

      await expect(
        applier.apply(patch, {
          missionId: 'm',
          workspaceRoot: root,
          patchHash: ctx.patchHash,
          approvalId: 'apr-1',
          context: ctx,
        })
      ).rejects.toThrow(/outside workspace root/);
      expect(fs.existsSync(path.join(outside, 'inside.ts'))).toBe(false);
    });

    it('refuse si le workspace ne sait pas supprimer', async () => {
      write('a.ts', 'v1');
      const noDelete = {
        getInfo: async () => ({ id: 'fake', root }),
        listFiles: async () => [],
        readFile: async (p: string) => fs.readFileSync(path.join(root, p), 'utf8'),
        exists: async (p: string) => fs.existsSync(path.join(root, p)),
        writeFile: async (p: string, c: string) => {
          fs.writeFileSync(path.join(root, p), c, 'utf8');
        },
      };
      const applier = createWorkspaceApplier({ workspace: noDelete, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = patchOf([{ path: 'a.ts', content: null }]);
      const ctx = await captureWorkspaceContext(noDelete, root, patch);

      await expect(
        applier.apply(patch, {
          missionId: 'm',
          workspaceRoot: root,
          patchHash: ctx.patchHash,
          approvalId: 'apr-1',
          context: ctx,
        })
      ).rejects.toThrow(/ne sait pas supprimer/);
      expect(read('a.ts')).toBe('v1');
    });
  });

  describe('échec partiel et rollback', () => {
    /**
     * `zz-blocker` est un FICHIER : créer `zz-blocker/child.txt` échoue donc
     * réellement (mkdir sur un fichier), après que `a-target.txt` a été écrit.
     */
    function blockingPatch(first: { path: string; content: string | null }) {
      return patchOf([first, { path: 'zz-blocker/child.txt', content: 'x' }]);
    }

    it('restaure un fichier modifié quand l’écriture suivante échoue', async () => {
      write('a-target.txt', 'original');
      write('zz-blocker', 'je suis un fichier');
      const applier = createWorkspaceApplier({ workspace, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = blockingPatch({ path: 'a-target.txt', content: 'modifié' });
      const ctx = await captureWorkspaceContext(workspace, root, patch);

      await expect(
        applier.apply(patch, {
          missionId: 'm',
          workspaceRoot: root,
          patchHash: ctx.patchHash,
          approvalId: 'apr-1',
          context: ctx,
        })
      ).rejects.toThrow(/rollback appliqué/);

      expect(read('a-target.txt')).toBe('original');
    });

    it('supprime un fichier créé quand l’écriture suivante échoue', async () => {
      write('zz-blocker', 'fichier');
      const applier = createWorkspaceApplier({ workspace, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = blockingPatch({ path: 'a-created.txt', content: 'nouveau' });
      const ctx = await captureWorkspaceContext(workspace, root, patch);

      await expect(
        applier.apply(patch, {
          missionId: 'm',
          workspaceRoot: root,
          patchHash: ctx.patchHash,
          approvalId: 'apr-1',
          context: ctx,
        })
      ).rejects.toThrow(/rollback appliqué/);

      expect(fs.existsSync(path.join(root, 'a-created.txt'))).toBe(false);
    });

    it('restaure un fichier supprimé quand l’écriture suivante échoue', async () => {
      write('a-deleted.txt', 'à conserver');
      write('zz-blocker', 'fichier');
      const applier = createWorkspaceApplier({ workspace, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = blockingPatch({ path: 'a-deleted.txt', content: null });
      const ctx = await captureWorkspaceContext(workspace, root, patch);

      await expect(
        applier.apply(patch, {
          missionId: 'm',
          workspaceRoot: root,
          patchHash: ctx.patchHash,
          approvalId: 'apr-1',
          context: ctx,
        })
      ).rejects.toThrow(/rollback appliqué/);

      expect(read('a-deleted.txt')).toBe('à conserver');
    });

    it('refuse une écriture silencieusement sans effet (postcondition non observée)', async () => {
      write('a.ts', 'v1');
      const silent = {
        getInfo: async () => ({ id: 'silent', root }),
        listFiles: async () => [],
        readFile: async (p: string) => fs.readFileSync(path.join(root, p), 'utf8'),
        exists: async (p: string) => fs.existsSync(path.join(root, p)),
        writeFile: async () => undefined,
        deleteFile: async () => true,
      };
      const applier = createWorkspaceApplier({ workspace: silent, workspaceRoot: root, missionId: 'm', ledgerPath: path.join(baseDir, 'audit.jsonl') });
      const patch = patchOf([{ path: 'a.ts', content: 'v2' }]);
      const ctx = await captureWorkspaceContext(silent, root, patch);

      await expect(
        applier.apply(patch, {
          missionId: 'm',
          workspaceRoot: root,
          patchHash: ctx.patchHash,
          approvalId: 'apr-1',
          context: ctx,
        })
      ).rejects.toThrow(/non conforme après écriture/);
      expect(read('a.ts')).toBe('v1');
    });
  });

  describe('hash de patch non ambigu', () => {
    it('distingue des patches qui se confondraient avec un simple join', () => {
      const colonPath = patchOf([{ path: 'a:b', content: 'c' }]);
      const colonContent = patchOf([{ path: 'a', content: 'b:c' }]);

      expect(computePatchHash(colonPath)).not.toBe(computePatchHash(colonContent));
    });

    it('distingue une suppression d’une écriture vide', () => {
      expect(computePatchHash(patchOf([{ path: 'a', content: null }]))).not.toBe(
        computePatchHash(patchOf([{ path: 'a', content: '' }]))
      );
    });

    it('est indépendant de l’ordre des fichiers', () => {
      const a = patchOf([
        { path: 'x.ts', content: '1' },
        { path: 'y.ts', content: '2' },
      ]);
      const b = patchOf([
        { path: 'y.ts', content: '2' },
        { path: 'x.ts', content: '1' },
      ]);
      expect(computePatchHash(a)).toBe(computePatchHash(b));
    });

    it('normalise les séparateurs Windows', () => {
      expect(computePatchHash(patchOf([{ path: 'src\\a.ts', content: '1' }]))).toBe(
        computePatchHash(patchOf([{ path: 'src/a.ts', content: '1' }]))
      );
    });
  });

  describe('intégration dans la boucle', () => {
    async function realLoop(missionId: string) {
      const missionRoot = createIsolatedWorkspace(missionId, baseDir);
      const missionWorkspace = new LocalWorkspace({ id: `ws-${missionId}`, root: missionRoot });
      const applier = createWorkspaceApplier({
        workspace: missionWorkspace,
        workspaceRoot: missionRoot,
        missionId,
        ledgerPath: path.join(baseDir, `audit-${missionId}.jsonl`),
      });
      const patch = patchOf([{ path: 'src/answer.ts', content: 'export const answer = 42;\n' }]);

      const verification: VerificationOutcome = {
        passed: true,
        results: [
          {
            checkId: 'file-content',
            passed: true,
            evidence: `src/answer.ts = ${fs.existsSync(path.join(missionRoot, 'src/answer.ts'))}`,
          },
        ],
      };

      const loop = new CodingLoop(
        { missionId, workspaceRoot: missionRoot, approvalTtlMs: 60_000 },
        {
          plan: async () => plan,
          propose: async () => patch,
          captureContext: applier.captureContext,
          applier: applier.apply,
          verify: async () => verification,
        }
      );

      return { loop, applier, missionRoot, missionWorkspace, patch };
    }

    it('écrit réellement le fichier approuvé puis vérifie', async () => {
      const { loop, missionRoot } = await realLoop('integration-happy');
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-real',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();
      await loop.verify();

      expect(loop.state).toBe('COMPLETED');
      expect(fs.readFileSync(path.join(missionRoot, 'src/answer.ts'), 'utf8')).toBe(
        'export const answer = 42;\n'
      );
    });

    it('refuse l’application si le workspace change entre approbation et application', async () => {
      const { loop, missionRoot } = await realLoop('integration-toctou');
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-real',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });

      // Un autre acteur crée le fichier cible avant l'application.
      fs.mkdirSync(path.join(missionRoot, 'src'), { recursive: true });
      fs.writeFileSync(path.join(missionRoot, 'src', 'answer.ts'), 'contenu pirate', 'utf8');

      await loop.apply();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/workspace modifié depuis l'approbation/);
      expect(fs.readFileSync(path.join(missionRoot, 'src', 'answer.ts'), 'utf8')).toBe(
        'contenu pirate'
      );
    });

    it('un crash pendant APPLYING reprend en BLOCKED et ne rejoue pas le patch', async () => {
      const { loop, missionRoot, applier } = await realLoop('integration-crash');
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-real',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();

      const crashSnapshot = { ...loop.snapshot(), state: 'APPLYING' as const };
      const restored = CodingLoop.restore(crashSnapshot, {
        plan: async () => plan,
        propose: async () => crashSnapshot.patch!,
        captureContext: applier.captureContext,
        applier: applier.apply,
        verify: async () => ({
          passed: true,
          results: [{ checkId: 'x', passed: true, evidence: 'ok' }],
        }),
      });

      expect(restored.state).toBe('BLOCKED');
      expect(restored.snapshot().blockedReason).toMatch(/reprise après crash/);
      expect(fs.readFileSync(path.join(missionRoot, 'src', 'answer.ts'), 'utf8')).toBe(
        'export const answer = 42;\n'
      );
    });
  });
});
