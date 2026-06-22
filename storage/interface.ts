// RemiFocus — 存储层接口

import { DeckData, WordEntry } from "../models/card";

export interface IStorage {
  /** 加载完整 deck */
  load(): Promise<DeckData>;
  /** 保存完整 deck */
  save(data: DeckData): Promise<void>;
  /** 更新单个单词 */
  updateWord(word: string, entry: WordEntry): Promise<void>;
  /** 获取单个单词 */
  getWord(word: string): Promise<WordEntry | undefined>;
  /** 按状态筛选单词 */
  getWordsByState(state: string): Promise<[string, WordEntry][]>;
}
