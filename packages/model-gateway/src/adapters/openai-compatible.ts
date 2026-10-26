import { IModelProvider, ModelRequest, ModelResponse } from '@raqib/shared';

export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  apiKeyEnv?: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

function getApiKey(cfg: OpenAICompatibleConfig): string | undefined {
  if (cfg.apiKey) return cfg.apiKey;
  if (cfg.apiKeyEnv && process.env[cfg.apiKeyEnv]) return process.env[cfg.apiKeyEnv];
  return undefined;
}

export class OpenAICompatibleAdapter implements IModelProvider {
  name: string;
  type = 'openai-compatible';
  private cfg: OpenAICompatibleConfig;

  constructor(cfg: OpenAICompatibleConfig) {
    this.name = cfg.name;
    this.cfg = cfg;
  }

  isEnabled(): boolean {
    const key = getApiKey(this.cfg);
    // freeLLMAPI uses a key but it's local proxy - allow if baseUrl present
    return !!this.cfg.baseUrl;
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const start = Date.now();
    const apiKey = getApiKey(this.cfg);
    const model = req.model || this.cfg.model || 'auto';
    const url = `${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;
    
    const body = {
      model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens ?? 2048,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const timeoutMs = req.timeoutMs ?? this.cfg.timeoutMs ?? 60000;
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
        throw new Error(`OpenAI-compatible error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      const promptTokens = data?.usage?.prompt_tokens;
      const completionTokens = data?.usage?.completion_tokens;
      
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
