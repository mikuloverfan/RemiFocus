import { IEngine } from "../engine/interface";
// RemiFocus — 学习 Session 界面
// 三种模式统一渲染：
//   🟢 Exposure（熟悉阶段）— 快速翻词，只记认识/不认识
//   🔵 Test（核心记忆测试）— 回忆单词，again/hard/good/easy 反馈
//   🟣 Review（系统复习）— 基于间隔算法自动调度
//
// UI 优化：紧凑标题、更大的卡片区域、更大的弹窗尺寸

import { UIComponent } from "./base";
import { WordEntry, ReviewResult, LearningMode } from "../models/card";

export interface SessionCallbacks {
  /** 学习完成时触发 */
  onComplete: (deckName: string) => void;
  /** 用户主动退出 */
  onExit: () => void;
}

interface SessionWord {
  word: string;
  entry: WordEntry;
}

/**
 * 学习 Session 界面
 *
 * 使用示例：
 * ```ts
 * const session = new SessionView(containerEl, engine, "biology", "test", callbacks, 40);
 * await session.render();
 * ```
 */
export class SessionView extends UIComponent {
  private deckName: string;
  private mode: LearningMode;
  private callbacks: SessionCallbacks;
  private sessionCount: number; // 自定义测试数量

  private queue: SessionWord[] = [];
  private currentIndex = 0;
  private completed = 0;
  private total = 0;
  private revealed = false; // Test/Review 模式下是否显示了释义

  constructor(
    container: HTMLElement,
    engine: IEngine,
    deckName: string,
    mode: LearningMode,
    callbacks: SessionCallbacks,
    sessionCount?: number
  ) {
    super(container, engine);
    this.deckName = deckName;
    this.mode = mode;
    this.callbacks = callbacks;
    this.sessionCount = sessionCount ?? 20;
    container.classList.add("remi-focus", "remi-session");
  }

  async render(): Promise<void> {
    this.clear();
    await this.loadQueue();
    this.renderSessionFrame();
  }

  // ─── 加载队列 ───

  private async loadQueue(): Promise<void> {
    const raw = await this.engine.getQueue(this.mode, this.sessionCount);
    // 筛选属于当前卡组的单词
    this.queue = raw
      .filter(([, entry]) => entry.deck.includes(this.deckName))
      .map(([word, entry]) => ({ word, entry }));
    this.total = this.queue.length;
    this.currentIndex = 0;
    this.completed = 0;
  }

  // ─── 主渲染 ───

  private renderSessionFrame(): void {
    this.clear();

    if (this.queue.length === 0) {
      this.renderEmpty();
      return;
    }

    if (this.currentIndex >= this.queue.length) {
      this.renderComplete();
      return;
    }

    const current = this.queue[this.currentIndex];
    this.revealed = false;

    // ─── 紧凑标题行 ───
    const modeLabels: Record<LearningMode, string> = {
      exposure: "👁 Exposure",
      test: "🧪 Test",
      review: "🔄 Review",
    };
    const header = this.appendChild(this.container, "div", "remi-session-header");
    header.innerHTML = `
      <span class="remi-session-header-title">${modeLabels[this.mode]}</span>
      <span class="remi-session-header-deck">📇 ${this.deckName}</span>
      <button class="remi-btn" style="font-size:0.8em;padding:4px 10px;">✕ 退出</button>
    `;
    header.querySelector("button")!.addEventListener("click", () => this.callbacks.onExit());

    // ─── 进度条 ───
    const progressContainer = this.appendChild(this.container, "div", "remi-session-progress");
    const progress = this.total > 0 ? (this.completed / this.total) * 100 : 0;
    const bar = this.appendChild(progressContainer, "div", "remi-progress-bar");
    const fill = this.appendChild(bar, "div", `remi-progress-fill ${progress >= 60 ? "high" : progress >= 30 ? "medium" : "low"}`);
    fill.style.width = `${progress}%`;
    const progressText = this.appendChild(progressContainer, "div", "remi-session-progress-text");
    progressText.textContent = `${this.completed} / ${this.total} (${Math.round(progress)}%)`;

    // ─── 渲染 Markdown 简易版 ───
    const renderMd = (s: string): string => {
      return s
        .replace(/==(.+?)==/g, "<mark>$1</mark>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br>");
    };
    const stripEquals = (s: string) => renderMd(s);

    // ─── 单词卡片区域（大尺寸） ───
    const wordEl = this.appendChild(this.container, "div", "remi-session-word");
    wordEl.innerHTML = renderMd(current.word);

    // ─── 可扩展卡片区域（弹性撑满剩余空间） ───
    const cardArea = this.appendChild(this.container, "div", "remi-session-card-area");

    // 检测是否为 Cloze（挖空）卡片
    const clozeData = (current.entry as any).cloze;
    const isCloze = clozeData && Array.isArray(clozeData) && clozeData.length > 0;

    if (isCloze) {
      this.renderClozeMode(current, stripEquals, clozeData, cardArea);
    } else {
      // 所有模式：Anki 风格 — 先看题，点击看答案
      this.renderAnkiCard(current, stripEquals, cardArea);
    }
  }

