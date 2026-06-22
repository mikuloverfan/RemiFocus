// RemiFocus — Card Maker v3.5
// 磁吸伸缩工具栏 + 现代化 UI

import { Notice } from "obsidian";

export interface MakerCardData {
  word: string;
  meaning: string;
  cloze?: Array<{ hint: string; answer: string }>;
  priority: number;
  source: string;
}

export interface CardMakerCallbacks {
  onSave: (cards: MakerCardData[], deckName: string, filePath: string) => Promise<void>;
  getActiveFilePath: () => string | null;
  getExistingDecks: () => Promise<string[]>;
}

function autoSplit(text: string): { word: string; meaning: string } {
  const cleaned = text.replace(/^[-*]\s+/, "").trim();
  const m1 = cleaned.match(/^==(.+?)==\s*[:：]\s*`\[([^\]]+)\]`\s*(.+)$/);
  if (m1) return { word: m1[1].trim(), meaning: `[${m1[2]}] ${m1[3].trim()}` };
  const m2 = cleaned.match(/^==(.+?)==\s*[:：]\s*(.+)$/);
  if (m2) return { word: m2[1].trim(), meaning: m2[2].trim() };
  const m3 = cleaned.match(/^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/);
  if (m3) return { word: m3[1].trim(), meaning: m3[2].trim() };
  const m4 = cleaned.match(/^(.+?)\s*[:：]\s*(.+)$/);
  if (m4) return { word: m4[1].trim(), meaning: m4[2].trim() };
  const m5 = cleaned.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (m5) return { word: m5[1].trim(), meaning: m5[2].trim() };
  return { word: cleaned, meaning: "" };
}

export class FloatingToolbar {
  private el: HTMLElement;
  private expandedEl: HTMLElement;
  private collapsedEl: HTMLElement;
  private selections: string[] = [];
  private selecting = false;
  private cards: MakerCardData[] = [];
  private currentDeck = "default";
  private decks: string[] = [];
  private callbacks: CardMakerCallbacks;
  private visible = false;
  private expanded = false;

  private dragging = false;

  constructor(callbacks: CardMakerCallbacks) {
    this.callbacks = callbacks;
    this.el = document.createElement("div");
    // 拖拽 + 磁吸
    this.el.onmousedown = (e) => {
      if ((e.target as HTMLElement).closest("button, select, input, textarea, .rf-icon")) return;
      this.dragging = true;
      const rect = this.el.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      this.el.style.right = "auto";
      this.el.style.left = rect.left + "px";
      this.el.style.top = rect.top + "px";
      this.el.style.transition = "none";

      const onMove = (ev: MouseEvent) => {
        if (!this.dragging) return;
        this.el.style.left = (ev.clientX - offsetX) + "px";
        this.el.style.top = (ev.clientY - offsetY) + "px";
      };

      const onUp = () => {
        this.dragging = false;
        document.removeEventListener("mousemove", onMove);
        // 四边磁吸
        const r = this.el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const snapEdge = 60;
        // 检测最近边缘
        const distLeft = r.left;
        const distRight = vw - r.right;
        const distTop = r.top;
        const distBot = vh - r.bottom;
        const min = Math.min(distLeft, distRight, distTop, distBot);
        if (min === distLeft && distLeft < snapEdge) {
          this.el.style.left = "0px";
        } else if (min === distRight && distRight < snapEdge) {
          this.el.style.left = (vw - this.el.offsetWidth) + "px";
        } else if (min === distTop && distTop < snapEdge / 2) {
          this.el.style.top = "0px";
        } else if (min === distBot && distBot < snapEdge / 2) {
          this.el.style.top = (vh - this.el.offsetHeight) + "px";
        }
        if (r.top < 0) this.el.style.top = "0px";
        this.el.style.transition = "left 0.15s ease, top 0.15s ease";
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp, { once: true });
    };
    this.el.className = "rf-toolbar";
    this.el.style.cssText = `
      position:fixed;top:80px;right:16px;z-index:9999;
      background:var(--background-primary);
      border:1px solid var(--background-modifier-border);
      border-right:none;border-radius:10px 0 0 10px;
      box-shadow:-2px 2px 12px rgba(0,0,0,0.1);
      overflow:hidden;display:none;font-size:0.85em;
      transition:width 0.2s ease;
    `;

    // 收缩状态 (40px)
    this.collapsedEl = document.createElement("div");
    this.collapsedEl.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0;width:40px;cursor:pointer;";
    this.collapsedEl.innerHTML = `
      <div class="rf-icon" style="font-size:1.3em;padding:4px;border-radius:6px;transition:background 0.15s;" title="展开制卡器">🧠</div>
    `;
    this.collapsedEl.onmouseenter = () => this.expand();
    this.el.appendChild(this.collapsedEl);

    // 展开状态 (240px)
    this.expandedEl = document.createElement("div");
    this.expandedEl.style.cssText = "display:none;width:240px;padding:10px 12px;";
    this.expandedEl.onmouseleave = () => this.collapse();
    this.el.appendChild(this.expandedEl);

    document.body.appendChild(this.el);
  }

