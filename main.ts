// RemiFocus — Obsidian 插件入口
// 集成 UI 组件到 Obsidian 的 Modal/View 系统

import {
  Plugin,
  Modal,
  ItemView,
  WorkspaceLeaf,
  App,
  PluginSettingTab,
  Setting,
  Notice,
  TFile,
} from "obsidian";

import { SessionManager, IEngine } from "./engine";
import { SM2Scheduler } from "./scheduler/sm2";
import { ExamScheduler } from "./scheduler/exam";
import { FixedIntervalScheduler } from "./scheduler/fixed-interval";
import { FSRSScheduler } from "./scheduler/fsrs";
import { ObsidianDeckStorage } from "./storage/obsidian-storage";
import { LearningMode } from "./models/card";
import { IScheduler } from "./scheduler/interface";

import { MainPopup, PopupCallbacks } from "./ui/popup";
import { DeckModal, DeckModalCallbacks } from "./ui/deckModal";
import { RemiDashboard, HomeCallbacks } from "./ui/home";
import { SessionView, SessionCallbacks } from "./ui/sessionView";
import { SessionConfigView, SessionConfigCallbacks } from "./ui/sessionConfig";
import { QuickView, QuickViewCallbacks } from "./ui/quickView";

import { CardExtractor } from "./resolver/cardExtractor";
import { FloatingToolbar, MakerCardData } from "./ui/cardMaker";
import { ModeSelectorModal, CardMode } from "./ui/mode-selector";

// ─── AI 模块 ───
import { AIService } from "./ai/service";
import { AISettings, DEFAULT_AI_SETTINGS } from "./ai/types";
import { AIChatModal } from "./ui/aiChat";
import { DSLEditorModal } from "./ui/dsl-editor";
import { DSLRegistry } from "./core/dsl/registry";

// ─── 常量 ───

const REMI_QUICK_VIEW_TYPE = "remifocus-quick-view";
const CARD_MAKER_VIEW_TYPE = "remifocus-card-maker";
const DECK_JSON_PATH = ".obsidian/plugins/remifocus/system/deck.json";

// ─── 设置 ───

interface RemiFocusSettings {
  /** 调度算法: sm-2 | fsrs | exam | fixed-interval */
  scheduler: string;
  /** 每次学习加载的最大单词数 */
  queueSize: number;
  /** 默认学习模式 */
  defaultMode: LearningMode;
  /** 提醒阈值：overdue 超过此数量时强提示 */
  reminderThreshold: number;
  /** 自动扫描笔记中的卡片（保存时触发） */
  autoScan: boolean;
  /** 每日学习目标（卡片数） */
  dailyGoal: number;
  /** 卡组解析来源开关 */
  sourcePriority: {
    inline: boolean;
    frontmatter: boolean;
    filename: boolean;
    tag: boolean;
  };
  /** AI 设置 */
  aiSettings: AISettings;

  // ─── v1.1 新增 ───

  /** 默认制卡模式: manual | classic | ku */
  defaultCardMode: CardMode;
  /** DSL 规则文件路径（相对于 vault） */
  dslRulePath: string;
  /** 默认投影模式 */
  defaultProjection: "literal" | "compression";
}

const DEFAULT_SETTINGS: RemiFocusSettings = {
  scheduler: "sm-2",
  queueSize: 20,
  defaultMode: "review",
  reminderThreshold: 10,
  autoScan: true,
  dailyGoal: 20,
  sourcePriority: {
    inline: true,
    frontmatter: true,
    filename: true,
    tag: true,
  },
  aiSettings: DEFAULT_AI_SETTINGS,
  defaultCardMode: "classic",
  dslRulePath: ".obsidian/plugins/remifocus/system/dsl-rules.yaml",
  defaultProjection: "literal",
};

// ─── 设置页 ───

class RemiFocusSettingTab extends PluginSettingTab {
  private plugin: RemiFocusPlugin;

