// RemiFocus — 提醒系统组件
// 打开插件时检查：
//   - 如果有 overdue → 强提示
//   - 实时显示当前学习进度
//   - 提醒未完成学习任务

import { UIComponent } from "./base";
import { DeckInfo } from "../models/card";

export interface ReminderCallbacks {
  /** 点击提醒 → 跳转到对应卡组学习 */
  onDeckClick: (deckName: string) => void;
  /** 忽略提醒 */
  onDismiss: () => void;
}

interface ReminderItem {
  deckName: string;
  overdueCount: number;
  dueTodayCount: number;
  severity: "danger" | "warning" | "info";
  message: string;
}

/**
 * 提醒系统组件
 * 可嵌入到 Popup、Dashboard 或作为独立 Banner 使用
 *
 * 使用示例：
 * ```ts
 * const reminder = new ReminderSystem(containerEl, engine, callbacks);
 * await reminder.render();
 * ```
 */
export class ReminderSystem extends UIComponent {
  private callbacks: ReminderCallbacks;

  constructor(
    container: HTMLElement,
    engine: IEngine,
    callbacks: ReminderCallbacks
  ) {
    super(container, engine);
    this.callbacks = callbacks;
    container.classList.add("remi-focus");
  }

  async render(): Promise<void> {
    this.clear();
    const reminders = await this.collectReminders();

    if (reminders.length === 0) {
      this.renderAllClear();
      return;
    }

    // 按严重程度排序：danger > warning > info
    reminders.sort((a, b) => {
      const order = { danger: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });

    for (const reminder of reminders) {
      this.renderReminder(reminder);
    }
  }

  // ─── 收集提醒 ───

  private async collectReminders(): Promise<ReminderItem[]> {
    const decks = await this.engine.getAllDeckInfos();
    const today = new Date().toISOString().slice(0, 10);
    const items: ReminderItem[] = [];

    for (const deck of decks) {
      if (deck.dueCount === 0) continue;

      // 获取卡组的详情以判断 overdue（过期的 next < today）
      const mastery = await this.engine.computeMastery(deck.name);

      let severity: "danger" | "warning" | "info";
      let message: string;

      if (deck.dueCount > 15) {
        severity = "danger";
        message = `⚠️ 紧急！${deck.name} 有 ${deck.dueCount} 个单词严重超期`;
      } else if (deck.dueCount > 5) {
        severity = "warning";
        message = `📝 ${deck.name} 有 ${deck.dueCount} 个单词待复习`;
      } else {
        severity = "info";
        message = `💡 ${deck.name} 有 ${deck.dueCount} 个单词可复习`;
      }

      items.push({
        deckName: deck.name,
        overdueCount: deck.dueCount,
        dueTodayCount: deck.dueCount,
        severity,
        message,
      });
    }

    return items;
  }

  // ─── 渲染提醒 ───

  private renderReminder(reminder: ReminderItem): void {
    const el = this.appendChild(this.container, "div", `remi-reminder ${reminder.severity}`);
    el.style.cursor = "pointer";
    el.addEventListener("click", () => this.callbacks.onDeckClick(reminder.deckName));

    // 图标
    const icons = {
      danger: "🔴",
      warning: "🟡",
      info: "🔵",
    };

    const icon = this.appendChild(el, "span", "");
    icon.textContent = icons[reminder.severity];

    // 消息
    const text = this.appendChild(el, "span", "");
    text.style.flex = "1";
    text.textContent = reminder.message;

    // 数量徽章
    const badge = this.appendChild(el, "span", "remi-reminder-time");
    badge.textContent = `${reminder.dueTodayCount} 词`;
  }

  // ─── 全部完成 ───

  private renderAllClear(): void {
    const el = this.appendChild(this.container, "div", "remi-status-banner success");
    el.innerHTML = `
      <span class="remi-status-icon">✅</span>
      <span class="remi-status-text">所有学习任务已完成，继续保持！</span>
    `;
  }
}

import { IEngine } from "../engine/interface";
