import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import request from 'supertest';
import { RaqibRuntime } from '../../services/runtime/src/RaqibRuntime';
import { createRuntimeServer } from '../../services/runtime/src/api/server';
import { ConversationStore } from '../../services/runtime/src/ConversationStore';

const testDataDir = path.join(process.cwd(), 'data', 'test-conversations-subagents');
const dbPath = path.join(testDataDir, 'conv-sub.db');

describe('ConversationStore', () => {
  let store: ConversationStore;

  beforeEach(() => {
    if (fs.existsSync(testDataDir)) {
      try { fs.rmSync(testDataDir, { recursive: true, force: true }); } catch {}
    }
    fs.mkdirSync(testDataDir, { recursive: true });
    store = new ConversationStore(dbPath);
  });

  afterEach(() => {
    store?.close();
    if (fs.existsSync(testDataDir)) {
      try { fs.rmSync(testDataDir, { recursive: true, force: true }); } catch {}
    }
  });

  it('crée, alimente, liste et relit une conversation avec ses messages', async () => {
    const conv = await store.ensureConversation(undefined, 'Audit des dépendances');
    expect(conv.title).toBe('Audit des dépendances');
    expect(conv.messageCount).toBe(0);

    await store.addMessage(conv.id, 'user', 'Bonjour');
    await store.addMessage(conv.id, 'assistant', 'Bonjour Operator', 'stub-model');

    const messages = await store.getMessages(conv.id);
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[0].content).toBe('Bonjour');
    expect(messages[1].model).toBe('stub-model');

    const list = await store.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].messageCount).toBe(2);
    expect(list[0].lastMessage).toBe('Bonjour Operator');

    const detail = await store.getConversation(conv.id);
    expect(detail?.messages).toHaveLength(2);
  });

  it('reprend une conversation existante sans perdre l\'historique', async () => {
    const first = await store.ensureConversation(undefined, 'Premier prompt');
    await store.addMessage(first.id, 'user', 'Premier prompt');

    const resumed = await store.ensureConversation(first.id);
    expect(resumed.id).toBe(first.id);
    expect((await store.getMessages(first.id)).length).toBe(1);
  });

  it('renomme et supprime une conversation (messages inclus)', async () => {
    const conv = await store.ensureConversation(undefined, 'Titre initial');
    await store.addMessage(conv.id, 'user', 'hello');

    expect(await store.renameConversation(conv.id, 'Titre final')).toBe(true);
    expect((await store.listConversations())[0].title).toBe('Titre final');

    expect(await store.deleteConversation(conv.id)).toBe(true);
    expect(await store.getConversation(conv.id)).toBeNull();
    expect(await store.listConversations()).toHaveLength(0);
  });
});