  // ─── Cloze 挖空渲染 ───

  private renderClozeMode(
    current: SessionWord,
    strip: (s: string) => string,
    segments: Array<{ hint: string; answer: string }>,
    cardArea: HTMLElement
  ): void {
    const container = this.appendChild(cardArea, "div", "");
    container.style.cssText = "margin:8px 0;";

    // 助记（如有）
    const mnemonic = (current.entry as any).mnemonic;
    if (mnemonic) {
      const memoEl = this.appendChild(container, "div", "");
      memoEl.style.cssText = "font-size:0.85em;color:var(--remi-accent);margin-bottom:12px;padding:8px 12px;background:var(--remi-bg-secondary);border-radius:6px;";
      memoEl.innerHTML = `💡 <strong>${strip(mnemonic)}</strong>`;
    }

    // 每个 cloze 片段：先显示 hint，点击揭示 answer
    const revealedFlags = new Array(segments.length).fill(false);

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segEl = this.appendChild(container, "div", "");
      segEl.style.cssText = "margin-bottom:8px;padding:8px 12px;border-radius:6px;border:1px solid var(--remi-border);cursor:pointer;transition:all 0.15s;";

      const hintEl = this.appendChild(segEl, "div", "");
      hintEl.style.cssText = "font-size:0.85em;color:var(--remi-text-muted);margin-bottom:4px;";
      hintEl.textContent = "📝 " + strip(this.shorten(seg.hint, 80));

      const answerEl = this.appendChild(segEl, "div", "");
      answerEl.style.cssText = "font-size:1em;font-weight:600;min-height:1.5em;";

      if (this.mode === "exposure") {
        answerEl.textContent = strip(seg.answer);
      } else {
        answerEl.textContent = "______";
        answerEl.style.color = "var(--remi-text-muted)";
      }

      segEl.addEventListener("click", () => {
        if (this.mode === "exposure") return;
        if (!revealedFlags[i]) {
          revealedFlags[i] = true;
          answerEl.textContent = strip(seg.answer);
          answerEl.style.color = "var(--remi-text)";
          segEl.style.borderColor = "var(--remi-success)";
          segEl.style.background = "rgba(39,174,96,0.05)";

          // 如果全部揭示了，显示反馈按钮
          if (revealedFlags.every(r => r)) {
            setTimeout(() => {
              const existing = this.container.querySelector("#remi-feedback-area");
              if (!existing) this.renderFeedbackButtons(current);
            }, 300);
          }
        }
      });
    }

