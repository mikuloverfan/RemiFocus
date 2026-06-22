// RemiFocus — deck.json 读写实现
// 唯一状态源：system/deck.json
// 所有学习状态集中在此文件，不在 markdown 中存储状态

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname, resolve } from "path";

import { DeckData, WordEntry } from "../models/card";
import { IStorage } from "./interface";

export class DeckStorage implements IStorage {
  private filePath: string;

  /**
   * @param filePath  deck.json 的路径，相对或绝对
   */
  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  // ─── 加载 ───

  async load(): Promise<DeckData> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as DeckData;
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && (err as any).code === "ENOENT") {
        // 文件不存在 → 返回默认空结构
        return { version: 1, words: {} };
      }
      throw new Error(
        `Failed to load deck data from ${this.filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ─── 保存完整数据 ───

  async save(data: DeckData): Promise<void> {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const json = JSON.stringify(data, null, 2);
    await writeFile(this.filePath, json, "utf-8");
  }

  // ─── 更新单个单词 ───

  async updateWord(word: string, entry: WordEntry): Promise<void> {
    const data = await this.load();
    data.words[word] = entry;
    await this.save(data);
  }

  // ─── 获取单个单词 ───

  async getWord(word: string): Promise<WordEntry | undefined> {
    const data = await this.load();
    return data.words[word];
  }

  // ─── 按状态筛选单词 ───

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
