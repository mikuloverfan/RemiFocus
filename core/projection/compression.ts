// RemiFocus — Compression Projection（AI 压缩投影生成器）
// 通过 AI 将 KU 压缩为学习卡片
// 支持可回放：同一 seed + 同一 promptHash → 同一组卡片

import { KnowledgeUnit } from "../../models/knowledge-unit";
import { CardFace, CardType, Projection as ProjectionResult } from "../../models/projection";
import { ClozeSegment } from "../../models/card";

// ─── AI 服务接口 ───

export interface AICompressionService {
  compress(
    prompt: string,
    options?: { seed?: string; temperature?: number }
  ): Promise<string>;
  getModel(): string;
}

// ─── 解析后的 AI 输出 ───

interface AICompressionOutput {
  compressed: string;
  cards: Array<{
    type: "qa" | "cloze" | "mnemonic" | "judgement";
    front: string;
    back: string;
  }>;
  cloze?: Array<{ hint: string; answer: string }>;
}

export interface CompressionProjectorOptions {
  /** AI 模型名称 */
  model?: string;
  /** 生成温度（越低越确定） */
  temperature: number;
  /** 是否启用可回放缓存 */
  enableCache: boolean;
  /** 最大卡片数 */
  maxCards: number;
}

const DEFAULT_OPTIONS: CompressionProjectorOptions = {
  temperature: 0,
  enableCache: true,
  maxCards: 5,
};

export class CompressionProjector {
  private aiService: AICompressionService;
  private options: CompressionProjectorOptions;

  /** 缓存：seed_promptHash → Projection */
  private cache: Map<string, ProjectionResult> = new Map();

  constructor(
    aiService: AICompressionService,
    options?: Partial<CompressionProjectorOptions>
  ) {
    this.aiService = aiService;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 将 KU 转换为 Compression 投影卡片
   *
   * 可回放保证：
   * 1. seed = kuId + version + optionsHash
   * 2. promptHash = SHA256(prompt)
   * 3. 同一 seed + 同一 promptHash → 复用缓存
   * 4. prompt 变化 → 重新生成
   */
  async project(ku: KnowledgeUnit, seed?: string): Promise<ProjectionResult> {
    const currentVersion = this.getNextVersion(ku);
    const optionsHash = this.hashOptions();
    const actualSeed = seed ?? `${ku.id}_comp_v${currentVersion}_${optionsHash}`;

    // Step 1: 构建 prompt
    const prompt = this.buildPrompt(ku);

    // Step 2: 计算 promptHash
    const promptHash = await this.hashPrompt(prompt);

    // Step 3: 检查缓存（可回放）
    const cacheKey = `${actualSeed}_${promptHash}`;
    if (this.options.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log(`[CompressionProjector] Cache hit: ${cacheKey}`);
        return cached;
      }
    }

    // Step 4: 调用 AI
    const response = await this.aiService.compress(prompt, {
      seed: actualSeed,
      temperature: this.options.temperature,
    });

    // Step 5: 解析 AI 输出
    const cards = this.parseResponse(response, ku, currentVersion);

    // Step 6: 构建投影结果
    const result: ProjectionResult = {
      kuId: ku.id,
      mode: "compression",
      version: currentVersion,
      cards,
      generatedAt: new Date().toISOString(),
      aiModel: this.aiService.getModel(),
      seed: actualSeed,
      promptHash,
      regenerationPolicy: "replace",
    };

    // Step 7: 写入缓存
    if (this.options.enableCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * 构建 AI prompt
   */
  private buildPrompt(ku: KnowledgeUnit): string {
    const text = ku.sources[0]?.rawText ?? ku.canonical.text;
    const structure = ku.structure;
    const tags = ku.tags.join(", ");

    return [
      "你是学习卡片生成助手。根据以下知识点生成压缩卡片。",
      "",
      `结构类型: ${structure}`,
      `标签: ${tags || "(无)"}`,
      `知识点: ${text}`,
      "",
      "要求：",
      "1. 生成 2-3 张不同角度的卡片（QA / Cloze / 助记）",
      "2. 保持知识点准确，不编造信息",
      "3. 语言风格：简洁、适合间隔重复",
      "4. 返回 JSON 格式：",
      `{
        "compressed": "一句话总结",
        "cards": [
          { "type": "qa", "front": "问题", "back": "答案" },
          { "type": "mnemonic", "front": "提示", "back": "助记" }
        ],
        "cloze": [
          { "hint": "提示文本", "answer": "答案" }
        ]
      }`,
    ].join("\n");
  }

  /**
   * 解析 AI 返回的 JSON
   */
  private parseResponse(
    response: string,
    ku: KnowledgeUnit,
    version: number
  ): CardFace[] {
    try {
      // 尝试从 JSON 代码块中提取
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      const output: AICompressionOutput = JSON.parse(jsonStr);

      const cards: CardFace[] = [];

      // 生成卡片
      for (let i = 0; i < Math.min(output.cards.length, this.options.maxCards); i++) {
        const card = output.cards[i];
        const cardId = `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}_cmp_${i}`;

        const face: CardFace = {
          cardId,
          type: card.type,
          front: card.front,
          back: card.back,
          wordKey: this.toWordKey(ku.canonical.text),
        };

        if (card.type === "cloze" && output.cloze) {
          face.clozeSegments = output.cloze.map((c) => ({
            hint: c.hint,
            answer: c.answer,
          }));
        }

        cards.push(face);
      }

      return cards;
    } catch {
      // 解析失败，返回一条 fallback 卡片
      console.warn("[CompressionProjector] Failed to parse AI response, using fallback");
      return [{
        cardId: `card_${Date.now().toString(36)}_fallback`,
        type: "qa",
        front: `📝 ${ku.canonical.text.slice(0, 100)}`,
        back: ku.canonical.text,
        wordKey: this.toWordKey(ku.canonical.text),
      }];
    }
  }

  /**
   * 计算 prompt 哈希（简化版）
   * 生产环境应使用 SHA-256
   */
  private async hashPrompt(prompt: string): Promise<string> {
    // 简化：使用字符串长度 + 前 50 字符 + 后 50 字符的哈希
    const str = `${prompt.length}_${prompt.slice(0, 50)}_${prompt.slice(-50)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 生成选项哈希
   */
  private hashOptions(): string {
    return `${this.options.temperature}_${this.options.maxCards}_${this.options.model ?? "default"}`;
  }

  private toWordKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 50);
  }

  private getNextVersion(ku: KnowledgeUnit): number {
    return (ku.projections?.compression?.version ?? 0) + 1;
  }

  /**
   * 清空缓存（当 prompt 模板变化时调用）
   */
  clearCache(): void {
    this.cache.clear();
  }
}
