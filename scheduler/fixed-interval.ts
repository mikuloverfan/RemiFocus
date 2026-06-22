import { IScheduler, ScheduleInput, ScheduleOutput } from "./interface";

const INTERVALS: Record<string, number> = {
  again: 0,
  hard: 1,
  good: 3,
  easy: 7,
};

export class FixedIntervalScheduler implements IScheduler {
  readonly name = "fixed-interval";

  schedule(input: ScheduleInput): ScheduleOutput {
    const interval = INTERVALS[input.result];
    const due = new Date(input.now);
    due.setDate(due.getDate() + interval);
    const next = due.toISOString().slice(0, 10);

    return { ease: input.entry.ease, interval, next };
  }
}
