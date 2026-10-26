import { IModelProvider, ModelRequest, ModelResponse } from '@raqib/shared';
import { OpenAICompatibleAdapter } from './openai-compatible';

export class FreeLLMAPIAdapter extends OpenAICompatibleAdapter {
  constructor(cfg: any) {
    super({
      name: cfg.name || 'FreeLLMAPI',
      baseUrl: cfg.baseUrl || process.env.FREE_LLM_API_BASE_URL || 'http://127.0.0.1:3001/v1',
      apiKeyEnv: cfg.apiKeyEnv || 'FREE_LLM_API_KEY',
      model: cfg.model || 'auto',
      timeoutMs: cfg.timeoutMs || 60000,
      maxRetries: cfg.maxRetries || 2,
      costPer1kInput: cfg.costPer1kInput ?? 0,
      costPer1kOutput: cfg.costPer1kOutput ?? 0,
    });
    this.name = cfg.name || 'FreeLLMAPI';
  }
}
