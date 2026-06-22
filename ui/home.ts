// RemiFocus — HOME：主页 Dashboard（状态看板）
// 只回答三个问题：
// 1. 我学了多少？
// 2. 我忘得怎么样？
// 3. 我该学什么？
// 不放置"开始学习"按钮 — 学习必须从 DECK_VIEW 进入

import { UIComponent } from "./base";
import { IEngine } from "../engine/interface";
import { HeatmapWidget } from "./heatmap";
import { StatsPanel } from "./stats";
import { DeckInfo } from "../models/card";
import { DeckStats } from "../engine/interface";

export interface HomeCallbacks {
  onOpenDeck: () => void;
  onOpenPlan: () => void;
  onOpenAlgo: () => void;
  onDeckClick: (deckName: string) => void;
}

export class RemiDashboard extends UIComponent {
  private callbacks: HomeCallbacks;
  private statsMode: "heatmap" | "line_day" | "line_week" | "line_month" = "heatmap";

  constructor(
    container: HTMLElement,
    engine: IEngine,
    callbacks: HomeCallbacks
  ) {
    super(container, engine);
    this.callbacks = callbacks;
    container.classList.add("remi-focus");
    container.style.cssText = "padding:20px 24px;height:100%;overflow-y:auto;box-sizing:border-box;";
  }

  async render(): Promise<void> {
    this.clear();
    const stats = await this.engine.getStats();
    const decks = await this.engine.getAllDeckInfos();

    this.renderHeader();
    this.renderTodayStatus(stats);
    this.renderChartSection(decks);
    this.renderRecentDecks(decks);
    this.renderFooter();
  }

  private renderHeader(): void {
    const header = this.appendChild(this.container, "div", "");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;";

    const title = this.appendChild(header, "h2", "");
    title.textContent = "🏠 主页";
    title.style.margin = "0";

    const actions = this.appendChild(header, "div", "");
    actions.style.cssText = "display:flex;gap:6px;";

    this.addSmallBtn(actions, "📅 计划", () => this.callbacks.onOpenPlan());
    this.addSmallBtn(actions, "📐 算法", () => this.callbacks.onOpenAlgo());
    this.addSmallBtn(actions, "📇 卡组", () => this.callbacks.onOpenDeck());
  }

  // ─── 今日状态（Q1: 我学了多少？） ───

  private renderTodayStatus(stats: DeckStats): void {
    const card = this.appendChild(this.container, "div", "");
    card.style.cssText = "padding:16px;border-radius:12px;border:1px solid var(--background-modifier-border);background:var(--background-primary);margin-bottom:16px;";

    const title = this.appendChild(card, "div", "");
    title.textContent = "📊 今日状态";
    title.style.cssText = "font-weight:600;font-size:0.95em;margin-bottom:12px;";

    const grid = this.appendChild(card, "div", "");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:12px;";

    this.addMetric(grid, "📄 总卡片", `${stats.total}`, "");
    this.addMetric(grid, "🆕 新词", `${stats.new}`, stats.new > 0 ? "var(--interactive-accent)" : "");
    this.addMetric(grid, "🔴 待复习", `${stats.dueToday}`, stats.dueToday > 0 ? "var(--text-error)" : "var(--color-green)");

    // 一行文字总结
    const summary = this.appendChild(card, "div", "");
    summary.style.cssText = "margin-top:12px;font-size:0.82em;color:var(--text-muted);text-align:center;";

    if (stats.dueToday > 0) {
      summary.textContent = `📌 有 ${stats.dueToday} 张卡片待复习，建议前往卡组页开始学习`;
    } else if (stats.new > 0) {
      summary.textContent = `📌 有 ${stats.new} 张新卡片等待初次学习`;
    } else {
      summary.textContent = "📌 今日任务已全部完成，做得很棒！";
    }
  }

  // ─── 图表区（Q2: 我忘得怎么样？） ───

  private async renderChartSection(decks: DeckInfo[]): Promise<void> {
    const section = this.appendChild(this.container, "div", "");
    section.style.cssText = "margin-bottom:16px;";

    // Tab 切换
    const tabRow = this.appendChild(section, "div", "");
    tabRow.style.cssText = "display:flex;gap:4px;margin-bottom:8px;";

    const tabs = [
      { key: "heatmap" as const, label: "🔥 热力图" },
      { key: "line_day" as const, label: "📈 日" },
      { key: "line_week" as const, label: "📈 周" },
      { key: "line_month" as const, label: "📈 月" },
    ];

    for (const tab of tabs) {
      const btn = this.appendChild(tabRow, "button", "");
      btn.textContent = tab.label;
      const isActive = this.statsMode === tab.key;
      btn.style.cssText = `
        padding:4px 12px;border-radius:14px;border:1px solid var(--background-modifier-border);
        background:${isActive ? "var(--interactive-accent)" : "var(--background-primary-alt)"};
        color:${isActive ? "var(--text-on-accent, white)" : "var(--text-normal)"};
        cursor:pointer;font-size:0.8em;transition:all 0.2s;
      `;
      btn.addEventListener("click", () => {
        this.statsMode = tab.key;
        this.render();
      });
    }

    // 图表区域
    const chartArea = this.appendChild(section, "div", "");
    chartArea.style.cssText = "padding:16px;border-radius:10px;border:1px solid var(--background-modifier-border);background:var(--background-primary);";

    if (this.statsMode === "heatmap") {
      // 使用现有 HeatmapWidget
      const heatmap = new HeatmapWidget(chartArea, this.engine);
      await heatmap.render();
    } else {
      // 简单折线图（基于 history 数据模拟）
      this.renderSimpleLineChart(chartArea, this.statsMode);
    }

    // 图表解释（关键：每图一行「这说明什么+我该怎么做」）
    const insight = this.appendChild(section, "div", "");
    insight.style.cssText = "margin-top:6px;font-size:0.8em;color:var(--text-muted);padding:8px 12px;border-radius:8px;background:var(--background-primary-alt);";

    const totalDue = decks.reduce((s, d) => s + d.dueCount, 0);
    if (totalDue > 10) {
      insight.textContent = `📌 近期待复习卡片较多 (${totalDue}张)，建议制定复习计划避免堆积 → [打开计划]`;
      insight.addEventListener("click", () => this.callbacks.onOpenPlan());
      insight.style.cursor = "pointer";
    } else if (totalDue > 0) {
      insight.textContent = `📌 少量待复习 (${totalDue}张)，保持节奏即可 👍`;
    } else {
      insight.textContent = `📌 全部卡片已复习，做得很棒！继续保持 👏`;
    }
  }

