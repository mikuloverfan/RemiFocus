// RemiFocus — KU 知识树视图
// 以知识单元为中心展示知识图谱和卡片投影

import { UIComponent } from "./base";
import { IEngine } from "../engine/interface";
import { KUStore } from "../resolver/ku-store";
import { KnowledgeUnit } from "../models/knowledge-unit";

export interface KUViewCallbacks {
  onKUClick: (kuId: string) => void;
  onGenerateCards: (kuId: string) => void;
  onBack: () => void;
}

export class KUView extends UIComponent {
  private kuStore: KUStore;
  private callbacks: KUViewCallbacks;
  private kus: KnowledgeUnit[] = [];
  private filterDomain: string | null = null;

  constructor(
    container: HTMLElement,
    engine: IEngine,
    kuStore: KUStore,
    callbacks: KUViewCallbacks
  ) {
    super(container, engine);
    this.kuStore = kuStore;
    this.callbacks = callbacks;
    container.style.cssText = "padding:16px 20px;height:100%;overflow-y:auto;box-sizing:border-box;";
  }

  async render(): Promise<void> {
    this.clear();
    this.kus = await this.kuStore.getAll();

    // 标题
    this.renderHeader();

    // 领域过滤器
    this.renderDomainFilter();

    // KU 列表
    if (this.kus.length === 0) {
      this.renderEmptyState();
    } else {
      this.renderKUList();
    }

    // 底部统计
    this.renderFooter();
  }

  private renderHeader(): void {
    const header = this.appendChild(this.container, "div", "ku-view-header");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;";

    const title = this.appendChild(header, "h2", "");
    title.textContent = "🧠 知识单元";
    title.style.margin = "0";

    const backBtn = this.appendChild(header, "button", "ku-view-back-btn");
    backBtn.textContent = "← 返回";
    backBtn.style.cssText = "padding:6px 12px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-primary-alt);cursor:pointer;";
    backBtn.addEventListener("click", () => this.callbacks.onBack());
  }

  private renderDomainFilter(): void {
    // 收集所有 domain
    const domains = new Set<string>();
    domains.add("all");
    for (const ku of this.kus) {
      if (ku.identity?.domain) domains.add(ku.identity.domain);
    }

    const filterBar = this.appendChild(this.container, "div", "ku-view-filter");
    filterBar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;";

    for (const domain of domains) {
      const btn = this.appendChild(filterBar, "button", "ku-view-filter-btn");
      btn.textContent = domain === "all" ? "📋 全部" : `📁 ${domain}`;
      btn.style.cssText = `
        padding:4px 12px;border-radius:16px;border:1px solid var(--background-modifier-border);
        background:${this.filterDomain === domain || (domain === "all" && !this.filterDomain)
          ? "var(--interactive-accent)" : "var(--background-primary-alt)"};
        color:${this.filterDomain === domain || (domain === "all" && !this.filterDomain)
          ? "var(--text-on-accent)" : "var(--text-normal)"};
        cursor:pointer;font-size:0.85em;transition:all 0.2s;
      `;

      btn.addEventListener("click", async () => {
        this.filterDomain = domain === "all" ? null : domain;
        await this.render(); // 重新渲染
      });
    }
  }

  private renderKUList(): void {
    const list = this.appendChild(this.container, "div", "ku-view-list");
    list.style.cssText = "display:flex;flex-direction:column;gap:8px;";

    const filtered = this.filterDomain
      ? this.kus.filter((ku) => ku.identity?.domain === this.filterDomain)
      : this.kus;

    if (filtered.length === 0) {
      this.appendChild(list, "div", "ku-view-empty")
        .textContent = "该领域暂无知识单元";
      return;
    }

    for (const ku of filtered) {
      this.renderKUCard(list, ku);
    }
  }

