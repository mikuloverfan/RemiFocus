// RemiFocus — AI 服务类型定义

// ─── AI 设置 ───

export interface AISettings {
  enabled: boolean;
  provider: string;         // "openai" | "custom"
  apiKey: string;
  baseUrl: string;          // 默认 https://api.openai.com/v1
  model: string;            // 默认 gpt-4o-mini
  maxTokens: number;        // 默认 4096
  temperature: number;      // 默认 0.7
  /** 压缩模式专用模型（可不同于聊天模型） */
  compressionModel?: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: "openai",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  maxTokens: 4096,
  temperature: 0.7,
  compressionModel: "gpt-4o-mini",
};

// ─── 聊天消息 ───

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: number;
}

// ─── 聊天会话 ───

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// ─── AI 响应结果 ───

export interface AIDiffResult {
  type: "deck-reorganize" | "card-extract" | "card-suggest" | "compression";
  summary: string;
  changes: Array<{
    action: "create" | "update" | "delete" | "move";
    target: string;
    detail: string;
  }>;
}

// ─── 压缩生成请求/响应 ───

export interface CompressionRequest {
  rawText: string;
  structure: string;
  tags: string[];
}

export interface CompressionResponse {
  compressed: string;
  cards: Array<{
    type: "qa" | "cloze" | "mnemonic" | "judgement";
    front: string;
    back: string;
    clozeSegments?: Array<{ hint: string; answer: string }>;
  }>;
}
