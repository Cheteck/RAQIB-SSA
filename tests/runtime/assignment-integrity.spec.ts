import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import request from 'supertest';
import { RaqibRuntime } from '../../services/runtime/src/RaqibRuntime';
import { createRuntimeServer } from '../../services/runtime/src/api/server';

/**
 * Intégrité Runtime — affectation des sous-agents (chantier Runtime Integrity).
 *
 * Couvre les quatre anomalies identifiées lors de la validation du Mission Control :
 *  3a — aucune écriture partielle quand une affectation est rejetée (+ rollback) ;
 *  3b — 404 ressource inexistante / 400 transition invalide ;
 *  3c — unassign() remet un agent COMPLETED à IDLE, jamais un agent RUNNING ;
 *  3d — /api/audit?order=desc&limit&offset (pagination serveur, plus récents d'abord).
 */

const testDataDir = path.join(process.cwd(), 'data', 'test-assignment-integrity');
const dbPath = path.join(testDataDir, 'assignment.db');

const PASS_REPORT = {
  verdict: 'PASS' as const,
  passed: true,
  results: [],
};

function missionPayload(id: string) {
  return {
    id,
    name: `Mission ${id}`,
    objective: 'Vérifier l’intégrité des affectations',
    autonomyLevel: 'A2',
    constraints: [],
    successCriteria: ['affectation cohérente'],
    steps: [
      { name: 'analyse', type: 'ANALYZE' },
      { name: 'propose', type: 'PROPOSE' },
    ],
    approvalRequired: false,
    budgetLimitEur: 1,
    maxDurationMs: 60000,
    maxAttempts: 2,
  };
}

