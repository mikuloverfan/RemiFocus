// RemiFocus — 卡组树形管理器
// 显示文件系统结构的卡组树，支持右键菜单

import { UIComponent } from "./base";

export interface DeckManagerCallbacks {
  onDeckSelect: (deckName: string) => void;
  onDeckDelete: (deckName: string) => Promise<void>;
  onDeckRename: (oldName: string, newName: string) => Promise<void>;
  onDeckCreate: (parentPath: string, name: string) => Promise<string>;
}

interface TreeNode {
  name: string;
  fullPath: string;
  type: "folder" | "file" | "deck";
  children: TreeNode[];
  cardCount?: number;
  expanded: boolean;
}

export class DeckManager extends UIComponent {
  private callbacks: DeckManagerCallbacks;
  private tree: TreeNode[] = [];
  private selectedDeck = "";

  constructor(
    container: HTMLElement,
    engine: IEngine,
    callbacks: DeckManagerCallbacks
  ) {
    super(container, engine);
    this.callbacks = callbacks;
    container.classList.add("remi-focus");
    container.style.cssText = "padding:8px;height:100%;overflow-y:auto;box-sizing:border-box;";
  }

  async render(): Promise<void> {
    this.clear();
    const decks = await this.engine.getAllDeckInfos();
    this.tree = this.buildTree(decks.map(d => ({ path: d.name, count: d.totalCards })));
    this.renderHeader();
    this.renderTree();
  }

  // ─── 构建树 ───

  private buildTree(items: { path: string; count: number }[]): TreeNode[] {
    const root: TreeNode[] = [];

    for (const item of items) {
      const parts = item.path.split("/");
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        let node = current.find(n => n.name === part);

        if (!node) {
          node = {
            name: part,
            fullPath: parts.slice(0, i + 1).join("/"),
            type: isLast ? "deck" : "folder",
            children: [],
            expanded: true,
            cardCount: isLast ? item.count : 0,
          };
          current.push(node);
        }

        if (!isLast && node) {
          // 累加子卡片数到父节点
          node.cardCount = (node.cardCount || 0) + item.count;
        }

        current = node.children;
      }
    }

