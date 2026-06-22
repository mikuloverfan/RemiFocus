import { Modal, App, Setting, Notice } from "obsidian";
// RemiFocus — AI 聊天弹窗
// 左侧：历史对话 | 右侧：聊天区域 | 左下角：设置

import { AIService } from "../ai/service";
import {
  AISettings,
  DEFAULT_AI_SETTINGS,
  ChatMessage,
  ChatSession,
} from "../ai/types";

export class AIChatModal extends Modal {
  private aiService: AIService;
  private settings: AISettings;
  private sessions: ChatSession[] = [];
  private currentSession: ChatSession | null = null;
  private onSettingsChange: (settings: AISettings) => void;

  constructor(
    app: App,
    aiService: AIService,
    settings: AISettings,
    onSettingsChange: (settings: AISettings) => void
  ) {
    super(app);
    this.aiService = aiService;
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;

    this.titleEl.style.display = "none";
    this.modalEl.style.width = "85vw";
    this.modalEl.style.maxWidth = "750px";
    this.modalEl.style.height = "75vh";
    this.modalEl.style.maxHeight = "650px";
    this.modalEl.style.borderRadius = "12px";
    this.modalEl.style.padding = "0";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.classList.add("remi-focus");
    contentEl.style.cssText =
      "display:flex;flex-direction:column;height:100%;padding:0;overflow:hidden;";

    // ── 主体：左右分栏 ──
    const body = contentEl.createDiv();
    body.style.cssText =
      "display:flex;flex:1;min-height:0;overflow:hidden;";

    // 左侧：历史会话列表
    const leftPanel = body.createDiv();
    leftPanel.style.cssText =
      "width:180px;border-right:1px solid var(--remi-border);" +
      "display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;";
    this.renderLeftPanel(leftPanel);

    // 右侧：聊天区域
    const rightPanel = body.createDiv();
    rightPanel.style.cssText =
      "flex:1;display:flex;flex-direction:column;overflow:hidden;";
    this.renderRightPanel(rightPanel);

    // ── 底部操作栏 ──
    const bottomBar = contentEl.createDiv();
    bottomBar.style.cssText =
      "display:flex;align-items:center;gap:8px;padding:8px 12px;" +
      "border-top:1px solid var(--remi-border);flex-shrink:0;";
    this.renderBottomBar(bottomBar);
  }

  // ════════════════════════════════════════
  //  左侧：历史会话
  // ════════════════════════════════════════

