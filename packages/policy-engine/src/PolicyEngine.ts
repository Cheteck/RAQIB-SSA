import { ActionType, AutonomyLevel, PolicyDecision } from '@raqib/shared';

export interface PolicyRequest {
  missionId: string;
  actor: string;
  actionType: ActionType;
  resource: string;
  autonomyLevel: AutonomyLevel;
  estimatedCostEur?: number;
  metadata?: Record<string, unknown>;
}

export class PolicyEngine {
  authorize(req: PolicyRequest): PolicyDecision {
    // 1. Emergency Stop Check
    if (this.isEmergencyStop()) {
      return { allowed: false, reason: 'Emergency Stop active', timestamp: new Date().toISOString() };
    }

    // 2. Read-only Mode Check
    if (this.isReadOnlyMode() && ['WRITE', 'CREATE', 'DELETE', 'EXECUTE_DESTRUCTIVE'].includes(req.actionType)) {
      return { allowed: false, reason: 'Read-only mode active', timestamp: new Date().toISOString() };
    }

    // Default Allow (for READ/INVENTORY)
    return { allowed: true, reason: 'Authorized', timestamp: new Date().toISOString() };
  }

  isEmergencyStop(): boolean {
    return process.env.RAQIB_EMERGENCY_STOP === 'true';
  }

  isReadOnlyMode(): boolean {
    return process.env.RAQIB_READ_ONLY_MODE === 'true';
  }
}