  async show(): Promise<void> {
    this.visible = true;
    this.el.style.display = "block";
    this.decks = await this.callbacks.getExistingDecks();
    if (this.decks.length > 0 && !this.decks.includes(this.currentDeck)) this.currentDeck = this.decks[0];
    this.renderExpanded();
  }

  hide(): void { this.visible = false; this.el.style.display = "none"; this.exitSelectionMode(); }
  toggle(): void { this.visible ? this.hide() : this.show(); }
  isVisible(): boolean { return this.visible; }

  destroy(): void { this.exitSelectionMode(); this.el.remove(); }

  private expand(): void {
    this.expanded = true;
    this.el.style.width = "240px";
    this.collapsedEl.style.display = "none";
    this.expandedEl.style.display = "block";
    this.renderExpanded();
  }

  private collapse(): void {
    this.expanded = false;
    this.el.style.width = "40px";
    this.collapsedEl.style.display = "flex";
    this.expandedEl.style.display = "none";
  }

  private renderExpanded(): void {
    this.expandedEl.innerHTML = "";

    // 标题栏
    const header = el("div", "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;");
    header.innerHTML = `<span style="font-weight:700;font-size:0.9em;">🧠 制卡器</span>
      <span style="font-size:0.85em;cursor:pointer;opacity:0.5;" id="rf-collapse-btn">◀</span>`;
    (header.querySelector("#rf-collapse-btn") as HTMLElement).onclick = () => this.collapse();
    this.expandedEl.appendChild(header);

    if (this.selecting) {
      // 选择模式
      const info = el("div", "font-size:0.82em;color:var(--text-muted);margin-bottom:6px;padding:6px 8px;background:var(--background-secondary);border-radius:6px;");
      info.textContent = `✂ 已选 ${this.selections.length} 段`;
      this.expandedEl.appendChild(info);

      const btnRow = el("div", "display:flex;gap:4px;");
      const doneBtn = mkBtn("✅ 完成", "flex:1;padding:6px;", () => { this.exitSelectionMode(); this.openBatchDialog(); });
      btnRow.appendChild(doneBtn);
      const cancelBtn = mkBtn("✕ 取消", "flex:1;padding:6px;", () => this.exitSelectionMode());
      btnRow.appendChild(cancelBtn);
      this.expandedEl.appendChild(btnRow);
      return;
    }

    // 工具栏按钮
    const tools = el("div", "display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px;");
    const btns = [
      { icon: "🖊", label: "制卡", hint: "点击进入选择模式", action: () => this.enterSelectionMode() },
      { icon: "✂", label: "挖空", hint: "选中文本→挖空", action: () => this.quickCloze() },
      { icon: "🔍", label: "预览", hint: "预览已创建的卡片", action: () => { if (this.cards.length > 0) this.showPreview(); } },
    ];
    for (const b of btns) {
      const btn = el("div", "display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 4px;border-radius:6px;cursor:pointer;transition:background 0.15s;font-size:0.7em;");
      btn.title = b.hint;
      btn.innerHTML = `<span style="font-size:1.3em">${b.icon}</span><span>${b.label}</span>`;
      btn.onmouseenter = () => btn.style.background = "var(--background-modifier-hover)";
      btn.onmouseleave = () => btn.style.background = "transparent";
      btn.onclick = b.action;
      tools.appendChild(btn);
    }
    this.expandedEl.appendChild(tools);

    // 卡组选择
    const deckRow = el("div", "display:flex;gap:4px;align-items:center;margin-bottom:6px;");
    const select = document.createElement("select");
    select.style.cssText = "flex:1;padding:4px 6px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.8em;background:var(--background-primary);color:var(--text-normal);";
    for (const d of this.decks) {
      const opt = document.createElement("option");
      opt.value = d; opt.textContent = d.split("/").pop() || d;
      if (d === this.currentDeck) opt.selected = true;
      select.appendChild(opt);
    }
    select.onchange = () => { this.currentDeck = select.value; };
    deckRow.appendChild(select);

    const newBtn = document.createElement("button");
    newBtn.textContent = "+";
    newBtn.style.cssText = "padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;font-size:0.8em;background:var(--background-primary);";
    newBtn.onclick = () => {
      const name = prompt("新卡组名:");
      if (name && !this.decks.includes(name)) {
        this.decks.push(name);
        const opt = document.createElement("option");
        opt.value = name; opt.textContent = name;
        select.appendChild(opt); select.value = name;
        this.currentDeck = name;
      }
    };
    deckRow.appendChild(newBtn);
    this.expandedEl.appendChild(deckRow);

    // 选择计数
    if (this.selections.length > 0) {
      const info = el("div", "font-size:0.78em;color:var(--text-muted);margin-bottom:4px;");
      info.textContent = `📋 已选 ${this.selections.length} 段文本`;
      this.expandedEl.appendChild(info);
    }

    // 卡片列表
    if (this.cards.length > 0) {
      const list = el("div", "max-height:120px;overflow-y:auto;margin-bottom:6px;border:1px solid var(--background-modifier-border);border-radius:6px;padding:4px;");
      for (const card of this.cards) {
        const row = el("div", "display:flex;align-items:center;gap:4px;padding:3px 6px;font-size:0.78em;border-radius:4px;");
        row.innerHTML = `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(card.word)}</span>
          <span style="font-size:0.75em;color:var(--text-muted);">${card.cloze ? '📋' : '📇'}</span>`;
        list.appendChild(row);
      }
      this.expandedEl.appendChild(list);

      const saveBtn = document.createElement("button");
      saveBtn.textContent = `💾 保存 ${this.cards.length} 张`;
      saveBtn.style.cssText = "width:100%;padding:7px;border:none;border-radius:6px;background:var(--interactive-accent);color:#fff;font-weight:600;cursor:pointer;font-size:0.82em;";
      saveBtn.onclick = async () => {
        const filePath = this.callbacks.getActiveFilePath() || "unknown";
        await this.callbacks.onSave(this.cards, this.currentDeck, filePath);
        this.cards = []; this.renderExpanded();
      };
      this.expandedEl.appendChild(saveBtn);
    }
  }

