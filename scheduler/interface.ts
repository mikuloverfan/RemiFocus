// RemiFocus — 调度算法接口

import { WordEntry, ReviewResult } from "../models/card";
import { LearningMode } from "../models/card";

/** 调度输入 */
export interface ScheduleInput {
  word: string;
  entry: WordEntry;
  result: ReviewResult;
  mode: LearningMode;
  now: string; // YYYY-MM-DD
}

/** 调度输出 */
export interface ScheduleOutput {
  ease: number;
  interval: number;
  next: string; // YYYY-MM-DD
}

/** 调度器接口 — 所有算法必须实现 */
export interface IScheduler {
  readonly name: string;
  schedule(input: ScheduleInput): ScheduleOutput;
}
