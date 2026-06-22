// RemiFocus — 三模式选择弹窗
// 统一入口：一个 Ribbon 图标 → 三模式选择

import { App, Modal, Notice, Platform } from "obsidian";

export type CardMode = "manual" | "classic" | "ku";

export interface ModeSelectorCallbacks {
  /** 选择手动制卡 */
  onSelectManual: () => void;
  /** 选择传统自动识别 */
  onSelectClassic: () => void;
  /** 选择 KU/DSL 智能系统 */
  onSelectKU: () => void;
  /** 直接打开快速复习 */
  onQuickReview: () => void;
}

export class ModeSelectorModal extends Modal {
  private callbacks: ModeSelectorCallbacks;

  constructor(app: App, callbacks: ModeSelectorCallbacks) {
    super(app);
    this.callbacks = callbacks;
    this.titleEl.style.display = "none";
    this.modalEl.style.width = "460px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.borderRadius = "16px";
    this.modalEl.style.padding = "8px";
  }

  onOpen(): void {
    const { contentEl } = this;

    // ── 标题 ──
    contentEl.createEl("h2", {
      text: "🧠 RemiFocus",
      attr: {
        style:
          "text-align:center;margin:8px 0 4px 0;font-size:1.5em;",
      },
    });
    contentEl.createEl("p", {
      text: "选择制卡模式",
      attr: {
        style:
          "text-align:center;color:var(--text-muted);margin:0 0 20px 0;font-size:0.95em;",
      },
    });

    // ── 三模式按钮 ──
    this.addModeButton(
      "🧱 手动编辑",
      "像 Notion 一样自由 — 完全手动控制卡片内容和格式",
      "var(--text-accent)",
      () => {
        this.close();
        this.callbacks.onSelectManual();
      }
    );

    this.addModeButton(
      "⚙️ 快速生成",
      "像 Anki 一样快速 — 自动扫描笔记中的词汇和结构",
      "var(--color-orange)",
      () => {
        this.close();
        this.callbacks.onSelectClassic();
      }
    );

    this.addModeButton(
      "🧠 智能结构化 ⭐",
      "像学习操作系统一样智能 — KU知识图谱 + DSL规则 + AI压缩",
      "var(--color-green)",
      () => {
        this.close();
        this.callbacks.onSelectKU();
      }
    );

    // ── 快速复习按钮 ──
    contentEl.createEl("hr", {
      attr: { style: "margin:16px 0 12px 0;border-color:var(--background-modifier-border);" },
    });

    const quickReviewBtn = contentEl.createEl("button", {
      text: "▶ 快速开始今日复习",
      attr: {
        style: `
          display:block;width:100%;padding:10px;border-radius:10px;
          border:1px solid var(--background-modifier-border);
          background:var(--background-primary-alt);color:var(--text-normal);
          cursor:pointer;font-size:0.95em;font-weight:500;
          transition:background 0.2s;
        `,
      },
    });
    quickReviewBtn.addEventListener("click", () => {
      this.close();
      this.callbacks.onQuickReview();
    });
    quickReviewBtn.addEventListener("mouseenter", () => {
      quickReviewBtn.style.background = "var(--background-modifier-hover)";
    });
    quickReviewBtn.addEventListener("mouseleave", () => {
      quickReviewBtn.style.background = "var(--background-primary-alt)";
    });

    // ── 底部提示 ──
    contentEl.createEl("p", {
      text: "💡 首次使用请选「快速生成」，后续可在设置中切换默认模式",
      attr: {
        style:
          "text-align:center;color:var(--text-faint);margin:12px 0 0 0;font-size:0.8em;",
      },
    });
  }

  private addModeButton(
    label: string,
    description: string,
    accentColor: string,
    onClick: () => void
  ): void {
    const { contentEl } = this;

    const container = contentEl.createEl("div", {
      attr: {
        style: `
          display:flex;flex-direction:column;gap:4px;
          padding:14px 16px;margin:6px 0;border-radius:12px;
          border:1px solid var(--background-modifier-border);
          background:var(--background-primary);
          cursor:pointer;transition:all 0.2s;
        `,
      },
    });

    container.addEventListener("click", onClick);
    container.addEventListener("mouseenter", () => {
      container.style.borderColor = accentColor;
      container.style.background = "var(--background-primary-alt)";
      container.style.transform = "translateX(4px)";
    });
    container.addEventListener("mouseleave", () => {
      container.style.borderColor = "var(--background-modifier-border)";
      container.style.background = "var(--background-primary)";
      container.style.transform = "none";
    });

    container.createEl("div", {
      text: label,
      attr: { style: `font-size:1.1em;font-weight:600;color:${accentColor};` },
    });

    container.createEl("div", {
      text: description,
      attr: {
        style: "font-size:0.85em;color:var(--text-muted);line-height:1.4;",
      },
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
