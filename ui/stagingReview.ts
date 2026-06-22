import { Modal, App } from "obsidian";
// RemiFocus — 暂存区审查弹窗
// 展示所有待处理的合并候选，供用户确认或拒绝

import { StagingRecord, StagingCandidate } from "../models/staging";
import { KUStagingPool } from "../resolver/ku-staging";

export class StagingReviewModal extends Modal {
  private stagingPool: KUStagingPool;
  private onRefresh: () => void;

  constructor(
    app: App,
    stagingPool: KUStagingPool,
    onRefresh: () => void
  ) {
    super(app);
    this.stagingPool = stagingPool;
    this.onRefresh = onRefresh;

    this.titleEl.setText("🟡 暂存区审查");
    this.modalEl.style.width = "600px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.maxHeight = "70vh";
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.classList.add("remi-focus");
    contentEl.style.cssText = "padding:8px;";

    const items = await this.stagingPool.getPending();

    if (items.length === 0) {
      const empty = contentEl.createDiv();
      empty.style.cssText =
        "text-align:center;padding:32px;color:var(--remi-text-muted);";
      empty.innerHTML = "✅ 暂存区为空<br/><span style='font-size:0.85em'>没有待处理的合并候选</span>";
      return;
    }

    for (const item of items) {
      this.renderStagingItem(contentEl, item);
    }
  }

  private renderStagingItem(container: HTMLElement, item: StagingRecord): void {
    const card = container.createDiv();
    card.style.cssText =
      "padding:12px 14px;border:1px solid var(--remi-border);border-radius:8px;" +
      "margin-bottom:8px;background:var(--remi-card-bg);";

    // 头
    const head = card.createDiv();
    head.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;";

    const headLabel = head.createSpan();
    headLabel.style.cssText = "font-weight:600;font-size:0.9em;";
    headLabel.textContent = `📥 候选合并 #${item.id.slice(-6)}`;

    const headTime = head.createSpan();
    headTime.style.cssText = "font-size:0.8em;color:var(--remi-text-muted);";
    headTime.textContent = new Date(item.createdAt).toLocaleString("zh-CN");

    // 新内容
    const newSection = card.createDiv();
    newSection.style.cssText =
      "padding:6px 8px;background:var(--remi-bg-secondary);border-radius:4px;" +
      "margin-bottom:8px;font-size:0.85em;";
    newSection.textContent = `新: ${item.incomingKu.rawText.slice(0, 80)}`;

    // 候选列表
    for (const c of item.candidates) {
      this.renderCandidate(card, c);
    }

    // 操作按钮
    const actions = card.createDiv();
    actions.style.cssText = "display:flex;gap:8px;margin-top:8px;justify-content:flex-end;";

    const mergeBtn = actions.createEl("button");
    mergeBtn.textContent = "✓ 合并";
    mergeBtn.style.cssText =
      "padding:4px 12px;border:none;border-radius:4px;cursor:pointer;" +
      "background:var(--remi-success);color:#fff;font-size:0.82em;";
    mergeBtn.addEventListener("click", async () => {
      await this.stagingPool.resolve(item.id, "merge", item.candidates[0]?.kuId);
      this.onRefresh();
      this.close();
    });

    const rejectBtn = actions.createEl("button");
    rejectBtn.textContent = "✕ 拒绝";
    rejectBtn.style.cssText =
      "padding:4px 12px;border:1px solid var(--remi-border);border-radius:4px;" +
      "cursor:pointer;background:var(--remi-bg);font-size:0.82em;";
    rejectBtn.addEventListener("click", async () => {
      await this.stagingPool.resolve(item.id, "reject");
      this.onRefresh();
      this.close();
    });
  }

  private renderCandidate(container: HTMLElement, c: StagingCandidate): void {
    const row = container.createDiv();
    row.style.cssText =
      "display:flex;align-items:center;gap:8px;padding:4px 8px;" +
      "font-size:0.82em;";

    const scoreColor =
      c.score > 0.95 ? "var(--remi-success)" :
      c.score > 0.90 ? "var(--remi-warning)" :
      "var(--remi-text-muted)";

    const statusLabels: Record<string, string> = {
      pending_llm: "⏳ LLM 判定中",
      auto_merge: "✅ 自动合并",
      rejected: "❌ 已拒绝",
      manual_review: "👀 待人工审查",
    };

    const score = row.createSpan();
    score.style.cssText = `font-weight:600;color:${scoreColor};width:50px;`;
    score.textContent = `${(c.score * 100).toFixed(0)}%`;

    const id = row.createSpan();
    id.style.cssText = "color:var(--remi-text);flex:1;overflow:hidden;text-overflow:ellipsis;";
    id.textContent = c.kuId;

    const status = row.createSpan();
    status.style.cssText = "color:var(--remi-text-muted);font-size:0.9em;";
    status.textContent = statusLabels[c.status] || c.status;

    if (c.llmResult) {
      const reason = row.createSpan();
      reason.style.cssText = "color:var(--remi-text-muted);font-size:0.85em;margin-left:4px;";
      reason.textContent = `— ${c.llmResult.reason}`;
    }
  }
}
