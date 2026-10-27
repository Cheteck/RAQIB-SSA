export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ModelRequest {
  model: string;
  messages: ModelMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  taskType?: string;
}

export interface ModelResponse {
  content: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  cost?: { input: number; output: number; total: number };
  provider: string;
  latencyMs: number;
}

export interface IModelProvider {
  name: string;
  type: string;
  isEnabled(): boolean;
  complete(req: ModelRequest): Promise<ModelResponse>;
}

// ============================================================================
// Mission Types (RAQIB-001)
// ============================================================================

export type MissionStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'RUNNING'
  | 'VERIFYING'
  | 'SUCCEEDED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'BLOCKED'
  | 'NEEDS_REVIEW';

export type AutonomyLevel = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';

export type ActionType =
  | 'READ'
  | 'INVENTORY'
  | 'WRITE'
  | 'CREATE'
  | 'DELETE'
  | 'EXECUTE'
  | 'EXECUTE_DESTRUCTIVE'
  | 'NETWORK_REQUEST'
  | 'READ_ONLY_INVENTORY';

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  ruleId?: string;
  timestamp: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  type:
    | 'MISSION_CREATED'
    | 'POLICY_DECISION'
    | 'ACTION_EXECUTED'
    | 'VERIFICATION_RESULT'
    | 'EMERGENCY_STOP'
    | 'BUDGET_CHECK'
    | 'ERROR'
    | 'APPROVAL_REQUEST'
    | 'APPROVAL_GRANTED'
    | 'APPROVAL_REJECTED';
  missionId?: string;
  actor: string;
  data: Record<string, unknown>;
}
