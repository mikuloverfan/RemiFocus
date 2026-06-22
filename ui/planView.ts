// RemiFocus — PLAN_VIEW：计划提醒专属页面
// 只做「调度解释器」：显示今日负载、未来压力、overdue 修复建议
// 不放置学习入口

import { UIComponent } from "./base";
import { IEngine } from "../engine/interface";

export interface PlanViewCallbacks {
  onBackToDeck: () => void;
  onStartReview: () => void;
}

export class PlanView extends UIComponent {
  private callbacks: PlanViewCallbacks;

  constructor(
    container: HTMLElement,
    engine: IEngine,
    callbacks: PlanViewCallbacks
  ) {
    super(container, engine);
    this.callbacks = callbacks;
    container.style.cssText = "padding:20px 24px;height:100%;overflow-y:auto;box-sizing:border-box;";
    container.classList.add("remi-focus");
  }

  async render(): Promise<void> {
    this.clear();
    const stats = await this.engine.getStats();
    const decks = await this.engine.getAllDeckInfos();

    this.renderHeader();
    this.renderTodayPlan(stats);
    this.renderDueCards(decks);
    this.renderWeeklyForecast(decks);
    this.renderHabitTrack();
    this.renderFooter();
  }

  private renderHeader(): void {
    const header = this.appendChild(this.container, "div", "");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;";

    const title = this.appendChild(header, "h2", "");
    title.textContent = "📅 学习计划";
    title.style.margin = "0";

    const backBtn = this.appendChild(header, "button", "");
    backBtn.textContent = "← 返回卡组";
    backBtn.style.cssText = "padding:6px 14px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-primary-alt);cursor:pointer;font-size:0.85em;";
    backBtn.addEventListener("click", () => this.callbacks.onBackToDeck());
  }

  private renderTodayPlan(stats: { dueToday: number; new: number; review: number; total: number }): void {
    const card = this.appendChild(this.container, "div", "");
    card.style.cssText = "padding:16px;border-radius:12px;border:1px solid var(--background-modifier-border);background:var(--background-primary);margin-bottom:16px;";

    this.appendChild(card, "div", "").textContent = "🎯 今日计划";
    (card.lastChild as HTMLElement).style.cssText = "font-weight:600;font-size:1em;margin-bottom:12px;";

    const target = 30; // 每日目标
    const done = stats.review; // 已复习数
    const progress = Math.min(100, Math.round((done / target) * 100));

    // 进度条
    const barBg = this.appendChild(card, "div", "");
    barBg.style.cssText = "height:8px;border-radius:4px;background:var(--background-modifier-border);margin-bottom:8px;overflow:hidden;";
    const bar = this.appendChild(barBg, "div", "");
    bar.style.cssText = `height:100%;border-radius:4px;background:var(--interactive-accent);width:${progress}%;transition:width 0.3s;`;

    // 统计
    const row = this.appendChild(card, "div", "");
    row.style.cssText = "display:flex;gap:16px;font-size:0.85em;color:var(--text-muted);";
    this.addStat(row, "✅", `${done}/${target}`);
    this.addStat(row, "📊", `${progress}%`);
    this.addStat(row, "🕐", stats.dueToday > 0 ? `${stats.dueToday} 待复习` : "全部完成");

    if (stats.dueToday > 0) {
      const reviewBtn = this.appendChild(card, "button", "");
      reviewBtn.textContent = "▶ 立即复习";
      reviewBtn.style.cssText = "margin-top:12px;padding:8px 16px;border-radius:8px;border:none;background:var(--interactive-accent);color:var(--text-on-accent,white);cursor:pointer;font-size:0.9em;";
      reviewBtn.addEventListener("click", () => this.callbacks.onStartReview());
    }
  }

  private renderDueCards(decks: { name: string; dueCount: number; mastery: number }[]): void {
    const dueDecks = decks.filter((d) => d.dueCount > 0);
    if (dueDecks.length === 0) return;

    const section = this.appendChild(this.container, "div", "");
    section.style.cssText = "margin-bottom:16px;";

    this.appendChild(section, "div", "").textContent = "🔴 待复习";
    (section.lastChild as HTMLElement).style.cssText = "font-weight:500;font-size:0.9em;margin-bottom:8px;color:var(--text-error);";

    for (const d of dueDecks) {
      const row = this.appendChild(section, "div", "");
      row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:6px;background:var(--background-primary-alt);margin-bottom:4px;font-size:0.85em;";

      const nameEl = this.appendChild(row, "span", "");
      nameEl.textContent = `📇 ${d.name}`;

      const dueEl = this.appendChild(row, "span", "");
      dueEl.textContent = `🔴 ${d.dueCount} 张`;
      dueEl.style.color = "var(--text-error)";
    }
  }

