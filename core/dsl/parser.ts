// RemiFocus — DSL YAML 规则解析器
// 将 YAML 规则文件解析为 DSLRule 对象的数组
// 支持内置规则（代码内）和用户自定义规则（YAML 文件）

import {
  DSLRule,
  DSLMatchRule,
  DSLAction,
  DSLOutputConfig,
  DSLMatchType,
  DSLExtractSource,
  BUILTIN_RULE_PRIORITIES,
  DEFAULT_RULE_PRIORITY,
  DEFAULT_RULE_EXCLUSIVE,
  DEFAULT_RULE_FALLBACK,
} from "./types";

// ─── 解析结果 ───

export interface ParseResult {
  rules: DSLRule[];
  errors: string[];
}

// ─── 内置规则定义（YAML 字符串，编译时内置） ───

// 注意：在 Obsidian 插件中不使用外部 YAML 库，
// 而是用轻量 JSON + 少量 YAML 兼容逻辑
// 如果用户有复杂 YAML 需求，可引入 js-yaml

const BUILTIN_RULES_YAML = `
- rule: vocab_highlight
  description: "提取高亮标记的词汇"
  match:
    - type: regex
      pattern: "- ==.*==:"
  action:
    extract:
      front: { source: highlight_word }
      meaning: { source: after_colon }
  output:
    structure: small-vocab
    tags: [vocabulary]

- rule: vocab_bold
  description: "提取加粗标记的词汇"
  match:
    - type: regex
      pattern: "- \\*\\*.*\\*\\*:"
  action:
    extract:
      front: { source: bold_word }
      meaning: { source: after_colon }
  output:
    structure: small-vocab
    tags: [vocabulary]

- rule: rule_card
  description: "提取【看到啥】→【想到啥】结构的规则卡片"
  match:
    - type: heading_contains
      heading_contains: "看到啥"
  action:
    extract:
      concept: { source: heading }
      core: { source: section, section_name: "想到啥" }
      wrong: { source: section, section_name: "别选啥" }
      mnemonic: { source: section, section_name: "记住啥" }
  output:
    structure: big-cloze
    tags: [rule]

- rule: comparison_table
  description: "将对比表格按行提取为卡片"
  match:
    - type: block_type
      block_type: table
  action:
    split_rows: true
    map_columns:
      left: A
      right: B
  output:
    structure: table
    tags: [comparison]

- rule: simple_list
  description: "提取简单的 term: definition 格式"
  match:
    - type: regex
      pattern: "- .+:"
  action:
    extract:
      front: { source: line_content }
      meaning: { source: after_colon }
  output:
    structure: small-vocab
    tags: [list]

- rule: paragraph
  description: "段落兜底规则，提取普通段落文本"
  match:
    - type: block_type
      block_type: paragraph
  action:
    extract:
      content: { source: line_content }
  output:
    structure: paragraph
    tags: [paragraph]
`;

// ─── 简单 YAML 解析器（不依赖外部库） ───
// 解析上述简化 YAML 格式
// 注意：这不是完整 YAML 解析器，只支持 DSL 所需的子集

export class DSLParser {
  /**
   * 解析内置规则
   */
  parseBuiltinRules(): DSLRule[] {
    return this.parseYAML(BUILTIN_RULES_YAML, true);
  }

  /**
   * 解析用户自定义 YAML 规则文件内容
   */
  parseUserRules(yamlContent: string): ParseResult {
    const rules = this.parseYAML(yamlContent, false);
    const errors: string[] = [];
    return { rules, errors };
  }

  /**
   * 从文件内容解析所有规则（包含内置 + 自定义）
   */
  parseAll(yamlContent?: string): { builtin: DSLRule[]; user: DSLRule[] } {
    const builtin = this.parseBuiltinRules();
    const user = yamlContent ? this.parseYAML(yamlContent, false) : [];
    return { builtin, user };
  }

  // ─── 简化 YAML 解析 ───

  private parseYAML(yaml: string, builtin: boolean): DSLRule[] {
    const rules: DSLRule[] = [];
    const lines = yaml.split("\n");
    let i = 0;

    while (i < lines.length) {
      const trimmed = lines[i].trim();

      // 检测规则起始: "- rule: xxx" 或 "rule: xxx"
      if (trimmed.startsWith("- rule:") || trimmed.startsWith("rule:")) {
        const ruleName = trimmed.replace(/^- rule:\s*|^rule:\s*/, "").trim();
        const block = this.extractRuleBlock(lines, i);
        const rule = this.buildRule(block, ruleName, builtin);
        if (rule) rules.push(rule);
        i += block.linesConsumed;
        continue;
      }
      i++;
    }

    return rules;
  }

  private extractRuleBlock(
    lines: string[],
    startIdx: number
  ): { lines: string[]; linesConsumed: number } {
    const blockLines: string[] = [];
    let i = startIdx;
    let baseIndent = -1;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === "" || trimmed.startsWith("#")) {
        if (blockLines.length > 0) blockLines.push(line);
        i++;
        continue;
      }

      const indent = line.length - line.trimStart().length;

