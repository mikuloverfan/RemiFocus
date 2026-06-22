// RemiFocus — 卡片流视图
// 以卡片流为中心展示从 KU 生成的投影卡片

import { UIComponent } from "./base";
import { IEngine } from "../engine/interface";
import { KUStore } from "../resolver/ku-store";
import { KnowledgeUnit } from "../models/knowledge-unit";
import { WordEntry } from "../models/card";

export interface CardViewCallbacks {
  onStartLearning: (deckName: string) => void;
  onBack: () => void;
}

export class CardView extends UIComponent {
  private kuStore: KUStore;
  private callbacks: CardViewCallbacks;

  constructor(
    container: HTMLElement,
    engine: IEngine,
    kuStore: KUStore,
    callbacks: CardViewCallbacks
  ) {
    super(container, engine);
    this.kuStore = kuStore;
    this.callbacks = callbacks;
    container.style.cssText = "padding:16px 20px;height:100%;overflow-y:auto;box-sizing:border-box;";
  }

  async render(): Promise<void> {
    this.clear();
    const kus = await this.kuStore.getAll();

    // 标题
    this.renderHeader(kus.length);

    if (kus.length === 0) {
      this.renderEmptyState();
      return;
    }

    // 按 domain 分组显示
    const byDomain = this.groupByDomain(kus);
    for (const [domain, domainKUs] of byDomain) {
      this.renderDomainSection(domain, domainKUs);
    }
  }

  private renderHeader(kuCount: number): void {
    const header = this.appendChild(this.container, "div", "card-view-header");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;";

    const title = this.appendChild(header, "h2", "");
    title.textContent = `📇 卡片流 (${kuCount} KUs)`;
    title.style.margin = "0";

    const backBtn = this.appendChild(header, "button", "card-view-back-btn");
    backBtn.textContent = "← 返回";
    backBtn.style.cssText = "padding:6px 12px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-primary-alt);cursor:pointer;";
    backBtn.addEventListener("click", () => this.callbacks.onBack());
  }

  private renderDomainSection(domain: string, kus: KnowledgeUnit[]): void {
    const section = this.appendChild(this.container, "div", "card-view-section");
    section.style.cssText = "margin-bottom:16px;";

    // Domain 标题
    const domainTitle = this.appendChild(section, "h3", "card-view-domain-title");
    domainTitle.textContent = `📁 ${domain}`;
    domainTitle.style.cssText = "font-size:0.95em;margin:0 0 8px 4px;color:var(--text-muted);";

    // 该 domain 下的 KU 卡片
    for (const ku of kus) {
      this.renderKUCardItem(section, ku);
    }
  }

  private renderKUCardItem(container: HTMLElement, ku: KnowledgeUnit): void {
    const item = this.appendChild(container, "div", "card-view-item");
    item.style.cssText = `
      padding:10px 12px;margin-bottom:6px;border-radius:8px;
      border:1px solid var(--background-modifier-border);
      background:var(--background-primary);
      transition:all 0.2s;
    `;

    // 标题行
    const titleRow = this.appendChild(item, "div", "card-view-item-title");
    titleRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;";

    const text = this.appendChild(titleRow, "span", "");
    text.textContent = ku.canonical.text.slice(0, 50);
    text.style.cssText = "font-weight:500;font-size:0.9em;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

    const projections = this.appendChild(titleRow, "span", "card-view-projection-badges");
    projections.style.cssText = "display:flex;gap:4px;flex-shrink:0;margin-left:8px;";

    // 显示有哪些投影
    if (ku.projections?.literal) {
      this.addBadge(projections, "原文", "literal");
    }
    if (ku.projections?.compression) {
      this.addBadge(projections, "AI", "compression");
    }
    if (!ku.projections?.literal && !ku.projections?.compression) {
      this.addBadge(projections, "无卡片", "none");
    }

    // 元数据行
    const metaRow = this.appendChild(item, "div", "card-view-item-meta");
    metaRow.style.cssText = "display:flex;gap:10px;margin-top:4px;font-size:0.78em;color:var(--text-faint);";

    const structure = this.appendChild(metaRow, "span", "");
    structure.textContent = `📐 ${ku.structure}`;

    const tags = this.appendChild(metaRow, "span", "");
    tags.textContent = `🏷️ ${ku.tags.slice(0, 3).join(", ") || "无标签"}`;

    const sources = this.appendChild(metaRow, "span", "");
    sources.textContent = `📄 ${ku.sources.length} notes`;
  }

  private addBadge(container: HTMLElement, text: string, type: string): void {
    const badge = this.appendChild(container, "span", `card-view-badge-${type}`);
    badge.textContent = text;
    const colors: Record<string, string> = {
      literal: "var(--interactive-accent)",
      compression: "var(--color-green)",
      none: "var(--text-faint)",
    };
    badge.style.cssText = `
      font-size:0.7em;padding:1px 6px;border-radius:8px;
      background:${colors[type] ?? "var(--background-modifier-border)"};
      color:var(--text-on-accent, white);
    `;
  }

  private renderEmptyState(): void {
    const empty = this.appendChild(this.container, "div", "card-view-empty");
    empty.style.cssText = "text-align:center;padding:40px 20px;color:var(--text-muted);";
    this.appendChild(empty, "p", "").textContent = "📭 暂无投影卡片，请先生成知识单元";
  }

  private groupByDomain(kus: KnowledgeUnit[]): Map<string, KnowledgeUnit[]> {
    const map = new Map<string, KnowledgeUnit[]>();
    for (const ku of kus) {
      const domain = ku.identity?.domain ?? "general";
      const list = map.get(domain) ?? [];
      list.push(ku);
      map.set(domain, list);
    }
    return map;
  }
}
