import { DeckData, WordEntry, ReviewResult } from "../models/card";

export function getExposureQueue(
  deck: DeckData,
  count: number
): [string, WordEntry][] {
  const candidates: [string, WordEntry][] = [];
  for (const [word, entry] of Object.entries(deck.words)) {
    if (entry.state === "new" || entry.state === "exposure") {
      candidates.push([word, entry]);
    }
  }
  // Fisher-Yates shuffle, take first `count`
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, count);
}

export function processExposureResult(
  entry: WordEntry,
  recognized: boolean,
  now: string
): WordEntry {
  const result: ReviewResult = recognized ? "good" : "again";
  const next: WordEntry = {
    ...entry,
    state: recognized ? "test" : "exposure",
    history: [
      ...entry.history,
      { date: now, mode: "exposure" as const, result },
    ],
  };
  return next;
}
