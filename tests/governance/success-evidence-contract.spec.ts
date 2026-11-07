import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  evaluateSuccessClaim,
  claimsSuccess,
  collectEvidence,
  assertProvenSuccess,
  UnprovenSuccessError,
} from '../../packages/shared/src/evidence';
import { SDKCodingEngine } from '../../coding-engine/packages/runtime/src/engine';
import { LocalWorkspace } from '../../coding-engine/packages/project/src/workspace';
import { applyPatchTool } from '../../coding-engine/packages/tools/src/apply-patch';
import { SkillsRegistry } from '../../packages/tool-gateway/src/SkillsRegistry';

/**
 * INVARIANT CI — « aucun succès sans preuve ».
 *
 * Tout composant qui revendique un succès doit fournir une preuve observée.
 * Les surfaces actuellement non conformes sont en QUARANTAINE explicite :
 * elles sont listées, rattachées à un finding de docs/PLACEHOLDER_AUDIT.md,
 * et vérifiées comme *toujours* non conformes.
 *
 * Conséquence recherchée : dès qu'une surface est corrigée, ce test échoue et
 * force la mise à jour de la quarantaine. Toute nouvelle surface qui renvoie un
 * succès vide échoue immédiatement — c'est le verrou anti-régression.
 */

const AUDIT_DOC = path.join(process.cwd(), 'docs', 'PLACEHOLDER_AUDIT.md');

interface ProbeResult {
  claim: unknown;
  /** Effets observables, pour vérifier que le succès revendiqué correspond au réel. */
  effects?: Record<string, unknown>;
}

interface SurfaceProbe {
  id: string;
  finding: string;
  /**
   * Un skill dont le contrat est « produire un travail » revendique un succès
   * dès qu'il retourne un objet au lieu d'échouer. Sans ce drapeau, un
   * placeholder qui retourne `{ message }` passerait pour un non-succès.
   */
  claimsOnAnyResponse?: boolean;
  produce: () => Promise<ProbeResult>;
}

/** Évalue une sonde en tenant compte de son contrat de surface. */
function probeVerdict(probe: SurfaceProbe, claim: unknown) {
  const verdict = evaluateSuccessClaim(claim);
  if (probe.claimsOnAnyResponse && !verdict.successClaimed) {
    // Un succès implicite doit tout de même être adossé à une preuve observée.
    const evidence = collectEvidence(claim);
    return {
      successClaimed: true,
      proven: evidence.length > 0,
      reason:
        evidence.length > 0
          ? `prouvé par ${evidence.map((e) => e.kind).join(', ')}`
          : 'réponse retournée sans preuve observée (contrat de travail non tenu)',
      evidence,
    };
  }
  return verdict;
}

/**
 * Quarantaine du contrat de preuve.
 *
 * F-06 (suppression réelle) est sorti de quarantaine : `apply_patch --delete`
 * supprime effectivement le fichier et vérifie l'absence après coup.
 * Toute nouvelle entrée doit référencer un finding présent dans PLACEHOLDER_AUDIT.md.
 */
const QUARANTINE: Record<string, { finding: string; reason: string }> = {};

