import { useSyncExternalStore } from "react";
import { z } from "zod";
import { studyPacketSchema, type StudyPacketContent } from "@/lib/study-packet";

// Everything lives in this browser (localStorage). There is no server: export a backup
// from Settings to move data to another device.

const STORAGE_KEY = "check-ai:static:v1";

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");

const packetSchema = z.object({
  content: studyPacketSchema,
  completedTaskIds: z.array(z.string()),
  savedAt: isoDate,
  /** Assignment.updatedAt when the packet was made; an older value means the assignment changed since. */
  basedOn: isoDate,
});

export const assignmentSchema = z.object({
  id: z.string(),
  /** Stable identity for dedupe across imports: "manual:<id>", "ics:<uid>", "x:<hash>". */
  key: z.string(),
  title: z.string(),
  courseName: z.string(),
  description: z.string().nullable(),
  dueDate: isoDate.nullable(),
  link: z.string().nullable(),
  source: z.enum(["manual", "syllabus", "calendar"]),
  sourceLabel: z.string(),
  packet: packetSchema.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type Assignment = z.infer<typeof assignmentSchema>;

export const candidateSchema = z.object({
  key: z.string(),
  title: z.string(),
  courseName: z.string(),
  description: z.string().nullable(),
  dueDate: isoDate.nullable(),
  link: z.string().nullable(),
  /** Calendar events the keyword rules couldn't classify start unchecked. */
  suggested: z.boolean().default(true),
});
export type Candidate = z.infer<typeof candidateSchema>;

const reviewSchema = z.object({
  id: z.string(),
  source: z.enum(["syllabus", "calendar"]),
  sourceLabel: z.string(),
  candidates: z.array(candidateSchema),
  note: z.string().nullable().default(null),
  createdAt: isoDate,
});
export type Review = z.infer<typeof reviewSchema>;

const settingsSchema = z.object({
  timeZone: z.string(),
  theme: z.enum(["system", "light", "dark"]),
  name: z.string().max(60).default(""),
});
export type Settings = z.infer<typeof settingsSchema>;

export const dataSchema = z.object({
  version: z.literal(1),
  assignments: z.array(assignmentSchema),
  reviews: z.array(reviewSchema),
  /** Keys the user removed; imports never re-add them. */
  dismissed: z.array(z.string()),
  settings: settingsSchema,
});
export type Data = z.infer<typeof dataSchema>;

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const empty = (): Data => ({ version: 1, assignments: [], reviews: [], dismissed: [], settings: { timeZone: browserTimeZone(), theme: "system", name: "" } });

function load(): Data {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = dataSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : empty();
  } catch {
    return empty();
  }
}

let state: Data = load();
const listeners = new Set<() => void>();
let saveError = false;

function emit() {
  for (const l of listeners) l();
}

function commit(next: Data) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    saveError = false;
  } catch {
    saveError = true; // private mode / storage full: keep working in memory
  }
  emit();
}

function update(fn: (d: Data) => Data) {
  commit(fn(state));
}

// Keep other open tabs in sync.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      emit();
    }
  });
}