  constructor(app: App, plugin: RemiFocusPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── 标题 ──
    containerEl.createEl("h2", { text: "🧠 RemiFocus 设置" });

    // ── 通用 ──
    containerEl.createEl("h3", { text: "⚙️ 通用设置" });

    new Setting(containerEl)
      .setName("调度算法")
      .setDesc("选择间隔重复算法 — FSRS-5 比 SM-2 更精准")
      .addDropdown((dd) =>
        dd
          .addOption("sm-2", "SM-2（基础）")
          .addOption("fsrs", "FSRS-5（高级）")
          .addOption("exam", "考试模式（强化）")
          .addOption("fixed-interval", "固定间隔")
          .setValue(this.plugin.settings.scheduler)
          .onChange(async (v) => {
            this.plugin.settings.scheduler = v;
            await this.plugin.saveSettings();
            this.plugin.rebuildEngine();
          })
      );

    new Setting(containerEl)
      .setName("默认学习模式")
      .setDesc("打开学习 session 时的默认模式")
      .addDropdown((dd) =>
        dd
          .addOption("exposure", "👁 Exposure（初学）")
          .addOption("test", "🧪 Test（测试）")
          .addOption("review", "🔄 Review（复习）")
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (v) => {
            this.plugin.settings.defaultMode = v as LearningMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("队列大小")
      .setDesc("每次学习加载的最大单词数（5–50）")
      .addSlider((sl) =>
        sl
          .setLimits(5, 50, 5)
          .setValue(this.plugin.settings.queueSize)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.queueSize = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("每日学习目标")
      .setDesc("每天计划学习的卡片数")
      .addSlider((sl) =>
        sl
          .setLimits(5, 100, 5)
          .setValue(this.plugin.settings.dailyGoal)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.dailyGoal = v;
            await this.plugin.saveSettings();
          })
      );

    // ── 提醒 ──
    containerEl.createEl("h3", { text: "🔔 提醒设置" });

    new Setting(containerEl)
      .setName("自动复习提醒")
      .setDesc("打开 Obsidian 时自动检查并提醒待复习单词")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.autoScan)
          .onChange(async (v) => {
            this.plugin.settings.autoScan = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("提醒阈值")
      .setDesc("待复习单词数超过此值时显示强提醒")
      .addSlider((sl) =>
        sl
          .setLimits(3, 50, 1)
          .setValue(this.plugin.settings.reminderThreshold)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.reminderThreshold = v;
            await this.plugin.saveSettings();
          })
      );

    // ── 卡片提取 ──
    containerEl.createEl("h3", { text: "📄 卡片提取规则" });

    new Setting(containerEl)
      .setName("自动提取卡片")
      .setDesc("保存笔记时自动扫描并提取单词卡片到 deck.json")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.autoScan)
          .onChange(async (v) => {
            this.plugin.settings.autoScan = v;
            await this.plugin.saveSettings();
            if (v) new Notice("✅ 自动提取已开启，保存笔记时将自动扫描卡片");
          })
      );

    new Setting(containerEl)
      .setName("内联标记 #deck/xxx")
      .setDesc("识别笔记中的 #deck/xxx 标记作为卡组来源（最高优先级）")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.sourcePriority.inline).onChange(async (v) => {
          this.plugin.settings.sourcePriority.inline = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Frontmatter decks")
      .setDesc("从 YAML 头部的 decks 字段读取卡组")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.sourcePriority.frontmatter).onChange(async (v) => {
          this.plugin.settings.sourcePriority.frontmatter = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("文件名映射")
      .setDesc("根据笔记所在文件夹名推断卡组")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.sourcePriority.filename).onChange(async (v) => {
          this.plugin.settings.sourcePriority.filename = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Tag 映射")
      .setDesc("从笔记标签推断卡组（如 #e → e 卡组，最低优先级）")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.sourcePriority.tag).onChange(async (v) => {
          this.plugin.settings.sourcePriority.tag = v;
          await this.plugin.saveSettings();
        })
      );

    // ── 数据 ──
    containerEl.createEl("h3", { text: "💾 数据管理" });

    new Setting(containerEl)
      .setName("手动扫描当前笔记")
      .setDesc("立即扫描当前打开的笔记，提取卡片到 deck.json")
      .addButton((btn) =>
        btn
          .setButtonText("🔍 扫描")
          .onClick(async () => {
            await this.plugin.scanActiveNote();
          })
      );

    new Setting(containerEl)
      .setName("重新统计所有卡组")
      .setDesc("重新计算所有卡组的统计数据和熟练度")
      .addButton((btn) =>
        btn
          .setButtonText("📊 刷新统计")
          .onClick(async () => {
            await this.plugin.refreshStats();
          })
      );

    // ── AI 设置 ──
    containerEl.createEl("h3", { text: "🤖 AI 设置" });

    new Setting(containerEl)
      .setName("启用 AI 识卡")
      .setDesc("开启 AI 功能后可在右侧栏使用 🤖 AI识卡 聊天")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.aiSettings.enabled).onChange(async (v) => {
          this.plugin.settings.aiSettings.enabled = v;
          await this.plugin.saveSettings();
          this.plugin.aiService?.rebuild(this.plugin.settings.aiSettings);
        })
      );

    new Setting(containerEl)
      .setName("API 地址")
      .setDesc("OpenAI 兼容接口（支持 DeepSeek / 通义千问 / Claude 等）")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.aiSettings.baseUrl)
          .setPlaceholder("https://api.openai.com/v1")
          .onChange(async (v) => {
            this.plugin.settings.aiSettings.baseUrl = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("你的 API 密钥")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.aiSettings.apiKey)
          .setPlaceholder("sk-...")
          .onChange(async (v) => {
            this.plugin.settings.aiSettings.apiKey = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("模型")
      .setDesc("模型名称（如 gpt-4o-mini, deepseek-chat, qwen-turbo）")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.aiSettings.model)
          .setPlaceholder("gpt-4o-mini")
          .onChange(async (v) => {
            this.plugin.settings.aiSettings.model = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("最大 Token")
      .setDesc("单次响应最大长度")
      .addSlider((sl) =>
        sl
          .setLimits(512, 8192, 512)
          .setValue(this.plugin.settings.aiSettings.maxTokens)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.aiSettings.maxTokens = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("温度")
      .setDesc("创造力参数")
      .addSlider((sl) =>
        sl
          .setLimits(0, 200, 10)
          .setValue(Math.round(this.plugin.settings.aiSettings.temperature * 100))
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.aiSettings.temperature = v / 100;
            await this.plugin.saveSettings();
          })
      );

    // ── DSL 规则管理 ──
    containerEl.createEl("h3", { text: "📜 DSL 规则管理" });

    new Setting(containerEl)
      .setName("管理 DSL 规则")
      .setDesc("查看内置规则、启用/禁用、自定义规则管理")
      .addButton((btn) =>
        btn
          .setButtonText("📜 打开规则管理器")
          .onClick(() => {
            const registry = new DSLRegistry({ enableBuiltin: true });
            registry.initialize().then(() => {
              new DSLEditorModal(this.plugin.app, registry).open();
            });
          })
      );
  }
}

// ─── 右侧边栏快速查看 View ───

class RemiQuickView extends ItemView {
  private plugin: RemiFocusPlugin;
  private widget: QuickView | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: RemiFocusPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return REMI_QUICK_VIEW_TYPE; }
  getDisplayText(): string { return "RemiFocus"; }
  getIcon(): string { return "brain"; }

  async onOpen(): Promise<void> {
    const callbacks: QuickViewCallbacks = {
      onStartQuickReview: () => {
        this.plugin.startReviewSession();
      },
      onOpenDashboard: () => {
        new DashboardModal(this.app, this.plugin.getEngine()).open();
      },
      onOpenModeSelector: () => {
        this.plugin.showModeSelector();
      },
      onOpenCardMaker: () => {
        if (this.plugin.cardMaker) this.plugin.cardMaker.toggle();
      },
      onOpenAIChat: () => {
        this.plugin.openAIChat();
      },
    };
    this.widget = new QuickView(this.contentEl, this.plugin.getEngine(), callbacks);
    await this.widget.render();
  }

  async onClose(): Promise<void> {
    if (this.widget) { this.widget.destroy(); this.widget = null; }
  }
}

