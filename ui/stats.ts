// RemiFocus — 统计面板 + 复习规划

import { UIComponent } from "./base";
import { DeckInfo } from "../models/card";

export class StatsPanel extends UIComponent {
  private decks: DeckInfo[] = [];

  async render(): Promise<void> {
    this.clear();
    this.renderTodayProgress();
    this.renderFolderStats();
    this.renderReviewPlan();
  }

  setData(decks: DeckInfo[]): void {
    this.decks = decks;
  }

  // ─── 今日进度 ───

  private renderTodayProgress(): void {
    const card = this.appendChild(this.container, "div", "remi-card");
    card.style.cursor = "default";

    const h = this.appendChild(card, "div", "");
    h.style.cssText = "font-weight:600;font-size:0.95em;margin-bottom:8px;";
    h.textContent = "📊 今日复习进度";

    const totalDue = this.decks.reduce((s, d) => s + d.dueCount, 0);
    const totalCards = this.decks.reduce((s, d) => s + d.totalCards, 0);
    const done = totalCards - totalDue;
    const progress = totalCards > 0 ? Math.round((done / totalCards) * 100) : 0;

    const bar = this.appendChild(card, "div", "remi-progress-bar");
    const fill = this.appendChild(bar, "div", `remi-progress-fill ${progress >= 80 ? "high" : "medium"}`);
    fill.style.width = `${progress}%`;

    const text = this.appendChild(card, "div", "");
    text.style.cssText = "font-size:0.85em;margin-top:4px;color:var(--remi-text-muted);";
    text.innerHTML = `已完成 <strong>${done}</strong> / ${totalCards} 词 (${progress}%)`;

    // 每个卡组的小进度条
    for (const deck of this.decks) {
      if (deck.totalCards === 0) continue;
      const deckDone = deck.totalCards - deck.dueCount;
      const deckPct = Math.round((deckDone / deck.totalCards) * 100);
      const row = this.appendChild(card, "div", "remi-plan-row");
      row.style.padding = "4px 0";
      row.innerHTML = `
        <span style="font-size:0.8em">${deck.name}</span>
        <span style="font-size:0.8em">${deckPct}%</span>
      `;
      const miniBar = this.appendChild(card, "div", "remi-progress-bar");
      miniBar.style.height = "3px";
      const miniFill = this.appendChild(miniBar, "div", "remi-progress-fill low");
      miniFill.style.width = `${deckPct}%`;
    }
  }

  // ─── 文件夹统计 ───

  private renderFolderStats(): void {
    if (this.decks.length === 0) return;

    const card = this.appendChild(this.container, "div", "remi-card");
    card.style.cursor = "default";

    const h = this.appendChild(card, "div", "");
    h.style.cssText = "font-weight:600;font-size:0.95em;margin-bottom:8px;margin-top:8px;";
    h.textContent = "📁 文件夹统计";

    // 按文件夹分组
    const folderMap = new Map<string, { cards: number; mastery: number }>();
    for (const d of this.decks) {
      const f = d.name.split("/")[0] || d.name;
      const prev = folderMap.get(f) ?? { cards: 0, mastery: 0 };
      prev.cards += d.totalCards;
      // mastery 加权平均
      prev.mastery = prev.mastery + d.mastery * d.totalCards;
      // 简化：累加后用 totalCards 除
      folderMap.set(f, prev);
    }

    for (const [folder, data] of folderMap) {
      // 修正 mastery 计算
      const totalMastery = this.decks
        .filter(d => (d.name.split("/")[0] || d.name) === folder)
        .reduce((sum, d) => sum + d.mastery * d.totalCards, 0);
      const avgMastery = data.cards > 0 ? Math.round(totalMastery / data.cards) : 0;

      const row = this.appendChild(card, "div", "remi-card-header");
      row.style.padding = "4px 0";
      const nameEl = this.appendChild(row, "span", "");
      nameEl.style.fontSize = "0.85em";
      nameEl.textContent = `📂 ${folder}`;
      const countEl = this.appendChild(row, "span", "");
      countEl.style.cssText = "font-size:0.85em;font-weight:600;";
      countEl.textContent = `${data.cards} 词`;

      const bar = this.appendChild(card, "div", "remi-progress-bar");
      bar.style.height = "4px";
      const fill = this.appendChild(bar, "div", `remi-progress-fill ${avgMastery >= 60 ? "high" : "medium"}`);
      fill.style.width = `${avgMastery}%`;
    }
  }

  // ─── 复习规划 ───

  private renderReviewPlan(): void {
    const card = this.appendChild(this.container, "div", "remi-card");
    card.style.cursor = "default";

    const h = this.appendChild(card, "div", "");
    h.style.cssText = "font-weight:600;font-size:0.95em;margin-bottom:8px;margin-top:8px;";
    h.textContent = "📅 复习规划";

    const todayDue = this.decks.reduce((s, d) => s + d.dueCount, 0);
    const tomorrowEst = Math.round(todayDue * 0.6 + this.decks.reduce((s, d) => s + d.testCount, 0) * 0.3);
    const weekEst = todayDue * 4 + this.decks.reduce((s, d) => s + d.newCount, 0);

    const plans = [
      { label: "今日", count: todayDue, urgent: todayDue > 0 },
      { label: "明日（预估）", count: tomorrowEst, urgent: false },
      { label: "本周（预估）", count: weekEst, urgent: false },
    ];

    for (const plan of plans) {
      const row = this.appendChild(card, "div", "remi-plan-row");
      row.style.padding = "6px 0";
      const label = this.appendChild(row, "span", "");
      label.style.fontSize = "0.85em";
      label.textContent = plan.label;
      const count = this.appendChild(row, "span", "");
      count.style.cssText = `font-size:0.85em;font-weight:600;color:${plan.urgent ? "var(--remi-danger)" : "var(--remi-text)"};`;
      count.textContent = `${plan.count} 词`;
    }

    // 今日目标
    if (todayDue > 0) {
      const tip = this.appendChild(card, "div", "");
      tip.style.cssText = "font-size:0.8em;margin-top:8px;color:var(--remi-text-muted);text-align:center;";
      tip.textContent = `💡 建议今日复习 ${Math.min(todayDue, 20)} 词，约 ${Math.ceil(Math.min(todayDue, 20) / 10)} 分钟`;
    }
  }
}
