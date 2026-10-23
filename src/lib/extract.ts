import { z } from "zod";
import { parseLocalDateTime } from "@/lib/dates";
import { buildExtractionFixItPrompt } from "@/lib/prompts";
import { extractJson, formatIssues } from "@/lib/study-packet";
import { hashKey, type Candidate } from "./store";

// Browser copy of the full app's manual-extraction parsing (lib/sources/extraction.ts, which
// also holds server-only API code). Same reply shape as the shared extraction prompt asks for.

const itemSchema = z.object({
  courseName: z.string().trim().max(200).nullish(),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(20_000).nullish(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/, "Use YYYY-MM-DD or YYYY-MM-DDTHH:mm").nullish(),
  link: z.string().max(2000).nullish(),
});
const replySchema = z.object({ assignments: z.array(itemSchema).max(200) });

const norm = (s: string) => s.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();

function safeLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export type ExtractionResult = { ok: true; candidates: Candidate[] } | { ok: false; errors: string[]; fixPrompt: string };

/** Validate Claude's pasted list of assignments and turn it into review candidates. */
export function parseExtraction(text: string, ctx: { timeZone: string; defaultCourse: string }): ExtractionResult {
  const json = extractJson(text);
  if (!json.ok) return { ok: false, errors: [json.error], fixPrompt: buildExtractionFixItPrompt([json.error]) };
  const value = Array.isArray(json.value) ? { assignments: json.value } : json.value;
  const parsed = replySchema.safeParse(value);
  if (!parsed.success) {
    const errors = formatIssues(parsed.error);
    return { ok: false, errors, fixPrompt: buildExtractionFixItPrompt(errors) };
  }
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const item of parsed.data.assignments) {
    const courseName = item.courseName?.trim() || ctx.defaultCourse;
    const due = item.dueDate ? parseLocalDateTime(item.dueDate, ctx.timeZone) : null;
    const key = `x:${hashKey(`${norm(item.title)}|${norm(courseName)}|${due?.toISOString().slice(0, 10) ?? "none"}`)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ key, title: item.title.trim(), courseName, description: item.description?.trim() || null, dueDate: due?.toISOString() ?? null, link: safeLink(item.link), suggested: true });
  }
  return { ok: true, candidates };
}
