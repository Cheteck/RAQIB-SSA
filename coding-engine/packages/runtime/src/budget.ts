export interface BudgetOptions {
  maxIterations?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export class BudgetTracker {
  private iterations = 0;
  private startTime = Date.now();
  private maxIterations: number;
  private timeoutMs: number;

  constructor(options: BudgetOptions = {}) {
    this.maxIterations = options.maxIterations ?? 10;
    this.timeoutMs = options.timeoutMs ?? 300000;
  }

  incrementIteration(): void {
    this.iterations++;
  }

  isExceeded(): { exceeded: boolean; reason?: string } {
    if (this.iterations > this.maxIterations) {
      return { exceeded: true, reason: `Max iterations (${this.maxIterations}) exceeded` };
    }
    if (Date.now() - this.startTime > this.timeoutMs) {
      return { exceeded: true, reason: `Timeout (${this.timeoutMs}ms) exceeded` };
    }
    return { exceeded: false };
  }
}
