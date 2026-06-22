// RemiFocus — 知识单元（Knowledge Unit）核心类型
// 系统的最小知识原子，卡片只是它的投影

export type KUId = string; // 格式: "ku_{8位hex}"

export type KUStructure =
  | "big-cloze"      // 西综大卡片 【看到啥】→【想到啥】
  | "small-vocab"    // 英语小卡片 word: def
  | "table"          // 表格行
  | "paragraph";     // 自由段落（未匹配的普通文本）

export type LockMode = "strict" | "semi" | "flex";

export interface SourceRef {
  notePath: string;
  blockId: string;       // 如 "b12"
  lineStart: number;
  lineEnd: number;
  rawText: string;       // 该源的原始文本
}

export interface StabilityConfig {
  lockMode: LockMode;
  protectedFields: Array<
    | "canonical.id"
    | "sources"
    | "relations"
    | "stability"
    | "createdAt"
    | "identity"          // v1.1: 保护 identity 不被 AI 修改
    | "learningStats"     // v1.1: 保护学习统计
  >;
  rewritePolicy: {
    allowAIRewrite: boolean;
    onlyCompressionView: boolean;
    requireUserApproval: boolean;
  };
  lockedAt?: string;
}

export interface MergeHistoryEntry {
  fromKuId: KUId;
  method: "exact" | "signature" | "vector" | "llm" | "manual";
  timestamp: string;
}

export interface KURelation {
  targetKuId: KUId;
  relation: "prerequisite" | "part-of" | "contrast" | "similar";
}

// ─── v1.1 新增：KU 稳定身份系统 ───

export interface KUStableIdentity {
  /** 稳定锚点 — 最重要的去重依据，如 "carotid_body" */
  canonicalKey: string;
  /** 知识领域：'physiology' | 'pathology' | 'vocab' | 'pharmacology' | 'general' */
  domain: string;
  /** 固定关键词集合（排序后的最小不可变关键词集） */
  anchorTerms: string[];
  /** 规范名称的语言 */
  lang: "en" | "zh" | "mixed";
}

// ─── v1.1 新增：KU 学习统计（反馈回路） ───

export interface KULearningStats {
  /** 关联卡片的平均 ease */
  avgEase: number;
  /** 关联卡片的错误率 0-1 */
  errorRate: number;
  /** 上次复习时间 */
  lastReviewed: string | null;
  /** 高频混淆标签（用户常做错的方面） */
  confusionTags: string[];
  /** 总复习次数 */
  totalReviews: number;
  /** 总错误次数 */
  totalErrors: number;
}

// ─── 知识单元（主实体） ───

export interface KnowledgeUnit {
  id: KUId;

  /** 规范表达 — 最优表述 */
  canonical: {
    text: string;
    confidence: number;   // 0-1
  };

  /** 多源引用 */
  sources: SourceRef[];

  /** 原始变体（各来源的原始表述） */
  rawVariants: Array<{
    text: string;
    sourceNote: string;
    blockId: string;
  }>;

  /** 结构类型 */
  structure: KUStructure;

  /** 投影版本索引（实际内容存 IndexedDB） */
  projections: {
    literal?: { version: number; generatedAt: string };
    compression?: { version: number; generatedAt: string };
  };

  /** 关联关系 */
  relations: KURelation[];

  /** 稳定性配置 */
  stability: StabilityConfig;

  /** 去重元数据 */
  dedup: {
    signature: string;
    mergeHistory: MergeHistoryEntry[];
  };

  // ─── v1.1 新增 ───

  /** 稳定身份系统 */
  identity: KUStableIdentity;

  /** 学习统计（反馈回路） */
  learningStats: KULearningStats;

  tags: string[];
  importance: number;    // 0-1
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_STABILITY: StabilityConfig = {
  lockMode: "flex",
  protectedFields: ["canonical.id", "sources", "stability", "createdAt", "identity", "learningStats"],
  rewritePolicy: {
    allowAIRewrite: false,
    onlyCompressionView: true,
    requireUserApproval: true,
  },
};

// ─── v1.1 新增：默认值 ───

export const DEFAULT_IDENTITY: KUStableIdentity = {
  canonicalKey: "",
  domain: "general",
  anchorTerms: [],
  lang: "mixed",
};

export const DEFAULT_LEARNING_STATS: KULearningStats = {
  avgEase: 250,
  errorRate: 0,
  lastReviewed: null,
  confusionTags: [],
  totalReviews: 0,
  totalErrors: 0,
};
