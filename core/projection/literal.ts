// RemiFocus — Literal Projection（原文投影生成器）
// 将 KU 忠实转换为原文卡片，不改变语义
// 确定性输出：同一 KU + 同一 seed → 同一组卡片

import { KnowledgeUnit } from "../../models/knowledge-unit";
import { CardFace, CardType, Projection as ProjectionResult } from "../../models/projection";
import { ClozeSegment } from "../../models/card";

export interface LiteralProjectorOptions {
  /** 最大 cloze 挖空数（用于段落类型） */
  maxClozeCount: number;
  /** 是否保留原格式标记 */
  preserveMarkdown: boolean;
}

const DEFAULT_OPTIONS: LiteralProjectorOptions = {
  maxClozeCount: 3,
  preserveMarkdown: false,
};

export class LiteralProjector {
  private options: LiteralProjectorOptions;

  constructor(options?: Partial<LiteralProjectorOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 将 KU 转换为 Literal 投影卡片
   * 根据 KU 的 structure 类型使用不同的转换策略
   */
  project(ku: KnowledgeUnit, seed?: string): ProjectionResult {
    const cards: CardFace[] = [];

    switch (ku.structure) {
      case "big-cloze":
        cards.push(...this.bigClozeToCards(ku));
        break;
      case "small-vocab":
        cards.push(...this.smallVocabToCards(ku));
        break;
      case "table":
        cards.push(...this.tableToCards(ku));
        break;
      case "paragraph":
        cards.push(...this.paragraphToCards(ku));
        break;
    }

    // 生成确定性 seed
    const version = this.getNextVersion(ku);
    const actualSeed = seed ?? `${ku.id}_literal_v${version}`;

    return {
      kuId: ku.id,
      mode: "literal",
      version,
      cards,
      generatedAt: new Date().toISOString(),
      seed: actualSeed,
      regenerationPolicy: "replace",
    };
  }

  // ─── big-cloze → cloze 卡片 ───

  private bigClozeToCards(ku: KnowledgeUnit): CardFace[] {
    const cards: CardFace[] = [];
    const rawText = ku.sources[0]?.rawText ?? ku.canonical.text;

    // 尝试从 rawText 解析【看到啥】→【想到啥】→【记住啥】
    const sections = this.parseBigCardSections(rawText);

    if (sections.see && sections.think) {
      // 将【想到啥】内容作为 cloze 挖空
      const clozeSegments: ClozeSegment[] = [
        { hint: sections.see.slice(0, 60), answer: sections.think },
      ];

      const cardId = this.generateCardId(ku.id, "cloze");
      cards.push({
        cardId,
        type: "cloze",
        front: `${sections.see}\n\n{{c1::${sections.think}}}`,
        back: `${sections.see}\n\n${sections.think}`,
        clozeSegments,
        wordKey: this.toWordKey(ku.canonical.text),
      });
    }

    // 如果有助记，单独生成助记卡片
    if (sections.mnemonic) {
      const cardId = this.generateCardId(ku.id, "mnemonic");
      cards.push({
        cardId,
        type: "mnemonic",
        front: `💡 ${sections.see ?? ku.canonical.text}`,
        back: sections.mnemonic,
        wordKey: this.toWordKey(ku.canonical.text),
      });
    }

    return cards;
  }

  // ─── small-vocab → QA 卡片 ───

  private smallVocabToCards(ku: KnowledgeUnit): CardFace[] {
    const rawText = ku.sources[0]?.rawText ?? ku.canonical.text;
    const { front, back } = this.parseVocab(rawText);

    const cardId = this.generateCardId(ku.id, "qa");
    return [{
      cardId,
      type: "qa",
      front: front || ku.canonical.text,
      back: back || "(no definition)",
      wordKey: this.toWordKey(ku.canonical.text),
    }];
  }

  // ─── table → 按行拆分为 cloze 卡片 ───

  private tableToCards(ku: KnowledgeUnit): CardFace[] {
    const cards: CardFace[] = [];
    const rawText = ku.sources[0]?.rawText ?? ku.canonical.text;
    const lines = rawText.split("\n").filter((l) => l.trim().startsWith("|"));

    if (lines.length < 2) {
      // 不足两行，当作简单文本处理
      return this.fallbackToQA(ku);
    }

    // 第一行 = header
    const headers = lines[0].split("|").filter((c) => c.trim()).map((c) => c.trim());
    // 第二行 = 分隔线（跳过）
    // 从第三行开始 = 数据行
    let cardIndex = 0;
    for (let i = 2; i < lines.length; i++) {
      const cells = lines[i].split("|").filter((c) => c.trim()).map((c) => c.trim());
      if (cells.length < 2) continue;

      const front = cells[0];
      const back = cells.slice(1).map((c, j) => `${headers[j + 1] || ""}: ${c}`).join("\n");

      const cardId = this.generateCardId(ku.id, "qa", cardIndex++);
      cards.push({
        cardId,
        type: "qa",
        front,
        back,
        wordKey: this.toWordKey(front),
      });
    }

    return cards;
  }

  // ─── paragraph → 自动挖空 ───

  private paragraphToCards(ku: KnowledgeUnit): CardFace[] {
    const text = ku.canonical.text;
    const keywords = this.extractKeywords(text);

    if (keywords.length === 0) {
      // 无关键词，生成 QA 卡片
      return this.fallbackToQA(ku);
    }

    const cards: CardFace[] = [];
    const clozeSegments: ClozeSegment[] = [];

    // 对前 N 个关键词挖空
    const clozeCount = Math.min(this.options.maxClozeCount, keywords.length);
    for (let i = 0; i < clozeCount; i++) {
      const keyword = keywords[i];
      const answer = keyword;
      const hint = text.replace(keyword, "______").slice(0, 60);

      clozeSegments.push({ hint, answer });
    }

    // 构建带挖空的文本
    let clozeText = text;
    for (let i = 0; i < clozeCount; i++) {
      const keyword = keywords[i];
      clozeText = clozeText.replace(keyword, `{{c${i + 1}::${keyword}}}`);
    }

    const cardId = this.generateCardId(ku.id, "cloze");
    cards.push({
      cardId,
      type: "cloze",
      front: clozeText,
      back: text,
      clozeSegments,
      wordKey: this.toWordKey(text),
    });

    return cards;
  }

  // ─── 解析方法 ───

  private parseBigCardSections(text: string): {
    see: string;
    think: string;
    wrong: string;
    mnemonic: string;
  } {
    const result = { see: "", think: "", wrong: "", mnemonic: "" };

    // 首先按行分割
    const lines = text.split("\n");
    let currentSection = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes("【看到啥】") || trimmed.includes("[看到啥]")) {
        currentSection = "see";
        continue;
      }
      if (trimmed.includes("【想到啥】") || trimmed.includes("[想到啥]")) {
        currentSection = "think";
        continue;
      }
      if (trimmed.includes("【别选啥】") || trimmed.includes("[别选啥]")) {
        currentSection = "wrong";
        continue;
      }
      if (trimmed.includes("【记住啥】") || trimmed.includes("[记住啥]")) {
        currentSection = "mnemonic";
        continue;
      }

      if (currentSection && trimmed) {
        (result as any)[currentSection] += trimmed + " ";
      }
    }

