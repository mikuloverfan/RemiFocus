import { IEngine } from "../engine/interface";
// RemiFocus — 卡组详情弹窗（简化版）
// 只显示：
//   - 卡组名称 + 卡片总数
//   - 三种学习模式入口

import { UIComponent } from "./base";
import { DeckInfo } from "../models/card";

export interface DeckModalCallbacks {
  onBack: () => void;
  onStartLearning: (deckName: string, mode: "exposure" | "test" | "review") => void;
}

export class DeckModal extends UIComponent {
  private deckName: string;
  private callbacks: DeckModalCallbacks;

  constructor(
    container: HTMLElement,
    engine: IEngine,
    deckName: string,
    callbacks: DeckModalCallbacks
  ) {
    super(container, engine);
    this.deckName = deckName;
    this.callbacks = callbacks;
    container.classList.add("remi-focus", "remi-deck-modal");
  }

  async render(): Promise<void> {
    this.clear();
    const info = await this.engine.getDeckInfo(this.deckName);

    this.renderHeader(info);
    this.renderModeButtons(info);
  }

  private renderHeader(info: DeckInfo): void {
    const header = this.appendChild(this.container, "div", "remi-popup-header");
    const title = this.appendChild(header, "div", "remi-popup-title");
    title.textContent = `📇 ${info.name}  (${info.totalCards} 词)`;

    const backBtn = this.appendChild(header, "button", "remi-btn");
    backBtn.textContent = "← 返回";
    backBtn.addEventListener("click", () => this.callbacks.onBack());
  }

  private renderModeButtons(info: DeckInfo): void {
    const btnGroup = this.appendChild(this.container, "div", "remi-btn-group");
    btnGroup.style.justifyContent = "center";
    btnGroup.style.flexDirection = "column";
    btnGroup.style.gap = "12px";
    btnGroup.style.marginTop = "20px";

    const modes: { mode: "exposure" | "test" | "review"; label: string; desc: string; cls: string }[] = [
      { mode: "exposure", label: "👁 练习模式 (Exposure)", desc: "快速翻词，熟悉阶段", cls: "" },
      { mode: "test", label: "🧪 测试模式 (Test)", desc: "回忆单词，影响调度", cls: "remi-btn-primary" },
      { mode: "review", label: "🔄 复习模式 (Review)", desc: "基于间隔算法自动调度", cls: "" },
    ];

    for (const m of modes) {
      const wrapper = this.appendChild(btnGroup, "div", "");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "4px";

      const btn = this.appendChild(wrapper, "button", `remi-btn ${m.cls}`);
      btn.textContent = m.label;
      btn.style.width = "100%";
      btn.style.padding = "12px 20px";
      btn.style.fontSize = "1em";
      btn.addEventListener("click", () =>
        this.callbacks.onStartLearning(this.deckName, m.mode)
      );

      const desc = this.appendChild(wrapper, "span", "");
      desc.textContent = m.desc;
      desc.style.fontSize = "0.8em";
      desc.style.color = "var(--remi-text-muted)";
    }

    // 统计信息放在底部
    const statsRow = this.appendChild(this.container, "div", "remi-card-stats");
    statsRow.style.justifyContent = "center";
    statsRow.style.marginTop = "20px";
    statsRow.innerHTML = `
      <span class="remi-stat">🆕 新词 <strong>${info.newCount}</strong></span>
      <span class="remi-stat">👁 初学 <strong>${info.exposureCount}</strong></span>
      <span class="remi-stat">🧪 测试 <strong>${info.testCount}</strong></span>
      <span class="remi-stat">🔄 复习 <strong>${info.reviewCount}</strong></span>
    `;
  }
}
