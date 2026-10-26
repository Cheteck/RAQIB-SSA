import { MissionStatus, AutonomyLevel } from '@raqib/shared';

export interface MissionStep {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  proof?: string;
  error?: string;
  attempts: number;
  maxAttempts: number;
}

export interface Evidence {
  type: 'FILE' | 'GIT_STATE' | 'COMMAND_OUTPUT' | 'TEST_RESULT';
  description: string;
  value: string;
  timestamp: string;
  verified: boolean;
}

export interface MissionResult {
  summary: string;
  success: boolean;
  artifacts?: string[];
  metrics?: Record<string, number>;
}

export interface Mission {
  id: string;
  name: string;
  status: MissionStatus;
  autonomyLevel: AutonomyLevel;
  objective: string;
  constraints: string[];
  successCriteria: string[];
  steps: MissionStep[];
  currentStepIndex: number;

  // Gouvernance
  approvalRequired: boolean;
  approvalId?: string;
  approvedBy?: string;
  approvedAt?: string;

  // Budget
  budgetLimitEur: number;
  budgetUsedEur: number;

  // Limites d'exécution
  maxDurationMs: number;
  maxAttempts: number;
  timeoutAt: string;

  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;

  // Preuves
  evidences: Evidence[];
  result?: MissionResult;
}
