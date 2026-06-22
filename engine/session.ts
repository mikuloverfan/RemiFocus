// RemiFocus — 学习 Session 管理器
// 实现 IEngine 接口，协调 storage / scheduler / modes / KU plasticity

import { IEngine, DeckStats } from "./interface";
import {
  DeckData,
  WordEntry,
  ReviewResult,
  LearningMode,
  DeckInfo,
  FolderStats,
  MasteryResult,
} from "../models/card";
import { IStorage } from "../storage/interface";
import { IScheduler } from "../scheduler/interface";
import { getExposureQueue, processExposureResult } from "../modes/exposure";
import { getTestQueue, processTestResult } from "../modes/test-mode";
import { getReviewQueue, processReviewResult } from "../modes/review";
import { KUPlasticityLayer } from "../core/ku/plasticity";

export class SessionManager implements IEngine {
  private queueSize: number;
  private plasticity: KUPlasticityLayer | null;

  constructor(
    private storage: IStorage,
    private scheduler: IScheduler,
    queueSize?: number,
    plasticity?: KUPlasticityLayer
  ) {
    this.queueSize = queueSize ?? 20;
    this.plasticity = plasticity ?? null;
  }

  // ─── 原有方法 ───

  async getQueue(mode: LearningMode, count?: number): Promise<[string, WordEntry][]> {
    const deck = await this.storage.load();
    const size = count ?? this.queueSize;
    switch (mode) {
      case "exposure":
        return getExposureQueue(deck, size);
      case "test":
        return getTestQueue(deck, size);
      case "review":
        const today = new Date().toISOString().slice(0, 10);
        return getReviewQueue(deck, size, today);
    }
  }

  async processResult(
    word: string,
    mode: LearningMode,
    result: ReviewResult
  ): Promise<WordEntry> {
    const deck = await this.storage.load();
    const entry = deck.words[word];
    if (!entry) throw new Error(`Word not found: ${word}`);

    const now = new Date().toISOString().slice(0, 10);
    let updated: WordEntry;

    switch (mode) {
      case "exposure":
        updated = processExposureResult(entry, result === "good", now);
        break;
      case "test":
        updated = processTestResult(word, entry, result, now, this.scheduler);
        break;
      case "review":
        updated = processReviewResult(word, entry, result, now, this.scheduler);
        break;
    }

    await this.storage.updateWord(word, updated);

    // ─── v1.1: KU Plasticity 反馈回路 ───
    // 如果卡片关联了 KU，将学习结果回写到 KU
    if (this.plasticity && entry.kuId) {
      try {
        await this.plasticity.processLearningResult(
          entry.kuId,
          result,
          updated.ease
        );
      } catch (err) {
        console.error(`[SessionManager] KU plasticity error for ${word}:`, err);
      }
    }

    return updated;
  }