  private renderSimpleLineChart(container: HTMLElement, mode: string): void {
    // 简单线条模拟（实际应基于 history 数据渲染 SVG 或 canvas）
    const lines = this.appendChild(container, "div", "");
    lines.style.cssText = "height:80px;display:flex;align-items:flex-end;gap:3px;padding:0 4px;";

    const count = mode === "line_day" ? 7 : mode === "line_week" ? 4 : 12;
    for (let i = 0; i < count; i++) {
      const h = 20 + Math.random() * 50;
      const bar = this.appendChild(lines, "div", "");
      bar.style.cssText = `flex:1;height:${h}px;border-radius:2px;background:var(--interactive-accent);opacity:${0.4 + (i / count) * 0.6};`;
    }

    const label = this.appendChild(container, "div", "");
    label.textContent = mode === "line_day" ? "近 7 天学习趋势" : mode === "line_week" ? "近 4 周趋势" : "近 12 月趋势";
    label.style.cssText = "text-align:center;font-size:0.78em;color:var(--text-faint);margin-top:8px;";
  }

  // ─── 最近卡组入口（Q3: 我该学什么？） ───

  private renderRecentDecks(decks: DeckInfo[]): void {
    if (decks.length === 0) return;

    const section = this.appendChild(this.container, "div", "");
    section.style.cssText = "margin-bottom:16px;";

    const title = this.appendChild(section, "div", "");
    title.textContent = "📁 最近卡组";
    title.style.cssText = "font-weight:500;font-size:0.9em;margin-bottom:8px;";

    // 只显示最多 3 个有 due 的卡组
    const recent = decks
      .filter((d) => d.dueCount > 0)
      .sort((a, b) => b.dueCount - a.dueCount)
      .slice(0, 3);

    if (recent.length === 0) {
      const empty = this.appendChild(section, "div", "");
      empty.textContent = "✅ 所有卡组已复习完毕";
      empty.style.cssText = "font-size:0.85em;color:var(--text-muted);padding:8px 4px;";
      return;
    }

    for (const d of recent) {
      const row = this.appendChild(section, "div", "");
      row.style.cssText = `
        display:flex;align-items:center;gap:10px;
        padding:8px 12px;border-radius:8px;
        border:1px solid var(--background-modifier-border);
        background:var(--background-primary);cursor:pointer;
        margin-bottom:4px;transition:all 0.2s;
      `;
      row.addEventListener("click", () => this.callbacks.onDeckClick(d.name));
      row.addEventListener("mouseenter", () => row.style.borderColor = "var(--interactive-accent)");

      const name = this.appendChild(row, "span", "");
      name.textContent = `📇 ${d.name}`;
      name.style.cssText = "flex:1;font-size:0.85em;";

      const barBg = this.appendChild(row, "div", "");
      barBg.style.cssText = "flex:0 0 60px;height:5px;border-radius:3px;background:var(--background-modifier-border);overflow:hidden;";
      const bar = this.appendChild(barBg, "div", "");
      bar.style.cssText = `height:100%;background:var(--interactive-accent);width:${d.mastery}%;`;

      const due = this.appendChild(row, "span", "");
      due.textContent = `🔴 ${d.dueCount}`;
      due.style.cssText = "font-size:0.8em;color:var(--text-error);";
    }
  }

  // ─── 底部 ───

  private renderFooter(): void {
    const footer = this.appendChild(this.container, "div", "");
    footer.style.cssText = "margin-top:16px;padding-top:10px;border-top:1px solid var(--background-modifier-border);font-size:0.78em;color:var(--text-faint);text-align:center;";
    footer.textContent = "📌 主页只展示学习状态，学习请从「卡组页」进入";
  }

  // ─── 工具方法 ───

  private addMetric(container: HTMLElement, label: string, value: string, color?: string): void {
    const el = this.appendChild(container, "div", "");
    el.style.cssText = "text-align:center;";

    const valEl = this.appendChild(el, "div", "");
    valEl.textContent = value;
    valEl.style.cssText = `font-size:1.6em;font-weight:700;${color ? `color:${color};` : ""}`;

    const labelEl = this.appendChild(el, "div", "");
    labelEl.textContent = label;
    labelEl.style.cssText = "font-size:0.78em;color:var(--text-muted);margin-top:2px;";
  }

  private addSmallBtn(container: HTMLElement, text: string, onClick: () => void): void {
    const btn = this.appendChild(container, "button", "");
    btn.textContent = text;
    btn.style.cssText = "padding:4px 10px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary-alt);cursor:pointer;font-size:0.78em;";
    btn.addEventListener("click", onClick);
  }
}
