// RemiFocus — KU 提取器
// 从 Markdown 笔记中提取知识单元（KU）
// 支持：大卡片、小卡片、段落、表格

import {
  KnowledgeUnit,
  KUStructure,
  SourceRef,
  DEFAULT_STABILITY,
} from "../models/knowledge-unit";

export interface ExtractedKU {
  rawText: string;
  structure: KUStructure;
  tags: string[];
  source: SourceRef;
}

interface KUExtractorOptions {
  /** 最小段落长度（字符数），小于此值不生成段落 KU */
  minParagraphLength?: number;
  /** 最大段落长度，超过此值截断 */
  maxParagraphLength?: number;
}

const DEFAULT_OPTIONS: KUExtractorOptions = {
  minParagraphLength: 10,
  maxParagraphLength: 2000,
};

export class KUExtractor {
  private options: KUExtractorOptions;

  constructor(options?: KUExtractorOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 从笔记内容中提取所有知识单元
   */
  extract(content: string, filePath: string): ExtractedKU[] {
    const lines = content.split("\n");
    const kus: ExtractedKU[] = [];
    let usedLines = new Set<number>();

    // Pass 1: 大卡片（西综 Cloze）— 复用 cardExtractor 思路
    const bigCardKUs = this.extractBigCardKUs(lines, filePath);
    for (const ku of bigCardKUs) {
      kus.push(ku);
      for (let l = ku.source.lineStart; l <= ku.source.lineEnd; l++) {
        usedLines.add(l);
      }
    }

    // Pass 2: 小卡片（列表项）
    const smallCardKUs = this.extractSmallCardKUs(lines, filePath, usedLines);
    for (const ku of smallCardKUs) {
      kus.push(ku);
      for (let l = ku.source.lineStart; l <= ku.source.lineEnd; l++) {
        usedLines.add(l);
      }
    }

    // Pass 3: 段落分割（普通文本）
    const paragraphKUs = this.extractParagraphKUs(lines, filePath, usedLines);
    kus.push(...paragraphKUs);

    return kus;
  }

  // ════════════════════════════════════════
  //  Pass 1: 大卡片（西综 Cloze 模式）
  // ════════════════════════════════════════

  private extractBigCardKUs(lines: string[], filePath: string): ExtractedKU[] {
    const kus: ExtractedKU[] = [];
    let currentHeading = "";
    let currentLines: string[] = [];
    let startLine = -1;
    let inBigCard = false;

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (i === 0 && t === "---") { i = this.skipFm(lines, i); continue; }
      if (!t || t.startsWith("```")) continue;

      const hm = t.match(/^(#{1,6})\s+(.+)$/);
      if (hm) {
        // 结束上一个
        if (inBigCard && currentLines.length > 0) {
          kus.push(this.makeKU(currentLines, currentHeading, filePath, startLine, "big-cloze"));
        }
        currentLines = [];
        currentHeading = hm[2].trim();
        startLine = i;
        inBigCard = this.isBigCardHeading(lines, i, currentHeading);
        continue;
      }

      if (!inBigCard) continue;
      currentLines.push(lines[i]);
    }

    // 最后一个
    if (inBigCard && currentLines.length > 0) {
      kus.push(this.makeKU(currentLines, currentHeading, filePath, startLine, "big-cloze"));
    }

    return kus;
  }

  private isBigCardHeading(lines: string[], idx: number, headingText: string): boolean {
    if (/[【\[]看到啥[】\]]/.test(headingText)) return true;
    const lookAhead = 5;
    for (let i = idx + 1; i <= idx + lookAhead && i < lines.length; i++) {
      const t = lines[i].trim();
      if (/【想到啥】/.test(t) || /【记住啥】/.test(t)) return true;
      if (/^#{1,6}\s/.test(t)) break;
    }
    return false;
  }

  // ════════════════════════════════════════
  //  Pass 2: 小卡片（列表项模式）
  // ════════════════════════════════════════

  private extractSmallCardKUs(
    lines: string[],
    filePath: string,
    skipLines: Set<number>
  ): ExtractedKU[] {
    const kus: ExtractedKU[] = [];
    let currentGroup = "default";
    let groupLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (skipLines.has(i)) continue;
      const t = lines[i].trim();
      if (i === 0 && t === "---") { i = this.skipFm(lines, i); continue; }
      if (!t || t.startsWith("```")) continue;

      const headingMatch = t.match(/^(#{2,3})\s+(.+)$/);
      if (headingMatch) {
        currentGroup = headingMatch[2].replace(/#\S+/g, "").trim() || "default";
        groupLine = i;
        continue;
      }

      // 列表项 → 小卡片 KU
      const listMatch = t.match(/^\s*[-*]\s+(.+)$/);
      if (listMatch) {
        const content = listMatch[1].trim();
        // 检测是否是有效的卡片格式
        if (/[:：]/.test(content) || /==.+==/.test(content) || /\*\*.+\*\*/.test(content)) {
          kus.push({
            rawText: content,
            structure: "small-vocab",
            tags: [currentGroup],
            source: {
              notePath: filePath,
              blockId: `b${i}`,
              lineStart: i,
              lineEnd: i,
              rawText: content,
            },
          });
        }
      }
    }

    return kus;
  }

  // ════════════════════════════════════════
  //  Pass 3: 段落分割
  // ════════════════════════════════════════

  private extractParagraphKUs(
    lines: string[],
    filePath: string,
    skipLines: Set<number>
  ): ExtractedKU[] {
    const kus: ExtractedKU[] = [];
    let currentParagraph: string[] = [];
    let currentHeading = "";
    let startLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (skipLines.has(i)) continue;
      const line = lines[i];

      // 标题 → 新段落的开始
      const headingMatch = line.match(/^#{1,6}\s+(.+)/);
      if (headingMatch) {
        if (currentParagraph.length > 0 && this.isValidParagraph(currentParagraph)) {
          kus.push(this.makeKU(currentParagraph, currentHeading, filePath, startLine, "paragraph"));
        }
        currentHeading = headingMatch[1].trim();
        currentParagraph = [];
        startLine = i;
        continue;
      }

      // 空行 → 段落分割
      if (line.trim() === "" && currentParagraph.length > 0) {
        if (this.isValidParagraph(currentParagraph)) {
          kus.push(this.makeKU(currentParagraph, currentHeading, filePath, startLine, "paragraph"));
        }
        currentParagraph = [];
        startLine = i + 1;
        continue;
      }

      // 非空行 → 追加到当前段落
      if (line.trim() !== "" && !line.startsWith("```") && !line.startsWith("|")) {
        currentParagraph.push(line);
      }
    }

    // 最后一段
    if (currentParagraph.length > 0 && this.isValidParagraph(currentParagraph)) {
      kus.push(this.makeKU(currentParagraph, currentHeading, filePath, startLine, "paragraph"));
    }

    return kus;
  }

  private isValidParagraph(lines: string[]): boolean {
    const text = lines.join("\n").trim();
    // 只保留满足最小长度且有实质内容的段落
    return (
      text.length >= (this.options.minParagraphLength ?? 10) &&
      /[一-龥A-Za-z]/.test(text) // 至少包含中英文
    );
  }

  // ════════════════════════════════════════
  //  工具方法
  // ════════════════════════════════════════

  private makeKU(
    lines: string[],
    heading: string,
    filePath: string,
    startLine: number,
    structure: KUStructure
  ): ExtractedKU {
    const rawText = lines
      .join("\n")
      .slice(0, this.options.maxParagraphLength)
      .trim();
    const blockId = `b${startLine}`;

    return {
      rawText,
      structure,
      tags: heading ? heading.split("/").map((s) => s.trim()).filter(Boolean) : [],
      source: {
        notePath: filePath,
        blockId,
        lineStart: startLine,
        lineEnd: startLine + lines.length,
        rawText,
      },
    };
  }

  private skipFm(lines: string[], start: number): number {
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") return i;
    }
    return start;
  }
}
