// RemiFocus — 多通道卡片提取器
//
// 三通道并行提取：
//   Pass 1: 大卡片（标题级）— 西综 ###【看到啥】
//   Pass 2: 小卡片（行级）— 列表项 word: def
//   Pass 3: 表格卡片 — markdown 表格

import { ClozeSegment } from "../models/card";

// ─── 类型 ───

export type CardType = "big-cloze" | "small-vocab" | "table";
export type CardFormat = string;

export interface ExtractedCard {
  word: string;
  meaning: string;
  group: string;
  line: number;
  format: CardFormat;
  sourceFile: string;
  cardType: CardType;
  cloze?: ClozeSegment[];
  mnemonic?: string;
}

export interface CardGroup {
  name: string;
  level: number;
  cards: ExtractedCard[];
}

export interface ExtractResult {
  cards: ExtractedCard[];
  groups: CardGroup[];
  stats: {
    totalCards: number;
    groupsCount: number;
    byType: Record<CardType, number>;
    byGroup: Record<string, number>;
  };
}

// ─── 提取器 ───

export class CardExtractor {

  extract(content: string, filePath: string, extractTables = false): ExtractResult {
    const lines = content.split("\n");
    const allCards: ExtractedCard[] = [];
    const groupMap = new Map<string, CardGroup>();

    // ── Pass 1: 大卡片（西综 Cloze） ──
    const bigCards = this.extractBigCards(lines, filePath);
    for (const card of bigCards) {
      allCards.push(card);
      this.ensureGroup(groupMap, card.group, 3, card);
    }

    const bigCardLines = new Set<number>();
    for (const card of bigCards) {
      for (let l = card.line; l < card.line + 30; l++) bigCardLines.add(l);
    }

    // ── Pass 2: 小卡片（列表项） ──
    const smallCards = this.extractSmallCards(lines, filePath, bigCardLines);
    for (const card of smallCards) {
      allCards.push(card);
      this.ensureGroup(groupMap, card.group, 2, card);
    }

    // ── Pass 3: 表格卡片（默认关闭，需显式启用） ──
    if (extractTables) {
      const tableCards = this.extractTableCards(lines, filePath);
      for (const card of tableCards) {
        allCards.push(card);
        this.ensureGroup(groupMap, card.group, 1, card);
      }
    }

    // ── 统计 ──
    const byType: Record<CardType, number> = { "big-cloze": 0, "small-vocab": 0, "table": 0 };
    for (const c of allCards) byType[c.cardType]++;

    return {
      cards: allCards,
      groups: Array.from(groupMap.values()),
      stats: {
        totalCards: allCards.length,
        groupsCount: groupMap.size,
        byType,
        byGroup: Object.fromEntries(allCards.map(c => [c.group, (allCards.filter(x => x.group === c.group).length)])),
      },
    };
  }

  // ════════════════════════════════════════
  //  Pass 1: 大卡片（西综 Cloze 模式）
  // ════════════════════════════════════════

