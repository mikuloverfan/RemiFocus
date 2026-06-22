// RemiFocus — FSRS-5 调度器实现
//
// FSRS (Free Spaced Repetition Scheduler) v5
// 参考: https://github.com/open-spaced-repetition/py-fsrs
//
// 核心参数映射:
//   WordEntry.ease     → difficulty × 100 (1.0–10.0 缩放)
//   WordEntry.interval → stability (天数)
//
// 状态流转:
//   new → first review → subsequent reviews (循环)

import { IScheduler, ScheduleInput, ScheduleOutput } from "./interface";

// ─── FSRS-5 默认权重（19 参数） ───
// 来源: FSRS-5 论文默认值，Anki 社区优化
const DEFAULT_W: readonly number[] = [
  0.4197,   // w0: initial stability offset
  1.1869,   // w1: initial stability rating multiplier
  3.0412,   // w2: initial difficulty offset
  15.2441,  // w3: initial difficulty rating multiplier
  7.1439,   // w4: difficulty decrement
  0.6473,   // w5: mean reversion weight
  0.0019,   // w6: mean reversion offset
  1.4997,   // w7: mean reversion damping scale
  0.1593,   // w8: mean reversion damping half-life
  0.2001,   // w9: mean reversion damping steepness
  1.5580,   // w10: stability increase scale
  0.8996,   // w11: difficulty dependence
  0.0524,   // w12: minimum stability factor
  0.2857,   // w13: stability decay after lapse
  1.3699,   // w14: stability increase for "easy"
  0.2515,   // w15: lapse stability factor
  1.5148,   // w16: ease bonus for "easy"
  0.1504,   // w17: retrievability decay exponent
  0.1000,   // w18: retrievability decay base
] as const;

// ─── 评分映射 ───
// again=1, hard=2, good=3, easy=4
function ratingToInt(rating: string): 1 | 2 | 3 | 4 {
  switch (rating) {
    case "again": return 1;
    case "hard":  return 2;
    case "good":  return 3;
    case "easy":  return 4;
    default:      return 3;
  }
}

// ─── 数学工具 ───

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * FSRS-5 调度器
 *
 * 核心特性:
 * - 19 参数可调权重体系
 * - 基于 difficulty / stability / retrievability 三参数模型
 * - 比 SM-2 更精准的记忆建模
 */
export class FSRSScheduler implements IScheduler {
  readonly name = "fsrs";

  private w: readonly number[];

  constructor(weights?: readonly number[]) {
    this.w = weights ?? DEFAULT_W;
  }

  schedule(input: ScheduleInput): ScheduleOutput {
    const { entry, result, now } = input;
    const rating = ratingToInt(result);

    // 从 WordEntry 解码 FSRS 参数
    // ease: SM-2 风格 (130-350) → FSRS difficulty (1-10)
    // 新卡片用默认值
    let difficulty = entry.interval === 0 && entry.ease === 250
      ? this.initialDifficulty(rating)
      : this.decodeDifficulty(entry.ease);

    let stability = entry.interval; // stability 直接用天数

    const isFirstReview = stability === 0;

    if (isFirstReview) {
      // 首次学习
      stability = this.initialStability(rating);
      difficulty = this.initialDifficulty(rating);
    } else {
      // 后续复习
      if (rating === 1) {
        // "again" → 遗忘，stability 大幅下降
        stability = this.stabilityAfterLapse(stability, difficulty, rating);
      } else {
        // "hard" / "good" / "easy" → 成功回忆
        stability = this.stabilityAfterSuccess(stability, difficulty, rating);
      }
      difficulty = this.difficultyAfterReview(difficulty, rating);
    }

    // 计算下次复习间隔（基于 retrievability 目标 90%）
    const retrievabilityTarget = 0.9;
    const interval = this.nextInterval(stability, retrievabilityTarget);

    // 编码回 WordEntry 格式
    const ease = this.encodeDifficulty(difficulty);

    // 计算下次复习日期
    const due = new Date(now);
    due.setDate(due.getDate() + interval);
    const next = due.toISOString().slice(0, 10);

    return {
      ease: Math.round(ease),
      interval: Math.max(1, Math.round(interval)),
      next,
    };
  }

  // ─── FSRS-5 核心算法 ───

  /**
   * 初始稳定性（首次记忆强度）
   * S0 = w0 + w1 × (rating - 1)
   */
  private initialStability(rating: 1 | 2 | 3 | 4): number {
    return Math.max(0.01, this.w[0] + this.w[1] * (rating - 1));
  }

