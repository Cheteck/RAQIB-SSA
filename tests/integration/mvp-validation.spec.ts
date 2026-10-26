import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { RaqibRuntime } from '../../services/runtime/src/RaqibRuntime';
import { createRuntimeServer } from '../../services/runtime/src/api/server';
import { DockerSandbox } from '../../packages/tool-gateway/src/DockerSandbox';
import { VerificationEngine } from '../../packages/verification/src/VerificationEngine';

describe('Phase 8 MVP Final Integration & Validation Suite', () => {
  let runtime: RaqibRuntime;
  let app: any;
  let testDbPath: string;
  let testDataDir: string;

  beforeEach(async () => {
    testDataDir = path.join(__dirname, 'mvp-data-' + Date.now());
    testDbPath = path.join(testDataDir, 'mvp-test.db');
    delete process.env.RAQIB_EMERGENCY_STOP;
    delete process.env.RAQIB_READ_ONLY_MODE;
    runtime = new RaqibRuntime({ dbPath: testDbPath, dataDir: testDataDir });
    await runtime.initialize();
    app = createRuntimeServer(runtime);
  });

  afterEach(async () => {
    if (runtime) {
      await runtime.stop();
    }
    if (fs.existsSync(testDataDir)) {
      try { fs.rmSync(testDataDir, { recursive: true, force: true }); } catch {}
    }
    delete process.env.RAQIB_EMERGENCY_STOP;
    delete process.env.RAQIB_READ_ONLY_MODE;
  });

  it('MVP Requirement 1: Policy Engine enforces rules independently of LLM models', async () => {
    const decision = runtime.policyEngine.authorize({
      missionId: 'MVP-M1',
      actor: 'agent',
      actionType: 'WRITE',
      resource: '/repo/docs/CONSTITUTION.md',
      autonomyLevel: 'A2'
    });
    expect(decision.allowed).toBe(false);
    expect(decision.ruleId).toBe('RULE-006');
  });

  it('MVP Requirement 2: Mission lifecycle & status transitions operate persistently', async () => {
    const mission = await runtime.missionEngine.createMission({
      id: 'MVP-M2',
      name: 'Lifecycle test',
      objective: 'Verify status machine',
      autonomyLevel: 'A1',
      constraints: [],
      successCriteria: ['DONE'],
      steps: [{ name: 'Step 1' }],
      approvalRequired: false,
      budgetLimitEur: 10.0,
      maxDurationMs: 30000,
      maxAttempts: 2
    });

    expect(mission.status).toBe('APPROVED');

    const runningMission = await runtime.missionEngine.transitionStatus('MVP-M2', 'RUNNING', 'Starting execution');
    expect(runningMission.status).toBe('RUNNING');
  });

  it('MVP Requirement 3: Emergency stop halts operations immediately across services', async () => {
    await runtime.emergencyStop.activate('Emergency trigger');
    expect(runtime.emergencyStop.isActive()).toBe(true);

    const statusRes = await request(app).get('/api/status');
    expect(statusRes.body.emergencyStop).toBe(true);

    const decision = runtime.policyEngine.authorize({
      missionId: 'MVP-M3',
      actor: 'agent',
      actionType: 'READ',
      resource: '/repo/file.ts',
      autonomyLevel: 'A1'
    });
    expect(decision.allowed).toBe(false);

    await runtime.emergencyStop.deactivate('admin');
  });

  it('MVP Requirement 4: VerificationEngine produces evidence-backed results', async () => {
    const verif = new VerificationEngine();
    const result = await verif.verifyCommandResult(0, 0);
    expect(result.passed).toBe(true);
    expect(result.evidence).toMatch(/Exit code: 0/);
  });

  it('MVP Requirement 5: DockerSandbox operates safely with explicit fallback option', async () => {
    const sandbox = new DockerSandbox();
    const ctx = await sandbox.createWorkspace(process.cwd());
    expect(ctx.mode).toBeDefined();

    const cmdRes = await sandbox.executeCommand(ctx, ['node', '-v']);
    expect(cmdRes.exitCode).toBe(0);
    expect(cmdRes.stdout).toMatch(/v\d+/);

    await sandbox.destroyWorkspace(ctx);
  });

  it('MVP Requirement 6: AuditLedger logs events in append-only format', async () => {
    await runtime.auditLedger.log({
      id: 'evt-mvp-01',
      timestamp: new Date().toISOString(),
      type: 'MISSION_CREATED',
      actor: 'test-suite',
      data: { key: 'value' }
    });

    const events = await runtime.auditLedger.query({});
    expect(events.some(e => e.id === 'evt-mvp-01')).toBe(true);
  });
});
