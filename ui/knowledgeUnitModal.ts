import { Modal, App } from "obsidian";
import { IEngine } from "../engine/interface";
// RemiFocus — KU 详情弹窗
// 展示单个知识单元的完整信息：来源、投影、演化历史

import { KnowledgeUnit } from "../models/knowledge-unit";
import { KnowledgeTree } from "./knowledgeTree";
import { CardStream } from "./cardStream";

export class KnowledgeUnitModal extends Modal {
  private engine: IEngine;
  private ku: KnowledgeUnit;
  private getKUs: () => Promise<KnowledgeUnit[]>;
  private getMasterStatus: (kuId: string) => Promise<"unlearned" | "learning" | "mastered" | "error">;

  constructor(
    app: App,
    engine: IEngine,
    ku: KnowledgeUnit,
    getKUs: () => Promise<KnowledgeUnit[]>,
    getMasterStatus: (kuId: string) => Promise<"unlearned" | "learning" | "mastered" | "error">
  ) {
    super(app);
    this.engine = engine;
    this.ku = ku;
    this.getKUs = getKUs;
    this.getMasterStatus = getMasterStatus;

    this.titleEl.style.display = "none";
    this.modalEl.style.width = "90vw";
    this.modalEl.style.maxWidth = "900px";
    this.modalEl.style.height = "80vh";
    this.modalEl.style.borderRadius = "12px";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.classList.add("remi-focus");
    contentEl.style.cssText = "display:flex;flex-direction:column;height:100%;padding:0;overflow:hidden;";

    // 顶部标题栏
    const header = contentEl.createDiv();
    header.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;" +
      "padding:16px 20px;border-bottom:1px solid var(--remi-border);flex-shrink:0;";

    const title = header.createDiv();
    title.style.cssText = "font-weight:700;font-size:1em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    title.textContent = `📌 ${this.ku.canonical.text.slice(0, 80)}`;

    const closeBtn = header.createEl("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText =
      "padding:4px 10px;border:none;border-radius:4px;cursor:pointer;" +
      "background:transparent;font-size:1.1em;color:var(--remi-text-muted);";
    closeBtn.addEventListener("click", () => this.close());

    // 主体：左右分栏
    const body = contentEl.createDiv();
    body.style.cssText =
      "display:flex;flex:1;min-height:0;overflow:hidden;";

    // 左侧：知识树（缩小版）
    const left = body.createDiv();
    left.style.cssText =
      "width:240px;border-right:1px solid var(--remi-border);" +
      "display:flex;flex-direction:column;overflow:hidden;padding:8px;";

    const treeTitle = left.createDiv();
    treeTitle.style.cssText = "font-weight:600;font-size:0.85em;margin-bottom:8px;color:var(--remi-text-muted);";
    treeTitle.textContent = "📂 知识树";

    // 右侧：详情
    const right = body.createDiv();
    right.style.cssText = "flex:1;display:flex;flex-direction:column;overflow:hidden;padding:12px 16px;";

    // 源信息
    this.renderSourceInfo(right);
    // 稳定性信息
    this.renderStabilityInfo(right);
    // 演化历史占位
    this.renderEvolutionPlaceholder(right);

    // 底部操作栏
    const footer = contentEl.createDiv();
    footer.style.cssText =
      "display:flex;gap:8px;padding:10px 16px;" +
      "border-top:1px solid var(--remi-border);flex-shrink:0;";

    const addCardsBtn = footer.createEl("button");
    addCardsBtn.textContent = "➕ 生成压缩卡片";
    addCardsBtn.style.cssText = "padding:6px 16px;border:none;border-radius:6px;cursor:pointer;" +
      "background:var(--remi-accent);color:#fff;font-size:0.85em;font-weight:500;";

    const lockBtn = footer.createEl("button");
    const isLocked = this.ku.stability.lockMode === "strict";
    lockBtn.textContent = isLocked ? "🔒 已锁定" : "🔓 锁定知识单元";
    lockBtn.style.cssText = "padding:6px 16px;border:1px solid var(--remi-border);border-radius:6px;" +
      "cursor:pointer;background:var(--remi-bg);font-size:0.85em;";

    const closeFooterBtn = footer.createEl("button");
    closeFooterBtn.textContent = "关闭";
    closeFooterBtn.style.cssText = "padding:6px 16px;border:1px solid var(--remi-border);border-radius:6px;" +
      "cursor:pointer;background:var(--remi-bg);font-size:0.85em;margin-left:auto;";
    closeFooterBtn.addEventListener("click", () => this.close());
  }

  private renderSourceInfo(container: HTMLElement): void {
    const section = container.createDiv();
    section.style.cssText = "margin-bottom:12px;";

    const title = section.createDiv();
    title.style.cssText = "font-weight:600;font-size:0.85em;margin-bottom:6px;color:var(--remi-text-muted);";
    title.textContent = "📄 来源笔记";

    for (const src of this.ku.sources) {
      const row = section.createDiv();
      row.style.cssText =
        "padding:4px 8px;background:var(--remi-bg-secondary);border-radius:4px;" +
        "margin-bottom:4px;font-size:0.82em;";

      const path = row.createSpan();
      path.textContent = `📝 ${src.notePath}:${src.lineStart}`;
      path.style.cssText = "color:var(--remi-text-muted);";
    }

    if (this.ku.sources.length === 0) {
      const empty = section.createDiv();
      empty.style.cssText = "font-size:0.82em;color:var(--remi-text-muted);";
      empty.textContent = "无来源信息";
    }
  }

  private renderStabilityInfo(container: HTMLElement): void {
    const section = container.createDiv();
    section.style.cssText = "margin-bottom:12px;";

    const title = section.createDiv();
    title.style.cssText = "font-weight:600;font-size:0.85em;margin-bottom:6px;color:var(--remi-text-muted);";
    title.textContent = "🔒 稳定性";

    const s = this.ku.stability;
    const lockLabels: Record<string, string> = {
      strict: "🔒 已锁定 — 不可修改",
      semi: "🔐 半锁定 — AI 只改投影",
      flex: "🔓 灵活 — AI 可优化（需确认）",
    };

    const row = section.createDiv();
    row.style.cssText =
      "padding:6px 10px;background:var(--remi-bg-secondary);border-radius:6px;font-size:0.82em;";
    row.textContent = lockLabels[s.lockMode] || s.lockMode;
  }

  private renderEvolutionPlaceholder(container: HTMLElement): void {
    const section = container.createDiv();
    section.style.cssText = "margin-bottom:12px;";

    const title = section.createDiv();
    title.style.cssText = "font-weight:600;font-size:0.85em;margin-bottom:6px;color:var(--remi-text-muted);";
    title.textContent = "📜 演化历史";

    const placeholder = section.createDiv();
    placeholder.style.cssText =
      "padding:12px;text-align:center;color:var(--remi-text-muted);font-size:0.82em;";

    const deps = this.ku.dedup.mergeHistory;
    if (deps.length > 0) {
      for (const h of deps) {
        const entry = placeholder.createDiv();
        entry.style.cssText = "padding:2px 0;";
        entry.textContent = `🔄 ${h.method} 合并 (${h.timestamp})`;
      }
    } else {
      placeholder.textContent = "尚无演化事件";
    }
  }
}
