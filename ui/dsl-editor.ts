// RemiFocus — DSL 规则管理弹窗
// 查看/启用/禁用 DSL 规则，内置规则与用户自定义规则一览

import { App, Modal, Notice } from "obsidian";
import { DSLRegistry } from "../core/dsl/registry";
import { DSLRule } from "../core/dsl/types";

export class DSLEditorModal extends Modal {
  private registry: DSLRegistry;
  private rules: DSLRule[] = [];
  private filterBuiltin: boolean | null = null; // null = all, true = builtin, false = user

  constructor(app: App, registry: DSLRegistry) {
    super(app);
    this.registry = registry;
    this.titleEl.setText("📜 DSL 规则管理");
    this.modalEl.style.width = "640px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.maxHeight = "80vh";
  }

  async onOpen(): Promise<void> {
    await this.refreshRules();
    this.render();
  }

  private async refreshRules(): Promise<void> {
    await this.registry.initialize();
    this.rules = this.registry.getAllRules();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // 顶部统计 + 过滤器
    this.renderStats();
    this.renderFilter();

    // 规则列表
    const filtered = this.getFilteredRules();

    if (filtered.length === 0) {
      contentEl.createEl("p", {
        text: "📭 没有匹配的规则",
        attr: { style: "text-align:center;padding:20px;color:var(--text-muted);" },
      });
      return;
    }

    const listEl = contentEl.createEl("div", {
      attr: { style: "display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto;padding:4px 0;" },
    });

    for (const rule of filtered) {
      this.renderRuleItem(listEl, rule);
    }

    // 底部提示
    contentEl.createEl("p", {
      text: "💡 自定义规则请编辑 .obsidian/plugins/remifocus/system/dsl-rules.yaml",
      attr: { style: "text-align:center;font-size:0.8em;color:var(--text-faint);margin-top:12px;" },
    });
  }

  private renderStats(): void {
    const { contentEl } = this;
    const stats = this.registry.getStats();

    const statsEl = contentEl.createEl("div", {
      attr: {
        style: "display:flex;gap:16px;justify-content:center;margin-bottom:12px;font-size:0.85em;",
      },
    });

    this.addStat(statsEl, `📊 总计 ${stats.total}`);
    this.addStat(statsEl, `✅ 启用 ${stats.enabled}`);
    this.addStat(statsEl, `🔵 内置 ${stats.builtin}`);
    this.addStat(statsEl, `🟢 自定义 ${stats.user}`);
  }

  private addStat(container: HTMLElement, text: string): void {
    const el = container.createEl("span", {
      text,
      attr: { style: "padding:4px 10px;border-radius:12px;background:var(--background-modifier-border);" },
    });
  }

  private renderFilter(): void {
    const { contentEl } = this;

    const filterEl = contentEl.createEl("div", {
      attr: { style: "display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;" },
    });

    const filters: Array<{ label: string; value: boolean | null }> = [
      { label: "📋 全部", value: null },
      { label: "🔵 内置规则", value: true },
      { label: "🟢 自定义规则", value: false },
    ];

    for (const f of filters) {
      const btn = filterEl.createEl("button", {
        text: f.label,
        attr: {
          style: `
            padding:4px 14px;border-radius:14px;border:1px solid var(--background-modifier-border);
            background:${this.filterBuiltin === f.value ? "var(--interactive-accent)" : "var(--background-primary-alt)"};
            color:${this.filterBuiltin === f.value ? "var(--text-on-accent, white)" : "var(--text-normal)"};
            cursor:pointer;font-size:0.82em;transition:all 0.2s;
          `,
        },
      });

      btn.addEventListener("click", () => {
        this.filterBuiltin = f.value;
        this.render();
      });
    }

    // 刷新按钮
    const refreshBtn = filterEl.createEl("button", {
      text: "🔄 刷新",
      attr: {
        style: `
          margin-left:auto;padding:4px 14px;border-radius:14px;
          border:1px solid var(--background-modifier-border);
          background:var(--background-primary-alt);cursor:pointer;font-size:0.82em;
        `,
      },
    });
    refreshBtn.addEventListener("click", async () => {
      await this.refreshRules();
      this.render();
      new Notice("✅ DSL 规则已刷新");
    });
  }

  private getFilteredRules(): DSLRule[] {
    if (this.filterBuiltin === null) return this.rules;
    return this.rules.filter((r) => r.builtin === this.filterBuiltin);
  }

  private renderRuleItem(container: HTMLElement, rule: DSLRule): void {
    const item = container.createEl("div", {
      attr: {
        style: `
          display:flex;align-items:center;gap:10px;
          padding:8px 12px;border-radius:8px;
          border:1px solid var(--background-modifier-border);
          background:var(--background-primary);
          transition:all 0.2s;
        `,
      },
    });

    // 启用/禁用开关
    const toggle = item.createEl("input", { attr: { type: "checkbox" } });
    toggle.checked = rule.enabled;
    toggle.style.cssText = "cursor:pointer;flex-shrink:0;";
    toggle.addEventListener("change", async () => {
      if (rule.enabled) {
        this.registry.disableRule(rule.id);
        new Notice(`⛔ 已禁用: ${rule.rule}`);
      } else {
        this.registry.enableRule(rule.id);
        new Notice(`✅ 已启用: ${rule.rule}`);
      }
      rule.enabled = !rule.enabled;
    });

    // 规则信息
    const info = item.createEl("div", {
      attr: { style: "flex:1;min-width:0;" },
    });

    const nameRow = info.createEl("div", {
      attr: { style: "display:flex;align-items:center;gap:6px;flex-wrap:wrap;" },
    });

    nameRow.createEl("span", {
      text: rule.rule,
      attr: { style: "font-weight:500;font-size:0.9em;" },
    });

    // 标签
    if (rule.builtin) {
      this.addTag(nameRow, "内置", "var(--interactive-accent)");
    } else {
      this.addTag(nameRow, "自定义", "var(--color-green)");
    }

    if (rule.exclusive) {
      this.addTag(nameRow, "独占", "var(--color-orange)");
    }

    if (rule.fallback) {
      this.addTag(nameRow, "兜底", "var(--text-faint)");
    }

    // 描述
    if (rule.description) {
      info.createEl("div", {
        text: rule.description,
        attr: { style: "font-size:0.78em;color:var(--text-muted);margin-top:2px;" },
      });
    }

    // 优先级 + 输出结构
    const metaRow = info.createEl("div", {
      attr: { style: "display:flex;gap:8px;margin-top:3px;font-size:0.75em;color:var(--text-faint);" },
    });
    metaRow.createEl("span", { text: `⚡ priority: ${rule.priority}` });
    metaRow.createEl("span", { text: `📐 ${rule.output.structure}` });
    if (rule.output.domain) {
      metaRow.createEl("span", { text: `📁 ${rule.output.domain}` });
    }
    if (rule.output.tags && rule.output.tags.length > 0) {
      metaRow.createEl("span", { text: `🏷️ ${rule.output.tags.join(", ")}` });
    }
  }

  private addTag(container: HTMLElement, text: string, color: string): void {
    container.createEl("span", {
      text,
      attr: {
        style: `
          font-size:0.65em;padding:1px 6px;border-radius:8px;
          background:${color};color:white;white-space:nowrap;
        `,
      },
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
