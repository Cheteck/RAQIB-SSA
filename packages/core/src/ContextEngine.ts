import { z } from 'zod';

export interface ContextWindowConfig {
  maxTokens: number;
  reserveForResponse: number;
  systemPromptReserve?: number;
  toolsReserve?: number;
  tokenizerFallbackMultiplier?: number;
}

export interface MessageItem {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tokens?: number;
  priority?: number; // 0 = lowest, 10 = highest
}

export interface ContextBudgetMetrics {
  totalBudget: number;
  systemTokens: number;
  toolsTokens: number;
  messagesTokens: number;
  responseReserve: number;
  availableTokens: number;
  usedTokens: number;
  strategyApplied: 'EXACT' | 'ESTIMATED_FALLBACK';
}

export class ContextEngine {
  private config: ContextWindowConfig;

  constructor(config: Partial<ContextWindowConfig> = {}) {
    this.config = {
      maxTokens: config.maxTokens ?? 128000,
      reserveForResponse: config.reserveForResponse ?? 4096,
      systemPromptReserve: config.systemPromptReserve ?? 2000,
      toolsReserve: config.toolsReserve ?? 2000,
      tokenizerFallbackMultiplier: config.tokenizerFallbackMultiplier ?? 0.25,
    };
  }

  estimateTokens(text: string): number {
    if (!text) return 0;
    const charCount = text.length;
    const wordCount = text.trim().split(/\s+/).length;
    return Math.max(Math.ceil(charCount * this.config.tokenizerFallbackMultiplier!), Math.ceil(wordCount * 1.3));
  }

  getMetrics(messages: MessageItem[], toolsDescription: string = ''): ContextBudgetMetrics {
    const systemMsg = messages.find((m) => m.role === 'system');
    const systemTokens = systemMsg ? this.estimateTokens(systemMsg.content) : 0;
    const toolsTokens = this.estimateTokens(toolsDescription);

    const nonSystem = messages.filter((m) => m.role !== 'system');
    const messagesTokens = nonSystem.reduce((acc, m) => acc + (m.tokens ?? this.estimateTokens(m.content)), 0);

    const usedTokens = systemTokens + toolsTokens + messagesTokens;
    const totalBudget = this.config.maxTokens;
    const availableTokens = Math.max(0, totalBudget - this.config.reserveForResponse - usedTokens);

    return {
      totalBudget,
      systemTokens,
      toolsTokens,
      messagesTokens,
      responseReserve: this.config.reserveForResponse,
      availableTokens,
      usedTokens,
      strategyApplied: 'ESTIMATED_FALLBACK',
    };
  }

  pruneMessages(messages: MessageItem[], toolsDescription: string = ''): MessageItem[] {
    const budget = this.config.maxTokens - this.config.reserveForResponse - this.estimateTokens(toolsDescription);
    let currentTokens = 0;

    const systemMessages = messages.filter((m) => m.role === 'system');
    for (const sys of systemMessages) {
      currentTokens += sys.tokens ?? this.estimateTokens(sys.content);
    }

    if (currentTokens > budget) {
      return systemMessages;
    }

    const nonSystem = messages.filter((m) => m.role !== 'system');
    const indexed = nonSystem.map((msg, index) => ({
      msg,
      index,
      tokens: msg.tokens ?? this.estimateTokens(msg.content),
      priority: msg.priority ?? 5,
    }));

    const keptIndexed: typeof indexed = [];
    for (let i = indexed.length - 1; i >= 0; i--) {
      const item = indexed[i];
      if (currentTokens + item.tokens <= budget) {
        keptIndexed.push(item);
        currentTokens += item.tokens;
      }
    }

    keptIndexed.sort((a, b) => a.index - b.index);

    return [...systemMessages, ...keptIndexed.map((k) => k.msg)];
  }

  compressContent(content: string, maxTargetLength: number): string {
    if (content.length <= maxTargetLength) return content;
    const head = content.slice(0, Math.floor(maxTargetLength * 0.6));
    const tail = content.slice(-Math.floor(maxTargetLength * 0.3));
    return `${head}\n...[content truncated by ContextEngine for budget]...\n${tail}`;
  }
}