  async getStats(): Promise<DeckStats> {
    const deck = await this.storage.load();
    const words = Object.values(deck.words);
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: words.length,
      new: words.filter((w) => w.state === "new").length,
      exposure: words.filter((w) => w.state === "exposure").length,
      test: words.filter((w) => w.state === "test").length,
      review: words.filter((w) => w.state === "review").length,
      dueToday: words.filter(
        (w) => w.state === "review" && w.next !== null && w.next <= today
      ).length,
    };
  }

  // ─── 新增：多卡组支持 ───

  async getDeckNames(): Promise<string[]> {
    const deck = await this.storage.load();
    const names = new Set<string>();
    for (const entry of Object.values(deck.words)) {
      for (const d of entry.deck) {
        names.add(d);
      }
    }
    return Array.from(names).sort();
  }

  async getDeckInfo(deckName: string): Promise<DeckInfo> {
    const deck = await this.storage.load();
    const today = new Date().toISOString().slice(0, 10);

    let totalCards = 0;
    let newCount = 0;
    let exposureCount = 0;
    let testCount = 0;
    let reviewCount = 0;
    let dueCount = 0;
    let totalEase = 0;
    let totalInterval = 0;
    let totalSuccess = 0;
    let totalAttempts = 0;

    for (const entry of Object.values(deck.words)) {
      if (!entry.deck.includes(deckName)) continue;
      totalCards++;
      switch (entry.state) {
        case "new": newCount++; break;
        case "exposure": exposureCount++; break;
        case "test": testCount++; break;
        case "review": reviewCount++; break;
      }
      if (entry.state === "review" && entry.next !== null && entry.next <= today) {
        dueCount++;
      }
      totalEase += entry.ease;
      totalInterval += entry.interval;
      for (const h of entry.history) {
        totalAttempts++;
        if (h.result === "good" || h.result === "easy") totalSuccess++;
      }
    }

    const mastery = totalCards > 0
      ? this.calcMastery(totalEase / totalCards, totalInterval / totalCards, totalAttempts > 0 ? totalSuccess / totalAttempts : 0)
      : 0;

    return {
      name: deckName,
      totalCards,
      dueCount,
      mastery: Math.round(mastery * 100),
      newCount,
      exposureCount,
      testCount,
      reviewCount,
    };
  }

  async getAllDeckInfos(): Promise<DeckInfo[]> {
    const names = await this.getDeckNames();
    const results = await Promise.all(names.map((n) => this.getDeckInfo(n)));
    return results;
  }

  async computeMastery(deckName: string): Promise<MasteryResult> {
    const deck = await this.storage.load();
    let totalEase = 0;
    let totalInterval = 0;
    let totalSuccess = 0;
    let totalAttempts = 0;
    let count = 0;

    for (const entry of Object.values(deck.words)) {
      if (!entry.deck.includes(deckName)) continue;
      count++;
      totalEase += entry.ease;
      totalInterval += entry.interval;
      for (const h of entry.history) {
        totalAttempts++;
        if (h.result === "good" || h.result === "easy") totalSuccess++;
      }
    }

    if (count === 0) {
      return { mastery: 0, ease: 250, interval: 0, successRate: 0 };
    }

    const avgEase = totalEase / count;
    const avgInterval = totalInterval / count;
    const successRate = totalAttempts > 0 ? totalSuccess / totalAttempts : 0;
    const mastery = this.calcMastery(avgEase, avgInterval, successRate);

    return {
      mastery: Math.round(mastery * 100),
      ease: Math.round(avgEase),
      interval: Math.round(avgInterval),
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  async getFolderStats(): Promise<FolderStats[]> {
    // 文件夹分组逻辑：deck 名按 "." 分割后取第一部分作为文件夹名
    // 例如 "e" → folder "e", "biology" → folder "biology"
    // 未来 resolver 会基于实际文件路径解析
    const decks = await this.getAllDeckInfos();
    const folderMap = new Map<string, DeckInfo[]>();

    for (const deck of decks) {
      const folder = deck.name.split("/")[0] || deck.name;
      const list = folderMap.get(folder) ?? [];
      list.push(deck);
      folderMap.set(folder, list);
    }

    const folders: FolderStats[] = [];
    for (const [path, deckList] of folderMap) {
      let totalCards = 0;
      let totalMastery = 0;
      for (const d of deckList) {
        totalCards += d.totalCards;
        totalMastery += d.mastery * d.totalCards;
      }
      folders.push({
        path,
        decks: deckList,
        totalCards,
        mastery: totalCards > 0 ? Math.round(totalMastery / totalCards) : 0,
      });
    }

    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }

  // ─── 私有工具 ───

  /**
   * 熟练度计算公式
   * mastery = weighted average(ease, interval, successRate)
   * ease 权重 0.4, interval 权重 0.3, successRate 权重 0.3
   * 归一化到 0–1 范围
   */
  private calcMastery(avgEase: number, avgInterval: number, successRate: number): number {
    // ease: 130–350 → 归一化到 0–1
    const easeNorm = Math.min(1, Math.max(0, (avgEase - 130) / 220));
    // interval: 0–365 → 归一化到 0–1 (log scale)
    const intervalNorm = Math.min(1, Math.log2(avgInterval + 1) / Math.log2(366));
    // successRate 已在 0–1 范围

    return easeNorm * 0.4 + intervalNorm * 0.3 + successRate * 0.3;
  }
}