  private renderKUCard(container: HTMLElement, ku: KnowledgeUnit): void {
    const card = this.appendChild(container, "div", "ku-view-card");
    card.style.cssText = `
      padding:12px 14px;border-radius:10px;
      border:1px solid var(--background-modifier-border);
      background:var(--background-primary);
      cursor:pointer;transition:all 0.2s;
    `;

    card.addEventListener("mouseenter", () => {
      card.style.borderColor = "var(--interactive-accent)";
      card.style.background = "var(--background-primary-alt)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.borderColor = "var(--background-modifier-border)";
      card.style.background = "var(--background-primary)";
    });
    card.addEventListener("click", () => this.callbacks.onKUClick(ku.id));

    // 标题行
    const titleRow = this.appendChild(card, "div", "ku-view-card-title");
    titleRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;";

    const title = this.appendChild(titleRow, "span", "");
    title.textContent = ku.canonical.text.slice(0, 60);
    title.style.cssText = "font-weight:500;font-size:0.95em;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

    const badge = this.appendChild(titleRow, "span", "ku-view-badge");
    badge.textContent = ku.structure;
    badge.style.cssText = `
      font-size:0.7em;padding:2px 8px;border-radius:10px;
      background:var(--background-modifier-border);color:var(--text-muted);
      margin-left:8px;flex-shrink:0;
    `;

    // 元数据行
    const metaRow = this.appendChild(card, "div", "ku-view-card-meta");
    metaRow.style.cssText = "display:flex;gap:12px;font-size:0.8em;color:var(--text-muted);";

    const domain = this.appendChild(metaRow, "span", "");
    domain.textContent = `📁 ${ku.identity?.domain ?? "general"}`;

    const sources = this.appendChild(metaRow, "span", "");
    sources.textContent = `📄 ${ku.sources.length} sources`;

    const mastery = this.appendChild(metaRow, "span", "");
    const errorRate = ku.learningStats?.errorRate ?? 0;
    mastery.textContent = errorRate > 0.3 ? `⚠️ ${Math.round(errorRate * 100)}% errors` : `✅ ${Math.round((1 - errorRate) * 100)}% correct`;

    // 生成卡片按钮
    const genBtn = this.appendChild(card, "button", "ku-view-gen-btn");
    genBtn.textContent = "📇 生成卡片";
    genBtn.style.cssText = `
      margin-top:8px;padding:4px 10px;border-radius:6px;
      border:1px solid var(--interactive-accent);background:transparent;
      color:var(--interactive-accent);cursor:pointer;font-size:0.8em;
    `;
    genBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.callbacks.onGenerateCards(ku.id);
    });
  }

  private renderEmptyState(): void {
    const empty = this.appendChild(this.container, "div", "ku-view-empty-state");
    empty.style.cssText = "text-align:center;padding:40px 20px;color:var(--text-muted);";

    this.appendChild(empty, "div", "").textContent = "📭";
    (empty.lastChild as HTMLElement).style.fontSize = "3em";

    this.appendChild(empty, "p", "").textContent = "暂无知识单元";
    (empty.lastChild as HTMLElement).style.margin = "12px 0 0 0";

    this.appendChild(empty, "p", "").textContent = "保存笔记后，DSL 引擎会自动提取知识单元";
    (empty.lastChild as HTMLElement).style.cssText = "font-size:0.85em;margin:4px 0 0 0;";
  }

  private renderFooter(): void {
    const footer = this.appendChild(this.container, "div", "ku-view-footer");
    footer.style.cssText = "margin-top:16px;padding-top:12px;border-top:1px solid var(--background-modifier-border);font-size:0.8em;color:var(--text-faint);text-align:center;";

    const total = this.kus.length;
    const byDomain = new Map<string, number>();
    for (const ku of this.kus) {
      const d = ku.identity?.domain ?? "general";
      byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
    }

    const stats = Array.from(byDomain.entries())
      .map(([d, c]) => `${d}:${c}`)
      .join(" | ");

    footer.textContent = `📊 ${total} KUs  |  ${stats}`;
  }
}
