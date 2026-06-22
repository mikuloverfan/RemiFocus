// RemiFocus — DECK_VIEW：当前笔记卡组页
// 系统的唯一学习入口，用户点击 Ribbon 或从其他页面回 DECK 时看到这里

import { UIComponent } from "./base";
import { IEngine } from "../engine/interface";
import { DeckInfo } from "../models/card";
import { UIRouter } from "../core/ui-router";

export interface DeckViewCallbacks {
  onStartSession: (deckName: string) => void;
  onOpenHome: () => void;
  onOpenPlan: () => void;
  onOpenModeSelector: () => void;
  onToggleViewMode: () => void;
}

export class DeckView extends UIComponent {
  private router: UIRouter;
  private callbacks: DeckViewCallbacks;
  private currentFilePath: string | null;

  constructor(
    container: HTMLElement,
    engine: IEngine,
    router: UIRouter,
    callbacks: DeckViewCallbacks,
    currentFilePath: string | null
  ) {
    super(container, engine);
    this.router = router;
    this.callbacks = callbacks;
    this.currentFilePath = currentFilePath;
    container.style.cssText = "padding:20px 24px;height:100%;overflow-y:auto;box-sizing:border-box;";
    container.classList.add("remi-focus");
  }

  async render(): Promise<void> {
    this.clear();
    const decks = await this.engine.getAllDeckInfos();

    // 全局导航条
    this.renderGlobalBar(decks);

    if (this.currentFilePath && decks.length > 0) {
      // 有当前笔记 → 显示该笔记的卡组
      const fileDecks = this.getFileDecks(decks);
      if (fileDecks.length > 0) {
        this.renderCurrentNote(fileDecks[0]);
        this.renderOperations();
        this.renderPeerDecks(decks);
      } else {
        this.renderNoDeckForFile();
      }
    } else {
      // 无当前笔记或卡组 → 显示所有卡组
      this.renderAllDecks(decks);
    }

    // 底部模式切换
    this.renderModeSwitcher();
  }

  // ─── 全局导航条 ───

  private renderGlobalBar(decks: DeckInfo[]): void {
    const bar = this.appendChild(this.container, "div", "deck-global-bar");
    bar.style.cssText = `
      display:flex;align-items:center;gap:12px;
      padding:8px 12px;margin-bottom:16px;
      border-radius:10px;background:var(--background-primary-alt);
      font-size:0.85em;
    `;

    // Logo
    const logo = this.appendChild(bar, "span", "");
    logo.textContent = "🧠 RemiFocus";
    logo.style.cssText = "font-weight:600;cursor:pointer;";
    logo.addEventListener("click", () => this.callbacks.onOpenHome());

    // 当前上下文
    if (this.currentFilePath) {
      const ctx = this.appendChild(bar, "span", "");
      ctx.textContent = `📘 ${this.currentFilePath.split("/").pop()?.replace(".md", "") || ""}`;
      ctx.style.cssText = "color:var(--text-muted);";
    }

    // 当前模式
    const mode = this.appendChild(bar, "span", "");
    mode.textContent = `🧠 ${this.router.context.currentMode.toUpperCase()}`;
    mode.style.cssText = "margin-left:auto;font-size:0.8em;color:var(--interactive-accent);";

    // 今日进度
    const totalDue = decks.reduce((s, d) => s + d.dueCount, 0);
    const progress = this.appendChild(bar, "span", "");
    progress.textContent = `🔥 ${totalDue} due`;
    progress.style.cssText = "font-size:0.8em;color:var(--text-muted);";
    progress.addEventListener("click", () => this.callbacks.onOpenPlan());
  }

  // ─── 当前笔记卡组（重点展示） ───

