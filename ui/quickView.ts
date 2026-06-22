import { IEngine } from "../engine/interface";
// RemiFocus — 右侧边栏小部件
// 今日概览 + 快速复习 + 文件夹速览

import { UIComponent } from "./base";

export interface QuickViewCallbacks {
  onStartQuickReview: () => void;
  onOpenDashboard: () => void;
  onOpenModeSelector: () => void;  // v1.1: 取代旧的 onOpenCardMaker
  onOpenCardMaker: () => void;
  onOpenAIChat: () => void;
}

export class QuickView extends UIComponent {
  private callbacks: QuickViewCallbacks;

  constructor(
    container: HTMLElement,
    engine: IEngine,
    callbacks: QuickViewCallbacks
  ) {
    super(container, engine);
    this.callbacks = callbacks;
    container.classList.add("remi-focus");
  }

  async render(): Promise<void> {
    this.clear();
    const stats = await this.engine.getStats();
    const decks = await this.engine.getAllDeckInfos();

    this.renderTitle();
    this.renderTodayOverview(stats);
    this.renderQuickActions();
    this.renderFolderSummary(decks);
  }

  private renderTitle(): void {
    const h = this.appendChild(this.container, "div", "remi-popup-header");
    h.style.padding = "8px 0";
    h.style.marginBottom = "8px";
    const t = this.appendChild(h, "div", "remi-popup-title");
    t.style.fontSize = "1em";
    t.textContent = "🧠 RemiFocus";
  }

  private renderTodayOverview(stats: {
    total: number; new: number; exposure: number;
    test: number; review: number; dueToday: number;
  }): void {
    const card = this.appendChild(this.container, "div", "remi-card");
    card.style.cursor = "default";

    const h = this.appendChild(card, "div", "");
    h.style.cssText = "font-weight:600;font-size:0.9em;margin-bottom:8px;";
    h.textContent = "📊 今日概览";

    const progress = stats.total > 0
      ? Math.round((stats.review / stats.total) * 100)
      : 0;
    const bar = this.appendChild(card, "div", "remi-progress-bar");
    const fill = this.appendChild(bar, "div", "remi-progress-fill medium");
    fill.style.width = `${progress}%`;

    const text = this.appendChild(card, "div", "");
    text.style.cssText = "font-size:0.85em;margin-top:4px;color:var(--remi-text-muted);";
    text.innerHTML = `
      待复习 <strong>${stats.dueToday}</strong> 词
      &nbsp;|&nbsp; 新词 <strong>${stats.new}</strong>
      &nbsp;|&nbsp; 总计 <strong>${stats.total}</strong>
    `;
  }

  private renderQuickActions(): void {
    const btnGroup = this.appendChild(this.container, "div", "remi-btn-group");
    btnGroup.style.marginTop = "8px";
    btnGroup.style.gap = "4px";

    // 第一行：AI 制卡（主入口，三模式选择）
    const modeBtn = this.appendChild(btnGroup, "button", "remi-btn");
    modeBtn.textContent = "🤖 AI 制卡";
    modeBtn.style.width = "100%";
    modeBtn.style.fontSize = "0.9em";
    modeBtn.style.fontWeight = "600";
    modeBtn.style.padding = "8px";
    modeBtn.style.background = "linear-gradient(135deg, #6c5ce7, #a29bfe)";
    modeBtn.style.color = "#fff";
    modeBtn.style.border = "none";
    modeBtn.style.borderRadius = "8px";
    modeBtn.style.marginBottom = "4px";
    modeBtn.addEventListener("click", () => this.callbacks.onOpenModeSelector());

    // 第二行：状态跳板（只做 4 种跳转）
    const row = this.appendChild(btnGroup, "div", "");
    row.style.cssText = "display:flex;gap:4px;width:100%;flex-wrap:wrap;";

    this.addJumpBtn(row, "📇 卡组", "var(--interactive-accent)", () => this.callbacks.onOpenDashboard());
    this.addJumpBtn(row, "🏠 主页", "var(--background-modifier-border)", () => this.callbacks.onOpenDashboard());
    this.addJumpBtn(row, "📅 计划", "var(--background-modifier-border)", () => this.callbacks.onOpenDashboard());
    this.addJumpBtn(row, "⚙️ 设置", "var(--background-modifier-border)", () => this.callbacks.onOpenDashboard());
  }

  private addJumpBtn(container: HTMLElement, text: string, borderColor: string, onClick: () => void): void {
    const btn = this.appendChild(container, "button", "remi-btn");
    btn.textContent = text;
    btn.style.cssText = `flex:1;font-size:0.82em;border:1px solid ${borderColor};`;
    btn.addEventListener("click", onClick);
  }

  private renderFolderSummary(
    decks: { name: string; totalCards: number; mastery: number }[]
  ): void {
    if (decks.length === 0) return;

    const card = this.appendChild(this.container, "div", "remi-card");
    card.style.cursor = "default";
    card.style.marginTop = "8px";

    const h = this.appendChild(card, "div", "");
    h.style.cssText = "font-weight:600;font-size:0.9em;margin-bottom:8px;";
    h.textContent = "📁 文件夹速览";

    // 按文件夹分组
    const folderMap = new Map<string, { cards: number; mastery: number }>();
    for (const d of decks) {
      const f = d.name.split("/")[0] || d.name;
      const prev = folderMap.get(f) ?? { cards: 0, mastery: 0 };
      prev.cards += d.totalCards;
      prev.mastery += d.mastery * d.totalCards;
      folderMap.set(f, prev);
    }

    for (const [folder, data] of folderMap) {
      const avgMastery = data.cards > 0 ? Math.round(data.mastery / data.cards) : 0;
      const row = this.appendChild(card, "div", "remi-plan-row");
      row.style.padding = "4px 0";
      row.innerHTML = `
        <span style="font-size:0.85em">📂 ${folder}</span>
        <span style="font-size:0.85em;font-weight:600">${data.cards}词</span>
      `;
    }
  }
}