// ─── 主弹窗 Modal（Ribbon 点击打开） ───

class MainPopupModal extends Modal {
  private engine: IEngine;
  private popup: MainPopup | null = null;

  constructor(app: App, engine: IEngine) {
    super(app);
    this.engine = engine;
    // 隐藏 Obsidian 默认标题栏（内容里已有标题）
    this.titleEl.style.display = "none";
    // 宽屏设计
    this.modalEl.style.width = "90vw";
    this.modalEl.style.maxWidth = "720px";
    this.modalEl.style.borderRadius = "12px";
  }

  onOpen(): void {
    const callbacks: PopupCallbacks = {
      onDeckClick: (name) => {
        this.close();
        new DeckDetailModal(this.app, this.engine, name).open();
      },
      onHomeClick: () => {
        this.close();
        new DashboardModal(this.app, this.engine).open();
      },
      onStartLearning: (name, mode) => {
        this.close();
        new SessionConfigModal(this.app, this.engine, name, mode).open();
      },
    };

    this.popup = new MainPopup(this.contentEl, this.engine, callbacks);
    this.popup.render();
  }

  onClose(): void {
    if (this.popup) { this.popup.destroy(); this.popup = null; }
  }
}

// ─── Dashboard 主页 Modal ───

class DashboardModal extends Modal {
  private engine: IEngine;
  private dashboard: RemiDashboard | null = null;

