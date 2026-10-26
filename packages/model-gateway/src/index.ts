import { IModelProvider } from '@raqib/shared';
import { OpenAICompatibleAdapter } from './adapters/openai-compatible';
import { FreeLLMAPIAdapter } from './adapters/free-llm-api';

export class ModelGateway {
  private providers = new Map<string, IModelProvider>();
  private config: any;

  constructor(config: any) {
    this.config = config;
    this.init();
  }

  private init() {
    const providers = this.config.providers || {};
    
    for (const [id, cfg] of Object.entries(providers)) {
      if (!(cfg as any).enabled) continue;
      
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
}

export * from './adapters/openai-compatible';
export * from './adapters/free-llm-api';
