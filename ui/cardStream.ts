import { IEngine } from "../engine/interface";
// RemiFocus — 卡片流组件（右侧面板）
// 展示选中 KU 的所有卡片，支持原文/压缩/训练三种 Tab

import { UIComponent } from "./base";
import { KnowledgeUnit } from "../models/knowledge-unit";
import { CardFace, Projection } from "../models/projection";
import { WordEntry } from "../models/card";

export type ViewMode = "literal" | "compression" | "training";

export interface CardStreamCallbacks {
  onStartSession: (deckName: string, mode: "exposure" | "test" | "review") => void;
}

interface CardGroup {
  type: "cloze" | "qa" | "judgement" | "mnemonic";
  mode: ViewMode;
  cards: CardFace[];
}

export class CardStream extends UIComponent {
  private callbacks: CardStreamCallbacks;
  private currentKU: KnowledgeUnit | null = null;
  private currentMode: ViewMode = "literal";
  private getProjections: (kuId: string) => Promise<Projection[]>;
  private getWordEntries: (wordKeys: string[]) => Promise<Map<string, WordEntry>>;

  constructor(
    container: HTMLElement,
    engine: IEngine,
    getProjections: (kuId: string) => Promise<Projection[]>,
    getWordEntries: (wordKeys: string[]) => Promise<Map<string, WordEntry>>,
    callbacks: CardStreamCallbacks
  ) {
    super(container, engine);
    this.getProjections = getProjections;
    this.getWordEntries = getWordEntries;
    this.callbacks = callbacks;
    container.classList.add("remi-focus", "remi-card-stream");
  }

  async render(): Promise<void> {
    this.clear();

    if (!this.currentKU) {
      this.renderEmpty();
      return;
    }

    this.renderHeader();
    this.renderModeTabs();
    await this.renderCards();
  }

  /**
   * 设置当前显示的 KU
   */
  async showKU(ku: KnowledgeUnit): Promise<void> {
    this.currentKU = ku;
    this.currentMode = "literal";
    await this.render();
  }

  /**
   * 清空选择
   */
  clearSelection(): void {
    this.currentKU = null;
    this.render();
  }

  private renderEmpty(): void {
    const empty = this.appendChild(this.container, "div", "");
    empty.style.cssText =
      "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
      "height:100%;color:var(--remi-text-muted);text-align:center;padding:32px;";

    const icon = this.appendChild(empty, "div", "");
    icon.style.cssText = "font-size:2.5em;margin-bottom:12px;";
    icon.textContent = "🃏";

    const text = this.appendChild(empty, "div", "");
    text.style.cssText = "font-size:0.9em;line-height:1.6;";
    text.innerHTML =
      "请在左侧知识树中选择一个知识单元<br/>" +
      "查看对应的学习卡片";
  }

  private renderHeader(): void {
    if (!this.currentKU) return;

    const header = this.appendChild(this.container, "div", "remi-cs-header");
    header.style.cssText =
      "padding-bottom:8px;border-bottom:1px solid var(--remi-border);" +
      "margin-bottom:8px;";

    const titleRow = this.appendChild(header, "div", "");
    titleRow.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;";

    const title = this.appendChild(titleRow, "div", "");
    title.style.cssText = "font-weight:600;font-size:0.95em;";
    title.textContent = this.currentKU.canonical.text.slice(0, 60);

    // 稳定性状态
    const stability = this.currentKU.stability;
    const lockIcon =
      stability.lockMode === "strict"
        ? "🔒"
        : stability.lockMode === "semi"
        ? "🔐"
        : "🔓";
    const lockBadge = this.appendChild(titleRow, "span", "");
    lockBadge.textContent = lockIcon;
    lockBadge.style.cssText =
      "font-size:0.85em;cursor:pointer;";
    lockBadge.title = `锁定模式: ${stability.lockMode}`;

    // 标签
    if (this.currentKU.tags.length > 0) {
      const tagRow = this.appendChild(header, "div", "");
      tagRow.style.cssText =
        "display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;";
      for (const tag of this.currentKU.tags) {
        const tagEl = this.appendChild(tagRow, "span", "");
        tagEl.textContent = `#${tag}`;
        tagEl.style.cssText =
          "font-size:0.72em;color:var(--remi-accent);" +
          "background:var(--remi-accent)11;padding:1px 6px;border-radius:4px;";
      }
    }
  }

  private renderModeTabs(): void {
    const tabs = this.appendChild(this.container, "div", "remi-cs-tabs");
    tabs.style.cssText =
      "display:flex;gap:4px;margin-bottom:8px;";

    const modes: { mode: ViewMode; label: string; icon: string }[] = [
      { mode: "literal", label: "原文", icon: "📖" },
      { mode: "compression", label: "压缩", icon: "🧠" },
      { mode: "training", label: "训练", icon: "🎯" },
    ];

    for (const m of modes) {
      const isActive = this.currentMode === m.mode;
      const tab = this.appendChild(tabs, "button", "remi-cs-tab");
      tab.textContent = `${m.icon} ${m.label}`;
      tab.style.cssText =
        "padding:4px 12px;border:none;border-radius:6px;cursor:pointer;" +
        "font-size:0.82em;font-weight:500;transition:all 0.15s;" +
        (isActive
          ? "background:var(--remi-accent);color:#fff;"
          : "background:var(--remi-bg-secondary);color:var(--remi-text-muted);");
      tab.addEventListener("click", () => {
        this.currentMode = m.mode;
        this.render();
      });
    }
  }

