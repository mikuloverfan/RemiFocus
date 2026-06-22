// RemiFocus — 四层去重引擎（v1.1 升级）
// Level 0: canonicalKey 匹配（新增，最高优先级，硬绑定）
// Level 1: 规则去重（免费）
// Level 2: 语义向量（核心）
// Level 3: LLM 判定（边界）

import { KnowledgeUnit, KUId, KUStableIdentity } from "../models/knowledge-unit";
import { KUDatabase } from "../storage/ku-database";
import { KUStagingPool } from "./ku-staging";
import { EmbeddingService } from "./embedding";
import { KUExtractor, ExtractedKU } from "./ku-extractor";

// ─── 去重结果类型 ───

export type DedupAction =
  | { type: "canonical_merge"; targetKu: KnowledgeUnit; score: 1.0 } // 新增
  | { type: "exact_merge"; targetKu: KnowledgeUnit; score: 1.0 }
  | { type: "signature_merge"; targetKu: KnowledgeUnit; score: 0.98 }
  | { type: "vector_merge"; targetKu: KnowledgeUnit; score: number }
  | { type: "staged"; stageId: string; candidates: Array<{ kuId: KUId; score: number }> }
  | { type: "new_ku" }
  | { type: "llm_merge"; targetKu: KnowledgeUnit; canonical: string; reason: string };

// ─── LLM 判定接口 ───

export interface LLMJudgeService {
  shouldMerge(
    kuA: string,
    kuB: string
  ): Promise<{ merge: boolean; canonical?: string; reason: string }>;
}

// ─── 四层去重引擎 ───

export class KUDedupEngine {
  private db: KUDatabase;
  private stagingPool: KUStagingPool;
  private embeddingService: EmbeddingService | null;
  private llmJudge: LLMJudgeService | null;

  constructor(
    db: KUDatabase,
    stagingPool: KUStagingPool,
    embeddingService?: EmbeddingService,
    llmJudge?: LLMJudgeService
  ) {
    this.db = db;
    this.stagingPool = stagingPool;
    this.embeddingService = embeddingService ?? null;
    this.llmJudge = llmJudge ?? null;
  }

  // ════════════════════════════════════════
  //  Level 0: canonicalKey 匹配（v1.1 新增）
  // ════════════════════════════════════════

  /**
   * canonicalKey 硬绑定匹配 — 最高优先级
   *
   * 两个 KU 的 anchorTerms 完全相同 → 100% 同一知识
   * 示例: "颈动脉体" 和 "carotid body" 都可映射到 canonicalKey "carotid_body"
   *
   * @param anchorTerms 新 KU 的 anchor terms（如 ["carotid", "body", "颈动脉体"]）
   * @param existingKUs 已有 KU 列表
   * @returns 匹配的 KU 或 null
   */
  canonicalKeyMatch(
    anchorTerms: string[],
    existingKUs: KnowledgeUnit[]
  ): KnowledgeUnit | null {
    const normalized = anchorTerms
      .map((t) => this.normalize(t))
      .filter(Boolean)
      .sort();

    for (const ku of existingKUs) {
      if (!ku.identity || ku.identity.anchorTerms.length === 0) continue;

      const existing = ku.identity.anchorTerms
        .map((t) => this.normalize(t))
        .filter(Boolean)
        .sort();

      // 要求至少 2 个 anchor term 匹配且长度相同
      if (normalized.length < 2 || existing.length < 2) continue;
      if (normalized.length !== existing.length) continue;

      // 规范化后精确比较
      if (JSON.stringify(normalized) === JSON.stringify(existing)) {
        return ku;
      }
    }

    return null;
  }

  // ════════════════════════════════════════
  //  Level 1: 规则去重
  // ════════════════════════════════════════

