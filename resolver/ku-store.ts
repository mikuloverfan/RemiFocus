// RemiFocus — KU 持久化（JSON 文件版）
// 读写 knowledge-units.json，提供同步备份
// 主存储为 IndexedDB，JSON 文件用于备份和跨设备同步

import { DataAdapter } from "obsidian";
import {
  KnowledgeUnit,
  KUId,
} from "../models/knowledge-unit";

interface KURegistryData {
  version: number;
  knowledgeUnits: Record<KUId, KnowledgeUnit>;
}

const DEFAULT_DATA: KURegistryData = {
  version: 1,
  knowledgeUnits: {},
};

let _kuIdCounter = 0;

/**
 * 生成全局唯一的 KU ID
 */
export function generateKUId(): KUId {
  _kuIdCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `ku_${ts}${rand}`;
}

export class KUStore {
  private adapter: DataAdapter;
  private filePath: string;
  private cache: KURegistryData | null = null;

  constructor(adapter: DataAdapter, filePath: string) {
    this.adapter = adapter;
    this.filePath = filePath;
  }

  async load(): Promise<KURegistryData> {
    if (this.cache) return this.cache;
    try {
      const exists = await this.adapter.exists(this.filePath);
      if (!exists) {
        this.cache = { ...DEFAULT_DATA };
        return this.cache;
      }
      const raw = await this.adapter.read(this.filePath);
      this.cache = JSON.parse(raw) as KURegistryData;
      return this.cache;
    } catch (err) {
      console.error("KUStore: Failed to load", err);
      this.cache = { ...DEFAULT_DATA };
      return this.cache;
    }
  }

  async save(): Promise<void> {
    if (!this.cache) return;
    const json = JSON.stringify(this.cache, null, 2);
    await this.adapter.write(this.filePath, json);
  }

  async getAll(): Promise<KnowledgeUnit[]> {
    const data = await this.load();
    return Object.values(data.knowledgeUnits);
  }

  async get(id: KUId): Promise<KnowledgeUnit | undefined> {
    const data = await this.load();
    return data.knowledgeUnits[id];
  }

  async put(ku: KnowledgeUnit): Promise<void> {
    const data = await this.load();
    data.knowledgeUnits[ku.id] = ku;
    await this.save();
  }

  async delete(id: KUId): Promise<void> {
    const data = await this.load();
    delete data.knowledgeUnits[id];
    await this.save();
  }

  async size(): Promise<number> {
    const data = await this.load();
    return Object.keys(data.knowledgeUnits).length;
  }

  /** 搜索 KU（按文本模糊匹配） */
  async search(query: string): Promise<KnowledgeUnit[]> {
    const data = await this.load();
    const q = query.toLowerCase();
    return Object.values(data.knowledgeUnits).filter(
      (ku) =>
        ku.canonical.text.toLowerCase().includes(q) ||
        ku.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
}
