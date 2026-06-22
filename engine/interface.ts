// RemiFocus — 引擎接口
// 定义学习引擎的全部公开操作

import { DeckData, WordEntry, ReviewResult, LearningMode, DeckInfo, FolderStats, MasteryResult } from "../models/card";

export interface DeckStats {
  total: number;
  new: number;
  exposure: number;
  test: number;
  review: number;
  dueToday: number;
}

export interface IEngine {
  /** 获取当前学习模式下的待学单词队列 */
  getQueue(mode: LearningMode, count?: number): Promise<[string, WordEntry][]>;

  /** 处理一次学习结果 */
  processResult(
    word: string,
    mode: LearningMode,
    result: ReviewResult
  ): Promise<WordEntry>;

  /** 获取整个 Deck 的统计（旧接口，保持向后兼容） */
  getStats(): Promise<DeckStats>;

  // ─── 新增：多卡组支持 ───

  /** 获取所有卡组的名称列表 */
  getDeckNames(): Promise<string[]>;

  /** 获取指定卡组的详细统计 */
  getDeckInfo(deckName: string): Promise<DeckInfo>;

  /** 获取所有卡组的统计 */
  getAllDeckInfos(): Promise<DeckInfo[]>;

  /** 计算指定卡组的熟练度 */
  computeMastery(deckName: string): Promise<MasteryResult>;

  /** 获取文件夹级统计（按路径前缀分组） */
  getFolderStats(): Promise<FolderStats[]>;
}
