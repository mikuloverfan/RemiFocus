// RemiFocus — UI 状态机核心
// Route + Context + ViewMode 三层状态模型
// 全局唯一路由控制，防止页面爆炸

// ─── 全局路由（只有 6 个页面态） ───

export type GlobalRoute =
  | "DECK_VIEW"    // 当前笔记卡组（唯一学习入口）
  | "HOME"         // 主页 Dashboard（状态看板）
  | "SESSION"      // 测试/学习界面（唯一执行层）
  | "PLAN"         // 计划提醒（调度解释器）
  | "ALGO"         // 算法说明（认知层）
  | "SETTINGS";    // 设置/DSL（认知层）

// ─── 上下文（决定"在处理谁的数据"） ───

export interface UIContext {
  currentNote?: string;
  currentDeck?: string;
  currentMode: "manual" | "classic" | "ku";
  currentKU?: string;
}

// ─── 子模式（决定"同一个页面怎么显示"） ───

export interface UIViewMode {
  deckViewMode: "cards" | "ku" | "list";
  statsMode: "heatmap" | "line_day" | "line_week" | "line_month";
  sessionMode: "test" | "review" | "learn";
}

// ─── 流转约束 ───

export type RouteTransition =
  | { from: "DECK_VIEW"; to: "SESSION" | "HOME" | "PLAN" }
  | { from: "HOME"; to: "DECK_VIEW" | "PLAN" | "ALGO" }
  | { from: "SESSION"; to: "DECK_VIEW" }
  | { from: "PLAN"; to: "DECK_VIEW" }
  | { from: "ALGO"; to: "DECK_VIEW" }
  | { from: "SETTINGS"; to: "DECK_VIEW" }
  | { from: "SESSION"; to: "DECK_VIEW"; sub: "RESULT" }
  | { from: "RESULT"; to: "DECK_VIEW" | "SESSION" };

// ─── 回调接口 ───

export interface UIRouterCallbacks {
  onNavigate: (route: GlobalRoute, context?: Partial<UIContext>) => void;
  onViewModeChange: (viewMode: Partial<UIViewMode>) => void;
}

// ─── 默认值 ───

const DEFAULT_CONTEXT: UIContext = {
  currentMode: "classic",
};

const DEFAULT_VIEW_MODE: UIViewMode = {
  deckViewMode: "cards",
  statsMode: "heatmap",
  sessionMode: "review",
};

// ─── 路由错误 ───

export class IllegalTransitionError extends Error {
  constructor(from: GlobalRoute, to: string) {
    super(`Illegal UI transition: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

// ─── UI 路由器 ───

export class UIRouter {
  private _currentRoute: GlobalRoute = "DECK_VIEW";
  private _context: UIContext = { ...DEFAULT_CONTEXT };
  private _viewMode: UIViewMode = { ...DEFAULT_VIEW_MODE };
  private _callbacks: UIRouterCallbacks;
  private _sessionResume: { deckName: string; mode: string } | null = null;

  constructor(callbacks: UIRouterCallbacks) {
    this._callbacks = callbacks;
  }

  // ─── 属性访问 ───

  get currentRoute(): GlobalRoute {
    return this._currentRoute;
  }

  get context(): UIContext {
    return { ...this._context };
  }

  get viewMode(): UIViewMode {
    return { ...this._viewMode };
  }

  get hasSessionResume(): boolean {
    return this._sessionResume !== null;
  }

  get sessionResumeInfo(): { deckName: string; mode: string } | null {
    return this._sessionResume;
  }

  // ─── 导航 ───

  /**
   * 导航到指定路由
   * 自动校验流转约束
   */
  navigate(route: GlobalRoute, context?: Partial<UIContext>): void {
    const from = this._currentRoute;

    // 校验流转合法性
    if (!this.isTransitionAllowed(from, route)) {
      console.warn(`[UIRouter] Blocked: ${from} → ${route}`);
      return;
    }

    this._currentRoute = route;
    if (context) {
      this._context = { ...this._context, ...context };
    }

    console.log(`[UIRouter] ${from} → ${route}`, this._context);
    this._callbacks.onNavigate(route, context);
  }

  /**
   * 回到 DECK_VIEW（所有页面的统一回路）
   */
  backToDeck(context?: Partial<UIContext>): void {
    this.navigate("DECK_VIEW", context);
  }

  /**
   * 开始学习（仅 DECK → SESSION 可触发）
   */
  startSession(deckName: string, mode?: string): void {
    if (this._currentRoute !== "DECK_VIEW") {
      console.warn("[UIRouter] Session can only start from DECK_VIEW");
      return;
    }
    this._context.currentDeck = deckName;
    if (mode) {
      this._viewMode.sessionMode = mode as any;
    }
    this.navigate("SESSION");
  }

  /**
   * 保存 session 状态（用于 resume）
   */
  saveSessionResume(deckName: string, mode: string): void {
    this._sessionResume = { deckName, mode };
  }

  /**
   * 清除 session resume
   */
  clearSessionResume(): void {
    this._sessionResume = null;
  }

  // ─── 视图模式切换 ───

  setViewMode(update: Partial<UIViewMode>): void {
    this._viewMode = { ...this._viewMode, ...update };
    this._callbacks.onViewModeChange(this._viewMode);
  }

  // ─── 上下文更新 ───

  updateContext(update: Partial<UIContext>): void {
    this._context = { ...this._context, ...update };
  }

  // ─── 流转校验 ───

  private isTransitionAllowed(from: GlobalRoute, to: GlobalRoute): boolean {
    // 允许回到 DECK_VIEW（所有页面的回路）
    if (to === "DECK_VIEW") return true;

    // 使用字符串比较避免 TS 类型收窄问题
    const fromStr: string = from;
    const toStr: string = to;

    switch (fromStr) {
      case "DECK_VIEW":
        return toStr === "SESSION" || toStr === "HOME" || toStr === "PLAN";
      case "HOME":
        return toStr === "DECK_VIEW" || toStr === "PLAN" || toStr === "ALGO";
      case "SESSION":
        return toStr === "DECK_VIEW"; // RESULT 通过 sub 状态处理
      case "PLAN":
        return toStr === "DECK_VIEW";
      case "ALGO":
        return toStr === "DECK_VIEW";
      case "SETTINGS":
        return toStr === "DECK_VIEW";
      default:
        return false;
    }
  }

  /**
   * 获取当前路由的层级
   */
  getRouteLayer(route?: GlobalRoute): "execution" | "control" | "cognition" {
    const r = route ?? this._currentRoute;
    switch (r) {
      case "DECK_VIEW":
      case "SESSION":
        return "execution";
      case "HOME":
      case "PLAN":
        return "control";
      case "ALGO":
      case "SETTINGS":
        return "cognition";
    }
  }

  /**
   * 重置到初始状态
   */
  reset(): void {
    this._currentRoute = "DECK_VIEW";
    this._context = { ...DEFAULT_CONTEXT };
    this._viewMode = { ...DEFAULT_VIEW_MODE };
    this._sessionResume = null;
  }
}
