import { IEngine } from "../engine/interface";
// RemiFocus — 主弹窗（重新设计）
// 宽屏卡片布局，上下结构：顶部操作区 + 底部卡组列表

import { UIComponent } from "./base";
import { DeckInfo, LearningMode } from "../models/card";

export interface PopupCallbacks {
  onDeckClick: (deckName: string) => void;
  onHomeClick: () => void;
  onStartLearning: (deckName: string, mode: LearningMode) => void;
}

export class MainPopup extends UIComponent {
  private callbacks: PopupCallbacks;
  private selectedMode: LearningMode = "review";

  constructor(
    container: HTMLElement,
    engine: IEngine,
    callbacks: PopupCallbacks
  ) {
    super(container, engine);
    this.callbacks = callbacks;
    container.classList.add("remi-focus");
    container.style.padding = "24px";
  }

  async render(): Promise<void> {
    this.clear();
    const deckInfos = await this.engine.getAllDeckInfos();

    // 顶部：模式选择 + 操作
    this.renderTopBar(deckInfos);

    // 中部：模式选择大卡片
    this.renderModeCards();

    // 底部：卡组列表
    this.renderDeckList(deckInfos);
  }

  // ─── 顶部栏 ───

  private renderTopBar(decks: DeckInfo[]): void {
    const top = this.appendChild(this.container, "div", "");
    top.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;";

    const total = decks.reduce((s, d) => s + d.totalCards, 0);
    const title = this.appendChild(top, "div", "");
    title.style.cssText = "font-size:1.1em;font-weight:700;";
    title.textContent = `🧠 RemiFocus  ·  ${total} 词`;

    const btnGroup = this.appendChild(top, "div", "");
    btnGroup.style.cssText = "display:flex;gap:8px;";

    const homeBtn = this.appendChild(btnGroup, "button", "");
    homeBtn.style.cssText = "padding:6px 16px;border:1px solid var(--remi-border);border-radius:6px;cursor:pointer;background:var(--remi-bg);color:var(--remi-text);font-size:0.85em;";
    homeBtn.textContent = "🏠 主页";
    homeBtn.addEventListener("click", () => this.callbacks.onHomeClick());
  }

  // ─── 模式选择卡片 ───

  private renderModeCards(): void {
    const grid = this.appendChild(this.container, "div", "");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;";

    const modes: { mode: LearningMode; icon: string; title: string; desc: string; color: string }[] = [
      { mode: "exposure", icon: "👁", title: "初学 Exposure", desc: "快速翻词，熟悉阶段\n不影响间隔算法", color: "#3498db" },
      { mode: "test", icon: "🧪", title: "测试 Test", desc: "回忆单词，again/hard/good/easy\n影响调度系统", color: "#6c5ce7" },
      { mode: "review", icon: "🔄", title: "复习 Review", desc: "基于间隔算法自动调度\nSM-2 / FSRS", color: "#27ae60" },
    ];

    for (const m of modes) {
      const isSelected = this.selectedMode === m.mode;
      const card = this.appendChild(grid, "div", "");
      card.style.cssText = `
        padding:20px 16px; border-radius:12px; cursor:pointer;
        border:2px solid ${isSelected ? m.color : "var(--remi-border)"};
        background:${isSelected ? m.color + "18" : "var(--remi-card-bg)"};
        transition:all 0.15s; display:flex; flex-direction:column; gap:8px;
        position:relative;
      `;

      // 选中标记
      if (isSelected) {
        const check = this.appendChild(card, "div", "");
        check.style.cssText = "position:absolute;top:8px;right:10px;font-size:1.2em;";
        check.textContent = "✓";
      }

      const iconRow = this.appendChild(card, "div", "");
      iconRow.style.cssText = "display:flex;align-items:center;gap:8px;";
      const icon = this.appendChild(iconRow, "span", "");
      icon.style.cssText = "font-size:1.5em;";
      icon.textContent = m.icon;
      const title = this.appendChild(iconRow, "span", "");
      title.style.cssText = `font-weight:700;font-size:0.95em;color:${isSelected ? m.color : "var(--remi-text)"};`;
      title.textContent = m.title;

      const desc = this.appendChild(card, "div", "");
      desc.style.cssText = "font-size:0.8em;color:var(--remi-text-muted);line-height:1.5;white-space:pre-line;";
      desc.textContent = m.desc;

      card.addEventListener("click", () => {
        this.selectedMode = m.mode;
        this.render();
      });
    }

    // 开始学习按钮
    const startRow = this.appendChild(this.container, "div", "");
    startRow.style.cssText = "display:flex;justify-content:center;margin-bottom:24px;";

    const startBtn = this.appendChild(startRow, "button", "");
    const modeLabel = this.selectedMode === "exposure" ? "Exposure" : this.selectedMode === "test" ? "Test" : "Review";
    startBtn.style.cssText = `
      padding:12px 40px; border:none; border-radius:10px; cursor:pointer;
      background:var(--remi-accent); color:#fff; font-size:1.05em; font-weight:700;
      transition:all 0.15s;
    `;
    startBtn.textContent = `🚀 开始 ${modeLabel} 学习`;
    startBtn.addEventListener("click", async () => {
      const decks = await this.engine.getAllDeckInfos();
      let target = decks.find(d =>
        this.selectedMode === "review" ? d.dueCount > 0 :
        this.selectedMode === "test" ? d.testCount > 0 :
        d.exposureCount > 0 || d.newCount > 0
      );
      if (!target && decks.length > 0) target = decks[0];
      if (target) this.callbacks.onStartLearning(target.name, this.selectedMode);
    });
  }

