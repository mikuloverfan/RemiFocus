// RemiFocus — DSL 规则执行器
// 对匹配成功的规则执行提取动作，生成 ExtractedKU

import { DSLRule, DSLExtractSource } from "./types";
import { NoteBlock } from "./matcher";

// ─── 提取结果 ───

export interface ExtractedField {
  /** 字段名（如 front, meaning, concept） */
  name: string;
  /** 提取的文本内容 */
  value: string;
}

export interface ExtractedKU {
  /** 源规则 ID */
  ruleId: string;
  /** 原始文本（整块内容） */
  rawText: string;
  /** 结构类型 */
  structure: string;
  /** 知识领域 */
  domain?: string;
  /** 标签 */
  tags: string[];
  /** 提取的字段 */
  fields: ExtractedField[];
  /** 源笔记路径 */
  sourceNote: string;
  /** 源块信息 */
  source: {
    blockId: string;
    lineStart: number;
    lineEnd: number;
  };
  /** 源规则的 canonicalKey 提示（用于后续 KU identity 构建） */
  canonicalKeyHint?: string;
}

// ─── 执行器 ───

export class DSLExecutor {
  /**
   * 对匹配成功的规则执行提取动作
   *
   * @param rule 匹配的 DSL 规则
   * @param block 原始笔记块
   * @param sourceNote 源笔记路径
   * @returns 提取结果
   */
  execute(
    rule: DSLRule,
    block: NoteBlock,
    sourceNote: string
  ): ExtractedKU {
    const fields: ExtractedField[] = [];
    const action = rule.action;

    if (action?.extract) {
      for (const [fieldName, extractRule] of Object.entries(action.extract)) {
        const value = this.extractField(extractRule.source, fieldName, block, extractRule);
        fields.push({ name: fieldName, value });
      }
    }

    // 构建 rawText
    const rawText = block.text;

    // 尝试从文本中提取 canonical key 提示
    const canonicalKeyHint = this.inferCanonicalKey(fields, block);

    return {
      ruleId: rule.id,
      rawText,
      structure: rule.output.structure,
      domain: rule.output.domain,
      tags: rule.output.tags ?? [],
      fields,
      sourceNote,
      source: {
        blockId: `b${block.startLine}`,
        lineStart: block.startLine,
        lineEnd: block.endLine,
      },
      canonicalKeyHint,
    };
  }

  /**
   * 提取单个字段
   */
  private extractField(
    source: DSLExtractSource,
    fieldName: string,
    block: NoteBlock,
    config: any
  ): string {
    switch (source) {
      case "heading":
        return block.heading ?? block.lines[0] ?? "";

      case "bold_word": {
        // 提取第一个 **加粗** 内容
        const match = block.text.match(/\*\*(.+?)\*\*/);
        return match ? match[1].trim() : "";
      }

      case "highlight_word": {
        // 提取第一个 ==高亮== 内容
        const match = block.text.match(/==(.+?)==/);
        return match ? match[1].trim() : "";
      }

      case "after_colon": {
        // 提取冒号后的内容
        const lines = block.lines;
        for (const line of lines) {
          const match = line.match(/[:：]\s*(.+)$/);
          if (match) return match[1].trim();
        }
        // 尝试从整段中匹配
        const match = block.text.match(/[:：]\s*(.+)$/m);
        return match ? match[1].trim() : "";
      }

      case "slash_content": {
        // 提取 /斜杠内容/
        const match = block.text.match(/\/(.+?)\//);
        return match ? match[1].trim() : "";
      }

      case "section": {
        // 提取特定章节内容（如 【想到啥】）
        const sectionName = config.section_name;
        if (!sectionName) return "";
        return this.extractSection(block.lines, sectionName);
      }

      case "table_cell": {
        // 提取表格单元格
        const colIdx = config.column_index ?? 0;
        const colName = config.column_name;
        if (colName) {
          // 按列名查找（需要表格有 header）
          return this.extractTableColumn(block, colName);
        }
        // 按索引取第一行
        if (block.lines.length > 0) {
          const cells = block.lines[0].split("|").filter((c) => c.trim());
          return cells[colIdx]?.trim() ?? "";
        }
        return "";
      }

      case "line_content":
        return block.text.trim();

      case "frontmatter": {
        const fmField = config.fm_field;
        if (!fmField) return "";
        // frontmatter 由调用方处理，此处返回空
        return "";
      }

      default:
        return "";
    }
  }

  /**
   * 提取章节内容：找到包含指定名称的标题后的内容
   * 例如 section("想到啥") → 找到 【想到啥】后的文本
   */
  private extractSection(lines: string[], sectionName: string): string {
    const sectionLines: string[] = [];
    let inSection = false;

    for (const line of lines) {
      if (line.includes(`【${sectionName}】`) || line.includes(`[${sectionName}]`)) {
        inSection = true;
        continue;
      }

      // 如果遇到新章节标题，停止
      if (inSection && /^#{1,6}\s+|【.+?】/.test(line) && !line.includes(`【${sectionName}】`)) {
        break;
      }

      if (inSection) {
        sectionLines.push(line.trim());
      }
    }

    return sectionLines.join(" ").trim();
  }

  /**
   * 提取表格中指定列名的所有内容
   */
  private extractTableColumn(block: NoteBlock, columnName: string): string {
    if (block.lines.length < 2) return "";

    // 第一行 = header
    const headers = block.lines[0].split("|").filter((c) => c.trim()).map((c) => c.trim());
    const colIdx = headers.findIndex(
      (h) => h.toLowerCase() === columnName.toLowerCase()
    );

    if (colIdx === -1) return "";

    // 跳过第二行（分隔线），从第三行开始取数据
    const values: string[] = [];
    for (let i = 2; i < block.lines.length; i++) {
      const cells = block.lines[i].split("|").filter((c) => c.trim());
      if (cells[colIdx]) {
        values.push(cells[colIdx].trim());
      }
    }

    return values.join(" | ");
  }

  /**
   * 从提取结果推断 canonicalKey 提示
   * 优先取 front/word/concept 字段的值
   */
  private inferCanonicalKey(fields: ExtractedField[], block: NoteBlock): string | undefined {
    // 优先取特定字段名
    const preferredFields = ["front", "word", "concept", "term"];
    for (const field of fields) {
      if (preferredFields.includes(field.name) && field.value) {
        return field.value.slice(0, 100);
      }
    }

    // 从标题推断
    if (block.heading && block.heading.length < 100) {
      return block.heading;
    }

    return undefined;
  }

  /**
   * 判断提取是否有效（有实质内容）
   */
  isValidExtraction(extracted: ExtractedKU): boolean {
    // 必须有原始文本
    if (!extracted.rawText || extracted.rawText.length < 3) return false;

    // 必须有至少一个有值的字段（除了 heading/paragraph 兜底）
    if (extracted.structure === "paragraph") {
      return extracted.rawText.length >= 10;
    }

    return extracted.fields.some((f) => f.value.length > 0);
  }
}
