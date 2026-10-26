import path from 'path';
import fs from 'fs';
import { PolicyEngine } from '@raqib/policy-engine';
import { EmergencyStop } from '@raqib/policy-engine';
import { MissionEngine } from '@raqib/mission-engine';
import { ModelGateway } from '@raqib/model-gateway';
import { AuditLedger } from '@raqib/audit-ledger';
import { VerificationEngine } from '@raqib/verification';

export class RaqibRuntime {
  public policyEngine: PolicyEngine;
  public emergencyStop: EmergencyStop;
  public missionEngine: MissionEngine;
  public modelGateway: ModelGateway;
  public auditLedger: AuditLedger;
  public verificationEngine: VerificationEngine;
  private isRunning: boolean = false;
  private tickInterval?: NodeJS.Timeout;

  constructor(options?: { dbPath?: string; dataDir?: string }) {
    const dataDir = options?.dataDir || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = options?.dbPath || path.join(dataDir, 'raqib.db');

    let providersConfig = { providers: {}, routing: {} };
    try {
      const providersPath = path.join(process.cwd(), 'config', 'providers.json');
      if (fs.existsSync(providersPath)) {
        providersConfig = JSON.parse(fs.readFileSync(providersPath, 'utf8'));
      }
    } catch {}

    this.auditLedger = new AuditLedger(dbPath);
    this.policyEngine = new PolicyEngine({ dbPath, logger: this.auditLedger });
    this.emergencyStop = new EmergencyStop(dataDir);
    this.missionEngine = new MissionEngine({ dbPath, ledger: this.auditLedger, policy: this.policyEngine });
    this.modelGateway = new ModelGateway(providersConfig, { logger: this.auditLedger, budgetChecker: this.policyEngine });
    this.verificationEngine = new VerificationEngine();
  }

  async initialize(): Promise<void> {
    await this.auditLedger.init();

    // Check emergency stop
    if (this.emergencyStop.isActive()) {
      await this.auditLedger.log({
        id: `evt-startup-emergency-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'EMERGENCY_STOP',
        actor: 'raqib-runtime',
        data: { message: 'Runtime starting with Emergency Stop ACTIVE' }
      });
    }

    // Recover interrupted missions
    const recovered = await this.missionEngine.recoverInterrupted();
    if (recovered.length > 0) {
      await this.auditLedger.log({
        id: `evt-startup-recover-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'MISSION_CREATED',
        actor: 'raqib-runtime',
        data: { count: recovered.length, missionIds: recovered.map(m => m.id) }
      });
    }

    this.isRunning = true;
    this.startTickLoop();
  }

  private startTickLoop(): void {
    this.tickInterval = setInterval(async () => {
      if (!this.isRunning) return;
      if (this.emergencyStop.isActive()) return;

      try {
        const runningMissions = await this.missionEngine.listMissions({ status: 'RUNNING' });
        for (const mission of runningMissions) {
          if (new Date(mission.timeoutAt).getTime() < Date.now()) {
            await this.missionEngine.transitionStatus(mission.id, 'FAILED', 'Mission timed out');
          } else {
            await this.missionEngine.runNextStep(mission.id);
          }
        }
      } catch (err: any) {
        // Runtime loop safety net
      }
    }, 5000);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    this.policyEngine.close();
  }
}
