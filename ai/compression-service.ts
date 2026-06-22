// RemiFocus — 压缩模式生成服务
// 调用 LLM 对知识单元进行语义压缩和卡片生成

import { AIProvider } from "./provider";
import { COMPRESSION_SYSTEM_PROMPT } from "./prompts";
import { CompressionRequest, CompressionResponse } from "./types";

export class CompressionService {
  private provider: AIProvider;
  private model: string;

  constructor(provider: AIProvider, model: string) {
    this.provider = provider;
    this.model = model;
  }

  /**
   * 对单个知识单元进行压缩，生成多张卡片
   */
  async compress(ku: CompressionRequest): Promise<CompressionResponse> {
    const userMessage = this.buildUserMessage(ku);

    const rawJson = await this.provider.chat({
      model: this.model,
      messages: [
        { role: "system", content: COMPRESSION_SYSTEM_PROMPT, timestamp: Date.now() },
        { role: "user", content: userMessage, timestamp: Date.now() },
      ],
      maxTokens: 2048,
      temperature: 0.7,
    });

    return this.parseResponse(rawJson);
  }

  /**
   * 批量压缩（逐个调用，可加并发限制）
   */
  async compressBatch(
    kus: CompressionRequest[],
    concurrency: number = 3
  ): Promise<CompressionResponse[]> {
    const results: CompressionResponse[] = [];
    const queue = [...kus];

    const worker = async () => {
      while (queue.length > 0) {
        const ku = queue.shift()!;
        try {
          const result = await this.compress(ku);
          results.push(result);
        } catch (err) {
          console.error("[Compression] Failed to compress:", err);
          results.push({
            compressed: ku.rawText.slice(0, 30),
            cards: [],
          });
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, kus.length) }, () => worker());
    await Promise.all(workers);

    return results;
  }

  private buildUserMessage(ku: CompressionRequest): string {
    return `## 笔记内容
${ku.rawText}

## 元数据
- 结构类型: ${ku.structure}
- 标签: ${ku.tags.join(", ") || "无"}

请压缩以上内容，生成最易记忆的卡片。`;
  }

  private parseResponse(raw: string): CompressionResponse {
    try {
      // 尝试提取 JSON（处理可能的 markdown 代码块包裹）
      const jsonStr = raw.replace(/```(?:json)?\s*/g, "").trim();
      return JSON.parse(jsonStr);
    } catch {
      // fallback: 将纯文本作为一张 QA 卡
      return {
        compressed: raw.slice(0, 30),
        cards: [
          {
            type: "qa",
            front: "压缩笔记",
            back: raw.slice(0, 200),
          },
        ],
      };
    }
  }
}
