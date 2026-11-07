import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  CodingLoop,
  LoopTransitionError,
  assertPatchWithinWorkspace,
  computePatchHash,
  createIsolatedWorkspace,
  type LoopPorts,
  type LoopSnapshot,
  type PatchProposal,
  type PlanStep,
  type VerificationOutcome,
} from '../../coding-engine/packages/runtime/src/loop';

/**
 * P1 — tests de frontière du contrat de boucle.
 *
 * Le module ne branche AUCUNE mutation réelle : `applier` est un port. Ces
 * tests vérifient que chaque frontière échoue en BLOCKED plutôt que de
 * revendiquer un succès, et qu'aucun état intermédiaire n'est jamais supposé
 * réussi après un crash.
 */

const plan: PlanStep[] = [
  { id: 'locate', description: 'Localiser les usages de la fonction cible' },
  { id: 'patch', description: 'Remplacer la fonction et vérifier les types' },
];

const patch: PatchProposal = {
  files: [
    { path: 'src/a.ts', content: 'export const a = 1;\n' },
    { path: 'src/b.ts', content: null },
  ],
};

const goodOutcome: VerificationOutcome = {
  passed: true,
  results: [
    { checkId: 'types', passed: true, evidence: 'tsc --noEmit : 0 erreur' },
    { checkId: 'tests', passed: true, evidence: 'vitest run : 12 passed' },
  ],
};

function makePorts(overrides: Partial<LoopPorts> = {}): LoopPorts {
  return {
    plan: async () => plan,
    propose: async () => patch,
    // Le loop exige une capture de contexte dès qu'un applier existe.
    captureContext: async (p) => ({
      capturedAt: 0,
      patchHash: computePatchHash(p),
      files: [],
      digest: 'ctx-digest',
    }),
    applier: async () => undefined,
    verify: async () => goodOutcome,
    ...overrides,
  };
}