    return root;
  }

  private renderHeader(): void {
    const h = this.appendChild(this.container, "div", "");
    h.style.cssText = "font-weight:600;font-size:0.9em;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;";
    const title = this.appendChild(h, "span", "");
    title.textContent = "📂 卡组管理器";
  }

  private renderTree(): void {
    for (const node of this.tree) {
      this.renderNode(node, 0);
    }
  }

  private renderNode(node: TreeNode, depth: number): void {
    if (node.type === "folder" && !node.expanded) {
      // 折叠的文件夹只显示一行
      const row = this.appendChild(this.container, "div", "");
      row.style.cssText = `padding:4px 0 4px ${depth * 16}px;cursor:pointer;display:flex;align-items:center;gap:4px;font-size:0.85em;`;
      row.innerHTML = `
        <span>📁</span>
        <span style="flex:1">${this.escapeHtml(node.name)}</span>
        <span style="color:var(--remi-text-muted);font-size:0.8em">${node.cardCount || 0}</span>
      `;
      row.onclick = () => { node.expanded = true; this.renderTree(); };
      return;
    }

    // 文件夹（展开状态）
    if (node.type === "folder") {
      const row = this.appendChild(this.container, "div", "");
      row.style.cssText = `padding:4px 0 4px ${depth * 16}px;cursor:pointer;display:flex;align-items:center;gap:4px;font-size:0.85em;font-weight:600;`;
      row.innerHTML = `
        <span>📂</span>
        <span style="flex:1">${this.escapeHtml(node.name)}</span>
        <span style="color:var(--remi-text-muted);font-size:0.8em">${node.cardCount || 0}</span>
      `;
      // 右键菜单
      row.oncontextmenu = (e) => {
        e.preventDefault();
        this.showContextMenu(e.clientX, e.clientY, node);
      };
      row.onclick = () => { node.expanded = !node.expanded; this.renderTree(); };

      for (const child of node.children) {
        this.renderNode(child, depth + 1);
      }
    }

    // 卡组（叶子节点）
    if (node.type === "deck") {
      const isSelected = node.fullPath === this.selectedDeck;
      const row = this.appendChild(this.container, "div", "");
      row.style.cssText = `
        padding:4px 0 4px ${depth * 16}px;cursor:pointer;display:flex;align-items:center;gap:4px;font-size:0.85em;
        background:${isSelected ? "rgba(108,92,231,0.1)" : "transparent"};
        border-radius:4px;transition:all 0.1s;
      `;
      row.innerHTML = `
        <span>🃏</span>
        <span style="flex:1">${this.escapeHtml(node.name)}</span>
        <span style="color:var(--remi-text-muted);font-size:0.8em">${node.cardCount || 0}</span>
      `;
      row.onclick = () => {
        this.selectedDeck = node.fullPath;
        this.callbacks.onDeckSelect(node.fullPath);
        this.renderTree();
      };
      row.oncontextmenu = (e) => {
        e.preventDefault();
        this.showContextMenu(e.clientX, e.clientY, node);
      };
    }
  }

  private showContextMenu(x: number, y: number, node: TreeNode): void {
    // 移除旧菜单
    document.querySelector(".remi-context-menu")?.remove();

    const menu = this.appendChild(this.container.ownerDocument.body, "div", "");
    menu.className = "remi-context-menu";
    menu.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;z-index:9999;
      background:var(--remi-bg);border:1px solid var(--remi-border);
      border-radius:6px;padding:4px 0;min-width:140px;
      box-shadow:0 4px 12px rgba(0,0,0,0.15);
    `;

    const items: { label: string; icon: string; action: () => void }[] = [];

    if (node.type === "deck") {
      items.push({ label: "新建子卡组", icon: "📦", action: () => this.createDeck(node) });
      items.push({ label: "重命名", icon: "✏", action: () => this.renameDeck(node) });
      items.push({ label: "删除卡组", icon: "🗑", action: () => this.deleteDeck(node) });
    } else {
      items.push({ label: "新建卡组", icon: "📦", action: () => this.createDeck(node) });
    }

    for (const item of items) {
      const el = this.appendChild(menu, "div", "");
      el.style.cssText = "padding:6px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:0.85em;";
      el.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
      el.onmouseenter = () => el.style.background = "var(--remi-bg-secondary)";
      el.onmouseleave = () => el.style.background = "transparent";
      el.onclick = () => { menu.remove(); item.action(); };
    }

    // 点击其他地方关闭菜单
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) { menu.remove(); document.removeEventListener("click", closeMenu); }
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 0);
  }

  private async createDeck(parent: TreeNode): Promise<void> {
    const name = prompt(`在 "${parent.fullPath}" 下创建新卡组，名称:`);
    if (!name) return;
    const fullPath = parent.type === "deck" ? `${parent.fullPath}/${name}` : `${parent.fullPath}/${name}`;
    await this.callbacks.onDeckCreate(parent.fullPath, name);
    await this.render();
  }

  private async renameDeck(node: TreeNode): Promise<void> {
    const name = prompt("新名称:", node.name);
    if (!name || name === node.name) return;
    // 替换路径中最后一段
    const parts = node.fullPath.split("/");
    parts[parts.length - 1] = name;
    const newPath = parts.join("/");
    await this.callbacks.onDeckRename(node.fullPath, newPath);
    await this.render();
  }

  private async deleteDeck(node: TreeNode): Promise<void> {
    if (!confirm(`删除卡组 "${node.fullPath}"？其中的卡片不会被删除，仅从该卡组移除。`)) return;
    await this.callbacks.onDeckDelete(node.fullPath);
    await this.render();
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
  }
}

import { IEngine } from "../engine/interface";