  private renderCurrentNote(deck: DeckInfo): void {
    const fileLabel = this.currentFilePath
      ? this.currentFilePath.split("/").pop()?.replace(".md", "") || ""
      : "";

    const card = this.appendChild(this.container, "div", "deck-current-card");
    card.style.cssText = `
      padding:20px;border-radius:14px;
      border:1px solid var(--interactive-accent);
      background:linear-gradient(135deg, var(--background-primary), var(--background-primary-alt));
      margin-bottom:16px;
    `;

    // 标题行
    const titleRow = this.appendChild(card, "div", "");
    titleRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;";

    const title = this.appendChild(titleRow, "div", "");
    title.style.cssText = "font-size:1.1em;font-weight:600;";
    title.textContent = `📇 ${deck.name}`;

    const mastery = this.appendChild(titleRow, "div", "");
    mastery.textContent = `熟练度 ${deck.mastery}%`;
    mastery.style.cssText = "font-size:0.85em;color:var(--text-muted);";

    // 进度条
    const barContainer = this.appendChild(card, "div", "");
    barContainer.style.cssText = "height:6px;border-radius:3px;background:var(--background-modifier-border);margin-bottom:12px;overflow:hidden;";

    const bar = this.appendChild(barContainer, "div", "");
    bar.style.cssText = `height:100%;border-radius:3px;background:var(--interactive-accent);width:${deck.mastery}%;transition:width 0.3s;`;

    // 统计行
    const statsRow = this.appendChild(card, "div", "");
    statsRow.style.cssText = "display:flex;gap:16px;font-size:0.85em;color:var(--text-muted);";

    this.addStat(statsRow, "📄", `${deck.totalCards} 卡片`);
    this.addStat(statsRow, "🆕", `${deck.newCount} 新词`);

    const dueColor = deck.dueCount > 0 ? "var(--text-error)" : "var(--text-muted)";
    this.addStat(statsRow, "🔥", `${deck.dueCount} 待复习`, dueColor);

    // 操作按钮
    const actions = this.appendChild(card, "div", "");
    actions.style.cssText = "display:flex;gap:8px;margin-top:16px;";

    this.addActionBtn(actions, "▶ 开始学习", "var(--interactive-accent)", () =>
      this.callbacks.onStartSession(deck.name)
    );

    this.addActionBtn(actions, "🧠 KU 视图", "var(--background-modifier-border)", () =>
      this.callbacks.onToggleViewMode()
    );

    this.addActionBtn(actions, "📊 统计", "var(--background-modifier-border)", () =>
      this.callbacks.onOpenHome()
    );
  }

  // ─── 操作区 ───

  private renderOperations(): void {
    const row = this.appendChild(this.container, "div", "");
    row.style.cssText = "display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;";

    this.addActionBtn(row, "🏠 主页", "var(--background-modifier-border)", () =>
      this.callbacks.onOpenHome()
    );

    this.addActionBtn(row, "📅 计划", "var(--background-modifier-border)", () =>
      this.callbacks.onOpenPlan()
    );
  }

  // ─── 同级卡组列表 ───

  private renderPeerDecks(decks: DeckInfo[]): void {
    const fileDecks = this.getFileDecks(decks);
    const filePrefix = fileDecks.length > 0 ? fileDecks[0].name.split("/").slice(0, -1).join("/") : "";

    const peers = decks.filter((d) => {
      const parent = d.name.split("/").slice(0, -1).join("/");
      return parent === filePrefix && !fileDecks.find((fd) => fd.name === d.name);
    });

    if (peers.length === 0) return;

    const section = this.appendChild(this.container, "div", "");
    section.style.cssText = "margin-bottom:16px;";

    const title = this.appendChild(section, "div", "");
    title.textContent = "📁 同级卡组";
    title.style.cssText = "font-weight:500;font-size:0.9em;margin-bottom:8px;color:var(--text-muted);";

    for (const peer of peers) {
      this.renderDeckRow(section, peer);
    }
  }

  // ─── 所有卡组列表 ───

  private renderAllDecks(decks: DeckInfo[]): void {
    if (decks.length === 0) {
      this.renderEmptyState();
      return;
    }

    const section = this.appendChild(this.container, "div", "");
    section.style.cssText = "margin-bottom:16px;";

    const title = this.appendChild(section, "div", "");
    title.textContent = "📚 所有卡组";
    title.style.cssText = "font-weight:500;font-size:0.9em;margin-bottom:8px;";

    // 按文件夹分组
    const byFolder = new Map<string, DeckInfo[]>();
    for (const d of decks) {
      const folder = d.name.split("/")[0] || "其他";
      const list = byFolder.get(folder) ?? [];
      list.push(d);
      byFolder.set(folder, list);
    }

    for (const [folder, folderDecks] of byFolder) {
      const folderEl = this.appendChild(section, "div", "");
      folderEl.style.cssText = "margin-bottom:8px;";

      const folderTitle = this.appendChild(folderEl, "div", "");
      folderTitle.textContent = `📂 ${folder}`;
      folderTitle.style.cssText = "font-size:0.85em;color:var(--text-muted);margin-bottom:4px;padding-left:4px;";

      for (const d of folderDecks) {
        this.renderDeckRow(folderEl, d);
      }
    }
  }