describe('Chat + conversations + sous-agents (API runtime)', () => {
  let runtime: RaqibRuntime;
  let app: any;
  const originalReadOnly = process.env.RAQIB_READ_ONLY_MODE;

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

  it('POST /api/conversations/:id/chat transmet contexte + historique au LLM et persiste les messages', async () => {
    const captured: any[] = [];
    // Gateway factice : capture exactement ce que le runtime envoie au LLM.
    (runtime as any).modelGateway = {
      complete: async (req: any, missionId: string) => {
        captured.push({ req, missionId });
        return {
          response: {
            content: `réponse-${captured.length}`,
            model: 'stub-model',
            cost: 0,
            latencyMs: 1,
          },
        };
      },
    };

    const first = await request(app).post('/api/chat').send({ prompt: 'Premier message' });
    expect(first.status).toBe(200);
    expect(first.body.conversationId).toBeTruthy();
    expect(first.body.context.historyIncluded).toBe(0);

    const conversationId = first.body.conversationId;

    const second = await request(app)
      .post('/api/chat')
      .send({ prompt: 'Second message', conversationId });
    expect(second.status).toBe(200);
    expect(second.body.conversationId).toBe(conversationId);

    // --- Preuve que le contexte runtime est envoyé ---
    const system = captured[1].req.messages[0];
    expect(system.role).toBe('system');
    expect(system.content).toContain('ÉTAT DU RUNTIME');
    expect(system.content).toContain('PolicyEngine');
    expect(system.content).toContain('Approbations en attente');

    // --- Preuve que l'historique est envoyé dans l'ordre ---
    const roles = captured[1].req.messages.map((m: any) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
    expect(captured[1].req.messages[1].content).toBe('Premier message');
    expect(captured[1].req.messages[2].content).toBe('réponse-1');
    expect(captured[1].req.messages[3].content).toBe('Second message');
    expect(second.body.context.historyIncluded).toBe(2);

    // --- Preuve de la persistance consultable ---
    const list = await request(app).get('/api/conversations');
    expect(list.status).toBe(200);
    expect(list.body.conversations).toHaveLength(1);
    expect(list.body.conversations[0].messageCount).toBe(4);

    const detail = await request(app).get(`/api/conversations/${conversationId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.conversation.messages.map((m: any) => m.content)).toEqual([
      'Premier message',
      'réponse-1',
      'Second message',
      'réponse-2',
    ]);
  });

  it('RAQIB crée puis exécute un sous-agent responsable de la mission', async () => {
    const missionRes = await request(app)
      .post('/api/missions')
      .send({
        id: 'mission-subagent-test',
        name: 'Analyse sous-agent',
        objective: 'Analyser puis proposer des améliorations',
        autonomyLevel: 'A2',
        constraints: [],
        successCriteria: ['analyse terminée'],
        steps: [
          { name: 'analyse', type: 'ANALYZE' },
          { name: 'propose', type: 'PROPOSE' },
        ],
        approvalRequired: false,
        budgetLimitEur: 1,
        maxDurationMs: 60000,
        maxAttempts: 2,
      });
    expect(missionRes.status).toBe(201);
    expect(missionRes.body.mission.status).toBe('APPROVED');

    const created = await request(app)
      .post('/api/subagents')
      .send({ name: 'Sous-agent analyse', role: 'executor', missionId: 'mission-subagent-test' });
    expect(created.status).toBe(201);
    expect(created.body.subagent.status).toBe('IDLE');
    expect(created.body.subagent.role).toBe('executor');

    const subagentId = created.body.subagent.id;

    const run = await request(app).post(`/api/subagents/${subagentId}/run`).send({});
    expect(run.status).toBe(200);
    expect(run.body.subagent.status).toBe('COMPLETED');
    expect(run.body.subagent.stepsExecuted).toBe(2);

    const missionAfter = await request(app).get('/api/missions/mission-subagent-test');
    expect(missionAfter.body.mission.status).toBe('VERIFYING');

    const listed = await request(app).get('/api/subagents');
    expect(listed.body.subagents).toHaveLength(1);
    expect(listed.body.subagents[0].status).toBe('COMPLETED');

    // Audit : création + démarrage + complétion tracés.
    const audit = await request(app).get('/api/audit?missionId=mission-subagent-test');
    const types = audit.body.events.map((e: any) => e.type);
    expect(types).toContain('SUBAGENT_CREATED');
    expect(types).toContain('SUBAGENT_STARTED');
    expect(types).toContain('SUBAGENT_COMPLETED');
  });

  it('un sous-agent ne déclare jamais un succès : la mission reste VERIFYING', async () => {
    await request(app)
      .post('/api/missions')
      .send({
        id: 'mission-subagent-no-success',
        name: 'Analyse simple',
        objective: 'Analyser',
        autonomyLevel: 'A2',
        constraints: [],
        successCriteria: [],
        steps: [{ name: 'analyse', type: 'ANALYZE' }],
        approvalRequired: false,
        budgetLimitEur: 1,
        maxDurationMs: 60000,
        maxAttempts: 1,
      });

    const created = await request(app)
      .post('/api/subagents')
      .send({ name: 'Exécuteur', missionId: 'mission-subagent-no-success' });
    const run = await request(app).post(`/api/subagents/${created.body.subagent.id}/run`).send({});

    expect(run.body.subagent.status).toBe('COMPLETED');
    const mission = await request(app).get('/api/missions/mission-subagent-no-success');
    expect(mission.body.mission.status).not.toBe('SUCCEEDED');
    expect(mission.body.mission.status).toBe('VERIFYING');
  });

  it('en mode READ-ONLY, le sous-agent est BLOCKED (gouvernance respectée)', async () => {
    process.env.RAQIB_READ_ONLY_MODE = 'true';
    await request(app)
      .post('/api/missions')
      .send({
        id: 'mission-subagent-readonly',
        name: 'Analyse bloquée',
        objective: 'Analyser',
        autonomyLevel: 'A2',
        constraints: [],
        successCriteria: [],
        steps: [{ name: 'analyse', type: 'ANALYZE' }],
        approvalRequired: false,
        budgetLimitEur: 1,
        maxDurationMs: 60000,
        maxAttempts: 1,
      });

    const created = await request(app)
      .post('/api/subagents')
      .send({ name: 'Exécuteur bloqué', missionId: 'mission-subagent-readonly' });
    const run = await request(app).post(`/api/subagents/${created.body.subagent.id}/run`).send({});

    expect(run.status).toBe(200);
    expect(run.body.subagent.status).toBe('BLOCKED');
    expect(run.body.subagent.lastError).toBeTruthy();

    // Les résultats (même en erreur) sont remontés et journalisés.
    const mission = await request(app).get('/api/missions/mission-subagent-readonly');
    expect(mission.body.mission.status).toBe('BLOCKED');
    expect(mission.body.mission.result).toBeTruthy();
    expect(mission.body.mission.result.errors?.length).toBeGreaterThan(0);

    const audit = await request(app).get('/api/audit?missionId=mission-subagent-readonly');
    const types = audit.body.events.map((e: any) => e.type);
    expect(types).toContain('MISSION_RESULT_RECORDED');
  });

  it('mission contextualisée : attribution, contexte append-only, historique et exécution', async () => {
    const missionRes = await request(app)
      .post('/api/missions')
      .send({
        id: 'mission-context-test',
        name: 'Audit contextualisé',
        title: 'Auditer le module de contexte',
        description: 'Vérifier la transmission explicite du contexte au sous-agent.',
        priority: 'HIGH',
        objective: 'Analyser le module de contexte puis proposer des corrections',
        autonomyLevel: 'A2',
        constraints: ['Pas de modification hors workspace'],
        successCriteria: ['Analyse terminée', 'Rapport produit'],
        steps: [
          { name: 'analyse contexte', type: 'ANALYZE' },
          { name: 'propose corrections', type: 'PROPOSE' },
        ],
        approvalRequired: false,
        budgetLimitEur: 2,
        maxDurationMs: 60000,
        maxAttempts: 2,
        executionContext: {
          projectPath: 'D:/Projets/RAQIB-SSA',
          files: ['services/runtime/src/chat/chatContext.ts'],
          instructions: ['Lire le fichier de contexte avant toute proposition'],
          constraints: ['Ne pas modifier les fichiers en READ-ONLY'],
        },
        dependsOn: ['mission-parent-context'],
      });

    expect(missionRes.status).toBe(201);
    expect(missionRes.body.mission.priority).toBe('HIGH');
    expect(missionRes.body.mission.title).toBe('Auditer le module de contexte');
    expect(missionRes.body.mission.executionContext.projectPath).toBe('D:/Projets/RAQIB-SSA');
    expect(missionRes.body.mission.executionContext.files).toContain(
      'services/runtime/src/chat/chatContext.ts',
    );
    expect(missionRes.body.mission.contextLog).toHaveLength(1);
    expect(missionRes.body.mission.contextLog[0].version).toBe(1);

    const created = await request(app)
      .post('/api/subagents')
      .send({
        name: 'Analyste contexte',
        role: 'researcher',
        specialty: 'audit du contexte LLM',
        instructions: 'Toujours citer les fichiers audités.',
        missionId: 'mission-context-test',
      });

    expect(created.status).toBe(201);
    expect(created.body.subagent.specialty).toBe('audit du contexte LLM');
    expect(created.body.subagent.missionId).toBe('mission-context-test');
    expect(created.body.subagent.mission?.name).toBe('Audit contextualisé');
    expect(created.body.subagent.state).toBe('available');

    const agentId = created.body.subagent.id;

    const missionAfterAssign = await request(app).get('/api/missions/mission-context-test');
    expect(missionAfterAssign.body.mission.assignedSubagentId).toBe(agentId);
    expect(missionAfterAssign.body.mission.assignedSubagentName).toBe('Analyste contexte');
    expect(missionAfterAssign.body.mission.assignedAt).toBeTruthy();

    // Complément de contexte : versionné, sans perte de l'historique.
    const contextualized = await request(app)
      .post('/api/missions/mission-context-test/context')
      .send({
        files: ['packages/mission-engine/src/SubagentManager.ts'],
        instructions: ['Vérifier aussi la remontée des résultats'],
        note: 'Complément demandé par le coordinateur',
        updatedBy: 'operator',
      });

    expect(contextualized.status).toBe(200);
    expect(contextualized.body.mission.contextLog).toHaveLength(2);
    expect(contextualized.body.mission.contextLog[1].version).toBe(2);
    expect(contextualized.body.mission.contextLog[1].note).toBe(
      'Complément demandé par le coordinateur',
    );
    expect(contextualized.body.mission.executionContext.files).toEqual(
      expect.arrayContaining([
        'services/runtime/src/chat/chatContext.ts',
        'packages/mission-engine/src/SubagentManager.ts',
      ]),
    );
    // L'instruction d'origine est conservée.
    expect(contextualized.body.mission.executionContext.instructions).toContain(
      'Lire le fichier de contexte avant toute proposition',
    );

    // Historique d'affectation attaché au bon agent.
    const history = await request(app).get(`/api/subagents/${agentId}/history`);
    expect(history.status).toBe(200);
    expect(history.body.history).toHaveLength(1);
    expect(history.body.history[0].missionId).toBe('mission-context-test');
    expect(history.body.history[0].missionName).toBe('Audit contextualisé');
    expect(history.body.missions).toHaveLength(1);

    // Exécution gouvernée + remontée des résultats.
    const run = await request(app).post(`/api/subagents/${agentId}/run`).send({});
    expect(run.status).toBe(200);
    expect(run.body.subagent.status).toBe('COMPLETED');
    expect(run.body.subagent.stepsExecuted).toBe(2);

    const executed = await request(app).get('/api/missions/mission-context-test');
    expect(executed.body.mission.status).toBe('VERIFYING');
    expect(executed.body.mission.result?.summary).toBeTruthy();
    expect(executed.body.mission.result?.reports?.length).toBe(2);
    expect(executed.body.mission.statusHistory.map((h: any) => h.status)).toEqual(
      expect.arrayContaining(['APPROVED', 'RUNNING', 'VERIFYING']),
    );

    // Traçabilité complète.
    const audit = await request(app).get('/api/audit?missionId=mission-context-test');
    const types = audit.body.events.map((e: any) => e.type);
    expect(types).toContain('MISSION_CREATED');
    expect(types).toContain('MISSION_ASSIGNED');
    expect(types).toContain('MISSION_CONTEXT_UPDATED');
    expect(types).toContain('MISSION_RESULT_RECORDED');
    expect(types).toContain('SUBAGENT_CREATED');
    expect(types).toContain('SUBAGENT_STARTED');
  });

  it('isole les conversations des sous-agents du chat principal RAQIB', async () => {
    const captured: any[] = [];
    (runtime as any).modelGateway = {
      complete: async (req: any, missionId: string) => {
        captured.push({ req, missionId });
        return {
          response: {
            content: `réponse-agent-${captured.length}`,
            model: 'stub-agent-model',
            cost: 0,
            latencyMs: 1,
          },
        };
      },
    };

    const createMission = async (id: string, name: string) => {
      const res = await request(app)
        .post('/api/missions')
        .send({
          id,
          name,
          objective: `Objectif ${name}`,
          autonomyLevel: 'A2',
          constraints: [],
          successCriteria: [],
          steps: [{ name: 'analyse', type: 'ANALYZE' }],
          approvalRequired: false,
          budgetLimitEur: 1,
          maxDurationMs: 60000,
          maxAttempts: 1,
          executionContext: {
            projectPath: '/workspace/raqib',
            files: [`fichier-${id}.ts`],
            instructions: [`Instruction propre à ${name}`],
            constraints: ['Aucun accès réseau'],
          },
        });
      expect(res.status).toBe(201);
      return res.body.mission;
    };

    await createMission('mission-agent-a', 'Agent Alpha');
    await createMission('mission-agent-b', 'Agent Beta');

    const agentA = await request(app)
      .post('/api/subagents')
      .send({ name: 'Agent Alpha', role: 'executor', specialty: 'alpha', missionId: 'mission-agent-a' });
    const agentB = await request(app)
      .post('/api/subagents')
      .send({ name: 'Agent Beta', role: 'verifier', specialty: 'beta', missionId: 'mission-agent-b' });

    const idA = agentA.body.subagent.id;
    const idB = agentB.body.subagent.id;

    const firstA = await request(app)
      .post(`/api/subagents/${idA}/chat`)
      .send({ prompt: 'Bonjour agent Alpha' });
    expect(firstA.status).toBe(200);
    expect(firstA.body.scope).toBe('agent');
    expect(firstA.body.agentId).toBe(idA);
    expect(firstA.body.missionId).toBe('mission-agent-a');
    expect(firstA.body.conversationId).toBe(`agent-${idA}`);

    const secondA = await request(app)
      .post(`/api/subagents/${idA}/chat`)
      .send({ prompt: 'Suite pour agent Alpha' });
    expect(secondA.status).toBe(200);
    expect(secondA.body.context.historyIncluded).toBe(2);

    const firstB = await request(app)
      .post(`/api/subagents/${idB}/chat`)
      .send({ prompt: 'Bonjour agent Beta' });
    expect(firstB.status).toBe(200);
    expect(firstB.body.conversationId).toBe(`agent-${idB}`);

    // Le contexte système de l'agent décrit bien l'agent et sa mission,
    // avec un contexte d'exécution explicite — pas le chat principal.
    const systemA = captured[0].req.messages[0];
    expect(systemA.role).toBe('system');
    expect(systemA.content).toContain('sous-agent « Agent Alpha »');
    expect(systemA.content).toContain("CONTEXTE D'EXÉCUTION");
    expect(systemA.content).toContain('/workspace/raqib');
    expect(systemA.content).toContain('Instruction propre à Agent Alpha');
    expect(systemA.content).toContain('MISSION AFFECTÉE');
    expect(systemA.content).not.toContain('Tu es RAQIB, un orchestrateur autonome gouverné');

    // La conversation A garde son propre historique.
    const convA = await request(app).get(`/api/subagents/${idA}/conversation`);
    expect(convA.body.conversation.scope).toBe('agent');
    expect(convA.body.conversation.agentId).toBe(idA);
    expect(convA.body.conversation.missionId).toBe('mission-agent-a');
    expect(convA.body.conversation.messages.map((m: any) => m.content)).toEqual([
      'Bonjour agent Alpha',
      'réponse-agent-1',
      'Suite pour agent Alpha',
      'réponse-agent-2',
    ]);

    // La conversation B ne contient que les échanges de B.
    const convB = await request(app).get(`/api/subagents/${idB}/conversation`);
    expect(convB.body.conversation.messages.map((m: any) => m.content)).toEqual([
      'Bonjour agent Beta',
      'réponse-agent-3',
    ]);

    // Chat principal : portée main, conversation distincte.
    const baselineMain = await request(app).get('/api/conversations?scope=main');
    const baselineAgent = await request(app).get('/api/conversations?scope=agent');
    const mainChat = await request(app).post('/api/chat').send({ prompt: 'Bonjour RAQIB' });
    expect(mainChat.status).toBe(200);
    expect(mainChat.body.conversationId).not.toBe(`agent-${idA}`);

    const agentConvs = await request(app).get('/api/conversations?scope=agent');
    expect(agentConvs.body.conversations).toHaveLength(
      baselineAgent.body.conversations.length,
    );
    expect(agentConvs.body.conversations.every((c: any) => c.scope === 'agent')).toBe(true);
    expect(agentConvs.body.conversations.map((c: any) => c.id)).toEqual(
      expect.arrayContaining([`agent-${idA}`, `agent-${idB}`]),
    );

    const mainConvs = await request(app).get('/api/conversations?scope=main');
    expect(mainConvs.body.conversations).toHaveLength(
      baselineMain.body.conversations.length + 1,
    );
    const createdMain = mainConvs.body.conversations.find(
      (c: any) => c.id === mainChat.body.conversationId,
    );
    expect(createdMain).toBeTruthy();
    expect(createdMain.scope).toBe('main');
    expect(createdMain.agentId).toBeUndefined();

    const mainSystem = captured[captured.length - 1].req.messages[0];
    expect(mainSystem.content).toContain('Tu es RAQIB, un orchestrateur autonome gouverné');
  });

  it('persiste missions, affectations, contextes et conversations après redémarrage', async () => {
    await request(app)
      .post('/api/missions')
      .send({
        id: 'mission-persistence',
        name: 'Mission persistante',
        objective: 'Vérifier la persistance après redémarrage',
        autonomyLevel: 'A1',
        constraints: [],
        successCriteria: [],
        steps: [{ name: 'analyse', type: 'ANALYZE' }],
        approvalRequired: false,
        budgetLimitEur: 1,
        maxDurationMs: 60000,
        maxAttempts: 1,
        executionContext: {
          projectPath: 'D:/workspace/persist',
          files: ['persist.ts'],
          instructions: ['Rester en lecture seule'],
          constraints: ['Aucune écriture'],
        },
      });

    const created = await request(app)
      .post('/api/subagents')
      .send({
        name: 'Agent persistant',
        role: 'researcher',
        specialty: 'persistance',
        instructions: 'Ne rien perdre.',
        missionId: 'mission-persistence',
      });
    const agentId = created.body.subagent.id;

    (runtime as any).modelGateway = {
      complete: async () => ({
        response: { content: 'réponse persistée', model: 'stub-persist', cost: 0, latencyMs: 1 },
      }),
    };
    await request(app)
      .post(`/api/subagents/${agentId}/chat`)
      .send({ prompt: 'Message avant redémarrage' });

    // Redémarrage réel : nouvelle instance, même base SQLite.
    await runtime.stop();
    runtime = new RaqibRuntime({ dbPath, dataDir: testDataDir });
    await runtime.initialize();
    app = createRuntimeServer(runtime);

    const agentAfter = await request(app).get(`/api/subagents/${agentId}`);
    expect(agentAfter.status).toBe(200);
    expect(agentAfter.body.subagent.name).toBe('Agent persistant');
    expect(agentAfter.body.subagent.specialty).toBe('persistance');
    expect(agentAfter.body.subagent.instructions).toBe('Ne rien perdre.');
    expect(agentAfter.body.subagent.missionId).toBe('mission-persistence');
    expect(agentAfter.body.history).toHaveLength(1);

    const missionAfter = await request(app).get('/api/missions/mission-persistence');
    expect(missionAfter.status).toBe(200);
    expect(missionAfter.body.mission.assignedSubagentId).toBe(agentId);
    expect(missionAfter.body.mission.executionContext.projectPath).toBe('D:/workspace/persist');
    expect(missionAfter.body.mission.contextLog).toHaveLength(1);

    const convAfter = await request(app).get(`/api/subagents/${agentId}/conversation`);
    expect(convAfter.body.conversation.scope).toBe('agent');
    expect(convAfter.body.conversation.messages.map((m: any) => m.content)).toEqual([
      'Message avant redémarrage',
      'réponse persistée',
    ]);
  });
});
