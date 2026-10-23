/** YYYY-MM-DD for `date` as seen in `timeZone` (en-CA formats that way). */
export function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function localDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "full", timeStyle: "short" }).format(date);
}

/** Shift a YYYY-MM-DD string by whole days. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Offset (local − UTC) of `timeZone` at the instant `utcMs`, in ms. */
function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - Math.floor(utcMs / 1000) * 1000;
}

/** The UTC instant of a wall-clock time in `timeZone` (handles DST transitions). */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let t = guess - tzOffsetMs(guess, timeZone);
  const second = guess - tzOffsetMs(t, timeZone);
  if (second !== t) t = second;
  return new Date(t);
}

/**
 * Parse "YYYY-MM-DD" (treated as 11:59 PM local, a typical deadline) or
 * "YYYY-MM-DDTHH:mm" as a wall-clock time in `timeZone`.
 */
export function parseLocalDateTime(value: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = zonedTimeToUtc(+y, +mo, +d, h ? +h : 23, mi ? +mi : 59, timeZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** ISO instant -> "YYYY-MM-DDTHH:mm" wall-clock in `timeZone` (for <input type="datetime-local">). */
export function toLocalInputValue(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const v = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}
