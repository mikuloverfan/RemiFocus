import { IScheduler, ScheduleInput, ScheduleOutput } from "./interface";

export class SM2Scheduler implements IScheduler {
  readonly name = "sm-2";

  schedule(input: ScheduleInput): ScheduleOutput {
    const { entry, result } = input;
    let ease = entry.ease;
    let interval = Math.max(1, entry.interval);

    switch (result) {
      case "again":
        ease = Math.max(130, ease - 20);
        interval = 0;
        break;
      case "hard":
        ease = Math.max(130, ease - 20);
        interval = Math.max(1, Math.round(interval * 1.2));
        break;
      case "good":
        interval = Math.round(interval * ease / 100);
        break;
      case "easy":
        ease += 20;
        interval = Math.round(interval * ease / 100 * 1.3);
        break;
    }

    interval = Math.min(interval, 365);
    interval = Math.max(0, interval);
    const due = new Date(input.now);
    due.setDate(due.getDate() + interval);
    const next = due.toISOString().slice(0, 10);

    return { ease, interval, next };
  }
}