  // ─── 选择模式 ───

  private enterSelectionMode(): void {
    this.selecting = true;
    this.selections = [];
    this.renderExpanded();
    const handler = () => {
      if (!this.selecting) return;
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (text && !this.selections.includes(text)) {
        this.selections.push(text);
        this.renderExpanded();
      }
    };
    document.addEventListener("mouseup", handler);
    // auto-cleanup
    const cleanup = () => document.removeEventListener("mouseup", handler);
    (window as any).__rf_select_cleanup = cleanup;
    new Notice("🖊 选择模式: 点击文本选择，完成后点击 ✅ 完成");
  }

  private exitSelectionMode(): void {
    this.selecting = false;
    if ((window as any).__rf_select_cleanup) {
      (window as any).__rf_select_cleanup();
      delete (window as any).__rf_select_cleanup;
    }
    this.renderExpanded();
  }

  private quickCloze(): void {
    const sel = window.getSelection()?.toString().trim();
    if (!sel) return;
    const { word, meaning } = autoSplit(sel);
    this.cards.push({ word, meaning, cloze: [{ hint: "点击揭示", answer: meaning }], priority: 1, source: "manual" });
    this.renderExpanded();
  }

  // ─── 批量弹窗 ───

  private openBatchDialog(): void {
    if (this.selections.length === 0) return;
    const allLines: string[] = [];
    for (const sel of this.selections) {
      const lines = sel.split("\n").map(l => l.trim()).filter(l => l && /^[-*]/.test(l));
      allLines.push(...(lines.length > 0 ? lines : [sel]));
    }
    this.cards = allLines.map(s => {
      const { word, meaning } = autoSplit(s);
      return { word, meaning, priority: 1, source: "manual" };
    });
    this.showBatchModal();
  }

