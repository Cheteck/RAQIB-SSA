import { PolicyRequest } from './PolicyEngine';

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  ruleId?: string;
  timestamp: string;
}

export interface AgentState {
  missionId: string;
  stepId?: string;
  context: Record<string, unknown>;
  history: Array<{ role: string; content: string }>;
}

export interface AgentMiddleware {
  name: string;
  beforeAgent?: (state: AgentState, req: PolicyRequest) => Promise<void | PolicyDecision>;
  afterAgent?: (state: AgentState, decision: PolicyDecision) => Promise<void>;
}

export class MiddlewarePipeline {
  private middlewares: AgentMiddleware[] = [];

  use(middleware: AgentMiddleware): void {
    this.middlewares.push(middleware);
  }

  async runBefore(state: AgentState, req: PolicyRequest): Promise<PolicyDecision | null> {
    for (const mw of this.middlewares) {
      if (mw.beforeAgent) {
        const decision = await mw.beforeAgent(state, req);
        if (decision && !decision.allowed) {
          return decision;
        }
      }
    }
    return null;
  }

  async runAfter(state: AgentState, decision: PolicyDecision): Promise<void> {
    for (const mw of this.middlewares) {
      if (mw.afterAgent) {
        await mw.afterAgent(state, decision);
      }
    }
  }
}
