import { IEngine } from "../engine/interface";
// RemiFocus — 知识树组件（左侧面板）
// 以树形结构展示所有知识单元（KU），支持展开/折叠、状态着色

import { UIComponent } from "./base";
import { KnowledgeUnit, KUId } from "../models/knowledge-unit";

export type MasterStatus = "unlearned" | "learning" | "mastered" | "error";

export interface KUNode {
  id: string;            // ku_id 或 folder_id
  type: "ku" | "folder";
  label: string;
  children: KUNode[];
  masterStatus: MasterStatus;
  kuCount: number;
  kuIds: KUId[];         // 该节点下所有 KU ID（用于快速选择）
}

export interface KnowledgeTreeCallbacks {
  onSelectKU: (kuId: KUId) => void;
  onSearch: (query: string) => void;
}

export class KnowledgeTree extends UIComponent {
  private callbacks: KnowledgeTreeCallbacks;
  private getKUs: () => Promise<KnowledgeUnit[]>;
  private getMasterStatus: (kuId: KUId) => Promise<MasterStatus>;
  private searchQuery = "";
  private expandedFolders = new Set<string>();

  constructor(
    container: HTMLElement,
    engine: IEngine,
    getKUs: () => Promise<KnowledgeUnit[]>,
    getMasterStatus: (kuId: KUId) => Promise<MasterStatus>,
    callbacks: KnowledgeTreeCallbacks
  ) {
    super(container, engine);
    this.getKUs = getKUs;
    this.getMasterStatus = getMasterStatus;
    this.callbacks = callbacks;
    container.classList.add("remi-focus", "remi-knowledge-tree");
  }

  async render(): Promise<void> {
    this.clear();
    const kus = await this.getKUs();

    this.renderSearchBar();
    this.renderFilterBar();
    this.renderTree(kus);
  }

  private renderSearchBar(): void {
    const searchBar = this.appendChild(this.container, "div", "remi-tree-search");
    searchBar.style.cssText =
      "display:flex;gap:6px;margin-bottom:8px;padding:4px 0;";

    const input = this.appendChild(searchBar, "input", "remi-tree-input");
    input.setAttribute("type", "text");
    input.setAttribute("placeholder", "🔍 搜索知识单元...");
    input.style.cssText =
      "flex:1;padding:6px 10px;border:1px solid var(--remi-border);" +
      "border-radius:6px;background:var(--remi-bg);color:var(--remi-text);" +
      "font-size:0.85em;";
    input.addEventListener("input", () => {
      this.searchQuery = input.value;
      this.callbacks.onSearch(this.searchQuery);
      this.render();
    });
  }

  private renderFilterBar(): void {
    const bar = this.appendChild(this.container, "div", "remi-tree-filters");
    bar.style.cssText =
      "display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;";

    const filters = [
      { label: "🌲 完整树", value: "all" },
      { label: "🟢 已掌握", value: "mastered" },
      { label: "🔵 学习中", value: "learning" },
      { label: "🔴 易错", value: "error" },
    ];

    for (const f of filters) {
      const btn = this.appendChild(bar, "button", "remi-tree-filter-btn");
      btn.textContent = f.label;
      btn.style.cssText =
        "padding:2px 8px;border:1px solid var(--remi-border);border-radius:4px;" +
        "background:var(--remi-bg);cursor:pointer;font-size:0.78em;" +
        "color:var(--remi-text-muted);";
      btn.addEventListener("click", () => {
        // TODO: filter by status
        this.render();
      });
    }
  }

  private async renderTree(kus: KnowledgeUnit[]): Promise<void> {
    const treeContainer = this.appendChild(this.container, "div", "remi-tree-container");
    treeContainer.style.cssText =
      "overflow-y:auto;flex:1;min-height:0;";

    // 按 tags 构建树
    const rootNodes = this.buildTree(kus);

    for (const node of rootNodes) {
      this.renderNode(treeContainer, node, 0);
    }

    if (rootNodes.length === 0) {
      const empty = this.appendChild(treeContainer, "div", "");
      empty.style.cssText =
        "text-align:center;padding:24px;color:var(--remi-text-muted);font-size:0.85em;";
      empty.textContent = "📭 暂无知识单元\n保存笔记后自动生成";
    }
  }