    // 清理
    for (const key of Object.keys(result)) {
      (result as any)[key] = (result as any)[key].trim();
    }

    return result;
  }

  private parseVocab(text: string): { front: string; back: string } {
    // 尝试各种格式
    const patterns = [
      { regex: /^==(.+?)==\s*[:：]\s*(.+)$/m, frontIdx: 1, backIdx: 2 },
      { regex: /^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/m, frontIdx: 1, backIdx: 2 },
      { regex: /^(.+?)\s*[-–—]\s+(.+)$/m, frontIdx: 1, backIdx: 2 },
      { regex: /^(.+?)\s*[:：]\s+(.+)$/m, frontIdx: 1, backIdx: 2 },
    ];

    for (const { regex, frontIdx, backIdx } of patterns) {
      const match = text.match(regex);
      if (match) {
        return {
          front: this.cleanMarkdown(match[frontIdx]),
          back: this.cleanMarkdown(match[backIdx]),
        };
      }
    }

    // 兜底：整段文本
    return { front: text.slice(0, 80), back: text };
  }

  private extractKeywords(text: string): string[] {
    // 提取关键术语（英文>=4字母，中文>=2字）
    const keywords: string[] = [];

    // 英文术语
    const engTerms = text.match(/\b[A-Za-z]{4,}\b/g);
    if (engTerms) keywords.push(...engTerms);

    // 中文术语
    const zhTerms = text.match(/[一-龥]{2,}/g);
    if (zhTerms) keywords.push(...zhTerms);

    // 去重并按出现频率排序
    const freq = new Map<string, number>();
    for (const k of keywords) {
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }

    return [...new Set(keywords)]
      .sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0))
      .slice(0, this.options.maxClozeCount);
  }

  private fallbackToQA(ku: KnowledgeUnit): CardFace[] {
    const cardId = this.generateCardId(ku.id, "qa");
    return [{
      cardId,
      type: "qa",
      front: ku.canonical.text.slice(0, 100),
      back: ku.canonical.text,
      wordKey: this.toWordKey(ku.canonical.text),
    }];
  }

  // ─── 工具方法 ───

  private generateCardId(kuId: string, type: CardType, index: number = 0): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    return `card_${ts}${rand}_${type}${index > 0 ? `_${index}` : ""}`;
  }

  private toWordKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 50);
  }

  private cleanMarkdown(text: string): string {
    if (this.options.preserveMarkdown) return text.trim();
    return text
      .replace(/==/g, "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .trim();
  }

  private getNextVersion(ku: KnowledgeUnit): number {
    return (ku.projections?.literal?.version ?? 0) + 1;
  }
}
