import { IModelProvider, ModelRequest, ModelResponse } from '@raqib/shared';

export interface PuterConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  apiKeyEnv?: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Coûts estimés par 1k tokens — Puter ne fournit pas de tarification explicite (modèle User-Pays) */
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

function getApiKey(cfg: PuterConfig): string | undefined {
  if (cfg.apiKey) return cfg.apiKey;
  if (cfg.apiKeyEnv && process.env[cfg.apiKeyEnv]) return process.env[cfg.apiKeyEnv];
  return undefined;
}

/**
 * PuterAdapter — implémente IModelProvider pour l'API OpenAI-compatible de Puter.
 *
 * Endpoint : https://api.puter.com/puterai/openai/v1/chat/completions
 * Auth : Bearer token (PUTER_AUTH_TOKEN depuis puter.com/dashboard#account)
 *
 * Dédié aux tâches non-critiques : reformulation, classification, synthèse, explications, démo.
 * Ne court-circuite jamais le Model Gateway / Policy Engine / Audit Ledger pour les missions critiques.
 *
 * @see https://developer.puter.com/tutorials/use-openai-sdk-with-puter/
 */
export class PuterAdapter implements IModelProvider {
  name: string;
  type = 'puter';
  private cfg: PuterConfig;

  constructor(cfg: PuterConfig) {
    this.name = cfg.name;
    this.cfg = cfg;
  }

  isEnabled(): boolean {
    const key = getApiKey(this.cfg);
    return !!this.cfg.baseUrl && !!key;
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const start = Date.now();
    const apiKey = getApiKey(this.cfg);
    const model = req.model || this.cfg.model || 'openai/gpt-5.4-nano';
    const url = `${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const body = {
      model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens ?? 2048,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const timeoutMs = req.timeoutMs ?? this.cfg.timeoutMs ?? 30000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const error = new Error(`Puter API error ${res.status}: ${text}`) as Error & { status?: number };
        error.status = res.status;
        throw error;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      const promptTokens = data?.usage?.prompt_tokens;
      const completionTokens = data?.usage?.completion_tokens;

      // Puter utilise le modèle User-Pays — les coûts ne sont pas retournés par l'API.
      // Estimation via les coûts configurés, ou 0 si non définis.
      const costIn = this.cfg.costPer1kInput ?? 0;
      const costOut = this.cfg.costPer1kOutput ?? 0;
      const cost = {
        input: ((promptTokens || 0) / 1000) * costIn,
        output: ((completionTokens || 0) / 1000) * costOut,
        total: ((promptTokens || 0) / 1000) * costIn + ((completionTokens || 0) / 1000) * costOut,
      };

      return {
        content,
        model,
        usage: { promptTokens, completionTokens, totalTokens: data?.usage?.total_tokens },
        cost,
        provider: this.name,
        latencyMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
