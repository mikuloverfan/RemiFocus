import { DeckData, WordEntry, ReviewResult } from "../models/card";
import { IScheduler } from "../scheduler/interface";

export function getTestQueue(
  deck: DeckData,
  count: number
): [string, WordEntry][] {
  const candidates: [string, WordEntry][] = [];
  for (const [word, entry] of Object.entries(deck.words)) {
    // Test 模式也包含新卡片（state === "new"）
    if (entry.state === "test" || entry.state === "new") {
      candidates.push([word, entry]);
    }
  }

  // 按 next 日期排序，优先展示到期的卡片
  candidates.sort((a, b) => {
    const na = a[1].next ?? "9999-12-31";
    const nb = b[1].next ?? "9999-12-31";
    return na.localeCompare(nb);
  });

  const totalAvail = candidates.length;
  if (totalAvail === 0) return [];

  // 如果 count <= 实际数量，直接取前 count 个
  if (count <= totalAvail) {
    return candidates.slice(0, count);
  }

  // ─── 加权扩展抽卡 ───
  // count > 实际数量：先用完所有候选词，剩余部分按权重重复抽取
  const result: [string, WordEntry][] = [...candidates];

  // 计算每个词的权重（困难度越高，权重越大）
  const weights = candidates.map(([, entry]) => calcWeight(entry));
  const remaining = count - totalAvail;

  for (let i = 0; i < remaining; i++) {
    const idx = weightedPick(weights);
    result.push(candidates[idx]);
  }

  return result;
}

/**
 * 计算单词的权重（值越高，被重复抽取的概率越大）
 * 权重因子：
 *   - ease 越低 → 权重越高（轻松度 130=难, 350=易）
 *   - interval 越小 → 权重越高（刚学过的容易忘）
 *   - 历史中 "again" 次数越多 → 权重越高
 *   - 历史中 "hard" 次数越多 → 权重略高
 */
function calcWeight(entry: WordEntry): number {
  // ease: 130–350 → 归一化到 0–1，取反（低 ease = 高权重）
  const easeNorm = Math.max(0, Math.min(1, (350 - entry.ease) / 220));
  // interval: 0–365 → 归一化，取反（短 interval = 高权重）
  const intervalNorm = Math.max(0, Math.min(1, 1 - Math.log2(entry.interval + 1) / Math.log2(366)));
  // 历史错误计数
  let againCount = 0;
  let hardCount = 0;
  for (const h of entry.history) {
    if (h.result === "again") againCount++;
    else if (h.result === "hard") hardCount++;
  }
  // 错误惩罚：again 权重乘 3，hard 乘 1.5
  const errorPenalty = againCount * 3 + hardCount * 1.5;

  // 基础权重：ease (0.5) + interval (0.3) + error (0.2 归一化)
  const baseWeight =
    easeNorm * 0.5 +
    intervalNorm * 0.3 +
    Math.min(1, errorPenalty / 10) * 0.2;

  // 至少保证基础权重 > 0，新卡片给中等权重
  return Math.max(0.1, baseWeight);
}

/**
 * 加权随机选取
 * @param weights 权重数组
 * @returns 选中元素的索引
 */
function weightedPick(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return Math.floor(Math.random() * weights.length);

  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export function processTestResult(
  word: string,
  entry: WordEntry,
  result: ReviewResult,
  now: string,
  scheduler: IScheduler
): WordEntry {
  const output = scheduler.schedule({
    word,
    entry,
    result,
    mode: "test",
    now,
  });
  return {
    ...entry,
    state: "review",
    ease: output.ease,
    interval: output.interval,
    next: output.next,
    history: [
      ...entry.history,
      { date: now, mode: "test" as const, result },
    ],
  };
}
