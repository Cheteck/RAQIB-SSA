import { ModelProvider, ModelRequest, ModelResponse } from "./provider";

export interface FreeLLMAPIConfig {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  timeoutMs?: number;
}

export class FreeLLMAPIProvider implements ModelProvider {
  public readonly id = "freellmapi";

  constructor(private config: FreeLLMAPIConfig) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const url = `${this.config.baseURL}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || this.config.defaultModel || "auto",
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
      }),
    });

    if (!res.ok) {
      throw new Error(`FreeLLMAPI HTTP error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as any;
    const choice = data.choices?.[0];
    const routedVia = res.headers.get("x-routed-via") || undefined;

    return {
      message: {
        role: "assistant",
        content: choice?.message?.content || "",
      },
      servedModel: data.model,
      routedVia,
      usage: {
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      },
    };
  }
}
