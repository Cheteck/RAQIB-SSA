import express from 'express';
import cors from 'cors';
import { isNotFoundError } from '@raqib/mission-engine';
import { RaqibRuntime } from '../RaqibRuntime';
import { buildAgentSystemContext, buildChatMessages, buildSystemContext } from '../chat/chatContext';

export function createRuntimeServer(runtime: RaqibRuntime) {
  const app = express();

  /**
   * Mappe une erreur métier vers le code HTTP attendu par le client :
   * - 404 : ressource inexistante (sous-agent, mission) ;
   * - 400 : transition refusée ou requête invalide.
   */
  const sendEngineError = (res: express.Response, err: any) => {
    const status = isNotFoundError(err) ? 404 : 400;
    res.status(status).json({ error: err?.message ?? 'Erreur inconnue' });
  };

  /**
   * Initialise le budget d'une mission déclarée (budgetLimitEur) auprès du
   * PolicyEngine. Sans cela, les appels LLM de la mission seraient refusés
   * par BUDGET-001 alors que la mission a explicitement déclaré son budget.
   */
  const ensureMissionBudget = (mission: { id: string; budgetLimitEur?: number } | null | undefined) => {
    if (!mission) return;
    const limit = Number(mission.budgetLimitEur ?? 0);
    if (!runtime.policyEngine.getBudget(mission.id) && Number.isFinite(limit) && limit > 0) {
      runtime.policyEngine.setBudget(mission.id, limit);
    }
  };

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS policy denied access for origin ${origin}`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json());

  // Status & Health
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'OK',
      emergencyStop: runtime.emergencyStop.isActive(),
      readOnlyMode: runtime.policyEngine.isReadOnlyMode(),
      timestamp: new Date().toISOString()
    });
  });

  // LLM Harness Endpoints
  app.get('/api/context', (req, res) => {
    const messages = (req.query.messages ? JSON.parse(req.query.messages as string) : []) as any[];
    const tools = (req.query.tools as string) || '';
    const metrics = runtime.contextEngine.getMetrics(messages, tools);
    res.json(metrics);
  });

  app.get('/api/memory', async (req, res) => {
    const namespace = (req.query.namespace as string) || 'global';
    const threadId = req.query.threadId as string | undefined;
    const type = req.query.type as any;
    const query = req.query.query as string | undefined;

    const memories = await runtime.memoryEngine.search({ namespace, threadId, type, query });
    res.json({ memories });
  });

  app.post('/api/memory', async (req, res) => {
    const { namespace, key, value, threadId, type, sensitivity } = req.body;
    if (!namespace || !key) {
      return res.status(400).json({ error: 'namespace and key are required' });
    }
    await runtime.memoryEngine.put(namespace, key, value, { threadId, type, sensitivity });
    res.json({ success: true });
  });

  app.get('/api/workflows', async (req, res) => {
    const workflows = await runtime.workflowEngine.listSavedStates();
    res.json({ workflows });
  });

  app.get('/api/workflows/:id', async (req, res) => {
    const saved = await runtime.workflowEngine.getSavedState(req.params.id);
    if (!saved) {
      return res.status(404).json({ error: 'Workflow state not found' });
    }
    res.json(saved);
  });

  app.get('/api/skills', (req, res) => {
    const skills = runtime.skillsRegistry.list();
    res.json({ skills });
  });

  app.post('/api/skills/:name/execute', async (req, res) => {
    try {
      const result = await runtime.skillsRegistry.execute(req.params.name, req.body);
      res.json({ result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Governed shell execution (allowlist + policy + audit)
  app.post('/api/shell/execute', async (req, res) => {
    try {
      const { command, cwd, timeoutMs, missionId, stepId, correlationId, readOnly } = req.body ?? {};
      if (!command) {
        return res.status(400).json({ error: 'command is required' });
      }
      const result = await runtime.executeShell({
        command,
        cwd,
        timeoutMs,
        missionId,
        stepId,
        correlationId,
        readOnly,
      });
      res.json({ result });
    } catch (err: any) {
      const status = err?.name === 'ShellPolicyError' ? 403 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  // Emergency Stop toggle
  app.post('/api/emergency-stop', async (req, res) => {
    const { action, reason, confirmedBy } = req.body;
    if (action === 'activate') {
      await runtime.emergencyStop.activate(reason || 'Manual emergency stop triggered via API');
      res.json({ success: true, active: true });
    } else if (action === 'deactivate') {
      await runtime.emergencyStop.deactivate(confirmedBy || 'admin');
      res.json({ success: true, active: false });
    } else {
      res.status(400).json({ error: 'Invalid action. Must be activate or deactivate' });
    }
  });

  // Missions
  app.get('/api/missions', async (req, res) => {
    const status = req.query.status as any;
    const subagentId = req.query.subagentId as string | undefined;
    const missions = await runtime.missionEngine.listMissions({
      ...(status ? { status } : {}),
      ...(subagentId ? { subagentId } : {}),
    });
    res.json({ missions });
  });

  app.get('/api/missions/:id', async (req, res) => {
    const mission = await runtime.missionEngine.getMission(req.params.id);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }
    res.json({ mission });
  });

  app.post('/api/missions/:id/assign', async (req, res) => {
    try {
      const { subagentId, assignedBy } = req.body ?? {};
      if (!subagentId) return res.status(400).json({ error: 'subagentId is required' });
      const agent = await runtime.subagentManager.get(subagentId);
      if (!agent) return res.status(404).json({ error: 'Subagent not found' });
      const updated = await runtime.subagentManager.assign(subagentId, req.params.id, assignedBy);
      const mission = await runtime.missionEngine.getMission(req.params.id);
      res.json({ mission, subagent: updated });
    } catch (err: any) {
      sendEngineError(res, err);
    }
  });

  app.post('/api/missions/:id/unassign', async (req, res) => {
    try {
      const mission = await runtime.missionEngine.getMission(req.params.id);
      if (!mission) return res.status(404).json({ error: 'Mission not found' });
      if (mission.assignedSubagentId) {
        await runtime.subagentManager.unassign(
          mission.assignedSubagentId,
          req.body?.reason ?? 'Désattribution via mission',
        );
      } else {
        await runtime.missionEngine.unassignMission(req.params.id, {
          reason: req.body?.reason,
          unassignedBy: req.body?.unassignedBy,
        });
      }
      const updated = await runtime.missionEngine.getMission(req.params.id);
      res.json({ mission: updated });
    } catch (err: any) {
      sendEngineError(res, err);
    }
  });

  app.post('/api/missions/:id/context', async (req, res) => {
    try {
      const { updatedBy, note, projectPath, files, instructions, constraints, inheritedContext } = req.body ?? {};
      const mission = await runtime.missionEngine.updateContext(
        req.params.id,
        { projectPath, files, instructions, constraints, inheritedContext },
        { updatedBy, note },
      );
      res.json({ mission });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/missions/:id/context', async (req, res) => {
    const mission = await runtime.missionEngine.getMission(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    res.json({
      missionId: mission.id,
      executionContext: mission.executionContext ?? null,
      contextLog: mission.contextLog ?? [],
      statusHistory: mission.statusHistory ?? [],
    });
  });

  app.post('/api/missions/:id/result', async (req, res) => {
    try {
      const mission = await runtime.missionEngine.recordResult(
        req.params.id,
        req.body ?? {},
        { recordedBy: req.body?.recordedBy },
      );
      res.json({ mission });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/missions/:id/history', async (req, res) => {
    try {
      const mission = await runtime.missionEngine.getMission(req.params.id);
      if (!mission) return res.status(404).json({ error: 'Mission not found' });
      const events = await runtime.missionEngine.getAuditTrail(req.params.id);
      res.json({
        missionId: mission.id,
        statusHistory: mission.statusHistory ?? [],
        events,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/missions', async (req, res) => {
    try {
      const mission = await runtime.missionEngine.createMission(req.body);
      ensureMissionBudget(mission);
      res.status(201).json({ mission });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/missions/:id/transition', async (req, res) => {
    const { status, reason } = req.body;
    try {
      const mission = await runtime.missionEngine.transitionStatus(req.params.id, status, reason);
      res.json({ mission });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Approvals
  app.get('/api/approvals', (req, res) => {
    const status = req.query.status as string | undefined;
    const approvals = runtime.policyEngine.listApprovals(status);
    res.json({ approvals });
  });

  app.get('/api/approvals/:id', (req, res) => {
    const approval = runtime.policyEngine.getApproval(req.params.id);
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    res.json({ approval });
  });

  app.post('/api/approvals/request', async (req, res) => {
    try {
      const approvalId = await runtime.policyEngine.requestApproval(req.body);
      res.status(201).json({ approvalId });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/approvals/:id/grant', async (req, res) => {
    const { grantedBy } = req.body;
    const success = await runtime.policyEngine.grantApproval(req.params.id, grantedBy || 'admin');
    res.json({ success });
  });

  app.post('/api/approvals/:id/reject', async (req, res) => {
    const { rejectedBy } = req.body;
    const success = await runtime.policyEngine.rejectApproval(req.params.id, rejectedBy || 'admin');
    res.json({ success });
  });

  // Audit Ledger
  app.get('/api/audit', async (req, res) => {
    try {
      const missionId = req.query.missionId as string | undefined;
      const order = req.query.order as string | undefined;

      if (order !== undefined && order !== 'asc' && order !== 'desc') {
        return res.status(400).json({ error: "order must be 'asc' or 'desc'" });
      }

      const parseCount = (value: unknown, name: string): number | undefined => {
        if (value === undefined) return undefined;
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 0) {
          throw Object.assign(new Error(`${name} must be a non-negative integer`), { code: 'INVALID_ARGUMENT' });
        }
        return parsed;
      };

      const limit = parseCount(req.query.limit, 'limit');
      const offset = parseCount(req.query.offset, 'offset');

      const events = await runtime.auditLedger.query({
        ...(missionId ? { missionId } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(offset !== undefined ? { offset } : {}),
        ...(order ? { order: order as 'asc' | 'desc' } : {}),
      });
      res.json({ events });
    } catch (err: any) {
      sendEngineError(res, err);
    }
  });

  // Vérification d'intégrité du journal (ordre causal + comptage)
  app.get('/api/audit/integrity', async (req, res) => {
    try {
      // L'intégrité causale se vérifie dans l'ordre chronologique croissant.
      const events = await runtime.auditLedger.query({ order: 'asc' });
      let error: string | undefined;
      for (let i = 1; i < events.length; i++) {
        if (new Date(events[i].timestamp).getTime() < new Date(events[i - 1].timestamp).getTime()) {
          error = `Ordre temporel violé entre les événements #${i} et #${i + 1}`;
          break;
        }
      }
      res.json({
        valid: error === undefined,
        totalEvents: events.length,
        error,
      });
    } catch (err: any) {
      res.json({ valid: false, totalEvents: 0, error: err.message || 'Erreur inconnue' });
    }
  });

  // Self-improvement mission
  // SECURITY (Constitution §2): the self-improvement mission REQUIRES human
  // approval. With approvalRequired=true it is created in PLANNED state and
  // MUST be approved by a human before it can run. Only auto-approved
  // missions (status APPROVED at creation) are auto-started here.
  app.post('/api/missions/self-improve', async (req, res) => {
    try {
      const mission = await runtime.createSelfImprovementMission();
      ensureMissionBudget(mission);
      if (mission.status === 'APPROVED') {
        await runtime.missionEngine.transitionStatus(mission.id, 'RUNNING', 'Self-improvement mission started');
      }
      res.status(201).json({
        mission,
        pendingApproval: mission.status === 'PLANNED',
        approvalHint: mission.status === 'PLANNED'
          ? 'Mission requires human approval. Approve via /api/missions/:id/transition (status=APPROVED) then start (status=RUNNING).'
          : undefined,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/missions/:id/run', async (req, res) => {
    try {
      const result = await runtime.missionEngine.runNextStep(req.params.id);
      res.json({ result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/budget/:missionId', (req, res) => {
    const budget = runtime.policyEngine.getBudget(req.params.missionId);
    if (!budget) {
      return res.status(404).json({ error: 'No budget set for mission' });
    }
    res.json(budget);
  });

  app.post('/api/budget/:missionId', (req, res) => {
    const { limitEur } = req.body;
    runtime.policyEngine.setBudget(req.params.missionId, Number(limitEur));
    res.json({ success: true });
  });

  // Model Gateway (chat) — contexte runtime + historique de conversation
  app.post('/api/chat', async (req, res) => {
    const { prompt, missionId, conversationId } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    const mid = missionId || 'raqib-chat';
    try {
      // 1) Conversation : création ou reprise.
      const conversation = await runtime.conversationStore.ensureConversation(
        conversationId,
        prompt.trim().slice(0, 80),
      );

      // 2) Historique AVANT d'ajouter le message courant.
      const history = await runtime.conversationStore.getMessages(conversation.id, 40);

      // 3) Persistance du message utilisateur.
      await runtime.conversationStore.addMessage(conversation.id, 'user', prompt);

      // 4) Contexte système réel (statut, missions, approbations, audit).
      const snapshot = await runtime.getChatSnapshot(missionId);
      const systemContext = buildSystemContext(snapshot);

      // 5) Assemblage system + history + prompt sous budget.
      const contextMetrics = runtime.contextEngine.getMetrics([]);
      const built = buildChatMessages({
        systemContext,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        prompt,
        contextEngine: runtime.contextEngine,
        maxContextTokens: contextMetrics.availableTokens,
      });

      // 6) Appel LLM avec les messages complets.
      const result = await runtime.modelGateway.complete(
        {
          taskType: 'default',
          messages: built.messages,
        } as any,
        mid,
      );

      if (result.error) {
        return res.status(502).json({
          error: result.error,
          needsReview: result.needsReview,
          conversationId: conversation.id,
          context: {
            systemTokens: runtime.contextEngine.estimateTokens(systemContext),
            historyIncluded: built.includedHistory,
            historyDropped: built.droppedHistory,
            estimatedTokens: built.estimatedTokens,
          },
        });
      }

      const text = result.response?.content ?? '';
      // 7) Persistance de la réponse assistant.
      await runtime.conversationStore.addMessage(
        conversation.id,
        'assistant',
        text,
        result.response?.model,
      );

      res.json({
        text,
        model: result.response?.model,
        cost: result.response?.cost,
        latencyMs: result.response?.latencyMs,
        conversationId: conversation.id,
        context: {
          systemTokens: runtime.contextEngine.estimateTokens(systemContext),
          historyIncluded: built.includedHistory,
          historyDropped: built.droppedHistory,
          estimatedTokens: built.estimatedTokens,
          messagesSent: built.messages.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Conversations (historique persistant, portée main | agent)
  app.get('/api/conversations', async (req, res) => {
    const limit = Number(req.query.limit) || 50;
    const scope = req.query.scope as 'main' | 'agent' | undefined;
    const agentId = req.query.agentId as string | undefined;
    const conversations = await runtime.conversationStore.listConversations({
      limit,
      scope,
      agentId,
    });
    res.json({ conversations });
  });

  app.get('/api/conversations/:id', async (req, res) => {
    const conversation = await runtime.conversationStore.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ conversation });
  });

  app.patch('/api/conversations/:id', async (req, res) => {
    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    const renamed = await runtime.conversationStore.renameConversation(req.params.id, title);
    if (!renamed) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ success: true });
  });

  app.delete('/api/conversations/:id', async (req, res) => {
    const deleted = await runtime.conversationStore.deleteConversation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.status(204).end();
  });

  // Sous-agents (créés et exécutés par RAQIB)
  app.get('/api/subagents', async (req, res) => {
    const state = req.query.state as string | undefined;
    let subagents = await runtime.subagentManager.list();
    if (state) subagents = subagents.filter((s) => s.state === state);
    res.json({ subagents });
  });

  app.get('/api/subagents/:id', async (req, res) => {
    const subagent = await runtime.subagentManager.get(req.params.id);
    if (!subagent) {
      return res.status(404).json({ error: 'Subagent not found' });
    }
    const [history, missions, conversation] = await Promise.all([
      runtime.subagentManager.history(subagent.id),
      runtime.missionEngine.listBySubagent(subagent.id),
      runtime.conversationStore.getConversation(`agent-${subagent.id}`),
    ]);
    res.json({
      subagent,
      history,
      missions,
      conversationId: conversation?.id ?? `agent-${subagent.id}`,
    });
  });

  app.post('/api/subagents', async (req, res) => {
    try {
      const subagent = await runtime.subagentManager.create(req.body);
      res.status(201).json({ subagent });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/subagents/:id/assign', async (req, res) => {
    try {
      const { missionId, assignedBy } = req.body ?? {};
      if (!missionId) return res.status(400).json({ error: 'missionId is required' });
      const subagent = await runtime.subagentManager.assign(req.params.id, missionId, assignedBy);
      res.json({ subagent });
    } catch (err: any) {
      sendEngineError(res, err);
    }
  });

  app.post('/api/subagents/:id/unassign', async (req, res) => {
    try {
      const subagent = await runtime.subagentManager.unassign(
        req.params.id,
        req.body?.reason ?? 'Désattribution manuelle',
      );
      res.json({ subagent });
    } catch (err: any) {
      sendEngineError(res, err);
    }
  });

  app.get('/api/subagents/:id/history', async (req, res) => {
    const agent = await runtime.subagentManager.get(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Subagent not found' });
    const [history, missions] = await Promise.all([
      runtime.subagentManager.history(agent.id),
      runtime.missionEngine.listBySubagent(agent.id),
    ]);
    res.json({ subagentId: agent.id, history, missions });
  });

  app.get('/api/subagents/:id/conversation', async (req, res) => {
    const agent = await runtime.subagentManager.get(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Subagent not found' });
    const conversation = await runtime.conversationStore.ensureAgentConversation(
      agent.id,
      agent.name,
      agent.missionId || undefined,
    );
    const detail = await runtime.conversationStore.getConversation(conversation.id);
    res.json({ conversation: detail, agentId: agent.id });
  });

  /**
   * Conversation dédiée à un sous-agent.
   * Volontairement séparée de `/api/chat` : la conversation porte scope=agent
   * et agent_id, et le contexte système décrit l'agent (pas le coordinateur).
   */
  app.post('/api/subagents/:id/chat', async (req, res) => {
    const prompt = req.body?.prompt;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    try {
      const agent = await runtime.subagentManager.get(req.params.id);
      if (!agent) return res.status(404).json({ error: 'Subagent not found' });

      const snapshot = await runtime.getAgentChatSnapshot(agent.id);
      if (!snapshot) return res.status(404).json({ error: 'Subagent snapshot unavailable' });

      const conversation = await runtime.conversationStore.ensureAgentConversation(
        agent.id,
        agent.name,
        agent.missionId || undefined,
      );
      if (agent.missionId && conversation.missionId !== agent.missionId) {
        await runtime.conversationStore.setConversationContext(conversation.id, {
          missionId: agent.missionId,
        });
      }

      const history = await runtime.conversationStore.getMessages(conversation.id, 40);
      await runtime.conversationStore.addMessage(conversation.id, 'user', prompt);

      const systemContext = buildAgentSystemContext(snapshot as any);
      const contextMetrics = runtime.contextEngine.getMetrics([]);
      const built = buildChatMessages({
        systemContext,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        prompt,
        contextEngine: runtime.contextEngine,
        maxContextTokens: contextMetrics.availableTokens,
      });

      const mid = agent.missionId || 'raqib-chat';
      if (agent.missionId) {
        const mission = await runtime.missionEngine.getMission(agent.missionId);
        ensureMissionBudget(mission);
      }
      const result = await runtime.modelGateway.complete(
        { taskType: 'default', messages: built.messages } as any,
        mid,
      );

      if (result.error) {
        return res.status(502).json({
          error: result.error,
          needsReview: result.needsReview,
          conversationId: conversation.id,
          agentId: agent.id,
        });
      }

      const text = result.response?.content ?? '';
      await runtime.conversationStore.addMessage(
        conversation.id,
        'assistant',
        text,
        result.response?.model,
      );

      res.json({
        text,
        model: result.response?.model,
        cost: result.response?.cost,
        latencyMs: result.response?.latencyMs,
        conversationId: conversation.id,
        agentId: agent.id,
        missionId: agent.missionId || null,
        scope: 'agent',
        context: {
          systemTokens: runtime.contextEngine.estimateTokens(systemContext),
          historyIncluded: built.includedHistory,
          historyDropped: built.droppedHistory,
          estimatedTokens: built.estimatedTokens,
          messagesSent: built.messages.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/subagents/:id/run', async (req, res) => {
    try {
      const subagent = await runtime.subagentManager.run(req.params.id, {
        maxSteps: req.body?.maxSteps,
      });
      res.json({ subagent });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/models/health', async (req, res) => {
    const providers = runtime.modelGateway.listProviders();
    const health = await Promise.all(providers.map((id) => runtime.modelGateway.checkProvider(id)));
    res.json({ providers: health });
  });

  // Coding Engine - OpenCode Adapter Endpoint
  app.post('/api/opencode/execute', async (req, res) => {
    try {
      const { taskId, projectPath, prompt, allowedCommands, maxDurationMs } = req.body;
      if (!taskId || !prompt) {
        return res.status(400).json({ error: 'taskId and prompt are required' });
      }

      const result = await runtime.skillsRegistry.execute('opencode_task', {
        taskId,
        projectPath: projectPath || process.cwd(),
        prompt,
        allowedCommands,
        maxDurationMs,
      });

      res.json({ result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return app;
}