  private buildTree(kus: KnowledgeUnit[]): KUNode[] {
    const root: KUNode[] = [];
    const folderMap = new Map<string, KUNode>();
    const statusCache = new Map<KUId, MasterStatus>();

    for (const ku of kus) {
      // 搜索过滤
      if (
        this.searchQuery &&
        !ku.canonical.text.toLowerCase().includes(this.searchQuery.toLowerCase())
      ) {
        continue;
      }

      statusCache.set(ku.id, "unlearned"); // placeholder
      const path = ku.tags.length > 0 ? ku.tags.join("/") : "未归类";
      const parts = path.split("/");
      let currentLevel = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLeaf = i === parts.length - 1;
        const folderKey = parts.slice(0, i + 1).join("/");

        let node = currentLevel.find((n) => n.label === part);
        if (!node) {
          node = {
            id: isLeaf ? ku.id : `folder_${folderKey}`,
            type: isLeaf ? "ku" : "folder",
            label: part,
            children: [],
            masterStatus: "unlearned",
            kuCount: 0,
            kuIds: [],
          };
          currentLevel.push(node);
        }

        node.kuCount++;
        node.kuIds.push(ku.id);
        currentLevel = node.children;
      }
    }

    return root;
  }

  private renderNode(container: HTMLElement, node: KUNode, depth: number): void {
    const isExpanded = this.expandedFolders.has(node.id);
    const indent = depth * 12;

    const row = this.appendChild(container, "div", "remi-tree-node");
    row.style.cssText =
      "display:flex;align-items:center;gap:4px;padding:3px 4px;" +
      "cursor:pointer;border-radius:4px;transition:background 0.1s;" +
      `margin-left:${indent}px;font-size:0.85em;`;
    row.addEventListener("mouseenter", () => {
      row.style.background = "var(--remi-bg-secondary)";
    });
    row.addEventListener("mouseleave", () => {
      row.style.background = "transparent";
    });

    if (node.type === "folder") {
      // 文件夹节点
      const toggle = this.appendChild(row, "span", "");
      toggle.textContent = isExpanded ? "▼" : "▶";
      toggle.style.cssText =
        "width:14px;font-size:0.7em;color:var(--remi-text-muted);flex-shrink:0;";

      const icon = this.appendChild(row, "span", "");
      icon.textContent = "📁";
      icon.style.cssText = "margin-right:2px;";

      const label = this.appendChild(row, "span", "");
      label.textContent = `${node.label} (${node.kuCount})`;
      label.style.cssText =
        "font-weight:500;color:var(--remi-text);overflow:hidden;" +
        "text-overflow:ellipsis;white-space:nowrap;flex:1;";

      row.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isExpanded) {
          this.expandedFolders.delete(node.id);
        } else {
          this.expandedFolders.add(node.id);
        }
        // Remove children and re-render
        let sibling = row.nextElementSibling;
        while (sibling && (sibling as HTMLElement).dataset?.depth !== undefined) {
          const el = sibling;
          sibling = el.nextElementSibling;
          el.remove();
        }
        if (!isExpanded) {
          for (const child of node.children) {
            this.renderNode(container, child, depth + 1);
          }
        }
      });

      // 双击展开/折叠全部
      row.addEventListener("dblclick", () => {
        if (isExpanded) {
          this.expandedFolders.clear();
        } else {
          this.expandAll(node);
        }
        this.render();
      });
    } else {
      // KU 节点
      const statusColors: Record<MasterStatus, string> = {
        unlearned: "#888",
        learning: "#3498db",
        mastered: "#27ae60",
        error: "#e74c3c",
      };
      const statusDots: Record<MasterStatus, string> = {
        unlearned: "⚪",
        learning: "🔵",
        mastered: "🟢",
        error: "🔴",
      };

      const dot = this.appendChild(row, "span", "");
      dot.textContent = statusDots[node.masterStatus] || "⚪";
      dot.style.cssText = "font-size:0.7em;flex-shrink:0;";

      const label = this.appendChild(row, "span", "");
      label.textContent = node.label;
      label.style.cssText =
        "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;";
      label.title = node.label;

      row.addEventListener("click", () => {
        // 去除所有高亮
        container.querySelectorAll(".remi-tree-node").forEach((el) => {
          (el as HTMLElement).style.background = "transparent";
        });
        row.style.background = "var(--remi-accent)22";
        // 选中 KU
        this.callbacks.onSelectKU(node.id);
      });

      // 右键菜单：锁定/查看详情
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.callbacks.onSelectKU(node.id);
      });
    }
  }

  private expandAll(node: KUNode): void {
    this.expandedFolders.add(node.id);
    for (const child of node.children) {
      if (child.type === "folder") this.expandAll(child);
    }
  }

  async refresh(): Promise<void> {
    await this.render();
  }
}
