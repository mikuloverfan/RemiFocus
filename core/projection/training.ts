// RemiFocus — Training View（训练视图生成器）
// 将 KU 转换为训练调度所需的元数据
// 为 FSRS/SM-2 调度算法提供数据

import { KnowledgeUnit } from "../../models/knowledge-unit";

// ─── 训练视图类型 ───

export interface TrainingView {
  kuId: string;
  /** 调度优先级（基于 importance + errorRate） */
  schedulingPriority: number;
  /** 建议的学习模式 */
  suggestedMode: "exposure" | "test" | "review";
  /** 建议的初始 ease */
  suggestedEase: number;
  /** 所需的最小卡片数 */
  minimumCardsRequired: number;
  /** 标签聚合 */
  tags: string[];
  /** 卡片 key 建议列表 */
  suggestedWordKeys: string[];
  /** 生成时间 */
  generatedAt: string;
  /** 种子（确定性） */
  seed: string;
}

export interface TrainingProjectorOptions {
  /** 新建 KU 的默认 ease */
  defaultEase: number;
  /** 高错误率阈值 */
  highErrorThreshold: number;
}

const DEFAULT_OPTIONS: TrainingProjectorOptions = {
  defaultEase: 250,
  highErrorThreshold: 0.3,
};

export class TrainingProjector {
  private options: TrainingProjectorOptions;

  constructor(options?: Partial<TrainingProjectorOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 从 KU 生成训练视图
   */
  project(ku: KnowledgeUnit): TrainingView {
    const stats = ku.learningStats;
    const importance = ku.importance;

    // 计算调度优先级
    const schedulingPriority = this.calcSchedulingPriority(importance, stats.errorRate);

    // 建议学习模式
    const suggestedMode = this.suggestMode(stats);

    // 建议 ease
    const suggestedEase = stats.avgEase > 0 ? stats.avgEase : this.options.defaultEase;

    // 建议卡片 key
    const suggestedWordKeys = this.generateSuggestedWordKeys(ku);

    return {
      kuId: ku.id,
      schedulingPriority,
      suggestedMode,
      suggestedEase,
      minimumCardsRequired: this.calcMinimumCards(ku.structure),
      tags: ku.tags,
      suggestedWordKeys,
      generatedAt: new Date().toISOString(),
      seed: `${ku.id}_training_v1`,
    };
  }

  /**
   * 计算调度优先级（0-100）
   *
   * 公式：
   *   base = importance * 100
   *   errorBonus = errorRate * 50（错误多=需要更多练习）
   *   priority = base + errorBonus
   *
   * 结果会在 0-100 范围内
   */
  private calcSchedulingPriority(importance: number, errorRate: number): number {
    const base = importance * 70;           // 重要性权重 70%
    const errorBonus = errorRate * 30;      // 错误率权重 30%
    const priority = Math.round(base + errorBonus);
    return Math.max(0, Math.min(100, priority));
  }

  /**
   * 根据学习统计建议模式
   */
  private suggestMode(stats: {
    totalReviews: number;
    errorRate: number;
    lastReviewed: string | null;
  }): "exposure" | "test" | "review" {
    if (stats.totalReviews === 0) {
      // 从未复习 → 初次学习
      return "exposure";
    }

    if (stats.errorRate > this.options.highErrorThreshold) {
      // 错误率过高 → 回到测试模式
      return "test";
    }

    // 已经学习过且错误率可接受 → 复习模式
    return "review";
  }

  /**
   * 计算该 KU 需要的最少卡片数
   */
  private calcMinimumCards(structure: string): number {
    switch (structure) {
      case "big-cloze":
        return 2;   // cloze + mnemonic
      case "small-vocab":
        return 1;   // QA
      case "table":
        return 2;   // 至少两行
      case "paragraph":
        return 1;   // 至少一个 cloze
      default:
        return 1;
    }
  }

  /**
   * 从 KU 生成建议的卡片 key 列表
   */
  private generateSuggestedWordKeys(ku: KnowledgeUnit): string[] {
    const keys: string[] = [];

    // 从 canonical text 生成 key
    const canonicalKey = this.toKey(ku.canonical.text);
    if (canonicalKey) keys.push(canonicalKey);

    // 从 identity 生成 key
    if (ku.identity?.canonicalKey) {
      keys.push(ku.identity.canonicalKey);
    }

    // 从 anchor terms 生成 key
    if (ku.identity?.anchorTerms) {
      for (const term of ku.identity.anchorTerms.slice(0, 3)) {
        const key = this.toKey(term);
        if (key && !keys.includes(key)) keys.push(key);
      }
    }

    return keys;
  }

  private toKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 50);
  }
}