  /**
   * 文本归一化：去 markdown 符号、标点、空格
   */
  normalize(text: string): string {
    return text
      .replace(/[#*_~`\[\]()]/g, "")              // 去 markdown 符号
      .replace(/[，。！？、；：""''（）《》【】]/g, "") // 去中文标点
      .replace(/[,.!?;:'"()\[\]{}]/g, "")         // 去英文标点
      .replace(/==/g, "")                          // 去 highlight
      .replace(/\*\*/g, "")                        // 去 bold
      .replace(/\s+/g, " ")                        // 合并空格
      .trim()
      .toLowerCase();
  }

  /**
   * 关键词签名：提取中英文关键词，排序后拼接
   */
  keywordSignature(text: string): string {
    const normalized = this.normalize(text);
    const keywords = normalized.match(/[A-Za-z]+|[一-龥]{2,}/g) ?? [];
    return [...new Set(keywords)].sort().join("_");
  }

  /**
   * 精确匹配（归一化后完全相同）
   */
  exactMatch(
    rawText: string,
    existingKUs: KnowledgeUnit[]
  ): KnowledgeUnit | null {
    const normalized = this.normalize(rawText);
    for (const ku of existingKUs) {
      if (this.normalize(ku.canonical.text) === normalized) {
        return ku;
      }
    }
    return null;
  }

  /**
   * 签名匹配（关键词签名相同）
   */
  signatureMatch(
    rawText: string,
    existingKUs: KnowledgeUnit[]
  ): KnowledgeUnit | null {
    const sig = this.keywordSignature(rawText);
    for (const ku of existingKUs) {
      if (ku.dedup.signature === sig) {
        return ku;
      }
    }
    return null;
  }

  // ════════════════════════════════════════
  //  Level 2: 语义向量
  // ════════════════════════════════════════

  /**
   * 向量搜索相似 KU
   */
  async vectorSearch(
    rawText: string,
    topK: number = 5,
    threshold: number = 0.85
  ): Promise<Array<{ kuId: KUId; score: number }>> {
    if (!this.embeddingService) return [];

    try {
      const queryVector = await this.embeddingService.embed(rawText);
      return this.db.searchSimilar(queryVector, topK, threshold);
    } catch (err) {
      console.error("[KUDedup] Vector search failed:", err);
      return [];
    }
  }

  // ════════════════════════════════════════
  //  Level 3: LLM 判定
  // ════════════════════════════════════════

  /**
   * LLM 判定两个 KU 是否应合并
   */
  async llmJudgeMerge(
    kuA: string,
    kuB: string
  ): Promise<{ merge: boolean; canonical?: string; reason: string }> {
    if (!this.llmJudge) {
      return { merge: false, reason: "LLM judge service not available" };
    }
    return this.llmJudge.shouldMerge(kuA, kuB);
  }

  // ════════════════════════════════════════
  //  完整四层去重流水线（v1.1 升级）
  // ════════════════════════════════════════

  /**
   * 执行完整的四层去重流水线
   *
   * 去重层级（按优先级）：
   *   Level 0: canonicalKey 硬绑定 ← 新增
   *   Level 1: exactMatch (归一化文本)
   *   Level 2: signatureMatch (关键词签名)
   *   Level 3: vectorSearch (语义向量)
   *   Level 4: LLM Judge (AI 判定)
   *
   * @param rawText  新提取的 KU 原始文本
   * @param sourceNote 来源笔记路径
   * @param blockId  来源块 ID
   * @param identity 新 KU 的身份信息（可选，用于 Level 0）
   * @returns 去重结果 + 操作建议
   */
  async deduplicate(
    rawText: string,
    sourceNote: string,
    blockId: string,
    identity?: KUStableIdentity   // v1.1 新增参数
  ): Promise<DedupAction> {
    const existingKUs = await this.db.getAllKUs();

    // ── Level 0: canonicalKey 匹配 ──
    if (identity && identity.anchorTerms.length > 0) {
      const canonicalMatch = this.canonicalKeyMatch(identity.anchorTerms, existingKUs);
      if (canonicalMatch) {
        return { type: "canonical_merge", targetKu: canonicalMatch, score: 1.0 };
      }
    }

    // ── Level 1: 规则去重 ──
    const exact = this.exactMatch(rawText, existingKUs);
    if (exact) {
      return { type: "exact_merge", targetKu: exact, score: 1.0 };
    }

    const sig = this.keywordSignature(rawText);
    const sigMatch = this.signatureMatch(rawText, existingKUs);
    if (sigMatch) {
      return { type: "signature_merge", targetKu: sigMatch, score: 0.98 };
    }

    // ── Level 2: 向量搜索 ──
    const vectorResults = await this.vectorSearch(rawText);
    if (vectorResults.length > 0) {
      const best = vectorResults[0];

      if (best.score > 0.95) {
        // 高置信度 → 自动合并
        const targetKu = await this.db.getKU(best.kuId);
        if (targetKu) {
          return { type: "vector_merge", targetKu, score: best.score };
        }
      }

      if (best.score > 0.85) {
        // 中等置信度 → 进入暂存区
        const stage = await this.stagingPool.stage(
          rawText,
          sourceNote,
          blockId,
          sig,
          vectorResults
        );
        return {
          type: "staged",
          stageId: stage.id,
          candidates: vectorResults,
        };
      }
    }

    // ── 无匹配 → 新建 KU ──
    return { type: "new_ku" };
  }

  /**
   * 处理暂存区中的条目（触发 LLM 判定）
   */
  async processStagedItem(
    stageId: string,
    rawText: string,
    candidates: Array<{ kuId: KUId; score: number }>
  ): Promise<DedupAction> {
    if (candidates.length === 0 || !this.llmJudge) {
      await this.stagingPool.resolve(stageId, "reject");
      return { type: "new_ku" };
    }

    const bestCandidate = candidates[0];
    const targetKu = await this.db.getKU(bestCandidate.kuId);

    if (!targetKu) {
      await this.stagingPool.resolve(stageId, "reject");
      return { type: "new_ku" };
    }

    try {
      const judgment = await this.llmJudgeMerge(rawText, targetKu.canonical.text);

      if (judgment.merge) {
        await this.stagingPool.resolve(stageId, "merge", targetKu.id, judgment.canonical);
        return {
          type: "llm_merge",
          targetKu,
          canonical: judgment.canonical ?? targetKu.canonical.text,
          reason: judgment.reason,
        };
      } else {
        await this.stagingPool.resolve(stageId, "reject");
        return { type: "new_ku" };
      }
    } catch (err) {
      console.error(`[KUDedup] LLM judge failed for ${stageId}:`, err);
      await this.stagingPool.resolve(stageId, "reject");
      return { type: "new_ku" };
    }
  }

  /**
   * 为新的 KU 生成关键词签名
   */
  computeSignature(rawText: string): string {
    return this.keywordSignature(rawText);
  }
}
