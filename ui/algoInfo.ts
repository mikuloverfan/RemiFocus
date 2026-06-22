// RemiFocus — ALGO_VIEW：算法说明页面
// 展示所有调度算法的可读描述、工作原理、适用场景
// 纯信息页，不参与学习流，用户可在此切换算法

import { UIComponent } from "./base";
import { IEngine } from "../engine/interface";

export interface AlgoInfoCallbacks {
  onBackToDeck: () => void;
  onSwitchAlgorithm: (algo: string) => Promise<void>;
}

interface AlgoInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  howItWorks: string[];
  pros: string[];
  cons: string[];
  bestFor: string;
  recommended: boolean;
}

const ALGORITHMS: AlgoInfo[] = [
  {
    id: "sm-2",
    name: "SM-2",
    icon: "🔵",
    description: "SuperMemo 经典算法，由 Piotr Wozniak 于 1987 年提出。适合初学者和简单词汇学习。",
    howItWorks: [
      "新卡片初始间隔为 1 天",
      "每次「良好」或「简单」后，间隔乘以 ease 因子（默认 ×2.5）",
      "每次「困难」或「忘记」后，间隔重置为 1 天，ease 因子降低",
      "ease 因子在 130%-350% 之间动态调整",
    ],
    pros: ["实现简单，易于理解", "适合固定节奏的词汇学习", "计算量小，无额外依赖"],
    cons: ["对长周期记忆不够精准", "不适应个人记忆能力差异", "无法处理批量最优调度"],
    bestFor: "简单词汇、英语单词、固定节奏的学习场景",
    recommended: false,
  },
  {
    id: "fsrs",
    name: "FSRS-5",
    icon: "🟢",
    description: "Free Spaced Repetition Scheduler v5，基于深度学习模型的现代间隔重复算法。Anki 官方推荐算法。",
    howItWorks: [
      "使用 4 个参数（稳定性、难度、可提取性、retention）建模记忆",
      "通过用户的历史复习数据自动拟合个人记忆曲线",
      "每次复习后更新模型参数，逐步逼近最优调度",
      "可预测长期 retention 率，支持自定义目标 retention",
    ],
    pros: ["比 SM-2 精准约 30%", "自适应个人记忆能力", "Anki 官方推荐，社区验证充分"],
    cons: ["需要一定的复习数据积累", "理解门槛比 SM-2 高", "初始参数需要校准"],
    bestFor: "医学笔记、长周期复习、大量卡片的专业学习",
    recommended: true,
  },
  {
    id: "exam",
    name: "考试模式",
    icon: "🟠",
    description: "考试强化模式，在考试前密集复习。适合突击备考场景。",
    howItWorks: [
      "以考试日期为目标，倒推复习计划",
      "考试前一段时间（如 7 天）加大复习频率",
      "每次「忘记」会显著降低间隔，确保重点内容反复出现",
      "考试结束后自动恢复正常调度",
    ],
    pros: ["适合考前冲刺", "密集复习减少遗忘", "目标导向"],
    cons: ["不适合日常学习", "长期效率低于 SM-2/FSRS", "需要设置考试日期"],
    bestFor: "期末考试、资格考试、证书考试前的集中复习",
    recommended: false,
  },
  {
    id: "fixed-interval",
    name: "固定间隔",
    icon: "⚪",
    description: "最简单的调度策略，所有卡片以固定间隔出现。适合不需要个性化的场景。",
    howItWorks: [
      "所有卡片使用相同的固定间隔（如 3 天）",
      "每次复习后间隔不变",
      "学习结果不影响下一次出现时间",
    ],
    pros: ["可预测性强", "实现最简单", "适合需要均匀分布的场景"],
    cons: ["效率最低", "不考虑卡片难度差异", "浪费简单卡片的复习机会"],
    bestFor: "临时学习、简单记忆、不需要长期 retention 的场景",
    recommended: false,
  },
];

export class AlgoInfoView extends UIComponent {
  private callbacks: AlgoInfoCallbacks;
  private currentAlgo: string = "sm-2";

  constructor(
    container: HTMLElement,
    engine: IEngine,
    callbacks: AlgoInfoCallbacks
  ) {
    super(container, engine);
    this.callbacks = callbacks;
    container.style.cssText = "padding:20px 24px;height:100%;overflow-y:auto;box-sizing:border-box;";
    container.classList.add("remi-focus");
  }

  async render(): Promise<void> {
    this.clear();
    this.renderHeader();

    for (const algo of ALGORITHMS) {
      this.renderAlgoCard(algo);
    }
  }

