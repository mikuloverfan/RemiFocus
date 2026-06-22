// RemiFocus — 演化日志类型定义
// 追踪 KU 的每一次变化

import { KUId, KnowledgeUnit } from "./knowledge-unit";

export type KUChangeType =
  | "created"
  | "merged"
  | "split"
  | "view_added"
  | "view_regenerated"
  | "stability_changed"
  | "importance_changed"
  | "tags_changed"
  | "relation_added";

export interface EvolutionEntry {
  id: string;                // "evt_{timestamp}_{kuId}"
  kuId: KUId;
  version: number;
  change: KUChangeType;
  detail: string;
  snapshot?: {
    before: Partial<KnowledgeUnit>;
    after: Partial<KnowledgeUnit>;
  };
  /** 变化来源: "note:path/to/note.md" | "ai:gpt-4o-mini" | "user:manual" */
  source: string;
  timestamp: string;
}
