// RemiFocus — Obsidian 适配器存储实现
// 使用 app.vault.adapter 跨平台读写 deck.json
// 替代 DeckStorage（基于 fs/promises，仅限 Node.js）

import { DataAdapter } from "obsidian";
import { DeckData, WordEntry } from "../models/card";
import { IStorage } from "./interface";

/**
 * Obsidian 存储适配器
 * 使用 Obsidian 的 DataAdapter 实现跨平台文件读写
 */
export class ObsidianDeckStorage implements IStorage {
  private adapter: DataAdapter;
  private filePath: string;

  /**
   * @param adapter  Obsidian 的 DataAdapter (app.vault.adapter)
   * @param filePath deck.json 的相对路径（相对于 vault 根）
   */
  constructor(adapter: DataAdapter, filePath: string) {
    this.adapter = adapter;
    this.filePath = filePath;
  }

  async load(): Promise<DeckData> {
    try {
      const exists = await this.adapter.exists(this.filePath);
      if (!exists) {
        return { version: 1, words: {} };
      }
      const raw = await this.adapter.read(this.filePath);
      return JSON.parse(raw) as DeckData;
    } catch (err) {
      console.error("RemiFocus: Failed to load deck.json", err);
      return { version: 1, words: {} };
    }
  }

  async save(data: DeckData): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await this.adapter.write(this.filePath, json);
  }

  async updateWord(word: string, entry: WordEntry): Promise<void> {
    const data = await this.load();
    data.words[word] = entry;
    await this.save(data);
  }

  async getWord(word: string): Promise<WordEntry | undefined> {
    const data = await this.load();
    return data.words[word];
  }

  async getWordsByState(state: string): Promise<[string, WordEntry][]> {
    const data = await this.load();
    const result: [string, WordEntry][] = [];
    for (const [word, entry] of Object.entries(data.words)) {
      if (entry.state === state) {
        result.push([word, entry]);
      }
    }
    return result;
  }
}