  private renderHeader(): void {
    const header = this.appendChild(this.container, "div", "");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;";

    const title = this.appendChild(header, "h2", "");
    title.textContent = "📐 调度算法";
    title.style.margin = "0";

    const backBtn = this.appendChild(header, "button", "");
    backBtn.textContent = "← 返回卡组";
    backBtn.style.cssText = "padding:6px 14px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-primary-alt);cursor:pointer;font-size:0.85em;";
    backBtn.addEventListener("click", () => this.callbacks.onBackToDeck());

    // 副标题
    const sub = this.appendChild(this.container, "p", "");
    sub.textContent = "了解每种算法的工作原理，选择最适合你的学习方式";
    sub.style.cssText = "font-size:0.85em;color:var(--text-muted);margin:-12px 0 16px 0;";
  }

  private renderAlgoCard(algo: AlgoInfo): void {
    const card = this.appendChild(this.container, "div", "");
    card.style.cssText = `
      padding:16px;border-radius:12px;
      border:1px solid ${algo.recommended ? "var(--interactive-accent)" : "var(--background-modifier-border)"};
      background:var(--background-primary);
      margin-bottom:12px;
      ${algo.recommended ? "border-left:4px solid var(--interactive-accent);" : ""}
    `;

    // 标题行
    const titleRow = this.appendChild(card, "div", "");
    titleRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;";

    const title = this.appendChild(titleRow, "div", "");
    title.textContent = `${algo.icon} ${algo.name}`;
    title.style.cssText = `font-size:1.05em;font-weight:600;${algo.recommended ? "color:var(--interactive-accent);" : ""}`;

    if (algo.recommended) {
      const badge = this.appendChild(titleRow, "span", "");
      badge.textContent = "⭐ 推荐";
      badge.style.cssText = "font-size:0.75em;padding:2px 10px;border-radius:12px;background:var(--interactive-accent);color:var(--text-on-accent,white);";
    }

    // 描述
    const desc = this.appendChild(card, "p", "");
    desc.textContent = algo.description;
    desc.style.cssText = "font-size:0.85em;color:var(--text-muted);line-height:1.5;margin:0 0 12px 0;";

    // 工作原理
    this.renderSection(card, "⚙️ 工作原理", algo.howItWorks.map((s) => `• ${s}`));

    // 优缺点
    const grid = this.appendChild(card, "div", "");
    grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;";

    this.renderList(grid, "✅ 优点", algo.pros, "var(--color-green)");
    this.renderList(grid, "⚠️ 缺点", algo.cons, "var(--text-error)");

    // 适用场景
    const bestFor = this.appendChild(card, "div", "");
    bestFor.style.cssText = "font-size:0.82em;color:var(--text-muted);margin-bottom:12px;";
    bestFor.textContent = `🎯 适合: ${algo.bestFor}`;

    // 切换按钮
    const isCurrent = this.currentAlgo === algo.id;
    const switchBtn = this.appendChild(card, "button", "");
    switchBtn.textContent = isCurrent ? "✅ 当前算法" : `切换到 ${algo.name}`;
    switchBtn.style.cssText = `
      padding:7px 16px;border-radius:8px;
      border:none;
      background:${isCurrent ? "var(--background-modifier-border)" : "var(--interactive-accent)"};
      color:${isCurrent ? "var(--text-muted)" : "var(--text-on-accent, white)"};
      cursor:${isCurrent ? "default" : "pointer"};
      font-size:0.85em;transition:all 0.2s;
    `;
    if (!isCurrent) {
      switchBtn.addEventListener("click", async () => {
        await this.callbacks.onSwitchAlgorithm(algo.id);
        this.currentAlgo = algo.id;
        this.render();
      });
    }
  }

  private renderSection(container: HTMLElement, title: string, lines: string[]): void {
    const section = this.appendChild(container, "div", "");
    section.style.cssText = "margin-bottom:12px;";

    const titleEl = this.appendChild(section, "div", "");
    titleEl.textContent = title;
    titleEl.style.cssText = "font-size:0.85em;font-weight:500;margin-bottom:4px;";

    for (const line of lines) {
      const p = this.appendChild(section, "div", "");
      p.textContent = line;
      p.style.cssText = "font-size:0.82em;color:var(--text-muted);line-height:1.6;padding-left:8px;";
    }
  }

  private renderList(container: HTMLElement, title: string, items: string[], color: string): void {
    const section = this.appendChild(container, "div", "");
    section.style.cssText = "margin-bottom:8px;";

    const titleEl = this.appendChild(section, "div", "");
    titleEl.textContent = title;
    titleEl.style.cssText = `font-size:0.82em;font-weight:500;margin-bottom:4px;color:${color};`;

    for (const item of items) {
      const p = this.appendChild(section, "div", "");
      p.textContent = `• ${item}`;
      p.style.cssText = "font-size:0.8em;color:var(--text-muted);line-height:1.5;";
    }
  }
}
