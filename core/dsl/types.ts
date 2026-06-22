// RemiFocus — DSL 规则引擎类型定义
// 定义 DSL 规则的完整类型体系，包含约束层（priority + exclusive + fallback）

// ─── 匹配类型 ───

export type DSLMatchType =
  | "regex"            // 正则匹配行内容
  | "heading"          // 标题精确匹配
  | "heading_contains" // 标题包含关键词
  | "heading_regex"    // 标题正则匹配
  | "block_type"       // 块类型（table / code / quote / list）
  | "tag";             // 标签匹配

export interface DSLMatchRule {
  type: DSLMatchType;
  pattern?: string;         // 正则表达式（regex 类型时使用）
  heading_contains?: string; // 标题包含（heading_contains 类型时使用）
  heading_regex?: string;    // 标题正则
  block_type?: string;       // block_type 时使用
  tag_name?: string;         // tag 类型时使用
}

// ─── 提取字段 ───

export type DSLExtractSource =
  | "heading"          // 当前标题文本
  | "bold_word"        // **加粗** 内容
  | "highlight_word"   // ==高亮== 内容
  | "after_colon"      // 冒号后的内容
  | "slash_content"    // /斜杠/ 内容
  | "section"          // 指定章节内容
  | "table_cell"       // 表格单元格
  | "line_content"     // 整行内容
  | "frontmatter";     // YAML frontmatter 字段

export interface DSLExtractField {
  source: DSLExtractSource;
  section_name?: string;     // section("想到啥") 中的参数
  column_index?: number;     // 表格列索引（0-based）
  column_name?: string;      // 表格列名
  fm_field?: string;         // frontmatter 字段名
}

export interface DSLAction {
  /** 提取字段映射: { fieldName: extractRule } */
  extract: Record<string, DSLExtractField>;
  /** 表格按行拆分 */
  split_rows?: boolean;
  /** 列映射: { targetField: sourceColumnName } */
  map_columns?: Record<string, string>;
}

// ─── 输出配置 ───

export interface DSLOutputConfig {
  /** KU 结构类型 */
  structure: "big-cloze" | "small-vocab" | "table" | "paragraph";
  /** 知识领域（用于 KU identity） */
  domain?: string;
  /** 标签列表 */
  tags?: string[];
}

// ─── DSL 规则（核心实体） ───

export interface DSLRule {
  /** 规则唯一 ID，如 "vocab_highlight" */
  id: string;
  /** 规则名称 */
  rule: string;
  /** 人类可读描述 */
  description?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 是否为内置规则 */
  builtin: boolean;

  // ─── 约束层（v1.1 新增） ───

  /** 优先级 10-100，数字越大越优先，默认 50 */
  priority: number;
  /** true = 命中后阻断其他规则 */
  exclusive: boolean;
  /** true = 兜底规则，仅当无其他规则匹配时触发 */
  fallback: boolean;

  /** 匹配条件列表（AND 逻辑） */
  match: DSLMatchRule[];

  /** 提取动作 */
  action?: DSLAction;

  /** 输出配置 */
  output: DSLOutputConfig;
}

// ─── 规则匹配结果 ───

export interface MatchedRule {
  rule: DSLRule;
  /** 匹配得分 0-1 */
  score: number;
  /** 匹配详情 */
  details: string;
}

export type ResolvedAction = "execute" | "blocked" | "fallback_skipped";

export interface ResolvedRule {
  rule: DSLRule;
  action: ResolvedAction;
}

// ─── 内置规则预设优先级 ───

export const BUILTIN_RULE_PRIORITIES: Record<string, { priority: number; exclusive: boolean; fallback: boolean }> = {
  rule_card:          { priority: 90, exclusive: true,  fallback: false },
  comparison_table:   { priority: 85, exclusive: true,  fallback: false },
  vocab_highlight:    { priority: 80, exclusive: false, fallback: false },
  vocab_bold:         { priority: 70, exclusive: false, fallback: false },
  simple_list:        { priority: 60, exclusive: false, fallback: false },
  paragraph:          { priority: 10, exclusive: false, fallback: true  },
};

// ─── 默认值 ───

export const DEFAULT_RULE_PRIORITY = 50;
export const DEFAULT_RULE_EXCLUSIVE = false;
export const DEFAULT_RULE_FALLBACK = false;