  private renderWeeklyForecast(decks: { name: string; dueCount: number; mastery: number; totalCards: number }[]): void {
    const section = this.appendChild(this.container, "div", "");
    section.style.cssText = "margin-bottom:16px;";

    this.appendChild(section, "div", "").textContent = "📊 未来 7 天压力";
    (section.lastChild as HTMLElement).style.cssText = "font-weight:500;font-size:0.9em;margin-bottom:8px;";

    const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    const today = new Date().getDay();
    const startDay = today === 0 ? 0 : today - 1; // 周一 = 0

    for (let i = 0; i < 7; i++) {
      const dayIdx = (startDay + i) % 7;
      const isToday = i === 0;
      const totalDue = decks.reduce((s, d) => s + d.dueCount, 0);
      const estimated = Math.round(totalDue / Math.max(1, 7 - i));

      const row = this.appendChild(section, "div", "");
      row.style.cssText = `display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.85em;${isToday ? "font-weight:600;" : ""}`;

      const dayEl = this.appendChild(row, "span", "");
      dayEl.textContent = isToday ? `🟢 ${days[dayIdx]} (今日)` : days[dayIdx];
      dayEl.style.cssText = `flex:0 0 90px;${isToday ? "" : "color:var(--text-muted);"}`;

      const barBg = this.appendChild(row, "div", "");
      barBg.style.cssText = "flex:1;height:6px;border-radius:3px;background:var(--background-modifier-border);overflow:hidden;";
      const barW = Math.min(100, Math.round((estimated / 20) * 100));
      const bar = this.appendChild(barBg, "div", "");
      bar.style.cssText = `height:100%;border-radius:3px;background:${estimated > 15 ? "var(--text-error)" : estimated > 8 ? "var(--color-orange)" : "var(--interactive-accent)"};width:${barW}%;`;

      const countEl = this.appendChild(row, "span", "");
      countEl.textContent = `~${estimated} 词`;
      countEl.style.cssText = "flex:0 0 50px;text-align:right;color:var(--text-muted);font-size:0.85em;";
    }
  }

  private renderHabitTrack(): void {
    const section = this.appendChild(this.container, "div", "");
    section.style.cssText = "margin-bottom:16px;";

    this.appendChild(section, "div", "").textContent = "🔥 习惯追踪";
    (section.lastChild as HTMLElement).style.cssText = "font-weight:500;font-size:0.9em;margin-bottom:8px;";

    const row = this.appendChild(section, "div", "");
    row.style.cssText = "display:flex;gap:6px;align-items:center;";

    // 模拟连续学习天数
    const streak = 5;
    const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

    for (let i = 0; i < 7; i++) {
      const done = i < streak;
      const day = this.appendChild(row, "div", "");
      day.textContent = weekDays[i];
      day.style.cssText = `
        width:32px;height:32px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:0.8em;
        background:${done ? "var(--interactive-accent)" : "var(--background-modifier-border)"};
        color:${done ? "var(--text-on-accent, white)" : "var(--text-muted)"};
      `;
    }

    this.appendChild(section, "div", "").textContent = `连续学习: 🔥 ${streak} 天`;
    (section.lastChild as HTMLElement).style.cssText = "font-size:0.85em;color:var(--text-muted);margin-top:8px;";
  }

  private renderFooter(): void {
    const footer = this.appendChild(this.container, "div", "");
    footer.style.cssText = "margin-top:16px;padding-top:12px;border-top:1px solid var(--background-modifier-border);font-size:0.8em;color:var(--text-faint);text-align:center;";
    footer.textContent = "📌 计划页面只做负载分析与建议，学习请从卡组页进入";
  }

  private addStat(container: HTMLElement, icon: string, text: string): void {
    const el = this.appendChild(container, "span", "");
    el.textContent = `${icon} ${text}`;
  }
}
