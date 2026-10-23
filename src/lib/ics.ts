import { zonedTimeToUtc } from "@/lib/dates";
import { hashKey } from "./store";

// Minimal, dependency-free iCalendar (.ics) reader for the browser, mirroring the full app's
// calendar-feed rules (lib/sources/ical.ts): UID ids, "[COURSE]" title suffixes, all-day items
// due 11:59 PM local, TZID / floating times, recurring/cancelled/holiday events skipped.

const PAST_WINDOW_MS = 14 * 86_400_000;
const FUTURE_WINDOW_MS = 365 * 86_400_000;

export type EventKind = "assignment" | "not_assignment" | "unclear";

export interface ParsedEvent {
  key: string;
  uid: string;
  title: string;
  courseName: string;
  description: string | null;
  dueDate: Date;
  link: string | null;
  kind: EventKind;
}

const NOT_ASSIGNMENT = [
  /\bholiday\b/i, /\bno school\b/i, /\bno class(es)?\b/i, /\b(spring|winter|fall|thanksgiving|summer|mid-?term) break\b/i, /\bvacation\b/i,
  /\boffice hours?\b/i, /\blecture\b/i, /\bclass meeting\b/i, /\bassembly\b/i, /\bearly (dismissal|release)\b/i,
  /\b(teacher|staff) (work|in-?service|development)\b/i, /\bpd day\b/i, /\bpicture day\b/i, /\bfield trip\b/i, /\bpep rally\b/i,
  /\btournament\b/i, /\bclub\b/i, /\bparent[- ]teacher\b/i, /\bopen house\b/i, /\bgraduation\b/i, /\blunch\b/i,
  /\bdays? off\b/i, /\bfirst day of\b/i, /\blast day of (school|classes)\b/i,
];
const ASSIGNMENT = [
  /\bassignments?\b/i, /\bhomework\b/i, /\bhw\b/i, /\bdue\b/i, /\bquiz(zes)?\b/i, /\btests?\b/i, /\bexams?\b/i, /\bmidterm\b/i, /\bfinal\b/i,
  /\bessay\b/i, /\bprojects?\b/i, /\blab\b/i, /\bworksheet\b/i, /\breading\b/i, /\bpaper\b/i, /\breport\b/i, /\bsubmit\b/i,
  /\bpresentation\b/i, /\bproblem set\b/i, /\bpset\b/i, /\bdiscussion (post|board)\b/i, /\bjournal\b/i, /\bchapter\b/i,
];

export function classifyEvent(e: { title: string; url: string | null; uid: string; recurring: boolean; multiDay: boolean; zeroLength: boolean }): EventKind {
  if (e.recurring || e.multiDay) return "not_assignment";
  if (/assignment|quiz|discussion_topic/i.test(`${e.url ?? ""} ${e.uid}`)) return "assignment";
  if (NOT_ASSIGNMENT.some((r) => r.test(e.title))) return "not_assignment";
  if (ASSIGNMENT.some((r) => r.test(e.title))) return "assignment";
  if (e.zeroLength) return "assignment";
  return "unclear";
}

// Outlook/Exchange feeds use Windows zone names.
const WINDOWS_ZONES: Record<string, string> = {
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Atlantic Standard Time": "America/Halifax",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "Central European Standard Time": "Europe/Warsaw",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "India Standard Time": "Asia/Kolkata",
  "China Standard Time": "Asia/Shanghai",
  "Tokyo Standard Time": "Asia/Tokyo",
  UTC: "UTC",
};

function validZone(tz: string | undefined): string | null {
  if (!tz) return null;
  const name = WINDOWS_ZONES[tz] ?? tz.replace(/^\/[^/]*\/[^/]*\//, ""); // strip "/mozilla.org/20050126_1/" style prefixes
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return name;
  } catch {
    return null;
  }
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): Prop | null {
  // NAME;PARAM=a;PARAM="b:c":VALUE  — the first ':' outside quotes ends the name/params.
  let inQuotes = false;
  let split = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ":" && !inQuotes) {
      split = i;
      break;
    }
  }
  if (split < 0) return null;
  const [name, ...rawParams] = line.slice(0, split).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(split + 1) };
}

