import { addDays, localDate } from "@/lib/dates";
import { buildBatchManualPrompt, buildFixItPrompt, buildManualPrompt, MAX_BATCH, type AssignmentInput } from "@/lib/prompts";
import { batchReplySchema, checkPacket, extractJson, formatIssues } from "@/lib/study-packet";
import { assignmentState, getData, savePacket, type Assignment } from "./store";

/** Pasted answers may arrive a day or two after the prompt was copied (same grace as the full app). */
const GRACE_DAYS = 3;

export function toInput(a: Assignment, timeZone: string): AssignmentInput {
  return { title: a.title, description: a.description, courseName: a.courseName, dueDate: a.dueDate ? new Date(a.dueDate) : null, timeZone };
}

export const promptFor = (a: Assignment, timeZone: string) => buildManualPrompt(toInput(a, timeZone));

/** Up to 5 assignments still waiting for a study guide, soonest due first. */
export function batchFor(assignments: Assignment[], timeZone: string) {
  const waiting = assignments
    .filter((a) => assignmentState(a) === "needs_guide")
    .sort((x, y) => (x.dueDate ? Date.parse(x.dueDate) : Infinity) - (y.dueDate ? Date.parse(y.dueDate) : Infinity))
    .slice(0, MAX_BATCH);
  return { ids: waiting.map((a) => a.id), prompt: waiting.length ? buildBatchManualPrompt(waiting.map((a) => ({ id: a.id, input: toInput(a, timeZone) })), timeZone) : "" };
}

export interface PasteResult {
  saved: number;
  errors: string[];
  fixPrompt?: string;
}

/** Validate a pasted Claude reply (one packet, or the "Copy all new" array) and save it. */
export function applyPacketReply(text: string, assignmentId?: string): PasteResult {
  const { assignments, settings } = getData();
  const json = extractJson(text);
  if (!json.ok) return { saved: 0, errors: [json.error], fixPrompt: buildFixItPrompt([json.error], !assignmentId) };

  let entries: Array<{ assignmentId: string; packet: unknown }>;
  const batch = Array.isArray(json.value);
  if (batch) {
    const parsed = batchReplySchema.safeParse(json.value);
    if (!parsed.success) {
      const errors = formatIssues(parsed.error);
      return { saved: 0, errors, fixPrompt: buildFixItPrompt(errors, true) };
    }
    entries = assignmentId ? parsed.data.filter((e) => e.assignmentId === assignmentId) : parsed.data;
    if (!entries.length) return { saved: 0, errors: ["That answer is for other assignments. Paste it in the “Copy all new” box on the Overview page."] };
  } else if (assignmentId) {
    entries = [{ assignmentId, packet: json.value }];
  } else {
    return { saved: 0, errors: ["This looks like a single study guide. Paste it into that assignment's own box on the Guides page."] };
  }

  const today = localDate(new Date(), settings.timeZone);
  const errors: string[] = [];
  let saved = 0;
  for (const entry of entries) {
    const a = assignments.find((x) => x.id === entry.assignmentId);
    const label = batch && !assignmentId ? `${a?.title ?? entry.assignmentId} — ` : "";
    if (!a) {
      errors.push(`${label}No assignment with id "${entry.assignmentId}" on this device`);
      continue;
    }
    const check = checkPacket(entry.packet, { timeZone: settings.timeZone, dueDate: a.dueDate ? new Date(a.dueDate) : null, earliestDate: addDays(today, -GRACE_DAYS) }, label);
    if (!check.ok) {
      errors.push(...check.errors);
      continue;
    }
    savePacket(a.id, check.packet);
    saved++;
  }
  return { saved, errors, ...(errors.length ? { fixPrompt: buildFixItPrompt(errors, batch && !assignmentId) } : {}) };
}
