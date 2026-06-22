// RemiFocus — 核心类型定义
// 唯一状态源：system/deck.json

export type ReviewResult = "again" | "hard" | "good" | "easy";
export type WordState = "new" | "exposure" | "test" | "review";
export type LearningMode = "exposure" | "test" | "review";

export interface HistoryEntry {
  date: string;       // YYYY-MM-DD
  mode: LearningMode;
  result: ReviewResult;
}

// ─── 单词条目（deck.json 中的最小单位） ───

/** 完形填空（Cloze）片段 */
export interface ClozeSegment {
  /** 提示文本（显示在前） */
  hint: string;
  /** 答案文本（默认隐藏） */
  answer: string;
}

export interface WordEntry {
  meaning: string;
  deck: string[];
  state: WordState;
  ease: number;
  interval: number;
  next: string | null;
  history: HistoryEntry[];
  cloze?: ClozeSegment[];
  mnemonic?: string;
  /** 优先级：1=高(手动制卡) 0=普通(自动扫描) */
  priority?: number;
  /**
   * 来源：
   * - 'manual'         — 手动制卡
   * - 'auto'           — 传统自动识别
   * - 'ku-literal'     — KU Literal 投影
   * - 'ku-compression' — KU Compression 投影
   */
  source?: "manual" | "auto" | "ku-literal" | "ku-compression";

  // ─── KU 关联（以下 3 个字段为可选，完全向后兼容） ───

  /** 关联的知识单元 ID */
  kuId?: string;
  /** 该卡片来自哪种投影模式 */
  projectionMode?: "literal" | "compression";
  /** 投影版本号，旧版本可被清理 */
  projectionVersion?: number;
}

// ─── 完整数据源 ───

export interface DeckData {
  version: number;
  words: Record<string, WordEntry>;
}

// ─── UI 层用到的统计类型 ───

/** 单个卡组的聚合统计 */
export interface DeckInfo {
  name: string;
  totalCards: number;
  /** 今日待复习数量 */
  dueCount: number;
  /** 熟练度百分比 0–100 */
  mastery: number;
  /** 各状态计数 */
  newCount: number;
  exposureCount: number;
  testCount: number;
  reviewCount: number;
}

/** 文件夹级统计 */
export interface FolderStats {
  path: string;
  decks: DeckInfo[];
  totalCards: number;
  mastery: number;
}

/** 自定义提取规则 */
export interface ExtractRule {
  id: string;
  name: string;
  /** JavaScript 正则表达式字符串 */
  regex: string;
  /** 是否启用 */
  enabled: boolean;
  /** 捕获组映射: { word: 1, meaning: 2, pronunciation: 3 } */
  fields: { word?: number; meaning?: number; pronunciation?: number };
  /** 是否为内置规则 */
  builtin: boolean;
}

/** 熟练度计算的中间结果 */
export interface MasteryResult {
  /** 0–100 百分比 */
  mastery: number;
  /** 加权平均 ease */
  ease: number;
  /** 加权平均 interval */
  interval: number;
  /** 历史成功率 0–1 */
  successRate: number;
}
