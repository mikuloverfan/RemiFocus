// RemiFocus — 学习 Session 配置弹窗（二级弹窗）
// 进入学习前展示卡组熟练度，允许用户配置测试数量

import { UIComponent } from "./base";
import { IEngine } from "../engine/interface";
import { LearningMode, MasteryResult } from "../models/card";

export interface SessionConfigCallbacks {
  onStart: (count: number) => void;
  onCancel: () => void;
}

export class SessionConfigView extends UIComponent {
  private deckName: string;
  private mode: LearningMode;
  private callbacks: SessionConfigCallbacks;
  private mastery: MasteryResult = { mastery: 0, ease: 250, interval: 0, successRate: 0 };
  private deckTotal = 0;

  constructor(
    container: HTMLElement,
    engine: IEngine,
    deckName: string,
    mode: LearningMode,
    callbacks: SessionConfigCallbacks
  ) {
    super(container, engine);
    this.deckName = deckName;
    this.mode = mode;
    this.callbacks = callbacks;
    container.classList.add("remi-focus", "remi-session-config");
  }

  async render(): Promise<void> {
    this.clear();

    // 加载卡组信息
    const deckInfo = await this.engine.getDeckInfo(this.deckName);
    this.deckTotal = deckInfo.totalCards;
    this.mastery = await this.engine.computeMastery(this.deckName);

    const modeLabels: Record<LearningMode, { icon: string; label: string }> = {
      exposure: { icon: "👁", label: "初学 Exposure" },
      test: { icon: "🧪", label: "测试 Test" },
      review: { icon: "🔄", label: "复习 Review" },
    };
    const ml = modeLabels[this.mode];

    // ─── 顶部标题栏 ───
    const header = this.appendChild(this.container, "div", "remi-config-header");
    header.innerHTML = `
      <span style="font-size:1.1em;font-weight:700;">${ml.icon} ${ml.label}</span>
      <button class="remi-btn" style="font-size:0.85em;">✕ 取消</button>
    `;
    header.querySelector("button")!.addEventListener("click", () => this.callbacks.onCancel());

    // ─── 卡组信息 ───
    const deckRow = this.appendChild(this.container, "div", "remi-config-deck");
    deckRow.textContent = `📇 ${this.deckName}`;

    // ─── 熟练度面板 ───
    const masteryPanel = this.appendChild(this.container, "div", "remi-config-mastery");

    const masteryPct = this.mastery.mastery;
    const getMasteryColor = (pct: number): string => {
      if (pct >= 80) return "var(--remi-success)";
      if (pct >= 50) return "var(--remi-warning)";
      return "var(--remi-danger)";
    };
    const mColor = getMasteryColor(masteryPct);

    masteryPanel.innerHTML = `
      <div class="remi-config-mastery-ring" style="--pct:${masteryPct};--color:${mColor};">
        <span class="remi-config-mastery-pct">${masteryPct}%</span>
      </div>
      <div class="remi-config-mastery-details">
        <div class="remi-config-mastery-title">📊 卡组熟练度</div>
        <div class="remi-config-mastery-stats">
          <span>🃏 卡片总数: <strong>${this.deckTotal}</strong></span>
          <span>📈 轻松度: <strong>${this.mastery.ease}</strong></span>
          <span>⏱ 平均间隔: <strong>${this.mastery.interval} 天</strong></span>
          <span>🎯 历史正确率: <strong>${Math.round(this.mastery.successRate * 100)}%</strong></span>
        </div>
      </div>
    `;

    // ─── 测试数量配置 ───
    const configArea = this.appendChild(this.container, "div", "remi-config-count");

    const labelRow = this.appendChild(configArea, "div", "remi-config-count-label");
    labelRow.innerHTML = `
      <span>🔢 本次测试数量</span>
      <span style="font-size:0.8em;color:var(--remi-text-muted);">
        可大于卡片总数（超出部分自动加权抽卡，不熟练的词出现概率更高）
      </span>
    `;

    const inputRow = this.appendChild(configArea, "div", "remi-config-count-input");
    const decBtn = this.appendChild(inputRow, "button", "remi-btn");
    decBtn.textContent = "−";
    decBtn.style.cssText = "font-size:1.2em;font-weight:700;width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;";

    const input = this.appendChild(inputRow, "input", "remi-config-input") as HTMLInputElement;
    input.type = "number";
    input.min = "1";
    input.max = "999";
    input.value = String(Math.max(this.deckTotal, 20));
    input.style.cssText = `
      width:80px;text-align:center;font-size:1.3em;font-weight:700;
      border:2px solid var(--remi-border);border-radius:8px;
      padding:6px 12px;background:var(--remi-bg);color:var(--remi-text);
    `;

    const incBtn = this.appendChild(inputRow, "button", "remi-btn");
    incBtn.textContent = "+";
    incBtn.style.cssText = "font-size:1.2em;font-weight:700;width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;";

    // 快捷数量按钮
    const quickRow = this.appendChild(configArea, "div", "remi-config-quick");
    const quickValues = [10, 20, 40, this.deckTotal, this.deckTotal * 2];
    // 去重排序
    const uniqueQuick = [...new Set(quickValues.filter(v => v > 0))].sort((a, b) => a - b);

    for (const qv of uniqueQuick) {
      const qBtn = this.appendChild(quickRow, "button", "remi-btn");
      qBtn.textContent = `${qv} 词`;
      qBtn.style.cssText = `font-size:0.85em;${qv === this.deckTotal ? "border-color:var(--remi-accent);" : ""}`;
      qBtn.addEventListener("click", () => {
        input.value = String(qv);
      });
    }

    // ─── 动态加权提示 ───
    if (this.deckTotal < 40) {
      const tip = this.appendChild(this.container, "div", "remi-config-tip");
      tip.innerHTML = `💡 <strong>加权抽卡提示：</strong>当测试数量超过 ${this.deckTotal} 词时，系统会优先抽取之前答错的词，强化薄弱环节。`;
    }

    // ─── 减/加按钮事件 ───
    const updateValue = (delta: number) => {
      let v = parseInt(input.value) || this.deckTotal;
      v = Math.max(1, Math.min(999, v + delta));
      input.value = String(v);
    };
    decBtn.addEventListener("click", () => updateValue(-5));
    incBtn.addEventListener("click", () => updateValue(5));

    // ─── 开始按钮 ───
    const startBtnRow = this.appendChild(this.container, "div", "remi-config-start");
    const startBtn = this.appendChild(startBtnRow, "button", "remi-btn remi-btn-primary");
    startBtn.style.cssText = `
      padding:14px 48px;border:none;border-radius:10px;cursor:pointer;
      background:var(--remi-accent);color:#fff;font-size:1.1em;font-weight:700;
      transition:all 0.15s;
    `;
    startBtn.textContent = `🚀 开始学习 (${input.value} 词)`;

    const updateStartBtn = () => {
      const v = parseInt(input.value) || this.deckTotal;
      const extra = v > this.deckTotal ? `（含 ${v - this.deckTotal} 次加权复抽）` : "";
      startBtn.textContent = `🚀 开始学习 ${v} 词${extra}`;
    };
    input.addEventListener("input", updateStartBtn);
    input.addEventListener("change", updateStartBtn);

    startBtn.addEventListener("click", () => {
      const count = Math.max(1, parseInt(input.value) || this.deckTotal);
      this.callbacks.onStart(count);
    });
  }
}
