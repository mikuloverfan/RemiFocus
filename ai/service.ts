// RemiFocus — AI 高级服务
// 聊天编排 + 卡片识别入口

import { AIProvider } from "./provider";
import { OpenAIProvider } from "./openai";
import {
  AISettings,
  ChatMessage,
  ChatSession,
  CompressionRequest,
  CompressionResponse,
} from "./types";
import { CHAT_SYSTEM_PROMPT } from "./prompts";
import { CompressionService } from "./compression-service";
import { IEngine } from "../engine/interface";

export class AIService {
  private settings: AISettings;
  private provider: AIProvider | null = null;
  private compressionService: CompressionService | null = null;
  private engine: IEngine | null = null;

  constructor(settings: AISettings, engine?: IEngine) {
    this.settings = settings;
    this.engine = engine ?? null;
    this.rebuild();
  }

  /**
   * 重建供应器（设置变更后调用）
   */
  rebuild(settings?: AISettings): void {
    if (settings) this.settings = settings;

    if (this.settings.enabled && this.settings.apiKey) {
      this.provider = new OpenAIProvider(
        this.settings.baseUrl,
        this.settings.apiKey,
        this.settings.model
      );
      this.compressionService = new CompressionService(
        this.provider,
        this.settings.compressionModel ?? this.settings.model
      );
    } else {
      this.provider = null;
      this.compressionService = null;
    }
  }

  /**
   * 基础聊天
   */
  async chat(
    messages: ChatMessage[]
  ): Promise<string> {
    if (!this.provider) {
      throw new Error("AI 服务未配置，请在设置中填写 API Key");
    }

    // 注入系统 prompt
    const systemPrompt = await this.buildSystemPrompt();

    return this.provider.chat({
      model: this.settings.model,
      messages: [
        { role: "system", content: systemPrompt, timestamp: Date.now() },
        ...messages,
      ],
      maxTokens: this.settings.maxTokens,
      temperature: this.settings.temperature,
    });
  }

  /**
   * 压缩模式：对知识单元生成压缩卡片
   */
  async compressKU(ku: CompressionRequest): Promise<CompressionResponse> {
    if (!this.compressionService) {
      throw new Error("压缩服务未初始化，请在设置中填写 API Key");
    }
    return this.compressionService.compress(ku);
  }

  /**
   * 批量压缩
   */
  async compressBatch(kus: CompressionRequest[]): Promise<CompressionResponse[]> {
    if (!this.compressionService) {
      throw new Error("压缩服务未初始化");
    }
    return this.compressionService.compressBatch(kus);
  }

  /**
   * 检查服务是否可用
   */
  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    if (!this.provider) {
      return { ok: false, message: "AI 未配置" };
    }
    try {
      const healthy = await this.provider.healthCheck();
      return healthy
        ? { ok: true, message: "✅ 连接正常" }
        : { ok: false, message: "❌ API 连接失败" };
    } catch (err: any) {
      return { ok: false, message: `❌ ${err.message}` };
    }
  }

  /**
   * 构建系统 Prompt（含 vault 上下文）
   */
  private async buildSystemPrompt(): Promise<string> {
    let totalCards = 0;
    let totalDecks = 0;

    try {
      if (this.engine) {
        const stats = await this.engine.getStats();
        totalCards = stats.total;
        const decks = await this.engine.getDeckNames();
        totalDecks = decks.length;
      }
    } catch {
      // engine 可能未就绪
    }

    return CHAT_SYSTEM_PROMPT({
      totalCards,
      totalDecks,
      kuCount: 0,
    });
  }
}
