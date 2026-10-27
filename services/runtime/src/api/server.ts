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
  app.post('/api/missions/self-improve', async (req, res) => {
    try {
      const mission = await runtime.createSelfImprovementMission();
      if (mission.status === 'APPROVED' || mission.status === 'PLANNED') {
        await runtime.missionEngine.transitionStatus(mission.id, 'RUNNING', 'Self-improvement mission started');
      }
      res.status(201).json({ mission });
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

  return app;
}
