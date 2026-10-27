import { z } from 'zod';

export interface ContextWindowConfig {
  maxTokens: number;
  reserveForResponse: number;
}

export interface MessageItem {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tokens?: number;
}

export class ContextEngine {
  private config: ContextWindowConfig;

  constructor(config: Partial<ContextWindowConfig> = {}) {
    this.config = {
      maxTokens: config.maxTokens ?? 128000,
      reserveForResponse: config.reserveForResponse ?? 4096,
    };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  pruneMessages(messages: MessageItem[]): MessageItem[] {
    const budget = this.config.maxTokens - this.config.reserveForResponse;
    let currentTokens = 0;
    const result: MessageItem[] = [];

    const systemMsg = messages.find((m) => m.role === 'system');
    if (systemMsg) {
      currentTokens += this.estimateTokens(systemMsg.content);
      result.push(systemMsg);
    }

    const nonSystem = messages.filter((m) => m.role !== 'system').reverse();
    const kept: MessageItem[] = [];

    for (const msg of nonSystem) {
      const msgTokens = this.estimateTokens(msg.content);
      if (currentTokens + msgTokens <= budget) {
        kept.push(msg);
        currentTokens += msgTokens;
      } else {
        break;
      }
    }

    kept.reverse();
    if (systemMsg) {
      return [systemMsg, ...kept];
    }
    return kept;
  }
}
