// RemiFocus — KU 可塑性层（学习反馈回路）
// 当用户做对/做错卡片时，将学习结果反向回写到关联的 KU
// 实现闭环：学习结果 → KU 统计更新 → 调度优先级调整

import { KnowledgeUnit, KUId } from "../../models/knowledge-unit";
import { KUStore } from "../../resolver/ku-store";
import { ReviewResult } from "../../models/card";

// ─── 配置 ───

export interface KUPlasticityConfig {
  /** 高错误率阈值（超过此值提升 KU importance） */
  highErrorThreshold: number;
  /** 每次错误增加的 importance 量 */
  errorImportanceBoost: number;
  /** 持续正确后降低 importance 的速度 */
  successImportanceDecay: number;
  /** 最小 importance 下限 */
  minImportance: number;
  /** 最大 importance 上限 */
  maxImportance: number;
}

const DEFAULT_CONFIG: KUPlasticityConfig = {
  highErrorThreshold: 0.3,
  errorImportanceBoost: 0.05,
  successImportanceDecay: 0.01,
  minImportance: 0.3,
  maxImportance: 1.0,
};

// ─── Plasticity Layer ───

export class KUPlasticityLayer {
  private kuStore: KUStore;
  private config: KUPlasticityConfig;

  /** 统计缓存 */
  private statsSummary = {
    totalUpdates: 0,
    totalErrors: 0,
    totalSuccesses: 0,
  };

  constructor(kuStore: KUStore, config?: Partial<KUPlasticityConfig>) {
    this.kuStore = kuStore;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 处理学习结果 → 触发 KU 回写
   *
   * @param kuId 关联的 KU ID（来自 card.kuId）
   * @param result 学习结果（'again'|'hard'|'good'|'easy'）
   * @param currentEase 卡片当前的 ease 值
   */
  async processLearningResult(
    kuId: KUId | undefined,
    result: ReviewResult,
    currentEase: number
  ): Promise<void> {
    if (!kuId) return; // 没有关联 KU 的卡片不处理

    const isError = result === "again" || result === "hard";

    if (isError) {
      await this.onCardError(kuId, currentEase);
    } else {
      await this.onCardSuccess(kuId, currentEase);
    }
  }

  /**
   * 当用户做错某张卡片时
   */
  async onCardError(kuId: KUId, currentEase: number): Promise<void> {
    const ku = await this.kuStore.get(kuId);
    if (!ku) return;

    // 更新学习统计
    ku.learningStats.totalErrors++;
    ku.learningStats.totalReviews++;
    ku.learningStats.errorRate =
      ku.learningStats.totalErrors / Math.max(1, ku.learningStats.totalReviews);
    ku.learningStats.lastReviewed = new Date().toISOString();

    // 更新 avgEase（加权移动平均）
    ku.learningStats.avgEase = ku.learningStats.avgEase > 0
      ? (ku.learningStats.avgEase * 0.7 + currentEase * 0.3)
      : currentEase;

    // 如果错误率超过阈值，提升 KU 重要性
    if (ku.learningStats.errorRate > this.config.highErrorThreshold) {
      ku.importance = Math.min(
        this.config.maxImportance,
        ku.importance + this.config.errorImportanceBoost
      );
    }

    // 记录 confusion tag（基于卡片内容推断）
    // 实际应用中，可以由 AI 或用户手动标注
    if (ku.learningStats.errorRate > 0.5) {
      const confusionTag = "high_error_rate";
      if (!ku.learningStats.confusionTags.includes(confusionTag)) {
        ku.learningStats.confusionTags.push(confusionTag);
      }
    }

    ku.updatedAt = new Date().toISOString();
    await this.kuStore.put(ku);

    this.statsSummary.totalUpdates++;
    this.statsSummary.totalErrors++;
  }

  /**
   * 当用户做对卡片时
   */
  async onCardSuccess(kuId: KUId, currentEase: number): Promise<void> {
    const ku = await this.kuStore.get(kuId);
    if (!ku) return;

    // 更新学习统计
    ku.learningStats.totalReviews++;
    ku.learningStats.lastReviewed = new Date().toISOString();

    // 更新 avgEase
    ku.learningStats.avgEase = ku.learningStats.avgEase > 0
      ? (ku.learningStats.avgEase * 0.7 + currentEase * 0.3)
      : currentEase;

    // 维持或轻微降低 importance（知识点已掌握）
    if (ku.learningStats.errorRate < 0.1 && ku.importance > this.config.minImportance) {
      ku.importance = Math.max(
        this.config.minImportance,
        ku.importance - this.config.successImportanceDecay
      );
    }

    // 如果错误率很低，移除 confusion tag
    if (ku.learningStats.errorRate < 0.2) {
      ku.learningStats.confusionTags = ku.learningStats.confusionTags.filter(
        (t) => t !== "high_error_rate"
      );
    }

    ku.updatedAt = new Date().toISOString();
    await this.kuStore.put(ku);

    this.statsSummary.totalUpdates++;
    this.statsSummary.totalSuccesses++;
  }

  /**
   * 批量处理多个学习结果
   */
  async batchProcess(
    results: Array<{
      kuId: KUId | undefined;
      result: ReviewResult;
      ease: number;
    }>
  ): Promise<{ updated: number; errors: number }> {
    for (const r of results) {
      await this.processLearningResult(r.kuId, r.result, r.ease);
    }
    return {
      updated: this.statsSummary.totalUpdates,
      errors: this.statsSummary.totalErrors,
    };
  }

  /**
   * 获取可塑性层的统计
   */
  getStats() {
    return { ...this.statsSummary };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.statsSummary = { totalUpdates: 0, totalErrors: 0, totalSuccesses: 0 };
  }
}