  constructor(app: App, engine: IEngine) {
    super(app);
    this.engine = engine;
    this.titleEl.style.display = "none";
    this.modalEl.style.width = "95vw";
    this.modalEl.style.maxWidth = "1000px";
    this.modalEl.style.height = "90vh";
    this.modalEl.style.borderRadius = "12px";
  }

  onOpen(): void {
    const callbacks: HomeCallbacks = {
      onOpenDeck: () => {
        this.close();
        new MainPopupModal(this.app, this.engine).open();
      },
      onOpenPlan: () => {
        new Notice("📅 计划页面即将上线");
      },
      onOpenAlgo: () => {
        new Notice("📐 算法说明即将上线");
      },
      onDeckClick: (name) => {
        this.close();
        new DeckDetailModal(this.app, this.engine, name).open();
      },
    };
    this.dashboard = new RemiDashboard(this.contentEl, this.engine, callbacks);
    this.dashboard.render();
  }

  onClose(): void {
    if (this.dashboard) { this.dashboard.destroy(); this.dashboard = null; }
  }
}

// ─── 卡组详情弹窗 Modal ───

class DeckDetailModal extends Modal {
  private engine: IEngine;
  private deckName: string;
  private deckModal: DeckModal | null = null;

  constructor(app: App, engine: IEngine, deckName: string) {
    super(app);
    this.engine = engine;
    this.deckName = deckName;
    this.titleEl.setText(`📇 ${deckName}`);
  }

  onOpen(): void {
    const callbacks: DeckModalCallbacks = {
      onBack: () => {
        this.close();
        new MainPopupModal(this.app, this.engine).open();
      },
      onStartLearning: (name, mode) => {
        this.close();
        new SessionConfigModal(this.app, this.engine, name, mode).open();
      },
    };
    this.deckModal = new DeckModal(this.contentEl, this.engine, this.deckName, callbacks);
    this.deckModal.render();
  }

  onClose(): void {
    if (this.deckModal) { this.deckModal.destroy(); this.deckModal = null; }
  }
}

// ─── 学习 Session 配置 Modal（二级弹窗） ───

class SessionConfigModal extends Modal {
  private engine: IEngine;
  private deckName: string;
  private mode: LearningMode;
  private configView: SessionConfigView | null = null;

  constructor(app: App, engine: IEngine, deckName: string, mode: LearningMode) {
    super(app);
    this.engine = engine;
    this.deckName = deckName;
    this.mode = mode;

    const modeLabels: Record<LearningMode, string> = {
      exposure: "👁 Exposure",
      test: "🧪 Test",
      review: "🔄 Review",
    };
    this.titleEl.style.display = "none";
    // 更大的弹窗
    this.modalEl.style.width = "480px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.borderRadius = "14px";
    this.modalEl.style.padding = "4px";
  }