    // 反馈容器
    if (this.mode !== "exposure") {
      const fc = this.appendChild(this.container, "div", "remi-feedback");
      fc.id = "remi-feedback-area";
      fc.style.marginTop = "16px";
    }
  }

  // ─── Anki 风格卡片 ───
  // 先看题（正面），点击后看答案（背面），然后评分

  private renderAnkiCard(current: SessionWord, strip: (s: string) => string, cardArea: HTMLElement): void {
    // 卡片背面（答案）— 初始隐藏
    const cardEl = this.appendChild(cardArea, "div", "remi-session-card");
    cardEl.innerHTML = `<div class="remi-session-hint">👆 点击显示答案</div>`;

    cardEl.addEventListener("click", () => {
      if (this.revealed) return;
      this.revealed = true;

      // 显示答案
      cardEl.classList.add("revealed");
      cardEl.innerHTML = strip(current.entry.meaning);

      // 创建反馈按钮容器（在 cardArea 之后，session container 中）
      const fc = this.appendChild(this.container, "div", "remi-feedback");
      fc.id = "remi-feedback-area";

      // 显示评分按钮
      this.renderFeedbackButtons(current);
    });
  }

  private shorten(s: string, max: number): string {
    return s.length > max ? s.slice(0, max) + "..." : s;
  }

  // ─── Exposure 模式按钮 ───

  private renderExposureButtons(current: SessionWord): void {
    const btnGroup = this.appendChild(this.container, "div", "remi-exposure-btns");

    const unknownBtn = this.appendChild(btnGroup, "button", "remi-exposure-btn unknown");
    unknownBtn.textContent = "✗ 不认识";
    unknownBtn.addEventListener("click", () =>
      this.handleResult(current, "again")
    );

    const knownBtn = this.appendChild(btnGroup, "button", "remi-exposure-btn known");
    knownBtn.textContent = "✓ 认识";
    knownBtn.addEventListener("click", () =>
      this.handleResult(current, "good")
    );
  }

  // ─── Test/Review 反馈按钮 ───

  private renderFeedbackButtons(current: SessionWord): void {
    const feedbackArea = this.container.querySelector("#remi-feedback-area");
    if (!feedbackArea) return;

    feedbackArea.innerHTML = "";

    const buttons: { result: ReviewResult; label: string; desc: string; className: string }[] = [
      { result: "again", label: "🔄 Again", desc: "完全忘了", className: "again" },
      { result: "hard", label: "😓 Hard", desc: "回忆困难", className: "hard" },
      { result: "good", label: "👍 Good", desc: "正确回忆", className: "good" },
      { result: "easy", label: "⚡ Easy", desc: "瞬间想起", className: "easy" },
    ];

    for (const btn of buttons) {
      const el = this.appendChild(feedbackArea as HTMLElement, "button", `remi-feedback-btn ${btn.className}`);
      el.innerHTML = `<span class="label">${btn.label}</span><span class="desc">${btn.desc}</span>`;
      el.addEventListener("click", () => this.handleResult(current, btn.result));
    }
  }

  // ─── 处理结果 ───

  private async handleResult(current: SessionWord, result: ReviewResult): Promise<void> {
    try {
      await this.engine.processResult(current.word, this.mode, result);
    } catch (err) {
      console.error("RemiFocus: processResult error", err);
    }

    this.completed++;
    this.currentIndex++;

    // 延迟一下再显示下一张
    setTimeout(() => this.renderSessionFrame(), 300);
  }

  // ─── 完成状态 ───

  private renderComplete(): void {
    this.clear();

    const modeEmoji: Record<LearningMode, string> = {
      exposure: "👁",
      test: "🧪",
      review: "🔄",
    };

    const completeEl = this.appendChild(this.container, "div", "remi-session-complete");

    completeEl.innerHTML = `
      <div style="font-size:3em;margin-bottom:12px;">🎉</div>
      <div style="font-size:1.3em;font-weight:700;margin-bottom:8px;">
        ${modeEmoji[this.mode]} ${this.deckName} 学习完成！
      </div>
      <div style="color:var(--remi-text-muted);margin-bottom:20px;">
        本次完成 ${this.total} 个单词
      </div>
      <div style="font-size:0.9em;color:var(--remi-text-muted);margin-bottom:24px;">
        ${this.mode === "exposure" ? "💡 建议进入 Test 模式进行记忆测试" :
          this.mode === "test" ? "💡 系统已调度复习计划，记得按时回来复习" :
          "💡 复习完成！看看其他卡组是否需要复习"}
      </div>
      <div class="remi-btn-group" style="justify-content:center;gap:12px;">
        <button class="remi-btn">← 返回</button>
        ${this.mode === "exposure" ? '<button class="remi-btn remi-btn-primary">🧪 进入 Test 模式</button>' : ''}
      </div>
    `;

    completeEl.querySelector(".remi-btn")!.addEventListener("click", () =>
      this.callbacks.onComplete(this.deckName)
    );

    if (this.mode === "exposure") {
      const testBtn = completeEl.querySelector(".remi-btn-primary")!;
      testBtn.addEventListener("click", () => {
        this.mode = "test";
        this.render();
      });
    }
  }

  // ─── 空状态 ───

  private renderEmpty(): void {
    this.clear();
    const modeLabels: Record<LearningMode, string> = {
      exposure: "初学 (Exposure)",
      test: "测试 (Test)",
      review: "复习 (Review)",
    };

    const empty = this.appendChild(this.container, "div", "remi-empty");
    empty.innerHTML = `
      <div class="remi-empty-icon">✅</div>
      <p>${this.deckName} 卡组暂无 ${modeLabels[this.mode]} 任务</p>
      <p style="font-size:0.85em;margin-top:4px;">尝试切换到其他学习模式</p>
    `;

    const btnGroup = this.appendChild(this.container, "div", "remi-btn-group");
    btnGroup.style.justifyContent = "center";
    btnGroup.style.marginTop = "16px";

    const backBtn = this.appendChild(btnGroup, "button", "remi-btn");
    backBtn.textContent = "← 返回";
    backBtn.addEventListener("click", () => this.callbacks.onExit());
  }
}
