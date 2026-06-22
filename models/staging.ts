// RemiFocus — 暂存区类型定义
// 模糊合并候选进入暂存区，防止误合并

import { KUId } from "./knowledge-unit";

export type StagingStatus = "pending" | "resolved" | "rejected";

export type CandidateStatus =
  | "pending_llm"
  | "auto_merge"
  | "rejected"
  | "manual_review";

export interface LLMJudgment {
  merge: boolean;
  canonical?: string;
  reason: string;
}

export interface StagingCandidate {
  kuId: KUId;
  score: number;           // cosine similarity
  status: CandidateStatus;
  llmResult?: LLMJudgment;
}

export interface StagingRecord {
  id: string;              // "stage_{timestamp}"
  incomingKu: {
    rawText: string;
    sourceNote: string;
    blockId: string;
    signature: string;
  };
  candidates: StagingCandidate[];
  status: StagingStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: "user" | "llm" | "system";
}