  onOpen(): void {
    const callbacks: SessionConfigCallbacks = {
      onStart: (count) => {
        this.close();
        new SessionModal(this.app, this.engine, this.deckName, this.mode, count).open();
      },
      onCancel: () => {
        this.close();
        // 返回卡组详情
        new DeckDetailModal(this.app, this.engine, this.deckName).open();
      },
    };

    this.configView = new SessionConfigView(
      this.contentEl,
      this.engine,
      this.deckName,
      this.mode,
      callbacks
    );
    this.configView.render();
  }

  onClose(): void {
    if (this.configView) { this.configView.destroy(); this.configView = null; }
  }
}

// ─── 学习 Session Modal（支持自定义数量） ───

class SessionModal extends Modal {
  private engine: IEngine;
  private deckName: string;
  private mode: LearningMode;
  private sessionCount: number;
  private session: SessionView | null = null;

  constructor(app: App, engine: IEngine, deckName: string, mode: LearningMode, sessionCount?: number) {
    super(app);
    this.engine = engine;
    this.deckName = deckName;
    this.mode = mode;
    this.sessionCount = sessionCount ?? 20;

    const modeLabels: Record<LearningMode, string> = {
      exposure: "👁 Exposure",
      test: "🧪 Test",
      review: "🔄 Review",
    };
    this.titleEl.style.display = "none";
    // 更大的弹窗 — 充分利用屏幕空间
    this.modalEl.style.width = "85vw";
    this.modalEl.style.maxWidth = "650px";
    this.modalEl.style.height = "80vh";
    this.modalEl.style.maxHeight = "700px";
    this.modalEl.style.borderRadius = "14px";
    this.modalEl.style.padding = "4px";
  }

  onOpen(): void {
    const callbacks: SessionCallbacks = {
      onComplete: () => {
        new Notice(`✅ ${this.deckName} 学习完成！`);
        this.close();
      },
      onExit: () => {
        this.close();
      },
    };

    this.session = new SessionView(
      this.contentEl,
      this.engine,
      this.deckName,
      this.mode,
      callbacks,
      this.sessionCount
    );
    this.session.render();
  }

  onClose(): void {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
  }
}

// ─── 浮动制卡工具栏实例化 ───
// 在插件类中管理，这里不需要额外的 View/Modal 类

// ─── 主插件类 ───

export default class RemiFocusPlugin extends Plugin {
  settings: RemiFocusSettings = DEFAULT_SETTINGS;
  private engine: IEngine | null = null;
  private extractor: CardExtractor | null = null;
  private scanDebounce: ReturnType<typeof setTimeout> | null = null;
  cardMaker: FloatingToolbar | null = null;
  aiService: AIService | null = null;

  // ─── 生命周期 ───

  async onload(): Promise<void> {
    console.log("RemiFocus: loading plugin");

    // 加载设置
    await this.loadSettings();

    // 构建引擎
    this.rebuildEngine();

    // 实例化卡片提取器
    this.extractor = new CardExtractor();

    // 注册右侧边栏 QuickView
    this.registerView(REMI_QUICK_VIEW_TYPE, (leaf) => new RemiQuickView(leaf, this));
    this.app.workspace.onLayoutReady(() => {
      if (this.app.workspace.getLeavesOfType(REMI_QUICK_VIEW_TYPE).length === 0) {
        this.app.workspace.getRightLeaf(false)?.setViewState({ type: REMI_QUICK_VIEW_TYPE, active: true });
      }
    });

    // 初始化浮动制卡工具栏
    this.cardMaker = new FloatingToolbar({
      getActiveFilePath: () => this.app.workspace.getActiveFile()?.path ?? null,
      getExistingDecks: async () => {
        try { return await this.getEngine().getDeckNames(); }
        catch { return []; }
      },
      onSave: async (cards, deckName, filePath) => {
        const storage = new ObsidianDeckStorage(this.app.vault.adapter, DECK_JSON_PATH);
        const data = await storage.load();
        const base = filePath.replace(/\.md$/i, "");
        let added = 0;
        for (const card of cards) {
          const word = card.word.toLowerCase().trim();
          if (!word) continue;
          const fullDeck = `${base}/${deckName}`;
          if (data.words[word]) {
            if (!data.words[word].deck.includes(fullDeck)) data.words[word].deck.push(fullDeck);
          } else {
            const e: any = { meaning: card.meaning, deck: [fullDeck], state: "new", ease: 250, interval: 0, next: null, history: [], priority: 1, source: "manual" };
            if (card.cloze?.length) e.cloze = card.cloze;
            data.words[word] = e;
            added++;
          }
        }
        await storage.save(data);
        new Notice(`✅ 制卡器: 保存 ${added} 张新卡片`);
      },
    });

    // 初始化 AI 服务
    this.aiService = new AIService(this.settings.aiSettings, this.engine ?? undefined);

    // 注册设置页
    this.addSettingTab(new RemiFocusSettingTab(this.app, this));

    // 注册命令
    this.registerCommands();

    // Ribbon 图标 → 打开三模式选择弹窗
    this.addRibbonIcon("brain", "RemiFocus - 选择制卡模式", () => {
      if (!this.engine) {
        new Notice("⚠️ RemiFocus 引擎未初始化");
        return;
      }
      this.showModeSelector();
    });

    // 自动扫描：监听笔记保存
    this.registerNoteScan();

    // 启动时检查提醒
    if (this.settings.autoScan) {
      this.checkRemindersOnStartup();
    }

    // 启动后扫描当前打开的笔记（延迟确保就绪）
    setTimeout(() => {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.extension === "md" && this.settings.autoScan) {
        console.log("RemiFocus: scanning active file on startup:", activeFile.path);
        this.scanFile(activeFile);
      }
    }, 2000);

