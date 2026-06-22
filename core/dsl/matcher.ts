// RemiFocus — DSL 规则匹配器
// 对笔记块逐一匹配 DSL 规则，返回匹配结果列表

import { DSLRule, MatchedRule, DSLMatchType } from "./types";

// ─── 笔记块类型（Block Splitter 输出） ───

export interface NoteBlock {
  /** 块类型 */
  type: "heading" | "list" | "table" | "paragraph" | "code" | "quote";
  /** 块内的原始行 */
  lines: string[];
  /** 块内的完整文本 */
  text: string;
  /** 起始行号（0-based） */
  startLine: number;
  /** 结束行号 */
  endLine: number;
  /** 如果是标题块，heading 内容 */
  heading?: string;
  /** heading 级别（1-6） */
  headingLevel?: number;
}

// ─── 匹配器 ───

export class DSLMatcher {
  /**
   * 对单个笔记块匹配合适的 DSL 规则
   * 返回所有匹配的规则（含匹配得分）
   */
  match(block: NoteBlock, rules: DSLRule[]): MatchedRule[] {
    const matched: MatchedRule[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const result = this.matchSingle(block, rule);
      if (result) {
        matched.push(result);
      }
    }

    return matched;
  }

  /**
   * 匹配单个规则
   */
  private matchSingle(block: NoteBlock, rule: DSLRule): MatchedRule | null {
    // 规则的所有 match 条件必须全部满足（AND 逻辑）
    for (const matchRule of rule.match) {
      if (!this.evaluateCondition(block, matchRule.type, matchRule)) {
        return null;
      }
    }

    // 计算匹配得分
    const score = this.calculateScore(block, rule);

    return {
      rule,
      score,
      details: `block type=${block.type} matched by rule=${rule.rule}`,
    };
  }

  /**
   * 评估单个匹配条件
   */
  private evaluateCondition(
    block: NoteBlock,
    matchType: DSLMatchType,
    matchRule: any
  ): boolean {
    switch (matchType) {
      case "regex": {
        if (!matchRule.pattern) return false;
        try {
          const regex = new RegExp(matchRule.pattern, "m");
          return regex.test(block.text);
        } catch {
          return false;
        }
      }

      case "heading": {
        if (block.type !== "heading") return false;
        if (matchRule.pattern) {
          try {
            return new RegExp(matchRule.pattern).test(block.heading ?? "");
          } catch {
            return false;
          }
        }
        return true;
      }

      case "heading_contains": {
        if (block.type !== "heading") return false;
        if (matchRule.heading_contains) {
          return (block.heading ?? "").includes(matchRule.heading_contains);
        }
        return false;
      }

      case "heading_regex": {
        if (block.type !== "heading") return false;
        if (matchRule.heading_regex) {
          try {
            return new RegExp(matchRule.heading_regex).test(block.heading ?? "");
          } catch {
            return false;
          }
        }
        return false;
      }

      case "block_type": {
        const targetType = matchRule.block_type;
        if (!targetType) return false;
        // 支持段落匹配多种类型
        if (targetType === "paragraph") {
          return block.type === "paragraph";
        }
        return block.type === targetType;
      }

      case "tag": {
        // 标签匹配需要 frontmatter 信息，由调用方提供
        // 此处返回 false，由 NoteProcessor 在更高层级处理
        return false;
      }

      default:
        return false;
    }
  }

  /**
   * 计算匹配得分（用于冲突解决时的优先级参考）
   */
  private calculateScore(_block: NoteBlock, rule: DSLRule): number {
    // 基础分 = priority / 100
    let score = rule.priority / 100;

    // exclusive 规则额外加分（确保优先级更高）
    if (rule.exclusive) score += 0.1;

    // fallback 规则减分
    if (rule.fallback) score -= 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 快速检测：笔记是否有任何潜在可匹配内容
   * 用于跳过完全无结构的笔记
   */
  hasMatchableContent(text: string): boolean {
    // 检测常见模式
    const patterns = [
      /^\s*[-*]\s+\S/m,       // 列表项
      /^#+\s+/m,               // 标题
      /^\s*\|.+\|$/m,          // 表格
      /==.+==/,                // 高亮
      /\*\*.+\*\*/,            // 加粗
    ];

    return patterns.some((p) => p.test(text));
  }
}
