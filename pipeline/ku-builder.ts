// RemiFocus — KU 构建器
// 将 DSL Executor 提取的 ExtractedKU 组装为完整的 KnowledgeUnit
// 包含 identity、stability、dedup 等元数据

import { KnowledgeUnit, KUId, DEFAULT_STABILITY } from "../models/knowledge-unit";
import { ExtractedKU } from "../core/dsl/executor";

// ─── ID 生成 ───

let _kuIdCounter = 0;

export function generateKUId(): KUId {
  _kuIdCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `ku_${ts}${rand}`;
}

// ─── 构建器 ───

export interface KUBuilderOptions {
  /** 默认知识领域（当 DSL 未指定时） */
  defaultDomain?: string;
}

const DEFAULT_OPTIONS: KUBuilderOptions = {
  defaultDomain: "general",
};

export class KUBuilder {
  private options: KUBuilderOptions;

  constructor(options?: KUBuilderOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 从 ExtractedKU 构建完整的 KnowledgeUnit
   */
  build(extracted: ExtractedKU): KnowledgeUnit {
    const now = new Date().toISOString();
    const id = generateKUId();

    // 构建规范文本（优先从 fields 拼接）
    const canonicalText = this.buildCanonicalText(extracted);

    // 提取 anchor terms
    const anchorTerms = this.extractAnchorTerms(extracted);

    return {
      id,

      canonical: {
        text: canonicalText,
        confidence: extracted.structure === "paragraph" ? 0.5 : 0.8,
      },

      sources: [
        {
          notePath: extracted.sourceNote,
          blockId: extracted.source.blockId,
          lineStart: extracted.source.lineStart,
          lineEnd: extracted.source.lineEnd,
          rawText: extracted.rawText,
        },
      ],

      rawVariants: [
        {
          text: extracted.rawText,
          sourceNote: extracted.sourceNote,
          blockId: extracted.source.blockId,
        },
      ],

      structure: extracted.structure as any,
      tags: extracted.tags,

      relations: [],

      stability: { ...DEFAULT_STABILITY },

      dedup: {
        signature: this.computeSignature(extracted),
        mergeHistory: [],
      },

      // ─── v1.1 新增字段 ───

      identity: {
        canonicalKey: extracted.canonicalKeyHint ?? this.inferCanonicalKey(extracted),
        domain: extracted.domain ?? this.options.defaultDomain ?? "general",
        anchorTerms,
        lang: this.detectLanguage(extracted.rawText),
      },

      learningStats: {
        avgEase: 250,
        errorRate: 0,
        lastReviewed: null,
        confusionTags: [],
        totalReviews: 0,
        totalErrors: 0,
      },

      projections: {},

      importance: extracted.structure === "paragraph" ? 0.3 : 0.7,
      createdAt: now,
      updatedAt: now,
    } as KnowledgeUnit;
  }

  /**
   * 构建规范文本
   */
  private buildCanonicalText(extracted: ExtractedKU): string {
    // 优先使用特定字段
    const priorityFields = ["concept", "front", "word", "term", "core"];
    for (const fieldName of priorityFields) {
      const field = extracted.fields.find((f) => f.name === fieldName);
      if (field && field.value.length > 3) {
        return field.value;
      }
    }

    // 拼接所有字段
    const parts = extracted.fields
      .filter((f) => f.value.length > 0)
      .map((f) => f.value);

    if (parts.length > 0) {
      return parts.join(" — ");
    }

    // 兜底：使用原始文本
    return extracted.rawText.slice(0, 200);
  }

  /**
   * 计算关键词签名（用于去重）
   */
  private computeSignature(extracted: ExtractedKU): string {
    const text = extracted.rawText
      .replace(/[#*_~`\[\]()]/g, "")
      .replace(/==/g, "")
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    // 提取中英文关键词
    const keywords = text.match(/[A-Za-z]{2,}|[一-龥]{2,}/g) ?? [];
    return [...new Set(keywords)].sort().join("_").slice(0, 200);
  }

  /**
   * 提取 anchor terms（稳定关键词集合）
   */
  private extractAnchorTerms(extracted: ExtractedKU): string[] {
    const text = extracted.rawText;
    const terms: string[] = [];

    // 提取英文术语（>=3字母）
    const engTerms = text.match(/\b[A-Za-z]{3,}\b/g);
    if (engTerms) terms.push(...engTerms.map((t) => t.toLowerCase()));

    // 提取中文术语（>=2字）
    const zhTerms = text.match(/[一-龥]{2,}/g);
    if (zhTerms) terms.push(...zhTerms);

    // 去重 + 排序
    return [...new Set(terms)].sort().slice(0, 10);
  }

  /**
   * 推断 canonicalKey
   */
  private inferCanonicalKey(extracted: ExtractedKU): string {
    // 如果有 canonicalKeyHint，直接使用
    if (extracted.canonicalKeyHint) {
      return extracted.canonicalKeyHint.toLowerCase().replace(/\s+/g, "_");
    }

    // 从 anchor terms 取前 2 个
    const terms = this.extractAnchorTerms(extracted);
    if (terms.length >= 2) {
      return terms.slice(0, 2).join("_");
    }
    if (terms.length === 1) {
      return terms[0];
    }

    // 兜底：使用 ID
    return `ku_${Date.now()}`;
  }

  /**
   * 检测文本语言
   */
  private detectLanguage(text: string): "zh" | "en" | "mixed" {
    const zhCount = (text.match(/[一-龥]/g) ?? []).length;
    const enCount = (text.match(/[A-Za-z]/g) ?? []).length;

    if (zhCount > 0 && enCount > 0) return "mixed";
    if (zhCount > 0) return "zh";
    return "en";
  }
}