  // ─── 卡组列表 ───

  private renderDeckList(decks: DeckInfo[]): void {
    if (decks.length === 0) {
      const empty = this.appendChild(this.container, "div", "");
      empty.style.cssText = "text-align:center;padding:32px 0;color:var(--remi-text-muted);";
      empty.innerHTML = "📭 暂无卡片<br><span style='font-size:0.85em'>编辑笔记并保存后自动识别</span>";
      return;
    }

    const sectionTitle = this.appendChild(this.container, "div", "");
    sectionTitle.style.cssText = "font-weight:600;font-size:0.9em;margin-bottom:8px;color:var(--remi-text-muted);";
    sectionTitle.textContent = "📁 所有卡组";

    for (const deck of decks) {
      const card = this.appendChild(this.container, "div", "");
      card.style.cssText = `
        display:flex;justify-content:space-between;align-items:center;
        padding:10px 14px; border-radius:8px; cursor:pointer;
        border:1px solid var(--remi-border); margin-bottom:4px;
        background:var(--remi-card-bg); transition:all 0.1s;
      `;
      card.addEventListener("mouseenter", () => card.style.borderColor = "var(--remi-accent)");
      card.addEventListener("mouseleave", () => card.style.borderColor = "var(--remi-border)");

      const left = this.appendChild(card, "div", "");
      left.style.cssText = "display:flex;align-items:center;gap:10px;";

      const name = this.appendChild(left, "span", "");
      name.style.cssText = "font-weight:600;font-size:0.9em;";
      name.textContent = deck.name;

      const chips = this.appendChild(left, "div", "");
      chips.style.cssText = "display:flex;gap:4px;font-size:0.75em;";
      chips.innerHTML = `
        <span style="color:var(--remi-text-muted)">🆕${deck.newCount}</span>
        <span style="color:var(--remi-info)">👁${deck.exposureCount}</span>
        <span style="color:var(--remi-accent)">🧪${deck.testCount}</span>
        <span style="color:var(--remi-success)">🔄${deck.reviewCount}</span>
      `;

      const right = this.appendChild(card, "div", "");
      right.style.cssText = "display:flex;align-items:center;gap:8px;";

      const count = this.appendChild(right, "span", "");
      count.style.cssText = "font-size:0.85em;color:var(--remi-text-muted);";
      count.textContent = `${deck.totalCards} 词`;

      if (deck.dueCount > 0) {
        const badge = this.appendChild(right, "span", "");
        badge.style.cssText = `
          background:var(--remi-danger);color:#fff;font-size:0.75em;
          padding:2px 8px;border-radius:10px;font-weight:600;
        `;
        badge.textContent = `${deck.dueCount}`;
      }

      card.addEventListener("click", () => this.callbacks.onDeckClick(deck.name));
    }
  }
}
