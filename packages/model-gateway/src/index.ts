import { IModelProvider, ModelRequest, ModelResponse, AuditEvent } from '@raqib/shared';
import { OpenAICompatibleAdapter } from './adapters/openai-compatible';
import { FreeLLMAPIAdapter } from './adapters/free-llm-api';

// ─── Audit Logger interface ───
export interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
}

// ─── Budget Checker interface ───
export interface BudgetChecker {
  checkBudget(missionId: string, estimatedCost: number): { allowed: boolean; reason: string };
  deductBudget(missionId: string, amount: number): Promise<{ success: boolean; remaining: number }>;
}

// ─── Provider Health ───
export interface ProviderHealth {
  id: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

// ─── Model Gateway ───

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

  getProviderForTask(taskType: string): IModelProvider | undefined {
    // policy_decision must never use a model
    if (taskType === 'policy_decision') {
      return undefined;
    }
    const routing = this.config.routing || {};
    const providerId = routing[taskType] || this.config.defaultProvider;
    if (!providerId || providerId === 'none') return undefined;
    return this.providers.get(providerId);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Complète une requête modèle avec :
   * - Vérification budget AVANT l'appel
   * - Filtrage des données sensibles
   * - Coût tracé APRÈS l'appel
   * - Timeout respecté
   * - Retry avec backoff
   * - Erreur gérée sans crash → retourne NEEDS_REVIEW
   */
  async complete(req: ModelRequest, missionId: string): Promise<{
    response?: ModelResponse;
    error?: string;
    needsReview?: boolean;
  }> {
    const provider = this.getProviderForTask(req.taskType || 'default');
    if (!provider) {
      return { error: 'No provider available for task', needsReview: true };
    }

    const providerConfig = this.providerConfigs.get(provider.name) || {};
    const maxRetries = providerConfig.maxRetries ?? 1;
    const timeoutMs = providerConfig.timeoutMs ?? 90000;

    // 1. Budget check BEFORE call
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

    // 2. Filter sensitive data from messages
    const filteredReq = this.filterSensitiveData(req);

    // 3. Execute with retry + backoff (timeout géré par l'adaptateur via timeoutMs)
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await provider.complete({ ...filteredReq, timeoutMs });

        // 4. Log cost AFTER successful call
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
            model: req.model,
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

    // All retries failed → NEEDS_REVIEW
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

  /** Filtre les patterns sensibles des messages avant envoi au provider. */
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

  /** Désactive un provider sans redémarrage. */
  disableProvider(id: string): void {
    const provider = this.providers.get(id);
    if (provider) {
      this.providers.delete(id);
      this.providerConfigs.delete(id);
    }
  }

  /** Health check d'un provider. */
  async checkProvider(id: string): Promise<ProviderHealth> {
    const provider = this.providers.get(id);
    const cfg = this.providerConfigs.get(id);

    if (!provider) {
      return { id, healthy: false, error: 'Provider not found' };
    }

    const start = Date.now();
    try {
      // Simple health check: call with minimal prompt
      await provider.complete({
        model: cfg?.model || 'auto',
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