const unescapeText = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

interface DateValue {
  date: Date;
  allDay: boolean;
}

function parseDate(p: Prop, studentTz: string, calendarTz: string | null): DateValue | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(p.value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h || p.params.VALUE === "DATE") return { date: zonedTimeToUtc(+y, +mo, +d, 23, 59, studentTz), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)), allDay: false };
  const zone = validZone(p.params.TZID) ?? calendarTz ?? studentTz;
  return { date: zonedTimeToUtc(+y, +mo, +d, +h, +mi, zone), allDay: false };
}

export class IcsError extends Error {}

export function parseIcs(text: string, ctx: { timeZone: string; now: Date; defaultCourse: string }): ParsedEvent[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new IcsError("That file isn't a calendar (.ics) file.");
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");

  // The feed's declared zone (X-WR-TIMEZONE, or its only VTIMEZONE) applies to floating times.
  let calendarTz: string | null = null;
  const tzids: string[] = [];
  for (const line of lines) {
    const p = parseLine(line);
    if (p?.name === "X-WR-TIMEZONE") calendarTz = validZone(p.value.trim());
    if (p?.name === "TZID") tzids.push(p.value.trim());
  }
  if (!calendarTz && tzids.length === 1) calendarTz = validZone(tzids[0]);

  const events: ParsedEvent[] = [];
  let current: Prop[] | null = null;
  let depth = 0;
  for (const line of lines) {
    if (/^BEGIN:VEVENT$/i.test(line.trim())) {
      current = [];
      depth = 0;
      continue;
    }
    if (!current) continue;
    if (/^BEGIN:/i.test(line)) depth++;
    else if (/^END:VEVENT$/i.test(line.trim())) {
      const ev = toEvent(current, ctx, calendarTz);
      if (ev) events.push(ev);
      current = null;
    } else if (/^END:/i.test(line)) depth--;
    else if (depth === 0) {
      const p = parseLine(line);
      if (p) current.push(p);
    }
  }
  return events;
}

function toEvent(props: Prop[], ctx: { timeZone: string; now: Date; defaultCourse: string }, calendarTz: string | null): ParsedEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  if ((get("STATUS")?.value ?? "").toUpperCase() === "CANCELLED") return null;
  const startProp = get("DTSTART");
  if (!startProp) return null;
  const start = parseDate(startProp, ctx.timeZone, calendarTz);
  if (!start) return null;
  const endProp = get("DTEND");
  const end = endProp ? parseDate(endProp, ctx.timeZone, calendarTz) : null;
  const due = start.date;
  if (due.getTime() < ctx.now.getTime() - PAST_WINDOW_MS || due.getTime() > ctx.now.getTime() + FUTURE_WINDOW_MS) return null;

  const summary = unescapeText(get("SUMMARY")?.value ?? "") || "Untitled event";
  const bracket = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(summary);
  const title = bracket && bracket[1] ? bracket[1].trim() : summary;
  const category = unescapeText(get("CATEGORIES")?.value.split(",")[0] ?? "");
  const courseName = (bracket && bracket[1] ? bracket[2].trim() : "") || category || ctx.defaultCourse;
  const description = unescapeText(get("DESCRIPTION")?.value ?? "") || null;
  const rawUrl = (get("URL")?.value ?? "").trim();
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : null;
  const uid = (get("UID")?.value ?? "").trim() || hashKey(`${summary}|${due.toISOString()}`);

  const multiDay = start.allDay && !!end && end.date.getTime() - due.getTime() > 86_400_000;
  const zeroLength = !end || end.date.getTime() === due.getTime();
  return {
    key: `ics:${uid}`,
    uid,
    title,
    courseName,
    description: description ? description.slice(0, 5000) : null,
    dueDate: due,
    link: url,
    kind: classifyEvent({ title, url, uid, recurring: !!get("RRULE") || !!get("RECURRENCE-ID"), multiDay, zeroLength }),
  };
}