  private extractBigCards(lines: string[], filePath: string): ExtractedCard[] {
    const cards: ExtractedCard[] = [];
    let current: Partial<ExtractedCard> | null = null;
    let cardLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (i === 0 && t === "---") { i = this.skipFm(lines, i); continue; }
      if (!t || t.startsWith("```")) continue;

      const hm = t.match(/^(#{1,6})\s+(.+)$/);
      if (hm) {
        this.finalizeBigCard(current, cardLines, cards);
        cardLines = [];
        const text = hm[2].trim();

        // 检测是否为"大卡片模式"标题
        if (this.isBigCardHeading(lines, i, text)) {
          current = {
            word: text,
            meaning: "",
            group: text,
            line: i,
            format: "big-cloze",
            sourceFile: filePath,
            cardType: "big-cloze",
            cloze: [],
            mnemonic: "",
          };
        } else {
          current = null;
        }
        continue;
      }

      if (!current) continue;
      cardLines.push(t);

      // 提取 → 后内容作为 cloze 片段
      const arrowMatch = t.match(/→\s*(.+)$/);
      if (arrowMatch) {
        const after = arrowMatch[1].trim();
        current.cloze!.push({
          hint: after.length > 60 ? after.slice(0, 60) + "…" : after,
          answer: after,
        });
      }

      // 提取 【记住啥】
      const remMatch = t.match(/【记住啥】[`'"]?\s*(.+?)\s*[`'"]?$/);
      if (remMatch) current.mnemonic = remMatch[1].trim();
    }
    this.finalizeBigCard(current, cardLines, cards);
    return cards;
  }

  /** 检测标题下是否是"大卡片模式" */
  private isBigCardHeading(lines: string[], idx: number, headingText: string): boolean {
    // 标题包含 【看到啥】 → 大卡片
    if (/[【\[]看到啥[】\]]/.test(headingText)) return true;

    // 标题后几行有 【想到啥】/【记住啥】 → 大卡片
    const lookAhead = 5;
    for (let i = idx + 1; i <= idx + lookAhead && i < lines.length; i++) {
      const t = lines[i].trim();
      if (/【想到啥】/.test(t) || /【记住啥】/.test(t)) return true;
      // 如果遇到新的标题，停止
      if (/^#{1,6}\s/.test(t)) break;
    }
    return false;
  }

  private finalizeBigCard(
    card: Partial<ExtractedCard> | null,
    cardLines: string[],
    cards: ExtractedCard[]
  ): void {
    if (card && card.word) {
      card.meaning = cardLines.join("\n");
      // 如果没提取到 cloze 片段，把整段当 meaning
      if (!card.cloze || card.cloze.length === 0) {
        card.cloze = [{ hint: card.meaning.slice(0, 60), answer: card.meaning }];
      }
      cards.push(card as ExtractedCard);
    }
  }

  // ════════════════════════════════════════
  //  Pass 2: 小卡片（列表项模式）
  // ════════════════════════════════════════

  private extractSmallCards(
    lines: string[], filePath: string, skipLines: Set<number>
  ): ExtractedCard[] {
    const cards: ExtractedCard[] = [];
    let currentGroup = "default";
    let currentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (i === 0 && t === "---") { i = this.skipFm(lines, i); continue; }
      if (!t || t.startsWith("```")) continue;
      if (skipLines.has(i)) continue;

      const headingMatch = t.match(/^(#{2,3})\s+(.+)$/);
      if (headingMatch) {
        currentLevel = headingMatch[1].length;
        currentGroup = headingMatch[2].replace(/#\S+/g, "").trim() || "default";
        continue;
      }

      const card = this.matchSmallCard(t, currentGroup, i, filePath);
      if (card) cards.push(card);
    }
    return cards;
  }

  private matchSmallCard(
    text: string, group: string, line: number, filePath: string
  ): ExtractedCard | null {
    // 必须是列表项
    const listMatch = text.match(/^\s*[-*]\s+(.+)$/);
    if (!listMatch) return null;
    const content = listMatch[1].trim();

    // 格式优先级
    const patterns: { format: string; regex: RegExp }[] = [
      { format: "highlight-colon", regex: /^==(.+?)==\s*[:：]\s*(.+)$/ },
      { format: "highlight-dash", regex: /^==(.+?)==\s*[-–—]\s*(.+)$/ },
      { format: "bold-colon", regex: /^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/ },
      { format: "dash", regex: /^(.+?)\s+[-–—]\s+(.+)$/ },
      { format: "colon", regex: /^(.+?)\s*[:：]\s+(.+)$/ },
      { format: "parens", regex: /^\((.+?)\)\s*[:：]?\s*(.+)$/ },
      { format: "highlight-alone", regex: /^==(.+?)==$/ },
    ];

    for (const { format, regex } of patterns) {
      const m = content.match(regex);
      if (m) {
        return {
          word: this.clean(m[1]),
          meaning: m[2] ? this.clean(m[2]) : "",
          group,
          line,
          format,
          sourceFile: filePath,
          cardType: "small-vocab",
        };
      }
    }
    return null;
  }

  // ════════════════════════════════════════
  //  Pass 3: 表格卡片
  // ════════════════════════════════════════

  private extractTableCards(lines: string[], filePath: string): ExtractedCard[] {
    const cards: ExtractedCard[] = [];
    let inTable = false;
    let headers: string[] = [];
    let tableStartLine = -1;
    let currentGroup = "default";

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();

      const hm = t.match(/^(#{1,3})\s+(.+)$/);
      if (hm) { currentGroup = hm[2].replace(/#\S+/g, "").trim() || "default"; }

      // 检测表格行
      if (t.startsWith("|") && t.endsWith("|")) {
        const cells = t.split("|").filter(c => c.trim()).map(c => c.trim());
        if (!inTable) {
          // 第一行 = 表头
          if (cells.length >= 2 && !/[-]+/.test(cells[0])) {
            inTable = true;
            headers = cells;
            tableStartLine = i;
          }
        } else if (i === tableStartLine + 1) {
          // 第二行 = 分隔线（跳过）
          continue;
        } else {
          // 数据行
          const word = this.clean(cells[0]);
          const meaning = cells.slice(1).map((c, j) => `${headers[j + 1] || ""}:${this.clean(c)}`).join(" | ");
          if (word) {
            cards.push({
              word,
              meaning,
              group: currentGroup,
              line: i,
              format: "table-row",
              sourceFile: filePath,
              cardType: "table",
            });
          }
        }
      } else {
        inTable = false;
      }
    }
    return cards;
  }

  // ════════════════════════════════════════
  //  工具方法
  // ════════════════════════════════════════

  private skipFm(lines: string[], start: number): number {
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") return i;
    }
    return start;
  }

  private clean(text: string): string {
    return text
      .replace(/^==|==$/g, "").replace(/^\*\*|\*\*$/g, "")
      .replace(/\[\[|\]\]/g, "").replace(/^`|`$/g, "")
      .replace(/\*\*/g, "")  // 去掉中间加粗
      .trim();
  }

  private ensureGroup(m: Map<string, CardGroup>, name: string, level: number, card: ExtractedCard): void {
    if (!m.has(name)) m.set(name, { name, level, cards: [] });
    m.get(name)!.cards.push(card);
  }
}