  private renderDeckRow(container: HTMLElement, deck: DeckInfo): void {
    const row = this.appendChild(container, "div", "");
    row.style.cssText = `
      display:flex;align-items:center;gap:10px;
      padding:8px 12px;border-radius:8px;
      border:1px solid var(--background-modifier-border);
      background:var(--background-primary);
      cursor:pointer;transition:all 0.2s;margin-bottom:4px;
    `;
    row.addEventListener("click", () => this.callbacks.onStartSession(deck.name));
    row.addEventListener("mouseenter", () => row.style.borderColor = "var(--interactive-accent)");
    row.addEventListener("mouseleave", () => row.style.borderColor = "var(--background-modifier-border)");

    const name = this.appendChild(row, "span", "");
    name.textContent = deck.name.split("/").pop() || deck.name;
    name.style.cssText = "flex:1;font-weight:500;font-size:0.9em;";

    const barBg = this.appendChild(row, "div", "");
    barBg.style.cssText = "flex:0 0 80px;height:5px;border-radius:3px;background:var(--background-modifier-border);overflow:hidden;";

    const bar = this.appendChild(barBg, "div", "");
    bar.style.cssText = `height:100%;border-radius:3px;background:var(--interactive-accent);width:${deck.mastery}%;`;

    const stats = this.appendChild(row, "span", "");
    stats.textContent = `${deck.totalCards}词 ${deck.mastery}%`;
    stats.style.cssText = "font-size:0.8em;color:var(--text-muted);white-space:nowrap;";
  }

  // ─── 模式切换 ───

  private renderModeSwitcher(): void {
    const row = this.appendChild(this.container, "div", "");
    row.style.cssText = `
      display:flex;gap:8px;padding-top:12px;
      border-top:1px solid var(--background-modifier-border);
      margin-top:8px;
    `;

    this.addActionBtn(row, "🧱 手动", "var(--background-modifier-border)", () =>
      this.callbacks.onOpenModeSelector()
    );
    this.addActionBtn(row, "⚙️ 快速", "var(--background-modifier-border)", () =>
      this.callbacks.onOpenModeSelector()
    );
    this.addActionBtn(row, "🧠 KU", "var(--interactive-accent)", () =>
      this.callbacks.onOpenModeSelector()
    );
  }

  // ─── 空状态 ───

  private renderNoDeckForFile(): void {
    const empty = this.appendChild(this.container, "div", "");
    empty.style.cssText = "text-align:center;padding:30px;color:var(--text-muted);";
    this.appendChild(empty, "p", "").textContent = `📭 当前笔记 "${this.currentFilePath?.split("/").pop()}" 暂无卡片数据`;
    this.appendChild(empty, "p", "").textContent = "保存笔记后自动扫描，或使用制卡工具添加卡片";
    (empty.lastChild as HTMLElement).style.cssText = "font-size:0.85em;margin-top:4px;";
  }

  private renderEmptyState(): void {
    const empty = this.appendChild(this.container, "div", "");
    empty.style.cssText = "text-align:center;padding:40px;color:var(--text-muted);";
    this.appendChild(empty, "p", "").textContent = "📭 暂无卡组数据";
    this.appendChild(empty, "p", "").textContent = "打开一篇 Markdown 笔记并保存，系统会自动提取卡片";
    (empty.lastChild as HTMLElement).style.cssText = "font-size:0.85em;margin-top:4px;";
  }

  // ─── 工具方法 ───

  private getFileDecks(decks: DeckInfo[]): DeckInfo[] {
    if (!this.currentFilePath) return [];
    const baseName = this.currentFilePath.replace(/\.md$/i, "");
    return decks.filter((d) => d.name.startsWith(baseName));
  }

  private addStat(container: HTMLElement, icon: string, text: string, color?: string): void {
    const el = this.appendChild(container, "span", "");
    el.textContent = `${icon} ${text}`;
    if (color) el.style.color = color;
  }

  private addActionBtn(container: HTMLElement, text: string, borderColor: string, onClick: () => void): void {
    const btn = this.appendChild(container, "button", "");
    btn.textContent = text;
    btn.style.cssText = `
      padding:7px 14px;border-radius:8px;border:1px solid ${borderColor};
      background:transparent;color:var(--text-normal);
      cursor:pointer;font-size:0.85em;transition:all 0.2s;
    `;
    btn.addEventListener("click", onClick);
    btn.addEventListener("mouseenter", () => { btn.style.background = "var(--background-modifier-hover)"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "transparent"; });
  }

  setCurrentFile(path: string | null): void {
    this.currentFilePath = path;
  }
}
