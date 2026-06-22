// RemiFocus — KU IndexedDB 数据库
// 主存储，支持向量搜索和快速查询
// JSON 文件（ku-store.ts）用于备份和跨设备同步

import {
  KnowledgeUnit,
  KUId,
} from "../models/knowledge-unit";
import { EvolutionEntry } from "../models/evolution";
import { StagingRecord } from "../models/staging";

const DB_NAME = "remifocus-ku";
const DB_VERSION = 1;

interface StoreSchema {
  knowledge_units: KnowledgeUnit;
  evolution_log: EvolutionEntry;
  staging_pool: StagingRecord;
}

type StoreName = keyof StoreSchema;

const STORE_CONFIG: Record<StoreName, { keyPath: string; indexes?: string[] }> =
{
  knowledge_units: {
    keyPath: "id",
    indexes: ["tags", "importance", "updatedAt"],
  },
  evolution_log: {
    keyPath: "id",
    indexes: ["kuId", "timestamp"],
  },
  staging_pool: {
    keyPath: "id",
    indexes: ["status", "createdAt"],
  },
};

export class KUDatabase {
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        for (const [storeName, config] of Object.entries(STORE_CONFIG)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: config.keyPath,
            });
            for (const index of config.indexes ?? []) {
              store.createIndex(index, index, { multiEntry: index === "tags" });
            }
          }
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db!);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private async withStore<T>(
    storeName: StoreName,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = fn(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ─── KU CRUD ───

  async putKU(ku: KnowledgeUnit): Promise<void> {
    await this.withStore("knowledge_units", "readwrite", (store) =>
      store.put(ku)
    );
  }

  async getKU(id: KUId): Promise<KnowledgeUnit | undefined> {
    return this.withStore("knowledge_units", "readonly", (store) =>
      store.get(id)
    );
  }

  async getAllKUs(): Promise<KnowledgeUnit[]> {
    return this.withStore("knowledge_units", "readonly", (store) =>
      store.getAll()
    );
  }

  async deleteKU(id: KUId): Promise<void> {
    await this.withStore("knowledge_units", "readwrite", (store) =>
      store.delete(id)
    );
  }

  async getKUsByTag(tag: string): Promise<KnowledgeUnit[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("knowledge_units", "readonly");
      const store = tx.objectStore("knowledge_units");
      const index = store.index("tags");
      const request = index.getAll(tag);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ─── 演化日志 ───

  async appendEvolution(entry: EvolutionEntry): Promise<void> {
    await this.withStore("evolution_log", "readwrite", (store) =>
      store.put(entry)
    );
  }

  async getEvolution(kuId: KUId): Promise<EvolutionEntry[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("evolution_log", "readonly");
      const store = tx.objectStore("evolution_log");
      const index = store.index("kuId");
      const request = index.getAll(kuId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ─── 暂存区 ───

  async putStaging(record: StagingRecord): Promise<void> {
    await this.withStore("staging_pool", "readwrite", (store) =>
      store.put(record)
    );
  }

  async getPendingStaging(): Promise<StagingRecord[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("staging_pool", "readonly");
      const store = tx.objectStore("staging_pool");
      const index = store.index("status");
      const request = index.getAll("pending");

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ─── 向量搜索（简单实现：遍历全量计算余弦相似度） ───
  // 生产环境应使用专门的向量数据库或 WebWorker 加速

  async searchSimilar(
    queryVector: Float32Array,
    topK: number = 5,
    threshold: number = 0.85
  ): Promise<Array<{ kuId: KUId; score: number }>> {
    // 注意：实际实现需要 embedding 表
    // 这里返回空数组，等 embedding 服务就绪后实现
    return [];
  }

  // ─── 关闭 ───

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
