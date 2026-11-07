/**
 * Types partagés du Mission Control.
 * Chaque interface correspond strictement à un endpoint du Runtime RAQIB
 * (aucune donnée dérivée côté client présentée comme réelle).
 */

export interface MissionStepInfo {
  name: string;
  status: string;
}

export interface Mission {
  id: string;
  name: string;
  objective: string;
  status: string;
  autonomyLevel: string;
  budgetLimitEur: number;
  budgetUsedEur: number;
  currentStepIndex?: number;
  steps?: MissionStepInfo[];
  assignedSubagentId?: string;
  assignedSubagentName?: string;
  executionContext?: {
    projectPath?: string;
    files?: string[];
    instructions?: string[];
    constraints?: string[];
  };
  result?: {
    success?: boolean;
    summary?: string;
    artifacts?: string[];
    modifiedFiles?: string[];
  };
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Subagent {
  id: string;
  name: string;
  role: 'executor' | 'researcher' | 'verifier';
  specialty?: string;
  instructions?: string;
  /** Mission courante ('' lorsqu'aucune mission n'est affectée). */
  missionId: string;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | 'FAILED';
  /** État de supervision dérivé par le Runtime : available/busy/inactive/error. */
  state?: 'available' | 'busy' | 'inactive' | 'error';
  mission?: { id: string; name: string; status: string } | null;
  stepsExecuted: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SubagentMissionHistoryEntry {
  id: string;
  missionId: string;
  missionName?: string;
  missionStatus?: string;
  assignedAt: string;
  unassignedAt?: string;
  assignedBy?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: string;
  missionId?: string;
  stepId?: string;
  actor: string;
  data?: Record<string, unknown>;
}
