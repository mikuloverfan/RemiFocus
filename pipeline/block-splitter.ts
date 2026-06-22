// RemiFocus — 笔记块分割器
// 将 Markdown 笔记按标题/空行/代码块分割为独立块
// 每个块将独立传递给 DSL Matcher

import { NoteBlock } from "../core/dsl/matcher";

export interface SplitResult {
  blocks: NoteBlock[];
  /** 无法解析的行 */
  skippedLines: number[];
}

export class BlockSplitter {
  /**
   * 将 Markdown 内容分割为语义块
   */
  split(content: string): SplitResult {
    const lines = content.split("\n");
    const blocks: NoteBlock[] = [];
    const skippedLines: number[] = [];

    let i = 0;

    // 跳过 YAML frontmatter
    if (lines.length > 0 && lines[0].trim() === "---") {
      i = this.skipFrontmatter(lines, 0);
    }

    while (i < lines.length) {
      const trimmed = lines[i].trim();

      // 跳过空行和注释
      if (trimmed === "" || trimmed.startsWith("%") || trimmed.startsWith("<!--")) {
        i++;
        continue;
      }

      // 代码块 → 单独块
      if (trimmed.startsWith("```")) {
        const block = this.extractCodeBlock(lines, i);
        if (block) {
          blocks.push(block);
          i = block.endLine + 1;
        } else {
          i++;
        }
        continue;
      }

      // 标题 → 新块
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const heading = headingMatch[2].trim();
        const block = this.extractHeadingBlock(lines, i, level);
        if (block) {
          blocks.push(block);
          i = block.endLine + 1;
        } else {
          i++;
        }
        continue;
      }

      // 表格 → 单独块
      if (trimmed.startsWith("|")) {
        const block = this.extractTableBlock(lines, i);
        if (block) {
          blocks.push(block);
          i = block.endLine + 1;
        } else {
          i++;
        }
        continue;
      }

      // 列表项 → 列表块
      if (trimmed.match(/^[-*+]\s+/)) {
        const block = this.extractListBlock(lines, i);
        if (block) {
          blocks.push(block);
          i = block.endLine + 1;
        } else {
          i++;
        }
        continue;
      }

      // 引用块
      if (trimmed.startsWith(">")) {
        const block = this.extractQuoteBlock(lines, i);
        if (block) {
          blocks.push(block);
          i = block.endLine + 1;
        } else {
          i++;
        }
        continue;
      }

      // 普通段落 → 段落块
      const block = this.extractParagraphBlock(lines, i);
      if (block) {
        blocks.push(block);
        i = block.endLine + 1;
      } else {
        skippedLines.push(i);
        i++;
      }
    }

    return { blocks, skippedLines };
  }

  // ─── 各类块的提取方法 ───

  private extractHeadingBlock(
    lines: string[],
    start: number,
    level: number
  ): NoteBlock | null {
    const blockLines: string[] = [lines[start]];
    const heading = lines[start].replace(/^#+\s+/, "").trim();
    let i = start + 1;

    // 收集标题后的内容（直到下一个同/更高级别标题或空行序列）
    while (i < lines.length) {
      const t = lines[i].trim();

      // 遇到新标题 → 停止
      if (/^#{1,6}\s+/.test(t)) break;

      // 遇到代码块 → 停止（让代码块自己处理）
      if (t.startsWith("```")) break;

      // 遇到空行 → 检查是否段落分割
      if (t === "") {
        // 如果已收集内容，空行作为分隔
        if (blockLines.length > 1) break;
        i++;
        continue;
      }

      blockLines.push(lines[i]);
      i++;
    }

    if (blockLines.length === 0) return null;

    return {
      type: "heading",
      lines: blockLines,
      text: blockLines.join("\n"),
      startLine: start,
      endLine: i - 1,
      heading,
      headingLevel: level,
    };
  }

  private extractListBlock(lines: string[], start: number): NoteBlock | null {
    const blockLines: string[] = [];
    let i = start;

    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === "") break;             // 空行结束列表
      if (t.startsWith("```")) break;  // 代码块
      if (/^#{1,6}\s+/.test(t)) break; // 新标题
      if (!t.match(/^[-*+]\s+/) && !t.match(/^\s{2,}[-*+]\s+/) && !t.match(/^\s{2,}\S/)) {
        // 非列表项且非延续行 → 结束
        if (blockLines.length > 0 && !t.startsWith("|")) break;
        if (blockLines.length === 0) break;
      }
      blockLines.push(lines[i]);
      i++;
    }

    if (blockLines.length === 0) return null;

    return {
      type: "list",
      lines: blockLines,
      text: blockLines.join("\n"),
      startLine: start,
      endLine: i - 1,
    };
  }

  private extractTableBlock(lines: string[], start: number): NoteBlock | null {
    const blockLines: string[] = [];
    let i = start;

    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t.startsWith("|")) break;
      blockLines.push(lines[i]);
      i++;
    }

    if (blockLines.length < 2) return null; // 至少需要 header + 分隔线

    return {
      type: "table",
      lines: blockLines,
      text: blockLines.join("\n"),
      startLine: start,
      endLine: i - 1,
    };
  }

  private extractCodeBlock(lines: string[], start: number): NoteBlock | null {
    const fence = lines[start].trim();
    const lang = fence.slice(3).trim();
    const blockLines: string[] = [lines[start]];
    let i = start + 1;

    while (i < lines.length) {
      blockLines.push(lines[i]);
      if (lines[i].trim() === "```") break;
      i++;
    }

    if (blockLines.length < 2) return null;

    return {
      type: "code",
      lines: blockLines,
      text: blockLines.slice(1, -1).join("\n"), // 不含 fence
      startLine: start,
      endLine: i,
      heading: lang || undefined,
    };
  }

  private extractQuoteBlock(lines: string[], start: number): NoteBlock | null {
    const blockLines: string[] = [];
    let i = start;

    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t.startsWith(">")) break;
      blockLines.push(lines[i].replace(/^>\s?/, ""));
      i++;
    }

    if (blockLines.length === 0) return null;

    return {
      type: "quote",
      lines: blockLines,
      text: blockLines.join("\n"),
      startLine: start,
      endLine: i - 1,
    };
  }

  private extractParagraphBlock(lines: string[], start: number): NoteBlock | null {
    const blockLines: string[] = [];
    let i = start;

    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === "") break;
      if (t.startsWith("```")) break;
      if (t.startsWith("|")) break;
      if (/^#{1,6}\s+/.test(t)) break;
      if (t.match(/^[-*+]\s+/)) break;
      if (t.startsWith(">")) break;
      blockLines.push(lines[i]);
      i++;
    }

    if (blockLines.length === 0) return null;

    const text = blockLines.join("\n").trim();
    if (text.length < 3) return null; // 忽略太短的段落

    return {
      type: "paragraph",
      lines: blockLines,
      text,
      startLine: start,
      endLine: i - 1,
    };
  }

  /**
   * 跳过 YAML frontmatter
   */
  private skipFrontmatter(lines: string[], start: number): number {
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") return i + 1;
    }
    return start + 1;
  }
}
