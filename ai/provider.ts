// RemiFocus — AI 供应器抽象接口
// 所有 AI 供应商（OpenAI / DeepSeek / 通义千问 等）实现此接口

import { ChatMessage } from "./types";

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  /** 供应商名称 */
  readonly name: string;

  /** 聊天补全 */
  chat(options: ChatCompletionOptions): Promise<string>;

  /** 生成 embedding */
  embed(text: string): Promise<number[]>;

  /** 检查 API 是否可用 */
  healthCheck(): Promise<boolean>;
}
