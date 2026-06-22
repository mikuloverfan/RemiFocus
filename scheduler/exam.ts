import { IScheduler, ScheduleInput, ScheduleOutput } from "./interface";

export class ExamScheduler implements IScheduler {
  readonly name = "exam";

  schedule(input: ScheduleInput): ScheduleOutput {
    const { entry, result } = input;
    let ease = entry.ease;
    let interval = entry.interval;

    switch (result) {
      case "again":
        ease = Math.max(130, ease - 30);
        interval = 0;
        break;
      case "hard":
        ease = Math.max(130, ease - 15);
        interval = Math.max(1, Math.round(interval * 0.5));
        break;
      case "good":
        interval = Math.max(1, Math.round(interval * ease / 100));
        break;
      case "easy":
        ease += 15;
        interval = Math.max(1, Math.round(interval * ease / 100 * 1.5));
        break;
    }

    interval = Math.min(interval, 90);
    const due = new Date(input.now);
    due.setDate(due.getDate() + interval);
    const next = due.toISOString().slice(0, 10);

    return { ease, interval, next };
  }
}
