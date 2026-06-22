// RemiFocus — AI 服务统一导出

export { AIService } from "./service";
export { CompressionService } from "./compression-service";
export { OpenAIProvider } from "./openai";
export type { AIProvider, ChatCompletionOptions } from "./provider";
export type {
  AISettings,
  ChatMessage,
  ChatRole,
  ChatSession,
  AIDiffResult,
  CompressionRequest,
  CompressionResponse,
} from "./types";
export { DEFAULT_AI_SETTINGS } from "./types";
