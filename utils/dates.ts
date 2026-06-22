// RemiFocus — 日期工具
// 参考 SR 插件 src/utils/dates.ts

import { PREFERRED_DATE_FORMAT } from "./constants";

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(ticks: number): string {
  const d = new Date(ticks);
  const y = d.getFullYear().toString().padStart(4, "0");
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 获取今天日期字符串 */
export function today(): string {
  return formatDate(Date.now());
}

/** parse YYYY-MM-DD 到 Date */
export function parseDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 计算两个日期之间的天数差 */
export function daysBetween(a: string, b: string): number {
  const da = parseDate(a).getTime();
  const db = parseDate(b).getTime();
  return Math.round((da - db) / (24 * 3600 * 1000));
}

/** 在日期上增加天数 */
export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return formatDate(d.getTime());
}