  private renderLeftPanel(container: HTMLElement): void {
    const title = container.createDiv();
    title.style.cssText =
      "font-weight:600;font-size:0.85em;padding:10px 12px 6px;" +
      "color:var(--remi-text-muted);";
    title.textContent = "📋 对话历史";

    const list = container.createDiv();
    list.style.cssText = "overflow-y:auto;flex:1;min-height:0;";

    if (this.sessions.length === 0) {
      const empty = list.createDiv();
      empty.style.cssText =
        "text-align:center;padding:16px;color:var(--remi-text-muted);font-size:0.8em;";
      empty.textContent = "暂无对话";
    }

    for (const session of this.sessions) {
      const item = list.createDiv();
      item.style.cssText =
        "padding:6px 12px;cursor:pointer;font-size:0.82em;" +
        "border-left:3px solid transparent;transition:all 0.1s;" +
        (this.currentSession?.id === session.id
          ? "background:var(--remi-accent)15;border-left-color:var(--remi-accent);font-weight:500;"
          : "");
      item.textContent = session.title;
      item.title = session.messages[0]?.content.slice(0, 60) || "";
      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--remi-bg-secondary)";
      });
      item.addEventListener("mouseleave", () => {
        if (this.currentSession?.id !== session.id) {
          item.style.background = "transparent";
        }
      });
      item.addEventListener("click", () => {
        this.currentSession = session;
        this.onOpen();
      });
    }

    // 新建会话按钮
    const newBtn = container.createDiv();
    newBtn.style.cssText =
      "padding:8px 12px;cursor:pointer;font-size:0.82em;color:var(--remi-accent);" +
      "border-top:1px solid var(--remi-border);font-weight:500;";
    newBtn.textContent = "＋ 新建对话";
    newBtn.addEventListener("click", () => {
      this.currentSession = {
        id: `session_${Date.now()}`,
        title: `对话 ${this.sessions.length + 1}`,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.sessions.push(this.currentSession);
      this.onOpen();
    });
  }

  // ════════════════════════════════════════
  //  右侧：聊天区域
  // ════════════════════════════════════════

  private renderRightPanel(container: HTMLElement): void {
    // 标题
    const header = container.createDiv();
    header.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;" +
      "padding:8px 14px;border-bottom:1px solid var(--remi-border);flex-shrink:0;";

    const title = header.createSpan();
    title.style.cssText = "font-weight:600;font-size:0.9em;";
    title.textContent = this.currentSession?.title || "💬 AI 识卡";

    const configIndicator = header.createSpan();
    configIndicator.style.cssText =
      "font-size:0.78em;color:var(--remi-text-muted);";
    configIndicator.textContent = this.settings.enabled
      ? `🤖 ${this.settings.model}`
      : "⚠️ 未配置";

    // 消息列表
    const msgContainer = container.createDiv();
    msgContainer.style.cssText =
      "flex:1;overflow-y:auto;padding:8px 14px;display:flex;" +
      "flex-direction:column;gap:8px;min-height:0;";

    if (!this.currentSession || this.currentSession.messages.length === 0) {
      const welcome = msgContainer.createDiv();
      welcome.style.cssText =
        "text-align:center;padding:32px;color:var(--remi-text-muted);font-size:0.85em;line-height:1.6;";
      welcome.innerHTML =
        "🤖 您好！我是 AI 学习助手<br/>" +
        "我可以帮您：<br/>" +
        "• 📖 分析笔记内容，提取卡片<br/>" +
        "• 🧠 压缩冗长笔记为易记卡片<br/>" +
        "• 📊 分析学习数据，优化卡组<br/>" +
        "• 💡 回答学习方法问题<br/><br/>" +
        "<span style='font-size:0.85em;color:var(--remi-text-muted)'>请在下方输入框发送消息开始</span>";
    }

    for (const msg of this.currentSession?.messages ?? []) {
      this.renderMessage(msgContainer, msg);
    }

    // 自动滚动到底部
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  private renderMessage(container: HTMLElement, msg: ChatMessage): void {
    const isUser = msg.role === "user";

    const bubble = container.createDiv();
    bubble.style.cssText =
      "max-width:85%;padding:8px 12px;border-radius:10px;font-size:0.85em;" +
      "line-height:1.5;word-wrap:break-word;align-self:" +
      (isUser ? "flex-end" : "flex-start") + ";";

    if (isUser) {
      bubble.style.background = "var(--remi-accent)";
      bubble.style.color = "#fff";
    } else {
      bubble.style.background = "var(--remi-bg-secondary)";
      bubble.style.color = "var(--remi-text)";
      bubble.style.border = "1px solid var(--remi-border)";
    }

    bubble.textContent = msg.content;

    // 时间戳
    const time = container.createDiv();
    time.style.cssText =
      "font-size:0.7em;color:var(--remi-text-muted);text-align:" +
      (isUser ? "right" : "left") + ";padding:0 4px;";
    time.textContent = new Date(msg.timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ════════════════════════════════════════
  //  底部操作栏
  // ════════════════════════════════════════

  private renderBottomBar(container: HTMLElement): void {
    // 设置按钮（左下角）
    const settingsBtn = container.createEl("button");
    settingsBtn.textContent = "⚙️";
    settingsBtn.style.cssText =
      "padding:6px 10px;border:1px solid var(--remi-border);border-radius:6px;" +
      "cursor:pointer;background:var(--remi-bg);font-size:0.9em;flex-shrink:0;";
    settingsBtn.title = "AI 设置";
    settingsBtn.addEventListener("click", () => this.openSettingsModal());

    // 输入框
    const input = container.createEl("input");
    input.setAttribute("type", "text");
    input.setAttribute("placeholder", "输入消息...");
    input.style.cssText =
      "flex:1;padding:8px 12px;border:1px solid var(--remi-border);border-radius:8px;" +
      "background:var(--remi-bg);color:var(--remi-text);font-size:0.88em;outline:none;";

    // 发送按钮
    const sendBtn = container.createEl("button");
    sendBtn.textContent = "发送 ▶";
    sendBtn.style.cssText =
      "padding:8px 16px;border:none;border-radius:8px;cursor:pointer;" +
      "background:var(--remi-accent);color:#fff;font-size:0.85em;font-weight:500;flex-shrink:0;";

    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text || !this.currentSession) return;

      // 检查配置
      if (!this.settings.enabled || !this.settings.apiKey) {
        new Notice("⚠️ 请先在设置中配置 AI API");
        this.openSettingsModal();
        return;
      }

      // 添加用户消息
      this.currentSession.messages.push({
        role: "user",
        content: text,
        timestamp: Date.now(),
      });
      input.value = "";
      sendBtn.textContent = "⏳...";
      sendBtn.disabled = true;

      // 重新渲染
      this.onOpen();

      try {
        // 调用 AI
        const response = await this.aiService.chat(
          this.currentSession.messages
        );

        // 添加 AI 回复
        this.currentSession.messages.push({
          role: "assistant",
          content: response,
          timestamp: Date.now(),
        });
        this.currentSession.updatedAt = Date.now();
      } catch (err: any) {
        new Notice(`❌ ${err.message}`);
        // 移除用户消息
        this.currentSession.messages.pop();
      } finally {
        sendBtn.textContent = "发送 ▶";
        sendBtn.disabled = false;
        this.onOpen();
      }
    };

    sendBtn.addEventListener("click", sendMessage);

    // Enter 发送
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // 快速操作按钮（右侧）
    const quickActions = container.createDiv();
    quickActions.style.cssText = "display:flex;gap:4px;flex-shrink:0;";

    const analyzeBtn = quickActions.createEl("button");
    analyzeBtn.textContent = "📊 分析";
    analyzeBtn.style.cssText =
      "padding:6px 10px;border:1px solid var(--remi-border);border-radius:6px;" +
      "cursor:pointer;background:var(--remi-bg);font-size:0.78em;color:var(--remi-text-muted);";
    analyzeBtn.title = "分析当前笔记";
    analyzeBtn.addEventListener("click", () => {
      input.value = "帮我分析当前笔记的内容，提取卡片";
    });

    const compressBtn = quickActions.createEl("button");
    compressBtn.textContent = "🧠 压缩";
    compressBtn.style.cssText =
      "padding:6px 10px;border:1px solid var(--remi-border);border-radius:6px;" +
      "cursor:pointer;background:var(--remi-bg);font-size:0.78em;color:var(--remi-text-muted);";
    compressBtn.title = "压缩当前笔记";
    compressBtn.addEventListener("click", () => {
      input.value = "帮我压缩当前笔记，生成易记卡片";
    });
  }

  // ════════════════════════════════════════
  //  设置弹窗（内嵌）
  // ════════════════════════════════════════

  private openSettingsModal(): void {
    const modal = new Modal(this.app);
    modal.titleEl.setText("🤖 AI 设置");
    modal.modalEl.style.width = "480px";
    modal.modalEl.style.maxWidth = "90vw";
    modal.modalEl.style.borderRadius = "10px";

    const settings = { ...this.settings };

    modal.onOpen = () => {
      const { contentEl } = modal;
      contentEl.classList.add("remi-focus");
      contentEl.style.padding = "8px";

      new Setting(contentEl)
        .setName("启用 AI")
        .setDesc("开启 AI 识卡和压缩功能")
        .addToggle((t) =>
          t.setValue(settings.enabled).onChange(async (v) => {
            settings.enabled = v;
          })
        );

      new Setting(contentEl)
        .setName("API 地址")
        .setDesc("OpenAI 兼容接口的基础 URL")
        .addText((t) =>
          t
            .setValue(settings.baseUrl)
            .setPlaceholder("https://api.openai.com/v1")
            .onChange((v) => {
              settings.baseUrl = v;
            })
        );

      new Setting(contentEl)
        .setName("API Key")
        .setDesc("你的 API 密钥")
        .addText((t) =>
          t
            .setValue(settings.apiKey)
            .setPlaceholder("sk-...")
            .onChange((v) => {
              settings.apiKey = v;
            })
        );

      new Setting(contentEl)
        .setName("模型")
        .setDesc("模型名称（如 gpt-4o-mini, deepseek-chat）")
        .addText((t) =>
          t
            .setValue(settings.model)
            .setPlaceholder("gpt-4o-mini")
            .onChange((v) => {
              settings.model = v;
            })
        );

      new Setting(contentEl)
        .setName("最大 Token")
        .setDesc("单次响应的最大长度")
        .addSlider((sl) =>
          sl
            .setLimits(512, 8192, 512)
            .setValue(settings.maxTokens)
            .setDynamicTooltip()
            .onChange((v) => {
              settings.maxTokens = v;
            })
        );

      new Setting(contentEl)
        .setName("温度")
        .setDesc("创造力参数（0=精确，2=随机）")
        .addSlider((sl) =>
          sl
            .setLimits(0, 200, 10)
            .setValue(Math.round(settings.temperature * 100))
            .setDynamicTooltip()
            .onChange((v) => {
              settings.temperature = v / 100;
            })
        );

      // 操作按钮
      const btnDiv = contentEl.createDiv();
      btnDiv.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:16px;";

      const testBtn = btnDiv.createEl("button");
      testBtn.textContent = "🔍 测试连接";
      testBtn.style.cssText =
        "padding:6px 16px;border:1px solid var(--remi-border);border-radius:6px;" +
        "cursor:pointer;background:var(--remi-bg);font-size:0.85em;";

      testBtn.addEventListener("click", async () => {
        testBtn.textContent = "⏳ 测试中...";
        testBtn.disabled = true;
        try {
          const testService = new (await import("../ai/service")).AIService(settings);
          const result = await testService.healthCheck();
          new Notice(result.message);
        } catch (err: any) {
          new Notice(`❌ ${err.message}`);
        }
        testBtn.textContent = "🔍 测试连接";
        testBtn.disabled = false;
      });

      const saveBtn = btnDiv.createEl("button");
      saveBtn.textContent = "💾 保存设置";
      saveBtn.style.cssText =
        "padding:6px 16px;border:none;border-radius:6px;" +
        "cursor:pointer;background:var(--remi-accent);color:#fff;font-size:0.85em;font-weight:500;";

      saveBtn.addEventListener("click", async () => {
        this.settings = { ...settings };
        this.aiService.rebuild(this.settings);
        this.onSettingsChange(this.settings);
        new Notice("✅ AI 设置已保存");
        modal.close();
        this.onOpen();
      });
    };

    modal.open();
  }
}