  private async renderCards(): Promise<void> {
    if (!this.currentKU) return;

    const projections = await this.getProjections(this.currentKU.id);
    const modeProjection = projections.find((p) => p.mode === this.currentMode);

    const cardContainer = this.appendChild(this.container, "div", "remi-cs-cards");
    cardContainer.style.cssText =
      "overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;";

    if (!modeProjection || modeProjection.cards.length === 0) {
      const empty = this.appendChild(cardContainer, "div", "");
      empty.style.cssText =
        "text-align:center;padding:24px;color:var(--remi-text-muted);font-size:0.85em;";
      empty.textContent =
        this.currentMode === "literal"
          ? "📖 暂无原文卡片\n切换到「压缩」模式使用 AI 生成"
          : this.currentMode === "compression"
          ? "🧠 暂无压缩卡片\n点击「AI 生成」创建压缩卡片"
          : "🎯 暂无训练卡片\n请先切换到原文或压缩模式";
      return;
    }

    // 按卡片类型分组
    const groups = this.groupCards(modeProjection.cards);

    for (const group of groups) {
      this.renderCardGroup(cardContainer, group);
    }
  }

  private groupCards(cards: CardFace[]): CardGroup[] {
    const groups: CardGroup[] = [];
    const typeOrder: CardFace["type"][] = ["cloze", "qa", "judgement", "mnemonic"];
    const typeLabels: Record<string, string> = {
      cloze: "🃏 挖空卡",
      qa: "💬 问答卡",
      judgement: "⚖️ 判断卡",
      mnemonic: "💡 助记卡",
    };

    for (const type of typeOrder) {
      const filtered = cards.filter((c) => c.type === type);
      if (filtered.length > 0) {
        groups.push({
          type,
          mode: this.currentMode,
          cards: filtered,
        });
      }
    }

    return groups;
  }

  private renderCardGroup(container: HTMLElement, group: CardGroup): void {
    const typeLabels: Record<string, string> = {
      cloze: "🃏 挖空卡",
      qa: "💬 问答卡",
      judgement: "⚖️ 判断卡",
      mnemonic: "💡 助记卡",
    };

    const groupEl = this.appendChild(container, "div", "remi-cs-group");
    groupEl.style.cssText =
      "border:1px solid var(--remi-border);border-radius:8px;" +
      "overflow:hidden;";

    // 组标题
    const groupHeader = this.appendChild(groupEl, "div", "");
    groupHeader.style.cssText =
      "padding:6px 10px;font-size:0.82em;font-weight:600;" +
      "background:var(--remi-bg-secondary);border-bottom:1px solid var(--remi-border);";
    groupHeader.textContent =
      `${typeLabels[group.type] || group.type} ×${group.cards.length}`;

    // 卡片列表
    for (const card of group.cards) {
      this.renderCardFace(groupEl, card);
    }
  }

  private renderCardFace(container: HTMLElement, card: CardFace): void {
    const cardEl = this.appendChild(container, "div", "remi-cs-card");
    cardEl.style.cssText =
      "padding:10px 12px;border-bottom:1px solid var(--remi-border);" +
      "cursor:pointer;transition:background 0.1s;font-size:0.85em;";
    cardEl.addEventListener("mouseenter", () => {
      cardEl.style.background = "var(--remi-bg-secondary)";
    });
    cardEl.addEventListener("mouseleave", () => {
      cardEl.style.background = "transparent";
    });

    // 点击翻转
    let isFlipped = false;
    cardEl.addEventListener("click", () => {
      isFlipped = !isFlipped;
      if (isFlipped) {
        frontEl.style.display = "none";
        backEl.style.display = "block";
      } else {
        frontEl.style.display = "block";
        backEl.style.display = "none";
      }
    });

    // 正面
    const frontEl = this.appendChild(cardEl, "div", "remi-cs-card-front");
    frontEl.style.cssText = "line-height:1.5;color:var(--remi-text);";
    frontEl.textContent = card.front;

    // 背面（默认隐藏）
    const backEl = this.appendChild(cardEl, "div", "remi-cs-card-back");
    backEl.style.cssText =
      "line-height:1.5;color:var(--remi-success);display:none;margin-top:4px;" +
      "padding-top:4px;border-top:1px dashed var(--remi-border);";
    backEl.textContent = card.back;

    // cloze 片段显示
    if (card.clozeSegments && card.clozeSegments.length > 0) {
      const clozeInfo = this.appendChild(cardEl, "div", "");
      clozeInfo.style.cssText =
        "font-size:0.78em;color:var(--remi-text-muted);margin-top:4px;";
      clozeInfo.textContent = `🔍 ${card.clozeSegments.length} 个挖空点`;
    }
  }
}
