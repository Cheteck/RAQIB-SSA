import { describe, it, expect, vi } from 'vitest';
import { Planner, PlanningError } from '../../coding-engine/packages/runtime/src/planner';
import { SDKCodingEngine } from '../../coding-engine/packages/runtime/src/engine';
import type { CodingTask } from '../../coding-engine/packages/core/src';
import type { ModelProvider, ModelRequest, ModelResponse } from '../../coding-engine/packages/providers/src';

/**
 * F-04 — le plan doit provenir de la réponse effective du modèle et être
 * validé. Aucun plan constant, aucun repli silencieux.
 */

const task: CodingTask = {
  kind: 'refactor',
  instruction: 'Renommer la variable `a` en `account`',
  workspaceId: 'ws-f04',
  mode: 'propose',
};

function providerReturning(content: string): ModelProvider & { calls: ModelRequest[] } {
  const calls: ModelRequest[] = [];
  return {
    id: 'fake',
    calls,
    async complete(req: ModelRequest): Promise<ModelResponse> {
      calls.push(req);
      return { message: { role: 'assistant', content } };
    },
  };
}

describe('F-04 — Planner réel', () => {
  it('refuse de produire un plan sans provider', async () => {
    const planner = new Planner();
    await expect(planner.createPlan(task)).rejects.toMatchObject({
      code: 'PLANNER_NOT_CONFIGURED',
    });
  });

  it('utilise les étapes de la réponse modèle, pas un plan constant', async () => {
    const provider = providerReturning(
      JSON.stringify({
        steps: [
          { id: 'locate', description: 'Localiser les usages de `a`' },
          { id: 'rename', description: 'Renommer en `account` et vérifier les types' },
        ],
      })
    );

    const planner = new Planner(provider);
    const steps = await planner.createPlan(task);

    expect(steps).toEqual([
      { id: 'locate', description: 'Localiser les usages de `a`', status: 'pending' },
      { id: 'rename', description: 'Renommer en `account` et vérifier les types', status: 'pending' },
    ]);
    // Le plan n'est plus le trio constant « Analyze/Generate/Validate ».
    expect(steps.map((s) => s.description).join(' ')).not.toMatch(/Analyze workspace for instruction/);

    const call = provider.calls[0];
    expect(call.model).toBe('auto');
    expect(call.temperature).toBe(0);
    expect(call.messages[0].role).toBe('system');
    expect(call.messages[1].content).toMatch(/Renommer la variable/);
  });

  it('accepte un bloc JSON clôturé par des backticks', async () => {
    const provider = providerReturning(
      '```json\n{"steps":[{"id":"s1","description":"Inspecter le fichier"}]}\n```'
    );
    const steps = await new Planner(provider).createPlan(task);
    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe('s1');
  });

  it('refuse une réponse sans JSON exploitable', async () => {
    const planner = new Planner(providerReturning('Voici un plan : fais des choses.'));
    await expect(planner.createPlan(task)).rejects.toMatchObject({
      code: 'PLANNER_INVALID_RESPONSE',
    });
  });

  it('refuse un plan vide', async () => {
    const planner = new Planner(providerReturning('{"steps":[]}'));
    await expect(planner.createPlan(task)).rejects.toMatchObject({
      code: 'PLANNER_INVALID_RESPONSE',
    });
  });

  it('refuse des identifiants dupliqués', async () => {
    const planner = new Planner(
      providerReturning(
        JSON.stringify({
          steps: [
            { id: 'dup', description: 'Première action' },
            { id: 'dup', description: 'Seconde action' },
          ],
        })
      )
    );
    await expect(planner.createPlan(task)).rejects.toMatchObject({
      code: 'PLANNER_INVALID_RESPONSE',
    });
  });

  it('refuse une description absente', async () => {
    const planner = new Planner(providerReturning('{"steps":[{"id":"s1","description":""}]}'));
    await expect(planner.createPlan(task)).rejects.toMatchObject({
      code: 'PLANNER_INVALID_RESPONSE',
    });
  });

  it('borne le nombre d’étapes via les contraintes', async () => {
    const planner = new Planner(
      providerReturning(
        JSON.stringify({
          steps: [
            { id: 's1', description: 'Action un' },
            { id: 's2', description: 'Action deux' },
            { id: 's3', description: 'Action trois' },
          ],
        })
      )
    );

    await expect(
      planner.createPlan({ ...task, constraints: { maxIterations: 2 } })
    ).rejects.toMatchObject({ code: 'PLANNER_INVALID_RESPONSE' });
  });

  it('remonte une erreur modèle explicite, sans plan de repli', async () => {
    const failing: ModelProvider = {
      id: 'failing',
      async complete(): Promise<ModelResponse> {
        throw new Error('réseau indisponible');
      },
    };

    const planner = new Planner(failing);
    await expect(planner.createPlan(task)).rejects.toBeInstanceOf(PlanningError);
    await expect(planner.createPlan(task)).rejects.toMatchObject({
      code: 'PLANNER_MODEL_ERROR',
    });
  });

  it('le moteur fail-closed ne planifie pas et n’appelle jamais le provider', async () => {
    const provider = providerReturning('{"steps":[{"id":"s1","description":"Ne devrait pas être lu"}]}');
    const engine = new SDKCodingEngine(provider);

    const result = await engine.execute(task);

    expect(result.status).toBe('blocked');
    expect(provider.calls).toHaveLength(0);
  });
});