      if (blockLines.length === 0) {
        // 第一行
        if (trimmed.startsWith("- rule:") || trimmed.startsWith("rule:")) {
          baseIndent = indent;
          blockLines.push(line);
          i++;
          continue;
        }
      } else {
        // 后续行：以相同的缩进基准则为新的规则
        if (indent <= baseIndent && trimmed.startsWith("- rule:")) {
          break;
        }
        blockLines.push(line);
        i++;
        continue;
      }
      i++;
    }

    return { lines: blockLines, linesConsumed: i - startIdx };
  }

  private buildRule(
    block: { lines: string[]; linesConsumed: number },
    ruleName: string,
    builtin: boolean
  ): DSLRule | null {
    const lines = block.lines;
    let description = "";
    const matchRules: DSLMatchRule[] = [];
    let action: DSLAction | undefined;
    let output: DSLOutputConfig = { structure: "paragraph" };
    let inMatch = false;
    let inAction = false;
    let inExtract = false;
    let inOutput = false;
    let inMapColumns = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const keyValue = trimmed.match(/^(\w[\w-]*):\s*(.*)$/);

      if (keyValue) {
        const key = keyValue[1];
        const value = keyValue[2].trim();

        if (key === "description") {
          description = value.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
          inMatch = false; inAction = false; inExtract = false; inOutput = false; inMapColumns = false;
        } else if (key === "match") {
          inMatch = true; inAction = false; inExtract = false; inOutput = false; inMapColumns = false;
        } else if (key === "action") {
          inMatch = false; inAction = true; inExtract = false; inOutput = false; inMapColumns = false;
        } else if (key === "output") {
          inMatch = false; inAction = false; inExtract = false; inOutput = true; inMapColumns = false;
        } else if (key === "extract") {
          inExtract = true; inMapColumns = false;
          action = action ?? { extract: {} };
        } else if (key === "map_columns") {
          inMapColumns = true; inExtract = false;
          action = action ?? { extract: {} };
        } else if (inMatch && key === "type") {
          matchRules.push({ type: value as DSLMatchType });
        } else if (inMatch && key === "pattern") {
          if (matchRules.length > 0) matchRules[matchRules.length - 1].pattern = value.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
        } else if (inMatch && key === "heading_contains") {
          if (matchRules.length > 0) matchRules[matchRules.length - 1].heading_contains = value.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
        } else if (inMatch && key === "block_type") {
          if (matchRules.length > 0) matchRules[matchRules.length - 1].block_type = value;
        } else if (inOutput && key === "structure") {
          output.structure = value as any;
        } else if (inOutput && key === "domain") {
          output.domain = value;
        } else if (inOutput && key === "tags") {
          output.tags = this.parseTagList(value);
        } else if (inAction && key === "split_rows") {
          action = action ?? { extract: {} };
          action.split_rows = value === "true";
        }
      }

      // 解析 extract 字段
      if (inExtract && trimmed.startsWith("  ") && !trimmed.startsWith("    ")) {
        // 形如 "      front: { source: highlight_word }"
        const fieldMatch = trimmed.match(/^(\w[\w-]*):\s*\{(.+)\}$/);
        if (fieldMatch && action) {
          const fieldName = fieldMatch[1];
          const propsStr = fieldMatch[2];
          const sourceMatch = propsStr.match(/source:\s*(\w+)/);
          const sectionMatch = propsStr.match(/section_name:\s*"([^"]+)"/);
          if (sourceMatch) {
            action.extract[fieldName] = {
              source: sourceMatch[1] as DSLExtractSource,
              section_name: sectionMatch ? sectionMatch[1] : undefined,
            };
          }
        }
        // 简写: "      concept: heading"
        const shortMatch = trimmed.match(/^(\w[\w-]*):\s*(\w+)$/);
        if (shortMatch && action && !fieldMatch) {
          action.extract[shortMatch[1]] = {
            source: shortMatch[2] as DSLExtractSource,
          };
        }
      }

      // 解析 map_columns
      if (inMapColumns) {
        const colMatch = trimmed.match(/^(\w[\w-]*):\s*(.+)$/);
        if (colMatch && action) {
          action.map_columns = action.map_columns ?? {};
          action.map_columns[colMatch[1]] = colMatch[2].trim().replace(/^"|"$/g, "");
        }
      }
    }

    // 应用内置规则优先级
    const preset = BUILTIN_RULE_PRIORITIES[ruleName];
    // 空匹配规则时添加默认
    if (matchRules.length === 0) {
      matchRules.push({ type: "block_type", block_type: "paragraph" });
    }

    return {
      id: `${builtin ? "builtin" : "user"}_${ruleName}`,
      rule: ruleName,
      description,
      enabled: true,
      builtin,
      priority: preset?.priority ?? DEFAULT_RULE_PRIORITY,
      exclusive: preset?.exclusive ?? DEFAULT_RULE_EXCLUSIVE,
      fallback: preset?.fallback ?? DEFAULT_RULE_FALLBACK,
      match: matchRules,
      action,
      output,
    };
  }

  private parseTagList(value: string): string[] {
    const cleaned = value.replace(/^\[|\]$/g, "").replace(/"/g, "");
    return cleaned.split(",").map((s) => s.trim()).filter(Boolean);
  }
}
