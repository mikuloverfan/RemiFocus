// RemiFocus — DSL 规则冲突解析器
// 当一个 block 命中多个规则时，决定最终执行策略
//
// 冲突解决策略：
// 1. fallback 规则仅当无其他规则匹配时才触发
// 2. exclusive:true 的规则 → 只执行优先级最高的那条
// 3. 全部非 exclusive → 允许多规则并行（生成多个 KU candidate）

import { DSLRule, MatchedRule, ResolvedRule } from "./types";
import { NoteBlock } from "./matcher";

// ─── 冲突解析器 ───

export class RuleConflictResolver {
  /**
   * 当多个规则命中同一个 block 时，确定最终执行策略
   *
   * @param matchedRules 所有匹配的规则
   * @param block 原始笔记块
   * @returns 解析后的执行计划
   */
  resolve(matchedRules: MatchedRule[], block: NoteBlock): ResolvedRule[] {
    if (matchedRules.length === 0) {
      return [];
    }

    const rules = matchedRules.map((m) => m.rule);

    // Step 1: 分离 fallback 和非 fallback
    const nonFallback = rules.filter((r) => !r.fallback);
    const fallbackRules = rules.filter((r) => r.fallback);

    if (nonFallback.length === 0) {
      // 只有 fallback 规则命中 → 全部执行
      return this.resolveFallback(fallbackRules);
    }

    // Step 2: 检查是否存在 exclusive 规则
    const exclusive = nonFallback.filter((r) => r.exclusive);
    if (exclusive.length > 0) {
      // 只执行优先级最高的 exclusive 规则
      const top = exclusive.sort((a, b) => b.priority - a.priority)[0];
      const result: ResolvedRule[] = [{ rule: top, action: "execute" }];

      // 标记其他规则为 blocked
      for (const r of rules) {
        if (r.id !== top.id) {
          result.push({ rule: r, action: "blocked" });
        }
      }

      return result;
    }

    // Step 3: 全部非 exclusive → 多规则并行
    const result: ResolvedRule[] = nonFallback.map((r) => ({
      rule: r,
      action: "execute" as const,
    }));

    // fallback 规则被跳过
    for (const r of fallbackRules) {
      result.push({ rule: r, action: "fallback_skipped" });
    }

    return result;
  }

  /**
   * 解析只有 fallback 规则的情况
   */
  private resolveFallback(fallbackRules: DSLRule[]): ResolvedRule[] {
    if (fallbackRules.length === 0) return [];

    // fallback 规则之间：exclusive 优先，否则全执行
    const exclusive = fallbackRules.filter((r) => r.exclusive);
    if (exclusive.length > 0) {
      const top = exclusive.sort((a, b) => b.priority - a.priority)[0];
      return [{ rule: top, action: "execute" }];
    }

    return fallbackRules.map((r) => ({ rule: r, action: "execute" }));
  }

  /**
   * 获取最终可执行的规则列表（过滤掉 blocked 和 fallback_skipped）
   */
  getExecutable(resolved: ResolvedRule[]): DSLRule[] {
    return resolved
      .filter((r) => r.action === "execute")
      .map((r) => r.rule);
  }

  /**
   * 生成冲突解决的人类可读报告
   */
  generateReport(matchedRules: MatchedRule[], resolved: ResolvedRule[]): string {
    const lines: string[] = [];
    lines.push("── DSL 规则冲突解决报告 ──");

    for (const mr of matchedRules) {
      const resolvedRule = resolved.find((r) => r.rule.id === mr.rule.id);
      const action = resolvedRule?.action ?? "unknown";
      const actionLabel = this.actionLabel(action);
      lines.push(`  ${actionLabel} ${mr.rule.rule} (priority=${mr.rule.priority}, exclusive=${mr.rule.exclusive}, fallback=${mr.rule.fallback})`);
    }

    lines.push("── ──");
    return lines.join("\n");
  }

  private actionLabel(action: string): string {
    switch (action) {
      case "execute": return "✅ EXECUTE";
      case "blocked": return "⛔ BLOCKED";
      case "fallback_skipped": return "⏭️ SKIP (fallback)";
      default: return "❓ UNKNOWN";
    }
  }
}