describe('P1 — contrat de boucle', () => {
  const baseDir = path.join(process.cwd(), 'data', 'test-p1-loop');
  let workspaceRoot: string;

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
    fs.mkdirSync(baseDir, { recursive: true });
    workspaceRoot = createIsolatedWorkspace('mission-test', baseDir);
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  function newLoop(ports: LoopPorts = makePorts(), options: Record<string, unknown> = {}) {
    return new CodingLoop(
      { missionId: 'mission-test', workspaceRoot, ...options },
      ports
    );
  }

  describe('happy path', () => {
    it('parcourt PLANNING → AWAITING_APPROVAL → APPLYING → VERIFYING → COMPLETED', async () => {
      const applied: PatchProposal[] = [];
      const loop = newLoop(
        makePorts({
          applier: async (p) => {
            applied.push(p);
          },
        })
      );

      expect(loop.state).toBe('PLANNING');
      await loop.planAndPropose();
      expect(loop.state).toBe('AWAITING_APPROVAL');
      expect(loop.plan).toEqual(plan);
      expect(loop.patchHash).toMatch(/^[a-f0-9]{64}$/);

      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();
      expect(loop.state).toBe('VERIFYING');
      expect(applied).toEqual([patch]);

      await loop.verify();
      expect(loop.state).toBe('COMPLETED');

      const transitions = loop.events.map((e) => `${e.from ?? 'START'}→${e.to}`);
      expect(transitions).toEqual([
        'PLANNING→AWAITING_APPROVAL',
        'AWAITING_APPROVAL→APPLYING',
        'APPLYING→VERIFYING',
        'VERIFYING→COMPLETED',
      ]);
    });

    it('produit un snapshot rejouable avec l’historique complet', async () => {
      const loop = newLoop();
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-snap',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();
      await loop.verify();

      const snapshot = loop.snapshot();
      expect(snapshot.version).toBe(1);
      expect(snapshot.state).toBe('COMPLETED');
      expect(snapshot.patchHash).toBe(computePatchHash(patch));
      expect(snapshot.approval?.approvalId).toBe('apr-snap');
      expect(snapshot.verification?.results).toHaveLength(2);
      expect(snapshot.events).toHaveLength(4);

      const restored = CodingLoop.restore(snapshot, makePorts());
      expect(restored.state).toBe('COMPLETED');
      expect(restored.snapshot().patchHash).toBe(snapshot.patchHash);
    });
  });

  describe('approbation liée au contenu', () => {
    it('refuse un hash qui ne correspond pas au patch courant', async () => {
      const loop = newLoop();
      await loop.planAndPropose();

      expect(() =>
        loop.grantApproval({
          approvalId: 'apr-bad',
          approvedBy: 'humain',
          patchHash: 'f'.repeat(64),
        })
      ).toThrow(/ne correspond pas au patch courant/);

      expect(loop.approval).toBeNull();
    });

    it('refuse une approbation sans identifiant ou sans auteur', async () => {
      const loop = newLoop();
      await loop.planAndPropose();

      expect(() =>
        loop.grantApproval({ approvalId: '', approvedBy: 'humain', patchHash: loop.patchHash! })
      ).toThrow(/identifiant et auteur obligatoires/);
      expect(() =>
        loop.grantApproval({ approvalId: 'apr', approvedBy: '', patchHash: loop.patchHash! })
      ).toThrow(/identifiant et auteur obligatoires/);
    });

    it('une double approbation remplace la précédente et reste liée au même hash', async () => {
      const applied: string[] = [];
      const loop = newLoop(
        makePorts({
          applier: async () => {
            applied.push('applied');
          },
        })
      );
      await loop.planAndPropose();

      loop.grantApproval({
        approvalId: 'apr-first',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      loop.grantApproval({
        approvalId: 'apr-second',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });

      expect(loop.approval?.approvalId).toBe('apr-second');

      await loop.apply();
      expect(applied).toEqual(['applied']);
      expect(loop.state).toBe('VERIFYING');
    });

    it('refuse d’appliquer une approbation liée à un autre patch (reprise falsifiée)', async () => {
      const loop = newLoop();
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });

      const snapshot = loop.snapshot();
      const tampered: LoopSnapshot = {
        ...snapshot,
        patch: { files: [{ path: 'src/evil.ts', content: 'x' }] },
        patchHash: computePatchHash({ files: [{ path: 'src/evil.ts', content: 'x' }] }),
      };

      const restored = CodingLoop.restore(tampered, makePorts());
      await restored.apply();

      expect(restored.state).toBe('BLOCKED');
      expect(restored.snapshot().blockedReason).toMatch(/non liée au patch courant/);
    });

    it('refuse d’appliquer sans approbation explicite', async () => {
      const loop = newLoop();
      await loop.planAndPropose();
      await loop.apply();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/aucune approbation explicite/);
    });

    it('refuse une approbation expirée', async () => {
      let clock = 1_000_000;
      const loop = newLoop(
        makePorts({ now: () => clock }),
        { approvalTtlMs: 1_000 }
      );
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-exp',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });

      clock += 1_001;
      await loop.apply();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/approbation expirée/);
    });

    it('n’accepte aucune transition depuis un état terminal', async () => {
      const loop = newLoop();
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();
      await loop.verify();
      expect(loop.state).toBe('COMPLETED');

      await expect(loop.planAndPropose()).rejects.toThrow(LoopTransitionError);
      await expect(loop.apply()).rejects.toThrow(LoopTransitionError);
      await expect(loop.verify()).rejects.toThrow(LoopTransitionError);
    });
  });

  describe('absence de mutation réelle', () => {
    it('passe en BLOCKED quand aucun applier n’est configuré', async () => {
      const ports = makePorts();
      delete (ports as { applier?: unknown }).applier;

      const loop = newLoop(ports);
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/aucun applier configuré/);
    });

    it('passe en BLOCKED si l’applier échoue', async () => {
      const loop = newLoop(
        makePorts({
          applier: async () => {
            throw new Error('disque plein');
          },
        })
      );
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/disque plein/);
    });

    it('refuse d’appliquer si aucun contexte n’a été capturé', async () => {
      const ports = makePorts();
      delete (ports as { captureContext?: unknown }).captureContext;

      const applied: string[] = [];
      ports.applier = async () => {
        applied.push('applied');
      };

      const loop = newLoop(ports);
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/contexte d'approbation non capturé/);
      expect(applied).toEqual([]);
    });

    it('refuse un contexte dont l’empreinte est absente', async () => {
      const loop = newLoop(
        makePorts({
          captureContext: async (p) => ({
            capturedAt: 0,
            patchHash: computePatchHash(p),
            files: [],
            digest: '',
          }),
        })
      );
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/empreinte absente/);
    });

    it('refuse un contexte non lié au patch proposé', async () => {
      const loop = newLoop(
        makePorts({
          captureContext: async () => ({
            capturedAt: 0,
            patchHash: 'f'.repeat(64),
            files: [],
            digest: 'ctx-digest',
          }),
        })
      );
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/non liée au patch proposé/);
    });

    it('refuse d’appliquer si le workspace a changé depuis l’approbation', async () => {
      let digest = 'ctx-v1';
      const applied: string[] = [];
      const loop = newLoop(
        makePorts({
          captureContext: async (p) => ({
            capturedAt: 0,
            patchHash: computePatchHash(p),
            files: [],
            digest,
          }),
          applier: async () => {
            applied.push('applied');
          },
        })
      );

      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });

      // Quelqu'un modifie le workspace après l'approbation.
      digest = 'ctx-v2';
      await loop.apply();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/workspace modifié depuis l'approbation/);
      expect(applied).toEqual([]);
    });

    it('refuse d’appliquer si la re-capture échoue', async () => {
      let calls = 0;
      const loop = newLoop(
        makePorts({
          captureContext: async (p) => {
            calls += 1;
            if (calls > 1) throw new Error('disque illisible');
            return {
              capturedAt: 0,
              patchHash: computePatchHash(p),
              files: [],
              digest: 'ctx-digest',
            };
          },
        })
      );
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/disque illisible/);
    });
  });

  describe('vérification indépendante', () => {
    async function loopAtVerifying(verify: LoopPorts['verify']) {
      const loop = newLoop(makePorts({ verify }));
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();
      expect(loop.state).toBe('VERIFYING');
      return loop;
    }

    it('refuse un résultat sans aucun check', async () => {
      const loop = await loopAtVerifying(async () => ({ passed: true, results: [] }));
      await loop.verify();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/aucun check exécuté/);
    });

    it('refuse un check sans preuve observée', async () => {
      const loop = await loopAtVerifying(async () => ({
        passed: true,
        results: [{ checkId: 'types', passed: true, evidence: '   ' }],
      }));
      await loop.verify();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/sans preuve observée/);
    });

    it('refuse un check dont la preuve est absente de la structure', async () => {
      const loop = await loopAtVerifying(async () => ({
        passed: true,
        results: [{ checkId: 'types', passed: true } as never],
      }));
      await loop.verify();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/sans preuve observée/);
    });

    it('refuse une vérification en échec', async () => {
      const loop = await loopAtVerifying(async () => ({
        passed: false,
        results: [{ checkId: 'tests', passed: false, evidence: '1 test en échec' }],
      }));
      await loop.verify();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/vérification échouée/);
    });

    it('refuse une vérification qui lève une erreur', async () => {
      const loop = await loopAtVerifying(async () => {
        throw new Error('runner indisponible');
      });
      await loop.verify();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/runner indisponible/);
    });

    it('ne peut pas vérifier depuis un autre état que VERIFYING', async () => {
      const loop = newLoop();
      await expect(loop.verify()).rejects.toThrow(LoopTransitionError);
    });
  });

  describe('planification', () => {
    it('refuse un plan vide', async () => {
      const loop = newLoop(makePorts({ plan: async () => [] }));
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/plan vide/);
    });

    it('refuse un plan trop long', async () => {
      const loop = newLoop(
        makePorts({
          plan: async () =>
            Array.from({ length: 4 }, (_, i) => ({
              id: `s${i}`,
              description: `Action ${i} détaillée`,
            })),
        }),
        { maxSteps: 3 }
      );
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/plan trop long/);
    });

    it('refuse des identifiants dupliqués', async () => {
      const loop = newLoop(
        makePorts({
          plan: async () => [
            { id: 'dup', description: 'Première action' },
            { id: 'dup', description: 'Seconde action' },
          ],
        })
      );
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/dupliquées/);
    });

    it('refuse une description inexploitable', async () => {
      const loop = newLoop(
        makePorts({ plan: async () => [{ id: 's1', description: '  ' }] })
      );
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/sans description exploitable/);
    });

    it('bloque si la planification lève une erreur', async () => {
      const loop = newLoop(
        makePorts({
          plan: async () => {
            throw new Error('provider indisponible');
          },
        })
      );
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/provider indisponible/);
    });
  });

  describe('confinement du patch', () => {
    it('refuse une traversée .. hors du workspace', async () => {
      const loop = newLoop(
        makePorts({
          propose: async () => ({
            files: [{ path: '../../outside.ts', content: 'x' }],
          }),
        })
      );
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/sort du workspace de la mission/);
      expect(loop.patch).toBeNull();
    });

    it('refuse un chemin absolu hors du workspace', async () => {
      const outside = path.join(baseDir, 'outside.ts');
      const loop = newLoop(
        makePorts({
          propose: async () => ({ files: [{ path: outside, content: 'x' }] }),
        })
      );
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/sort du workspace/);
    });

    it('refuse un patch vide', async () => {
      const loop = newLoop(makePorts({ propose: async () => ({ files: [] }) }));
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/Patch vide/);
    });

    it('refuse un chemin présent plusieurs fois', () => {
      expect(() =>
        assertPatchWithinWorkspace(workspaceRoot, {
          files: [
            { path: 'src/a.ts', content: '1' },
            { path: 'src/../src/a.ts', content: '2' },
          ],
        })
      ).toThrow(/présent plusieurs fois/);
    });

    it('accepte un patch strictement contenu dans le workspace', () => {
      expect(() => assertPatchWithinWorkspace(workspaceRoot, patch)).not.toThrow();
    });
  });

  describe('délais et reprise après crash', () => {
    it('bloque si le délai est dépassé avant la planification', async () => {
      let clock = 1_000_000;
      const loop = newLoop(makePorts({ now: () => clock }), { timeoutMs: 500 });

      clock += 501;
      await loop.planAndPropose();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/timeout pendant la planification/);
    });

    it('bloque si le délai est dépassé avant l’application', async () => {
      let clock = 1_000_000;
      const called: string[] = [];
      const loop = newLoop(
        makePorts({
          now: () => clock,
          applier: async () => {
            called.push('applied');
          },
        }),
        { timeoutMs: 5_000 }
      );
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });

      clock += 5_001;
      await loop.apply();

      expect(loop.state).toBe('BLOCKED');
      expect(loop.snapshot().blockedReason).toMatch(/timeout avant application/);
      expect(called).toEqual([]);
    });

    it.each(['PLANNING', 'APPLYING', 'VERIFYING'] as const)(
      'un snapshot en état %s reprend en BLOCKED (issue inconnue)',
      async (state) => {
        const loop = newLoop();
        await loop.planAndPropose();
        loop.grantApproval({
          approvalId: 'apr-1',
          approvedBy: 'humain',
          patchHash: loop.patchHash!,
        });
        await loop.apply();

        const snapshot: LoopSnapshot = { ...loop.snapshot(), state };
        const restored = CodingLoop.restore(snapshot, makePorts());

        expect(restored.state).toBe('BLOCKED');
        expect(restored.snapshot().blockedReason).toMatch(/reprise après crash/);
      }
    );

    it('un snapshot COMPLETED ou BLOCKED reste stable après reprise', async () => {
      const loop = newLoop();
      await loop.planAndPropose();
      loop.grantApproval({
        approvalId: 'apr-1',
        approvedBy: 'humain',
        patchHash: loop.patchHash!,
      });
      await loop.apply();
      await loop.verify();

      const restored = CodingLoop.restore(loop.snapshot(), makePorts());
      expect(restored.state).toBe('COMPLETED');
      expect(restored.snapshot().blockedReason).toBeNull();
    });
  });

  describe('isolation des workspaces', () => {
    it('crée un répertoire distinct par mission, sans fuite de fichiers', () => {
      const one = createIsolatedWorkspace('mission-a', baseDir);
      const two = createIsolatedWorkspace('mission-a', baseDir);
      const other = createIsolatedWorkspace('mission-b', baseDir);

      expect(one).not.toBe(two);
      expect(one).not.toBe(other);

      fs.writeFileSync(path.join(one, 'secret.ts'), 'mission A', 'utf8');

      expect(fs.existsSync(path.join(one, 'secret.ts'))).toBe(true);
      expect(fs.existsSync(path.join(two, 'secret.ts'))).toBe(false);
      expect(fs.existsSync(path.join(other, 'secret.ts'))).toBe(false);
    });

    it('refuse une boucle sans workspaceRoot', () => {
      expect(
        () =>
          new CodingLoop({ missionId: 'm', workspaceRoot: '' }, makePorts())
      ).toThrow(/workspaceRoot obligatoire/);
    });

    it('normalise les identifiants de mission dangereux pour le nom de dossier', () => {
      const created = createIsolatedWorkspace('../../etc/passwd', baseDir);

      // Le répertoire reste enfant direct de la base : aucun séparateur ne
      // subsiste dans le nom, donc aucune traversée n'est possible.
      expect(path.dirname(created)).toBe(path.resolve(baseDir));
      const name = path.basename(created);
      expect(name).not.toMatch(/[\\/]/);
      expect(name.startsWith('.._.._etc_passwd-')).toBe(true);
    });
  });
});
