import express from 'express';
import { RaqibRuntime } from '../RaqibRuntime';

export function createRuntimeServer(runtime: RaqibRuntime) {
  const app = express();
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

  // Audit Ledger
  app.get('/api/audit', async (req, res) => {
    const missionId = req.query.missionId as string | undefined;
    const events = await runtime.auditLedger.query(missionId ? { missionId } : {});
    res.json({ events });
  });

  // Budget
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

  return app;
}
