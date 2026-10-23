// Display helpers shared by server and client components. Dates arrive as ISO strings on the client.

type DateLike = Date | string;
const toDate = (d: DateLike) => (typeof d === "string" ? new Date(d) : d);

export function formatDue(d: DateLike, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(toDate(d));
}

export function formatDay(d: DateLike, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(toDate(d));
}

/** YYYY-MM-DD in the zone (for grouping into days). */
export function dayKey(d: DateLike, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(toDate(d));
}

/** "Due today", "Due tomorrow", "Due in 3 days", "Overdue by 2 days". */
export function dueLabel(d: DateLike, timeZone: string, now: Date = new Date()): string {
  const due = dayKey(d, timeZone);
  const today = dayKey(now, timeZone);
  const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days === 0) return toDate(d) < now ? "Due earlier today" : "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  return days === -1 ? "Due yesterday" : `Overdue by ${-days} days`;
}

/** "just now", "10m ago", "3h ago", "2d ago". */
export function timeAgo(d: DateLike, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - toDate(d).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

export const STATUS_LABELS = {
  PENDING_GENERATION: "Queued for Claude",
  AWAITING_MANUAL: "Ready to copy to Claude",
  GENERATING: "Generating…",
  PROCESSED: "Study guide ready",
  FAILED: "Failed",
  SKIPPED: "Skipped",
} as const;

/** "Calendar: School calendar", or just "Google Classroom" when the name is the type. */
export function sourceTag(source: { type: keyof typeof SOURCE_LABELS; label: string }): string {
  const kind = SOURCE_LABELS[source.type];
  return source.label === kind ? kind : `${kind}: ${source.label}`;
}

export const SOURCE_LABELS = {
  GOOGLE_CLASSROOM: "Google Classroom",
  ICAL_FEED: "Calendar",
  CANVAS: "Canvas",
  WEB_PAGE: "Website",
  MANUAL_TEXT: "Pasted",
} as const;

/** "Synced 10m ago — No new assignments" / "Synced just now — 2 new study guides ready". */
export function syncStatusLine(
  s: { lastSyncedAt: string | null; lastRun: { status: string; newCount: number; updatedCount: number; errors: string[] } | null; readySinceLastSync: number; awaitingManual: number; inProgress: number },
  mode: "api" | "manual",
  now: Date = new Date(),
): string {
  if (!s.lastRun) return "Not synced yet";
  const when = s.lastSyncedAt ? `Synced ${timeAgo(s.lastSyncedAt, now)}` : "Last sync failed";
  const parts: string[] = [];
  if (s.readySinceLastSync) parts.push(`${s.readySinceLastSync} new study guide${s.readySinceLastSync === 1 ? "" : "s"} ready`);
  if (mode === "api" && s.inProgress) parts.push(`${s.inProgress} being generated`);
  if (mode === "manual" && s.awaitingManual) parts.push(`${s.awaitingManual} ready to copy to Claude`);
  if (!parts.length) parts.push(s.lastRun.newCount + s.lastRun.updatedCount ? `${s.lastRun.newCount} new, ${s.lastRun.updatedCount} updated` : "No new assignments");
  if (s.lastRun.status === "PARTIAL" || s.lastRun.status === "FAILED") parts.push(`${s.lastRun.errors.length} source problem${s.lastRun.errors.length === 1 ? "" : "s"}`);
  return `${when} — ${parts.join(" · ")}`;
}