export function useData(): Data {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export const storageFailed = () => saveError;
export const getData = () => state;

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const nowIso = () => new Date().toISOString();

/** Small stable hash (cyrb53) for dedupe keys; not for security. */
export function hashKey(text: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export type AssignmentState = "needs_guide" | "ready" | "outdated" | "past";

export function assignmentState(a: Assignment, now = Date.now()): AssignmentState {
  if (a.packet) return Date.parse(a.packet.basedOn) < Date.parse(a.updatedAt) ? "outdated" : "ready";
  if (a.dueDate && Date.parse(a.dueDate) < now) return "past";
  return "needs_guide";
}

export interface NewAssignment {
  key?: string;
  title: string;
  courseName: string;
  description: string | null;
  dueDate: string | null;
  link: string | null;
  source: Assignment["source"];
  sourceLabel: string;
}

/**
 * Add assignments with the same dedupe rules as the full app: a known key is updated in
 * place when its details changed (its study guide then shows as outdated), removed keys are
 * never re-added, and new keys are created. Returns counts.
 */
export function upsertAssignments(items: NewAssignment[]) {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  update((d) => {
    const dismissed = new Set(d.dismissed);
    const byKey = new Map(d.assignments.map((a) => [a.key, a]));
    const next = [...d.assignments];
    for (const item of items) {
      const id = newId();
      const key = item.key ?? `manual:${id}`;
      if (dismissed.has(key)) {
        skipped++;
        continue;
      }
      const existing = byKey.get(key);
      if (existing) {
        const changed =
          existing.title !== item.title || existing.description !== item.description || existing.dueDate !== item.dueDate || existing.courseName !== item.courseName || existing.link !== item.link;
        if (!changed) {
          skipped++;
          continue;
        }
        const i = next.findIndex((a) => a.id === existing.id);
        next[i] = { ...existing, ...item, key, updatedAt: nowIso() };
        updated++;
        continue;
      }
      const at = nowIso();
      const created: Assignment = { id, key, ...item, packet: null, createdAt: at, updatedAt: at };
      next.push(created);
      byKey.set(key, created);
      added++;
    }
    return { ...d, assignments: next };
  });
  return { added, updated, skipped };
}

export function editAssignment(id: string, patch: Partial<Pick<Assignment, "title" | "courseName" | "description" | "dueDate" | "link">>) {
  update((d) => ({
    ...d,
    assignments: d.assignments.map((a) => {
      if (a.id !== id) return a;
      const changed = (Object.keys(patch) as Array<keyof typeof patch>).some((k) => patch[k] !== a[k]);
      // Only a real change marks the study guide as out of date.
      return changed ? { ...a, ...patch, updatedAt: nowIso() } : a;
    }),
  }));
}

/** Remove an assignment; imports won't bring it back. */
export function removeAssignment(id: string) {
  update((d) => {
    const a = d.assignments.find((x) => x.id === id);
    return { ...d, assignments: d.assignments.filter((x) => x.id !== id), dismissed: a ? [...new Set([...d.dismissed, a.key])] : d.dismissed };
  });
}

export function savePacket(id: string, content: StudyPacketContent) {
  update((d) => ({
    ...d,
    assignments: d.assignments.map((a) => (a.id === id ? { ...a, packet: { content, completedTaskIds: [], savedAt: nowIso(), basedOn: a.updatedAt } } : a)),
  }));
}

export function toggleTask(id: string, taskId: string, done: boolean) {
  update((d) => ({
    ...d,
    assignments: d.assignments.map((a) => {
      if (a.id !== id || !a.packet) return a;
      const set = new Set(a.packet.completedTaskIds);
      if (done) set.add(taskId);
      else set.delete(taskId);
      return { ...a, packet: { ...a.packet, completedTaskIds: [...set] } };
    }),
  }));
}

/** Stage extracted/imported items for review; drops ones already saved or removed. */
export function createReview(source: Review["source"], sourceLabel: string, candidates: Candidate[], note: string | null = null): { id: string; count: number } {
  const known = new Set([...state.assignments.map((a) => a.key), ...state.dismissed]);
  const fresh = candidates.filter((c) => !known.has(c.key));
  // Nothing new to look at: don't leave an empty review behind.
  if (!fresh.length) return { id: "", count: 0 };
  const review: Review = { id: newId(), source, sourceLabel, candidates: fresh, note, createdAt: nowIso() };
  update((d) => ({ ...d, reviews: [review, ...d.reviews] }));
  return { id: review.id, count: fresh.length };
}

export function applyReview(id: string, decisions: Array<Candidate & { include: boolean }>) {
  const review = state.reviews.find((r) => r.id === id);
  if (!review) return { added: 0 };
  const accepted = decisions.filter((c) => c.include);
  const removed = decisions.filter((c) => !c.include).map((c) => c.key);
  const result = upsertAssignments(
    accepted.map((c) => ({ key: c.key, title: c.title, courseName: c.courseName, description: c.description, dueDate: c.dueDate, link: c.link, source: review.source, sourceLabel: review.sourceLabel })),
  );
  update((d) => ({ ...d, reviews: d.reviews.filter((r) => r.id !== id), dismissed: [...new Set([...d.dismissed, ...removed])] }));
  return result;
}

export function discardReview(id: string) {
  update((d) => ({ ...d, reviews: d.reviews.filter((r) => r.id !== id) }));
}

export function updateSettings(patch: Partial<Settings>) {
  update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
}

export function exportBackup(): string {
  return JSON.stringify({ ...state, exportedAt: nowIso() }, null, 2);
}

export function importBackup(text: string): { ok: true; count: number } | { ok: false; error: string } {
  try {
    const parsed = dataSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return { ok: false, error: "That file isn't a Check AI backup (or it's damaged)." };
    commit(parsed.data);
    return { ok: true, count: parsed.data.assignments.length };
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
}

export function clearAll() {
  commit({ ...empty(), settings: state.settings });
}
