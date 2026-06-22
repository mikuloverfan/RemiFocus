// RemiFocus — OpenAI 兼容 API 客户端
// 支持 OpenAI / DeepSeek / 通义千问 / Claude 等兼容接口

import { AIProvider, ChatCompletionOptions } from "./provider";
import { ChatMessage } from "./types";

export class OpenAIProvider implements AIProvider {
  readonly name = "OpenAI-Compatible";

  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor(baseUrl: string, apiKey: string, defaultModel: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async chat(options: ChatCompletionOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: options.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-3-small",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Embedding API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
