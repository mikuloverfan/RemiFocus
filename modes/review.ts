import { DeckData, WordEntry, ReviewResult } from "../models/card";
import { IScheduler } from "../scheduler/interface";

export function getReviewQueue(
  deck: DeckData,
  count: number,
  today: string
): [string, WordEntry][] {
  const candidates: [string, WordEntry][] = [];
  for (const [word, entry] of Object.entries(deck.words)) {
    if (entry.state === "review" && entry.next !== null && entry.next <= today) {
      candidates.push([word, entry]);
    }
  }
  candidates.sort((a, b) => a[1].next!.localeCompare(b[1].next!));
  return candidates.slice(0, count);
}

export function processReviewResult(
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
    mode: "review",
    now,
  });
  return {
    ...entry,
    ease: output.ease,
    interval: output.interval,
    next: output.next,
    history: [
      ...entry.history,
      { date: now, mode: "review" as const, result },
    ],
  };
}
