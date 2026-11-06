import express from 'express';
import cors from 'cors';
import { RaqibRuntime } from '../RaqibRuntime';

export function createRuntimeServer(runtime: RaqibRuntime) {
  const app = express();

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
    const missions = await runtime.missionEngine.listMissions(status ? { status } : undefined);
    res.json({ missions });
  });

  app.get('/api/missions/:id', async (req, res) => {
    const mission = await runtime.missionEngine.getMission(req.params.id);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }
    res.json({ mission });
  });

  app.post('/api/missions', async (req, res) => {
    try {
      const mission = await runtime.missionEngine.createMission(req.body);
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
    const missionId = req.query.missionId as string | undefined;
    const events = await runtime.auditLedger.query(missionId ? { missionId } : {});
    res.json({ events });
  });

  // Self-improvement mission
  // SECURITY (Constitution §2): the self-improvement mission REQUIRES human
  // approval. With approvalRequired=true it is created in PLANNED state and
  // MUST be approved by a human before it can run. Only auto-approved
  // missions (status APPROVED at creation) are auto-started here.
  app.post('/api/missions/self-improve', async (req, res) => {
    try {
      const mission = await runtime.createSelfImprovementMission();
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

  // Model Gateway (chat)
  app.post('/api/chat', async (req, res) => {
    const { prompt, missionId } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    const mid = missionId || 'raqib-chat';
    try {
      const result = await runtime.modelGateway.complete(
        {
          taskType: 'default',
          messages: [{ role: 'user', content: prompt }],
        } as any,
        mid,
      );
      if (result.error) {
        return res.status(502).json({ error: result.error, needsReview: result.needsReview });
      }
      res.json({
        text: result.response?.content ?? '',
        model: result.response?.model,
        cost: result.response?.cost,
        latencyMs: result.response?.latencyMs,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
