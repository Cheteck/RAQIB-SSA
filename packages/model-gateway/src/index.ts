import { IModelProvider, ModelRequest, ModelResponse, AuditEvent } from '@raqib/shared';
import { OpenAICompatibleAdapter } from './adapters/openai-compatible';
import { FreeLLMAPIAdapter } from './adapters/free-llm-api';

export interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
}

export interface BudgetChecker {
  checkBudget(missionId: string, estimatedCost: number): { allowed: boolean; reason: string };
  deductBudget(missionId: string, amount: number): Promise<{ success: boolean; remaining: number }>;
}

export interface ProviderHealth {
  id: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export class ModelGateway {
  private providers = new Map<string, IModelProvider>();
  private providerConfigs = new Map<string, any>();
  private config: any;
  private logger: AuditLogger | null = null;
  private budgetChecker: BudgetChecker | null = null;

  constructor(config: any, options?: { logger?: AuditLogger; budgetChecker?: BudgetChecker }) {
    this.config = config;
    this.logger = options?.logger ?? null;
    this.budgetChecker = options?.budgetChecker ?? null;
    this.init();
  }

  private init() {
    const providers = this.config.providers || {};

    for (const [id, cfg] of Object.entries(providers)) {
      if (!(cfg as any).enabled) continue;

      this.providerConfigs.set(id, cfg);

      if ((cfg as any).type === 'openai-compatible') {
        if (id === 'freellmapi') {
          this.providers.set(id, new FreeLLMAPIAdapter(cfg));
        } else {
          this.providers.set(id, new OpenAICompatibleAdapter(cfg as any));
        }
      }
    }
  }

  getProvider(id: string): IModelProvider | undefined {
    return this.providers.get(id);
  }

  getProviderForTask(taskType: string): { provider: IModelProvider; providerId: string } | undefined {
    if (taskType === 'policy_decision') {
      return undefined;
    }
    const routing = this.config.routing || {};
    let target = routing[taskType] || routing['default'] || this.config.defaultProvider;

    if (!target) return undefined;

    if (Array.isArray(target)) {
      for (const providerId of target) {
        const p = this.providers.get(providerId);
        if (p) return { provider: p, providerId };
      }
      return undefined;
    }

    const provider = this.providers.get(target);
    return provider ? { provider, providerId: target } : undefined;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async complete(req: ModelRequest, missionId: string): Promise<{
    response?: ModelResponse;
    error?: string;
    needsReview?: boolean;
  }> {
    const resolved = this.getProviderForTask(req.taskType || 'default');
    if (!resolved) {
      return { error: 'No provider available for task', needsReview: true };
    }

    const { provider, providerId } = resolved;
    const providerConfig = this.providerConfigs.get(providerId) || {};
    const maxRetries = providerConfig.maxRetries ?? 1;
    const timeoutMs = providerConfig.timeoutMs ?? 90000;

    const estimatedCost = req.maxTokens ? (req.maxTokens / 1000) * 0.001 : 0.01;
    if (this.budgetChecker) {
      const budgetResult = this.budgetChecker.checkBudget(missionId, estimatedCost);
      if (!budgetResult.allowed) {
        await this.logger?.log({
          id: `evt-model-budget-denied-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'BUDGET_CHECK',
          missionId,
          actor: 'raqib-core',
          data: { reason: budgetResult.reason, estimatedCost },
        });
        return { error: `Budget denied: ${budgetResult.reason}`, needsReview: true };
      }
    }

    const filteredReq = this.filterSensitiveData(req);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const targetModel = req.model || providerConfig.model || providerConfig.models?.[0] || 'auto';
        const response = await provider.complete({ ...filteredReq, model: targetModel, timeoutMs });

        if (response.cost && this.budgetChecker) {
          await this.budgetChecker.deductBudget(missionId, response.cost.total);
        }

        await this.logger?.log({
          id: `evt-model-complete-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'ACTION_EXECUTED',
          missionId,
          actor: 'raqib-core',
          data: {
            provider: provider.name,
            model: targetModel,
            cost: response.cost,
            latencyMs: response.latencyMs,
          },
        });

        return { response };
      } catch (err) {
        lastError = err as Error;
        if (attempt < maxRetries) {
          const backoffMs = (providerConfig.retryBackoffMs ?? 2000) * Math.pow(2, attempt);
          await new Promise((res) => setTimeout(res, backoffMs));
        }
      }
    }

    await this.logger?.log({
      id: `evt-model-error-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'ERROR',
      missionId,
      actor: 'raqib-core',
      data: { error: lastError?.message, provider: provider.name, attempts: maxRetries + 1 },
    });

    return { error: lastError?.message ?? 'Unknown error', needsReview: true };
  }

  private filterSensitiveData(req: ModelRequest): ModelRequest {
    const patterns = this.config.safety?.filterSensitivePatterns || [
      '.env',
      'PRIVATE KEY',
      'BEGIN RSA PRIVATE KEY',
      'API_KEY',
    ];

    const filterText = (text: string): string => {
      let filtered = text;
      for (const pattern of patterns) {
        const regex = new RegExp(`(${pattern})[^\\s]{0,50}`, 'gi');
        filtered = filtered.replace(regex, '[REDACTED]');
      }
      return filtered;
    };

    return {
      ...req,
      messages: req.messages.map((m) => ({
        ...m,
        content: filterText(m.content),
      })),
    };
  }

  disableProvider(id: string): void {
    const provider = this.providers.get(id);
    if (provider) {
      this.providers.delete(id);
      this.providerConfigs.delete(id);
    }
  }

  async checkProvider(id: string): Promise<ProviderHealth> {
    const provider = this.providers.get(id);
    const cfg = this.providerConfigs.get(id);

    if (!provider) {
      return { id, healthy: false, error: 'Provider not found' };
    }

    const start = Date.now();
    try {
      await provider.complete({
        model: cfg?.model || cfg?.models?.[0] || 'auto',
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 1,
        timeoutMs: 5000,
      });
      return { id, healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { id, healthy: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }
}

export * from './adapters/openai-compatible';
export * from './adapters/free-llm-api';