describe('Runtime Integrity — affectations de sous-agents', () => {
  let runtime: RaqibRuntime;
  let app: any;
  const originalReadOnly = process.env.RAQIB_READ_ONLY_MODE;

  const createMission = async (id: string) => {
    const res = await request(app).post('/api/missions').send(missionPayload(id));
    expect(res.status).toBe(201);
    return res.body.mission;
  };

  const createSubagent = async (name: string, missionId?: string) => {
    const res = await request(app)
      .post('/api/subagents')
      .send({ name, role: 'executor', ...(missionId ? { missionId } : {}) });
    expect(res.status).toBe(201);
    return res.body.subagent;
  };

  const getAgent = async (id: string) => {
    const res = await request(app).get(`/api/subagents/${id}`);
    expect(res.status).toBe(200);
    return res.body.subagent;
  };

  const getHistory = async (id: string) => {
    const res = await request(app).get(`/api/subagents/${id}/history`);
    expect(res.status).toBe(200);
    return res.body.history as Array<Record<string, any>>;
  };

  const getMission = async (id: string) => {
    const res = await request(app).get(`/api/missions/${id}`);
    expect(res.status).toBe(200);
    return res.body.mission;
  };

  /** Force une mission à SUCCEEDED (statut terminal) via la machine à états. */
  const makeTerminal = async (id: string) => {
    await runtime.missionEngine.transitionStatus(id, 'RUNNING', 'test');
    await runtime.missionEngine.transitionStatus(id, 'VERIFYING', 'test');
    await runtime.missionEngine.transitionStatus(id, 'SUCCEEDED', 'test', {
      ...PASS_REPORT,
      missionId: id,
      timestamp: new Date().toISOString(),
      summary: 'Vérification automatique de test',
    } as any);
    expect((await getMission(id)).status).toBe('SUCCEEDED');
  };

  beforeEach(async () => {
    if (fs.existsSync(testDataDir)) {
      try { fs.rmSync(testDataDir, { recursive: true, force: true }); } catch {}
    }
    fs.mkdirSync(testDataDir, { recursive: true });

    process.env.RAQIB_READ_ONLY_MODE = 'false';
    runtime = new RaqibRuntime({ dbPath, dataDir: testDataDir });
    await runtime.initialize();
    app = createRuntimeServer(runtime);
  });

  afterEach(async () => {
    if (runtime) await runtime.stop();
    if (originalReadOnly === undefined) delete process.env.RAQIB_READ_ONLY_MODE;
    else process.env.RAQIB_READ_ONLY_MODE = originalReadOnly;
    if (fs.existsSync(testDataDir)) {
      try { fs.rmSync(testDataDir, { recursive: true, force: true }); } catch {}
    }
  });

  // ---------------------------------------------------------------- 3a / 3b

  it('3a — affectation vers une mission terminale : 400 et AUCUNE écriture partielle', async () => {
    await createMission('mission-open');
    await createMission('mission-terminal');
    await makeTerminal('mission-terminal');

    const agent = await createSubagent('Agent intégrité');

    // Affectation saine initiale.
    const ok = await request(app)
      .post(`/api/subagents/${agent.id}/assign`)
      .send({ missionId: 'mission-open', assignedBy: 'test' });
    expect(ok.status).toBe(200);
    expect(ok.body.subagent.missionId).toBe('mission-open');

    const historyBefore = await getHistory(agent.id);
    expect(historyBefore).toHaveLength(1);
    expect(historyBefore[0].missionId).toBe('mission-open');
    expect(historyBefore[0].unassignedAt).toBeFalsy();

    // Affectation refusée : la mission est terminale.
    const refused = await request(app)
      .post(`/api/subagents/${agent.id}/assign`)
      .send({ missionId: 'mission-terminal', assignedBy: 'test' });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toContain('terminal status SUCCEEDED');

    // Preuve d'absence d'écriture partielle : agent, mission cible et historique inchangés.
    const agentAfter = await getAgent(agent.id);
    expect(agentAfter.missionId).toBe('mission-open');

    const terminalMission = await getMission('mission-terminal');
    expect(terminalMission.assignedSubagentId ?? null).toBeNull();

    const historyAfter = await getHistory(agent.id);
    expect(historyAfter).toHaveLength(1);
    expect(historyAfter[0].missionId).toBe('mission-open');
    expect(historyAfter[0].unassignedAt).toBeFalsy();
  });

  it('3a — échec inattendu après écriture : rollback complet (aucune affectation fantôme)', async () => {
    await createMission('mission-rollback');
    const agent = await createSubagent('Agent rollback');

    const engine = runtime.missionEngine as any;
    const originalAssign = engine.assignMission.bind(engine);
    engine.assignMission = async () => {
      throw new Error('panne simulée après écriture');
    };

    try {
      const res = await request(app)
        .post(`/api/subagents/${agent.id}/assign`)
        .send({ missionId: 'mission-rollback', assignedBy: 'test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('panne simulée');
    } finally {
      engine.assignMission = originalAssign;
    }

    const agentAfter = await getAgent(agent.id);
    expect(agentAfter.missionId).toBe('');
    expect(await getHistory(agent.id)).toHaveLength(0);

    const mission = await getMission('mission-rollback');
    expect(mission.assignedSubagentId ?? null).toBeNull();
  });

  it('3b — 404 pour une ressource inexistante, 400 pour une requête invalide', async () => {
    await createMission('mission-3b');
    await createSubagent('Agent 3b');

    const unknownMission = await request(app)
      .post('/api/subagents/00000000-0000-0000-0000-000000000000/assign')
      .send({ missionId: 'mission-3b' });
    expect(unknownMission.status).toBe(404);

    const unknownSubagent = await request(app)
      .post('/api/subagents/00000000-0000-0000-0000-000000000000/assign')
      .send({ missionId: 'mission-inexistante' });
    expect(unknownSubagent.status).toBe(404);

    const agent = (await request(app).get('/api/subagents')).body.subagents[0];

    const unknownTarget = await request(app)
      .post(`/api/subagents/${agent.id}/assign`)
      .send({ missionId: 'mission-inexistante' });
    expect(unknownTarget.status).toBe(404);
    expect(await getHistory(agent.id)).toHaveLength(0);

    const missingBody = await request(app)
      .post(`/api/subagents/${agent.id}/assign`)
      .send({});
    expect(missingBody.status).toBe(400);
    expect(await getHistory(agent.id)).toHaveLength(0);
  });

  // --------------------------------------------------------------------- 3c

  it('3c — unassign remet un agent COMPLETED à IDLE donc affectable', async () => {
    await createMission('mission-idle');
    const agent = await createSubagent('Agent IDLE', 'mission-idle');

    const run = await request(app).post(`/api/subagents/${agent.id}/run`).send({});
    expect(run.status).toBe(200);
    expect(run.body.subagent.status).toBe('COMPLETED');

    const completed = await getAgent(agent.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.state).toBe('inactive');
    expect(completed.missionId).toBe('mission-idle');

    const unassigned = await request(app)
      .post(`/api/subagents/${agent.id}/unassign`)
      .send({ reason: 'Fin de supervision' });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.subagent.missionId).toBe('');
    expect(unassigned.body.subagent.status).toBe('IDLE');
    expect(unassigned.body.subagent.state).toBe('available');
    expect(unassigned.body.subagent.completedAt ?? null).toBeNull();

    // La mission est bien désaffectée et l'agent redevient sélectionnable.
    const mission = await getMission('mission-idle');
    expect(mission.assignedSubagentId ?? null).toBeNull();

    const available = (await request(app).get('/api/subagents')).body.subagents
      .filter((a: any) => a.state === 'available')
      .map((a: any) => a.id);
    expect(available).toContain(agent.id);

    // Preuve d'affectabilité restaurée : réaffectation acceptée (mission VERIFYING).
    const reassign = await request(app)
      .post(`/api/subagents/${agent.id}/assign`)
      .send({ missionId: 'mission-idle', assignedBy: 'test' });
    expect(reassign.status).toBe(200);
    expect(reassign.body.subagent.missionId).toBe('mission-idle');
  });

  it('3c — unassign normalise aussi un agent COMPLETED orphelin (sans mission) vers IDLE', async () => {
    await createMission('mission-orphan');
    const agent = await createSubagent('Agent orphelin', 'mission-orphan');

    const run = await request(app).post(`/api/subagents/${agent.id}/run`).send({});
    expect(run.status).toBe(200);
    expect(run.body.subagent.status).toBe('COMPLETED');

    // État orphelin observé en production : COMPLETED mais missionId vide.
    const db = new Database(dbPath);
    db.prepare("UPDATE subagents SET mission_id = '' WHERE id = ?").run(agent.id);
    db.close();

    const before = await getAgent(agent.id);
    expect(before.status).toBe('COMPLETED');
    expect(before.state).toBe('inactive');

    const res = await request(app)
      .post(`/api/subagents/${agent.id}/unassign`)
      .send({ reason: 'Normalisation état orphelin' });
    expect(res.status).toBe(200);
    expect(res.body.subagent.status).toBe('IDLE');
    expect(res.body.subagent.state).toBe('available');
  });

  it('3c — unassign refuse un agent RUNNING sans écrire', async () => {
    await createMission('mission-running');
    const agent = await createSubagent('Agent RUNNING', 'mission-running');

    // Simulation d'une exécution active (le run du manager est synchrone).
    const db = new Database(dbPath);
    db.prepare("UPDATE subagents SET status = 'RUNNING' WHERE id = ?").run(agent.id);
    db.close();

    const res = await request(app)
      .post(`/api/subagents/${agent.id}/unassign`)
      .send({ reason: 'tentative' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('running');

    const after = await getAgent(agent.id);
    expect(after.status).toBe('RUNNING');
    expect(after.missionId).toBe('mission-running');
  });

  // --------------------------------------------------------------------- 3d

  it('3d — /api/audit?order=desc renvoie les plus récents d’abord', async () => {
    await createMission('mission-audit');
    await createSubagent('Agent audit', 'mission-audit');

    const all = (await request(app).get('/api/audit')).body.events;
    expect(all.length).toBeGreaterThan(3);

    const desc = await request(app).get('/api/audit?order=desc&limit=5');
    expect(desc.status).toBe(200);
    expect(desc.body.events).toHaveLength(5);

    // Ordre décroissant par seconde (created_at, puis rowid DESC à l'intérieur
    // d'une même seconde : les millisecondes du timestamp ne sont pas le critère).
    for (let i = 1; i < desc.body.events.length; i += 1) {
      const prev = Math.floor(new Date(desc.body.events[i - 1].timestamp).getTime() / 1000);
      const cur = Math.floor(new Date(desc.body.events[i].timestamp).getTime() / 1000);
      expect(prev).toBeGreaterThanOrEqual(cur);
    }

    // L'API par défaut est déjà DESC : le premier élément est le plus récent.
    expect(desc.body.events[0].id).toBe(all[0].id);

    // Pagination serveur : pages disjointes et ordre global préservé.
    const page1 = await request(app).get('/api/audit?order=desc&limit=3&offset=0');
    const page2 = await request(app).get('/api/audit?order=desc&limit=3&offset=3');
    const ids1 = page1.body.events.map((e: any) => e.id);
    const ids2 = page2.body.events.map((e: any) => e.id);
    expect(ids1).toHaveLength(3);
    expect(ids2).toHaveLength(3);
    expect(ids1.filter((id: string) => ids2.includes(id))).toHaveLength(0);

    const descSix = await request(app).get('/api/audit?order=desc&limit=6');
    expect([...ids1, ...ids2]).toEqual(descSix.body.events.map((e: any) => e.id));

    const invalidOrder = await request(app).get('/api/audit?order=sideways');
    expect(invalidOrder.status).toBe(400);

    const invalidLimit = await request(app).get('/api/audit?limit=-1');
    expect(invalidLimit.status).toBe(400);
  });
});