  /**
   * 初始难度
   * D0 = w2 + w3 × (rating - 1)
   * 范围 [1, 10]
   */
  private initialDifficulty(rating: 1 | 2 | 3 | 4): number {
    return clamp(this.w[2] + this.w[3] * (rating - 1), 1, 10);
  }

  /**
   * 成功回忆后的稳定性增长
   *
   * S' = S × (1 + w10 × (1 - w11 × D) × (1 + w12 × (1 - e^(-S / w13))) × e^(w14 × (rating - 1)))
   *
   * 简化: stability × (1 + w10 × f(D) × g(S) × h(rating))
   *   其中 f(D) = 1 - w11 × D        — 难度效应
   *        g(S) = 1 + w12 × (1 - e^(-S/w13)) — 稳定性效应
   *        h(rating) = e^(w14 × (rating - 1)) — 评分效应
   */
  private stabilityAfterSuccess(
    stability: number,
    difficulty: number,
    rating: 2 | 3 | 4
  ): number {
    const difficultyFactor = 1 - this.w[11] * difficulty;
    const stabilityFactor = 1 + this.w[12] * (1 - Math.exp(-stability / this.w[13]));
    const ratingFactor = Math.exp(this.w[14] * (rating - 1));

    return stability * (1 + this.w[10] * difficultyFactor * stabilityFactor * ratingFactor);
  }

  /**
   * 遗忘后的稳定性衰减
   *
   * S' = w15 × D^(-w16) × (S + 1)^w17 - 1
   *
   * 简化版本:
   * S' = min(S, S × w15 × D^(-w16))
   */
  private stabilityAfterLapse(
    stability: number,
    difficulty: number,
    rating: 1
  ): number {
    // 遗忘后稳定性大幅下降
    const lapseFactor = this.w[15] * Math.pow(difficulty, -this.w[16]);
    const newStability = Math.max(0.01, stability * lapseFactor);
    return newStability;
  }

  /**
   * 复习后的难度更新
   *
   * D' = D + w4 × (5 - rating) × meanReversion
   *
   * 其中 meanReversion = 1 - sigmoid(w5 × D + w6 + w7 × ln(1 + e^((w8 - D) / w9)))
   *
   * 范围 [1, 10]
   */
  private difficultyAfterReview(difficulty: number, rating: 1 | 2 | 3 | 4): number {
    // "again" 会回到初始难度
    if (rating === 1) {
      return this.initialDifficulty(1);
    }

    // 均值回归项：难度越极端，越向中间回归
    const damping = this.w[5] * difficulty + this.w[6] +
      this.w[7] * Math.log(1 + Math.exp((this.w[8] - difficulty) / this.w[9]));
    const meanReversion = 1 - sigmoid(damping);

    const delta = this.w[4] * (5 - rating) * meanReversion;
    const newDifficulty = difficulty + delta;

    return clamp(newDifficulty, 1, 10);
  }

  /**
   * 基于目标 retrievability 计算复习间隔
   *
   * R(t) = (1 + (t / (S × 9))^(-1))^(-1/w17)
   *
   * 已知 R 和 S，求 t：
   * t = S × 9 × (R^(-w17) - 1)^(-1)
   *
   * 简化：使用 90% 目标 → t ≈ S × (一些系数)
   */
  private nextInterval(stability: number, targetRetrievability: number): number {
    // 从 retrievability 公式反推时间
    // R(t) = (1 + (t / (9 * S))^(-1))^(-1/w17)
    // 求解 t:
    // R^(-w17) = 1 + (t / (9*S))^(-1)
    // (t / (9*S))^(-1) = R^(-w17) - 1
    // t / (9*S) = 1 / (R^(-w17) - 1)
    // t = 9 * S / (R^(-w17) - 1)

    const r = targetRetrievability;
    // 防止除零
    const denominator = Math.pow(r, -this.w[17]) - 1;
    if (denominator <= 0) return stability;

    const interval = (9 * stability) / denominator;
    return Math.max(1, Math.round(interval));
  }

  // ─── 编解码 ───

  /**
   * FSRS difficulty (1-10) → SM-2 ease (100-1000)
   */
  private encodeDifficulty(difficulty: number): number {
    // difficulty 1.0 → ease 150, difficulty 10.0 → ease 1000
    const ease = 50 + difficulty * 95;
    return Math.round(clamp(ease, 100, 1000));
  }

  /**
   * SM-2 ease (100-1000) → FSRS difficulty (1-10)
   */
  private decodeDifficulty(ease: number): number {
    const difficulty = (ease - 50) / 95;
    return clamp(difficulty, 1, 10);
  }
}