describe('Contrat de preuve de succès — invariant CI', () => {
  const testDir = path.join(process.cwd(), 'data', 'test-success-contract');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('table de vérité du contrat', () => {
    it('ne considère pas un résultat neutre comme un succès', () => {
      const verdict = evaluateSuccessClaim({ status: 'needs_approval' });
      expect(verdict.successClaimed).toBe(false);
      expect(verdict.proven).toBe(false);
    });

    it('refuse un succès narratif sans preuve', () => {
      const verdict = evaluateSuccessClaim({
        success: true,
        output: 'Task audit-proof-1 completed in mode apply.',
        durationMs: 1,
      });
      expect(verdict.successClaimed).toBe(true);
      expect(verdict.proven).toBe(false);
      expect(verdict.reason).toMatch(/sans preuve/);
    });

    it('refuse un rapport PASS sans résultats vérifiés', () => {
      const verdict = evaluateSuccessClaim({ verdict: 'PASS', passed: true, results: [] });
      expect(verdict.proven).toBe(false);
    });

    it('accepte un rapport PASS dont chaque résultat porte une preuve', () => {
      const verdict = evaluateSuccessClaim({
        verdict: 'PASS',
        passed: true,
        results: [{ checkId: 'c1', passed: true, evidence: 'exit 0', method: 'COMMAND_EXIT_CODE' }],
      });
      expect(verdict.proven).toBe(true);
      expect(verdict.evidence.map((e) => e.kind)).toContain('VERIFICATION_RESULT');
    });

    it('accepte un état de dépôt mesuré et sourcé', () => {
      const verdict = evaluateSuccessClaim({
        status: 'clean',
        dirtyCount: 0,
        source: 'git status --porcelain',
      });
      expect(verdict.proven).toBe(true);
      expect(verdict.evidence.map((e) => e.kind)).toContain('REPO_STATE');
    });

    it('refuse un état de dépôt déclaré sans mesure', () => {
      expect(collectEvidence({ status: 'clean', repo: '.' })).toEqual([]);
    });

    it('refuse un objet vide et un simple message comme preuve', () => {
      expect(collectEvidence({})).toEqual([]);
      expect(collectEvidence({ message: 'Codebase audit for path services' })).toEqual([]);
      expect(evaluateSuccessClaim({ success: true, message: 'fait' }).proven).toBe(false);
    });

    it('accepte une absence de changement explicitement justifiée', () => {
      expect(
        evaluateSuccessClaim({ status: 'completed', noChangeRequired: true, justification: 'tâche en lecture seule' })
          .proven
      ).toBe(true);
    });

    it('refuse une absence de changement non justifiée', () => {
      expect(claimsSuccess({ status: 'completed' })).toBe(true);
      expect(evaluateSuccessClaim({ status: 'completed' }).proven).toBe(false);
    });

    it('assertProvenSuccess lève une erreur typée', () => {
      expect(() => assertProvenSuccess('demo', { success: true })).toThrow(UnprovenSuccessError);
      expect(assertProvenSuccess('demo', { success: true, modifiedFiles: ['a.ts'] }).proven).toBe(true);
    });
  });

  describe('surfaces réelles', () => {
    const probes: SurfaceProbe[] = [
      {
        id: 'coding-engine.execute',
        finding: 'F-01',
        produce: async () => {
          const workspace = new LocalWorkspace({ id: 'ws-contract', root: testDir });
          const engine = new SDKCodingEngine(undefined, workspace);
          const result = await engine.execute({
            kind: 'create',
            instruction: 'Créer le fichier proof.txt',
            workspaceId: 'ws-contract',
            mode: 'apply',
          } as any);
          const target = path.join(testDir, 'proof.txt');
          return { claim: result, effects: { fileCreated: fs.existsSync(target) } };
        },
      },
      {
        id: 'coding-engine.approve',
        finding: 'F-05',
        produce: async () => {
          const engine = new SDKCodingEngine();
          const result = await engine.approve('task-contract', 'apr-contract');
          return { claim: result };
        },
      },
      {
        id: 'tool.apply_patch.delete',
        finding: 'F-06',
        produce: async () => {
          const root = path.join(testDir, 'delete-workspace');
          fs.mkdirSync(root, { recursive: true });
          const workspace = new LocalWorkspace({ id: 'ws-delete', root });
          const target = path.join(root, 'to-delete.ts');
          fs.writeFileSync(target, 'export const x = 1;', 'utf8');

          const result = await applyPatchTool.execute(
            { filePath: 'to-delete.ts', diff: '', operation: 'delete' },
            { taskId: 'task-contract', workspace }
          );
          return { claim: result, effects: { fileStillExists: fs.existsSync(target) } };
        },
      },
      {
        id: 'skill.git_status_check',
        finding: 'F-02',
        produce: async () => {
          const registry = new SkillsRegistry();
          const result = await registry.execute('git_status_check', { repoPath: '.' });
          return { claim: result };
        },
      },
      {
        id: 'skill.codebase_audit',
        finding: 'F-08',
        // Le contrat du skill est d'auditer : retourner un objet est un succès implicite.
        claimsOnAnyResponse: true,
        produce: async () => {
          const registry = new SkillsRegistry();
          const result = await registry.execute('codebase_audit', { path: 'packages' });
          return { claim: result };
        },
      },
    ];

    it("aucune surface hors quarantaine ne revendique un succès sans preuve", async () => {
      const offenders: string[] = [];

      for (const probe of probes) {
        const { claim } = await probe.produce();
        const verdict = probeVerdict(probe, claim);
        if (!verdict.successClaimed || verdict.proven) continue;
        if (QUARANTINE[probe.id]) continue;
        offenders.push(`${probe.id} (${probe.finding}): ${verdict.reason}`);
      }

      expect(offenders, `Succès sans preuve détecté(s) :\n${offenders.join('\n')}`).toEqual([]);
    });

    it('la quarantaine est exacte : chaque entrée est encore non conforme et documentée', async () => {
      const auditDoc = fs.readFileSync(AUDIT_DOC, 'utf8');
      const byId = new Map(probes.map((p) => [p.id, p]));
      const problems: string[] = [];

      for (const [id, entry] of Object.entries(QUARANTINE)) {
        const probe = byId.get(id);
        if (!probe) {
          problems.push(`${id}: sonde absente — retirer l'entrée de quarantaine`);
          continue;
        }
        if (probe.finding !== entry.finding) {
          problems.push(`${id}: finding incohérent (${probe.finding} attendu)`);
        }
        if (!auditDoc.includes(entry.finding)) {
          problems.push(`${id}: ${entry.finding} introuvable dans ${path.basename(AUDIT_DOC)}`);
        }

        const { claim } = await probe.produce();
        const verdict = probeVerdict(probe, claim);
        if (!verdict.successClaimed || verdict.proven) {
          problems.push(
            `${id}: la surface produit désormais une preuve — retirer l'entrée de quarantaine ` +
              `et mettre à jour ${path.basename(AUDIT_DOC)}`
          );
        }
      }

      expect(problems, problems.join('\n')).toEqual([]);
    });

    it('F-01 : le moteur refuse au lieu de revendiquer un succès sans effet', async () => {
      const probe = probes.find((p) => p.id === 'coding-engine.execute')!;
      const { claim, effects } = await probe.produce();
      const result = claim as { status: string; changes: unknown[] };

      expect(result.status).toBe('blocked');
      expect(evaluateSuccessClaim(claim).successClaimed).toBe(false);
      // Le moteur ne revendique plus une création de fichier : aucun fichier n'existe.
      expect(effects?.fileCreated).toBe(false);
    });

    it('F-06 : delete supprime réellement le fichier et le prouve', async () => {
      const probe = probes.find((p) => p.id === 'tool.apply_patch.delete')!;
      const { claim, effects } = await probe.produce();
      const result = claim as { success: boolean; observed: boolean };

      expect(result.success).toBe(true);
      expect(result.observed).toBe(true);
      expect(effects?.fileStillExists).toBe(false);
      expect(collectEvidence(claim).some((e) => e.kind === 'FILE_CHANGE')).toBe(true);
    });

    it('F-06 : un workspace sans deleteFile ne peut pas revendiquer une suppression', async () => {
      await expect(
        applyPatchTool.execute(
          { filePath: 'ghost.ts', diff: '', operation: 'delete' },
          { taskId: 'task-contract', workspace: { writeFile: async () => undefined } as any }
        )
      ).rejects.toThrow(/does not support deleteFile/);
    });

    it('F-02 : git_status_check mesure réellement le dépôt', async () => {
      // Dépôt isolé : aucune course avec les autres workers qui écrivent dans le repo.
      const repoDir = path.join(testDir, 'git-fixture');
      fs.mkdirSync(repoDir, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: repoDir });
      execFileSync('git', ['config', 'user.email', 'contract@raqib.test'], { cwd: repoDir });
      execFileSync('git', ['config', 'user.name', 'Contract'], { cwd: repoDir });
      fs.writeFileSync(path.join(repoDir, 'tracked.txt'), 'x', 'utf8');
      execFileSync('git', ['add', 'tracked.txt'], { cwd: repoDir });
      execFileSync('git', ['commit', '-qm', 'init'], { cwd: repoDir });
      fs.writeFileSync(path.join(repoDir, 'untracked.txt'), 'y', 'utf8');

      const registry = new SkillsRegistry();
      const claim = await registry.execute('git_status_check', { repoPath: repoDir });
      const result = claim as {
        status: string;
        dirtyCount: number;
        source: string;
        entries: string[];
        observed: boolean;
      };

      expect(result.source).toBe('git status --porcelain');
      expect(result.dirtyCount).toBe(1);
      expect(result.status).toBe('dirty');
      expect(result.entries).toEqual(['?? untracked.txt']);
      expect(result.observed).toBe(true);
      expect(collectEvidence(claim).some((e) => e.kind === 'REPO_STATE')).toBe(true);
    });

    it('F-08 : codebase_audit produit un inventaire réel', async () => {
      const probe = probes.find((p) => p.id === 'skill.codebase_audit')!;
      const { claim } = await probe.produce();
      const result = claim as {
        files: number;
        byExtension: Record<string, number>;
        observed: boolean;
        evidenceKind: string;
      };

      expect(result.observed).toBe(true);
      expect(result.evidenceKind).toBe('INVENTORY');
      expect(result.files).toBeGreaterThan(0);
      expect(result.byExtension['.ts'] ?? 0).toBeGreaterThan(0);
      expect(collectEvidence(claim).some((e) => e.kind === 'INVENTORY')).toBe(true);
    });
  });
});
