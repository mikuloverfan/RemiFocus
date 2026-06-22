// RemiFocus — KU 稳定性层
// 防止 AI 漂移：定义 KU 什么情况下"必须保持不变"

import { KnowledgeUnit, StabilityConfig, LockMode } from "../models/knowledge-unit";

export type Actor = "user" | "ai" | "system";

// ─── 稳定性守卫 ───

export class KUStabilityGuard {
  /**
   * 检查是否允许修改 KU 的指定字段
   */
  canModify(
    ku: KnowledgeUnit,
    field: string,
    actor: Actor
  ): { allowed: boolean; reason: string } {
    const s = ku.stability;

    // strict 模式：只有用户能修改
    if (s.lockMode === "strict" && actor !== "user") {
      return {
        allowed: false,
        reason: `KU ${ku.id} 处于 strict 锁定状态，仅用户可修改`,
      };
    }

    // 检查受保护字段
    if (s.protectedFields.includes(field as any)) {
      return {
        allowed: false,
        reason: `字段 "${field}" 受保护，不可修改`,
      };
    }

    // AI 重写策略
    if (actor === "ai") {
      if (!s.rewritePolicy.allowAIRewrite) {
        return {
          allowed: false,
          reason: "AI 重写被禁用",
        };
      }
      if (s.rewritePolicy.onlyCompressionView && field !== "projections.compression") {
        return {
          allowed: false,
          reason: "AI 只能修改 compression 投影",
        };
      }
    }

    return { allowed: true, reason: "ok" };
  }

  /**
   * 锁定 KU — 进入 strict 模式
   */
  lock(ku: KnowledgeUnit): KnowledgeUnit {
    return {
      ...ku,
      stability: {
        ...ku.stability,
        lockMode: "strict",
        lockedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 解锁 KU — 回到 semi 模式
   */
  unlock(ku: KnowledgeUnit): KnowledgeUnit {
    return {
      ...ku,
      stability: {
        ...ku.stability,
        lockMode: "semi",
        lockedAt: undefined,
      },
    };
  }

  /**
   * 更新稳定性配置
   */
  updateConfig(
    ku: KnowledgeUnit,
    updates: Partial<StabilityConfig>
  ): KnowledgeUnit {
    return {
      ...ku,
      stability: { ...ku.stability, ...updates },
    };
  }

  /**
   * 获取人类可读的锁定状态
   */
  getStatusText(ku: KnowledgeUnit): string {
    switch (ku.stability.lockMode) {
      case "strict":
        return "🔒 已锁定 — 不可修改";
      case "semi":
        return "🔐 半锁定 — AI 可改投影，不可改结构";
      case "flex":
        return "🔓 灵活 — AI 可优化（需用户确认）";
    }
  }
}