    console.log("RemiFocus: plugin loaded");
  }

  onunload(): void {
    console.log("RemiFocus: unloading plugin");
    if (this.cardMaker) { this.cardMaker.destroy(); this.cardMaker = null; }
    this.app.workspace.detachLeavesOfType(REMI_QUICK_VIEW_TYPE);
    this.engine = null;
    this.extractor = null;
  }

  // ─── 命令注册 ───

  private registerCommands(): void {
    // 打开弹窗
    this.addCommand({
      id: "open-remifocus-popup",
      name: "打开 RemiFocus 弹窗",
      icon: "brain",
      callback: () => {
        if (!this.engine) {
          new Notice("⚠️ RemiFocus 引擎未初始化");
          return;
        }
        new MainPopupModal(this.app, this.engine).open();
      },
    });

    // 打开 Dashboard
    this.addCommand({
      id: "open-remifocus-dashboard",
      name: "打开 Remi OS 主页",
      icon: "layout-dashboard",
      callback: () => {
        if (!this.engine) return;
        new DashboardModal(this.app, this.engine).open();
      },
    });

    // 快速开始复习
    this.addCommand({
      id: "start-remifocus-review",
      name: "开始今日复习",
      icon: "play",
      callback: async () => {
        await this.startReviewSession();
      },
    });

    // 扫描当前笔记
    this.addCommand({
      id: "scan-current-note",
      name: "扫描当前笔记中的卡片",
      icon: "search",
      callback: async () => {
        await this.scanActiveNote();
      },
    });

    // 切换浮动制卡工具栏
    this.addCommand({
      id: "toggle-card-maker",
      name: "切换制卡工具栏",
      icon: "plus-with-circle",
      callback: () => {
        if (this.cardMaker) this.cardMaker.toggle();
      },
    });

    // 打开 AI 聊天
    this.addCommand({
      id: "open-remifocus-ai-chat",
      name: "打开 AI 识卡聊天",
      icon: "bot",
      callback: () => {
        this.openAIChat();
      },
    });
  }

  // ─── AI 聊天 ───

  openAIChat(): void {
    if (!this.aiService) {
      new Notice("⚠️ AI 服务未初始化");
      return;
    }
    new AIChatModal(
      this.app,
      this.aiService,
      this.settings.aiSettings,
      async (newSettings) => {
        this.settings.aiSettings = newSettings;
        await this.saveSettings();
        this.aiService?.rebuild(newSettings);
      }
    ).open();
  }

  // ─── 自动笔记扫描 ───

  private registerNoteScan(): void {
    // 1. 修改事件：保存时扫描
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (!this.settings.autoScan || !this.extractor) return;
        if (!(file instanceof TFile) || file.extension !== "md") return;
        if (this.scanDebounce) clearTimeout(this.scanDebounce);
        this.scanDebounce = setTimeout(() => {
          this.scanFile(file);
        }, 500);
      })
    );

    // 2. 修复：打开笔记时真正执行扫描
    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        if (!this.settings.autoScan || !this.extractor) return;
        if (!file || file.extension !== "md") return;
        // 延迟一下等 metadataCache 就绪
        setTimeout(() => this.scanFile(file), 300);
      })
    );

    // 3. Obsidian 就绪后扫描（已在 onload 中用 setTimeout 处理）

    // 4. 笔记被删除时清理对应卡组中的卡片
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        const prefix = file.path.replace(/\.md$/i, "");
        const storage = new ObsidianDeckStorage(
          this.app.vault.adapter, DECK_JSON_PATH
        );
        const deckData = await storage.load();
        let changed = false;
        for (const [word, entry] of Object.entries(deckData.words)) {
          const before = entry.deck.length;
          entry.deck = entry.deck.filter(d => !d.startsWith(prefix));
          if (entry.deck.length !== before) changed = true;
          // 如果卡片不属于任何卡组了，删除它
          if (entry.deck.length === 0) {
            delete deckData.words[word];
          }
        }
        if (changed) await storage.save(deckData);
      })
    );
  }

  /**
   * 扫描单个笔记文件，提取卡片
   */
  async scanFile(file: TFile): Promise<void> {
    const start = Date.now();
    try {
      const content = await this.app.vault.read(file);
      const filePath = file.path;
      console.log(`RemiFocus: scanFile start [${filePath}]`);

      // 快速检测：有列表项即可尝试提取（m=multiline，匹配任意行开头）
      if (!/^\s*[-*]\s+\S/m.test(content)) {
        console.log(`RemiFocus: no list items found in [${filePath}]`);
        return;
      }

      const result = this.extractor!.extract(content, filePath);
      console.log(`RemiFocus: extract result [${filePath}]: ${result.cards.length} cards, ${result.groups.length} groups`);

      if (result.cards.length === 0) {
        console.log(`RemiFocus: no cards extracted from [${filePath}], type breakdown:`, result.stats.byType);
        return;
      }

      // deck 命名规则：
      // - 大卡片(西综)：deck = 文件路径（不含 .md），标题 = 卡片名
      // - 小卡片(英语)：deck = 文件路径/标题
      const deckNameForCard = (card: { sourceFile: string; group: string; cardType: string }) => {
        const base = card.sourceFile.replace(/\.md$/i, "");
        if (card.cardType === "big-cloze") return base;          // 西综：只有文件路径
        return `${base}/${card.group}`;                           // 英语：文件路径/标题
      };

      const storage = new ObsidianDeckStorage(
        this.app.vault.adapter,
        DECK_JSON_PATH
      );
      const deckData = await storage.load();

      // 合并新卡片到 deck.json
      let newCount = 0;
      let existingCount = 0;

      for (const card of result.cards) {
        const word = card.word.toLowerCase().trim();
        if (!word) continue;
        const deckName = deckNameForCard(card);

        if (deckData.words[word]) {
          const existing = deckData.words[word];
          if (!existing.deck.includes(deckName)) {
            existing.deck.push(deckName);
          }
          existingCount++;
        } else {
          const newEntry: any = {
            meaning: card.meaning,
            deck: [deckName],
            state: "new",
            ease: 250,
            interval: 0,
            next: null,
            history: [],
          };
          if (card.cloze && card.cloze.length > 0) newEntry.cloze = card.cloze;
          if (card.mnemonic) newEntry.mnemonic = card.mnemonic;
          deckData.words[word] = newEntry;
          newCount++;
        }
      }

      if (newCount > 0 || existingCount > 0) {
        await storage.save(deckData);

        const groupSummary = Object.entries(result.stats.byGroup)
          .map(([g, c]) => `${g}:${c}`)
          .join(" ");
        new Notice(
          `📚 RemiFocus: 新增 ${newCount} 词, 更新 ${existingCount} 词\n` +
          `📂 ${groupSummary}`
        );
      }
    } catch (err) {
      console.error("RemiFocus: scan error", err);
    }
  }

  /**
   * 扫描当前活动笔记
   */
  async scanActiveNote(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("⚠️ 没有打开的笔记");
      return;
    }
    if (activeFile.extension !== "md") {
      new Notice("⚠️ 只支持 Markdown 文件");
      return;
    }
    await this.scanFile(activeFile);
  }

  // ─── 启动提醒检查 ───

  private async checkRemindersOnStartup(): Promise<void> {
    if (!this.engine) return;

    const decks = await this.engine.getAllDeckInfos();
    const totalDue = decks.reduce((sum, d) => sum + d.dueCount, 0);

    if (totalDue >= this.settings.reminderThreshold) {
      new Notice(
        `⚠️ RemiFocus: 你有 ${totalDue} 个单词待复习！\n` +
        `超过提醒阈值 ${this.settings.reminderThreshold} 词`,
        8000
      );
    } else if (totalDue > 0) {
      new Notice(`📚 RemiFocus: ${totalDue} 个单词待复习`, 4000);
    }

    // 检查每日目标
    const stats = await this.engine.getStats();
    if (stats.dueToday < this.settings.dailyGoal) {
      const remaining = this.settings.dailyGoal - stats.dueToday;
      if (remaining > 0) {
        new Notice(
          `🎯 今日目标: ${this.settings.dailyGoal} 词 | 还需学习 ${remaining} 词`,
          5000
        );
      }
    }
  }

  // ─── 刷新统计 ───

  async refreshStats(): Promise<void> {
    new Notice("📊 RemiFocus: 统计已刷新");
    if (this.engine) {
      new DashboardModal(this.app, this.engine).open();
    }
  }

  // ─── 引擎管理 ───

  getEngine(): IEngine {
    if (!this.engine) {
      throw new Error("RemiFocus engine not initialized");
    }
    return this.engine;
  }

  rebuildEngine(): void {
    const adapter = this.app.vault.adapter;
    const storage = new ObsidianDeckStorage(adapter, DECK_JSON_PATH);

    let scheduler: IScheduler;
    switch (this.settings.scheduler) {
      case "fsrs":
        scheduler = new FSRSScheduler();
        break;
      case "exam":
        scheduler = new ExamScheduler();
        break;
      case "fixed-interval":
        scheduler = new FixedIntervalScheduler();
        break;
      default:
        scheduler = new SM2Scheduler();
    }

    this.engine = new SessionManager(storage, scheduler, this.settings.queueSize);
    console.log(`RemiFocus: engine rebuilt (scheduler: ${this.settings.scheduler})`);
  }

  // ─── 三模式选择器 ───

  showModeSelector(): void {
    if (!this.engine) {
      new Notice("⚠️ RemiFocus 引擎未初始化");
      return;
    }

    new ModeSelectorModal(this.app, {
      onSelectManual: () => {
        // 手动制卡：打开浮动制卡工具栏
        if (this.cardMaker) {
          this.cardMaker.toggle();
          new Notice("🧱 手动制卡模式已开启");
        } else {
          new Notice("⚠️ 制卡工具栏未初始化");
        }
      },
      onSelectClassic: () => {
        // 传统自动识别：打开现有主弹窗
        new MainPopupModal(this.app, this.engine!).open();
      },
      onSelectKU: () => {
        // KU 智能系统：提示（Phase 6 实现完整视图）
        new Notice("🧠 KU 系统即将上线，敬请期待");
        // 暂时回退到经典模式
        new MainPopupModal(this.app, this.engine!).open();
      },
      onQuickReview: () => {
        this.startReviewSession();
      },
    }).open();
  }

  // ─── 快速复习 ───

  async startReviewSession(): Promise<void> {
    if (!this.engine) return;

    const decks = await this.engine.getAllDeckInfos();
    const dueDeck = decks.find((d) => d.dueCount > 0);

    if (!dueDeck) {
      new Notice("✅ 所有卡组已完成复习！");
      return;
    }

    new SessionModal(
      this.app,
      this.engine,
      dueDeck.name,
      this.settings.defaultMode
    ).open();
  }

  // ─── 设置持久化 ───

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
