// RemiFocus — 投影类型定义
// 同一个 KU 在不同模式下的表达

import { KUId } from "./knowledge-unit";
import { ClozeSegment } from "./card";

export type CardType =
  | "cloze"        // 挖空：颈动脉体是{{c1::外周化学感受器}}
  | "qa"           // 问答：Q: 功能? A: ...
  | "judgement"    // 判断：颈动脉体主要调节循环 → 错误
  | "mnemonic";    // 助记：只监不吃，调呼吸

/** 卡片面 — 一张卡的正反面 */
export interface CardFace {
  cardId: string;           // "card_{12位hex}"
  type: CardType;
  front: string;            // 正面文本（含 cloze 标记）
  back: string;             // 背面文本（完整答案）
  clozeSegments?: ClozeSegment[];
  wordKey: string;          // 关联到 deck.json 中的 key
}

/** 投影 — 同一个 KU 在某个模式下的表达集合 */
export interface Projection {
  kuId: KUId;
  mode: "literal" | "compression";
  version: number;
  cards: CardFace[];
  generatedAt: string;
  aiModel?: string;          // AI 生成的压缩投影才需要

  // ─── v1.1 新增：可回放机制 ───

  /** 确定性种子：kuId + version + optionsHash，用于可复现生成 */
  seed: string;
  /** 构建 prompt 的哈希，用于检测 prompt 是否变化（compression 模式需要） */
  promptHash?: string;
  /** 重生成策略：replace = 替换旧投影，append = 追加新卡片 */
  regenerationPolicy: "replace" | "append";
}

/** 投影生成请求 */
export interface ProjectionRequest {
  kuId: KUId;
  mode: "literal" | "compression";
  rawText: string;
  structure: string;
  tags: string[];

  // ─── v1.1 新增 ───

  /** 生成种子（用于确定性的 literal 投影） */
  seed?: string;
  /** 目标版本号 */
  targetVersion?: number;
}