  private showBatchModal(): void {
    const overlay = modalOverlay();
    const modal = modalBox("660px", overlay);
    let deckPerCard: string[] = this.cards.map(() => this.currentDeck);
    let html = `<div style="font-weight:700;font-size:1em;margin-bottom:12px;">🧠 批量制卡</div>`;

    // ── 粘贴区 ──
    html += `<textarea id="rf-paste-area" rows="3" placeholder="📋 粘贴文本到这里，自动识别为卡片\n或点击 [从笔记选择] 按钮" style="width:100%;padding:8px 10px;border:1px solid var(--background-modifier-border);border-radius:8px;margin-bottom:10px;font-size:0.85em;resize:vertical;box-sizing:border-box;background:var(--background-primary);color:var(--text-normal);font-family:inherit;"></textarea>`;

    // ── 检测条 ──
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:6px 10px;background:var(--background-secondary);border-radius:6px;font-size:0.82em;">
      <span>🔍 检测到 <strong id="rf-card-count">${this.cards.length}</strong> 张卡片</span>
      <div style="display:flex;gap:6px;">
        <button id="rf-auto-cloze" style="padding:3px 10px;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;font-size:0.8em;background:var(--background-primary);">✂ 全部挖空</button>
        <button id="rf-reparse-btn" style="padding:3px 10px;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;font-size:0.8em;background:var(--background-primary);">🔄 重新识别</button>
      </div>
    </div>`;

    // ── 卡片列表 ──
    html += `<div id="rf-card-list" style="max-height:45vh;overflow-y:auto;margin-bottom:10px;">`;
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      html += `
        <div class="rf-card-item" data-idx="${i}" style="padding:8px 10px;margin-bottom:4px;border:1px solid var(--background-modifier-border);border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:600;font-size:0.8em;color:var(--text-muted);">#${i + 1}</span>
            <div style="display:flex;gap:4px;align-items:center;">
              <select class="rf-card-deck" data-idx="${i}" style="padding:2px 4px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.75em;background:var(--background-primary);color:var(--text-normal);">
                ${this.decks.map(d => `<option value="${d}" ${d === (deckPerCard[i] || this.currentDeck) ? 'selected' : ''}>${d.split("/").pop()}</option>`).join("")}
              </select>
              <span class="rf-cloze-single" style="font-size:0.7em;cursor:pointer;color:var(--text-accent);padding:2px 6px;border-radius:4px;border:1px solid var(--background-modifier-border);">✂挖空</span>
              <span class="rf-del-single" style="font-size:0.7em;cursor:pointer;color:var(--text-error);padding:2px 4px;">🗑</span>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:4px;">
            <input class="rf-w-${i}" value="${esc(c.word)}" placeholder="单词" style="flex:1;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.88em;font-weight:600;background:var(--background-primary);color:var(--text-normal);">
          </div>
          <textarea class="rf-m-${i}" rows="2" placeholder="释义" style="width:100%;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.82em;box-sizing:border-box;resize:vertical;background:var(--background-primary);color:var(--text-normal);font-family:inherit;">${esc(c.meaning)}</textarea>
        </div>`;
    }
    html += `</div>`;

    // ── 添加新卡 ──
    html += `<div style="display:flex;gap:6px;margin-bottom:10px;">
      <input id="rf-new-word" placeholder="新单词..." style="flex:1;padding:5px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.82em;background:var(--background-primary);color:var(--text-normal);">
      <input id="rf-new-meaning" placeholder="新释义..." style="flex:2;padding:5px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.82em;background:var(--background-primary);color:var(--text-normal);">
      <button id="rf-add-card" style="padding:5px 12px;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;font-size:0.82em;background:var(--background-primary);">➕ 添加</button>
    </div>`;

    // ── 底部按钮 ──
    html += `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--background-modifier-border);padding-top:10px;">
      <span style="font-size:0.82em;color:var(--text-muted);">📦 批量存入:</span>
      <select id="rf-batch-deck-all" style="flex:1;min-width:100px;padding:5px 8px;border:1px solid var(--background-modifier-border);border-radius:6px;font-size:0.82em;background:var(--background-primary);color:var(--text-normal);">
        ${this.decks.map(d => `<option value="${d}" ${d === this.currentDeck ? 'selected' : ''}>${d.split("/").pop()}</option>`).join("")}
      </select>
      <button id="rf-apply-deck" style="padding:4px 10px;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;font-size:0.78em;background:var(--background-primary);">应用到全部</button>
      <button id="rf-preview-btn" style="padding:5px 12px;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;font-size:0.82em;background:var(--background-primary);">🔍预览</button>
      <button id="rf-save-btn" style="padding:6px 24px;border:none;border-radius:8px;cursor:pointer;background:var(--interactive-accent);color:#fff;font-weight:600;font-size:0.85em;">💾 保存全部</button>
      <button id="rf-cancel-btn" style="padding:5px 12px;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;font-size:0.82em;background:var(--background-primary);">✕取消</button>
    </div>`;

    modal.innerHTML = html;
    document.body.appendChild(overlay);

    // ── 事件绑定 ──

    // 粘贴识别
    const pasteArea = modal.querySelector("#rf-paste-area") as HTMLTextAreaElement;
    pasteArea.oninput = () => {
      const text = pasteArea.value;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l && /^[-*]/.test(l) || l && /^==/.test(l));
      if (lines.length > 0) {
        const newCards = lines.map(l => { const { word, meaning } = autoSplit(l); return { word, meaning, priority: 1, source: "manual" }; });
        this.cards = newCards;
        deckPerCard = this.cards.map(() => this.currentDeck);
        overlay.remove();
        this.showBatchModal();
      }
    };

    // 全部挖空
    modal.querySelector("#rf-auto-cloze")?.addEventListener("click", () => {
      for (const card of this.cards) {
        if (!card.cloze) {
          const hlMatch = card.meaning.match(/==(.+?)==/g);
          if (hlMatch) {
            card.cloze = hlMatch.map(m => ({ hint: m.replace(/==/g, "").slice(0, 60), answer: m.replace(/==/g, "") }));
          }
        }
      }
      new Notice(`✂ 已为 ${this.cards.filter(c => c.cloze).length} 张卡片创建挖空`);
    });

    // 单卡挖空（选中文本）
    modal.querySelectorAll(".rf-cloze-single").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = (btn as HTMLElement).closest(".rf-card-item") as HTMLElement;
        const idx = parseInt(item.getAttribute("data-idx") || "0");
        const ta = modal.querySelector(`.rf-m-${idx}`) as HTMLTextAreaElement;
        if (!ta) return;
        const s = ta.selectionStart, e = ta.selectionEnd;
        if (s !== null && e !== null && s !== e) {
          const txt = ta.value;
          ta.value = txt.slice(0, s) + `{{c1::${txt.slice(s, e)}}}` + txt.slice(e);
          this.cards[idx].meaning = ta.value;
          this.cards[idx].cloze = [{ hint: "点击揭示", answer: txt.slice(s, e) }];
        }
      });
    });

    // 删除单卡
    modal.querySelectorAll(".rf-del-single").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = (btn as HTMLElement).closest(".rf-card-item") as HTMLElement;
        const idx = parseInt(item.getAttribute("data-idx") || "0");
        this.cards.splice(idx, 1);
        overlay.remove();
        this.showBatchModal();
      });
    });

    // 添加新卡
    modal.querySelector("#rf-add-card")?.addEventListener("click", () => {
      const w = (modal.querySelector("#rf-new-word") as HTMLInputElement).value.trim();
      const m = (modal.querySelector("#rf-new-meaning") as HTMLInputElement).value.trim();
      if (w) {
        this.cards.push({ word: w, meaning: m, priority: 1, source: "manual" });
        overlay.remove();
        this.showBatchModal();
      }
    });

    // 应用卡组到全部
    modal.querySelector("#rf-apply-deck")?.addEventListener("click", () => {
      const deck = (modal.querySelector("#rf-batch-deck-all") as HTMLSelectElement).value;
      this.currentDeck = deck;
      modal.querySelectorAll(".rf-card-deck").forEach(sel => (sel as HTMLSelectElement).value = deck);
      new Notice(`✅ 全部卡组已设为 "${deck.split("/").pop()}"`);
    });

    // 保存
    modal.querySelector("#rf-save-btn")?.addEventListener("click", async () => {
      for (let i = 0; i < this.cards.length; i++) {
        const w = modal.querySelector(`.rf-w-${i}`) as HTMLInputElement;
        const m = modal.querySelector(`.rf-m-${i}`) as HTMLTextAreaElement;
        const d = modal.querySelector(`.rf-card-deck[data-idx="${i}"]`) as HTMLSelectElement;
        if (w) this.cards[i].word = w.value.trim();
        if (m) this.cards[i].meaning = m.value.trim();
        if (d) this.currentDeck = d.value;
      }
      const filePath = this.callbacks.getActiveFilePath() || "unknown";
      await this.callbacks.onSave(this.cards, this.currentDeck, filePath);
      this.cards = []; this.selections = []; overlay.remove(); this.renderExpanded();
    });

    modal.querySelector("#rf-cancel-btn")?.addEventListener("click", () => overlay.remove());
    modal.querySelector("#rf-preview-btn")?.addEventListener("click", () => { overlay.remove(); this.showPreview(); });
  }

  // ─── 预览 ───

  private showPreview(): void {
    if (this.cards.length === 0) return;
    let idx = 0;
    const overlay = modalOverlay();
    const modal = modalBox("360px", overlay);

    const render = () => {
      const card = this.cards[idx];
      modal.innerHTML = `
        <div style="font-weight:600;font-size:0.9em;margin-bottom:10px;">🔍 预览 — ${idx + 1}/${this.cards.length}</div>
        <div style="text-align:center;padding:24px;border:1px solid var(--background-modifier-border);border-radius:10px;margin-bottom:10px;">
          <div style="font-size:1.3em;font-weight:700;margin-bottom:6px;">${esc(card.word)}</div>
          <div style="color:var(--text-muted);font-size:0.9em;">${esc(card.meaning)}</div>
          ${card.cloze ? '<div style="margin-top:6px;color:var(--text-accent);font-size:0.8em;">📋 含挖空</div>' : ''}
        </div>
        <div style="display:flex;gap:6px;justify-content:center;">
          <button class="rf-prev" style="padding:5px 14px;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;background:var(--background-primary);font-size:0.85em;" ${idx === 0 ? 'disabled' : ''}>←</button>
          <button class="rf-next" style="padding:5px 14px;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;background:var(--background-primary);font-size:0.85em;" ${idx >= this.cards.length - 1 ? 'disabled' : ''}>→</button>
        </div>
        <div style="text-align:center;margin-top:8px;"><button class="rf-close" style="padding:4px 16px;border:none;border-radius:6px;cursor:pointer;color:var(--text-muted);font-size:0.82em;">✕ 关闭</button></div>
      `;
      modal.querySelector(".rf-prev")?.addEventListener("click", () => { if (idx > 0) { idx--; render(); } });
      modal.querySelector(".rf-next")?.addEventListener("click", () => { if (idx < this.cards.length - 1) { idx++; render(); } });
      modal.querySelector(".rf-close")?.addEventListener("click", () => overlay.remove());
    };
    render();
    document.body.appendChild(overlay);
  }
}

// ─── 工具函数 ───

function el(tag: string, style: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = style;
  return e;
}

function mkBtn(label: string, style: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText = `padding:5px 10px;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;font-size:0.82em;background:var(--background-primary);${style}`;
  b.onclick = onClick;
  return b;
}

function esc(s: string): string {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

function modalOverlay(): HTMLElement {
  const o = document.createElement("div");
  o.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;";
  o.onclick = (e) => { if (e.target === o) o.remove(); };
  return o;
}

function modalBox(width: string, overlay: HTMLElement): HTMLElement {
  const m = document.createElement("div");
  m.style.cssText = `background:var(--background-primary);border-radius:14px;padding:20px;width:${width};max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2);`;
  m.onclick = (e) => e.stopPropagation();
  overlay.appendChild(m);
  return m;
}
