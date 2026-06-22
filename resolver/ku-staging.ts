// RemiFocus — KU 暂存区管理
// 模糊合并候选先进入暂存区，防止误合并

import {
  StagingRecord,
  StagingCandidate,
  StagingStatus,
  CandidateStatus,
  LLMJudgment,
} from "../models/staging";
import { KUId } from "../models/knowledge-unit";
import { KUDatabase } from "../storage/ku-database";

export class KUStagingPool {
  private db: KUDatabase;

  constructor(db: KUDatabase) {
    this.db = db;
  }

  /**
   * 将候选合并放入暂存区
   */
  async stage(
    incomingRaw: string,
    sourceNote: string,
    blockId: string,
    signature: string,
    candidates: Array<{ kuId: KUId; score: number }>
  ): Promise<StagingRecord> {
    const record: StagingRecord = {
      id: `stage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      incomingKu: {
        rawText: incomingRaw,
        sourceNote,
        blockId,
        signature,
      },
      candidates: candidates.map((c) => ({
        kuId: c.kuId,
        score: c.score,
        status: c.score > 0.95 ? "auto_merge" : "pending_llm",
      })),
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    await this.db.putStaging(record);
    return record;
  }

  /**
   * LLM 判定后的处理
   */
  async resolve(
    stageId: string,
    decision: "merge" | "reject",
    targetKuId?: KUId,
    canonicalText?: string
  ): Promise<void> {
    // 注：实际数据库操作需要 get + put
    // 这里简化处理，直接记录判断结果
    console.log(
      `[KUStaging] Resolved ${stageId}: ${decision}` +
      (targetKuId ? ` → ${targetKuId}` : "") +
      (canonicalText ? ` | "${canonicalText}"` : "")
    );
  }

  /**
   * 获取所有待处理的暂存条目
   */
  async getPending(): Promise<StagingRecord[]> {
    return this.db.getPendingStaging();
  }

  /**
   * 获取暂存区统计
   */
  async getStats(): Promise<{ pending: number; resolved: number; rejected: number }> {
    return { pending: 0, resolved: 0, rejected: 0 };
  }

  /**
   * 用户手动覆盖
   */
  async override(
    stageId: string,
    decision: "merge" | "reject",
    targetKuId?: KUId
  ): Promise<void> {
    await this.resolve(stageId, decision, targetKuId);
  }
}
