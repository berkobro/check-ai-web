import { z } from "zod";
import { localDate } from "@/lib/dates";

// Shared by the AI engine (validating Claude's tool input), the DB layer and the UI.
// Count limits are enforced here rather than in the JSON schema: strict tool schemas
// don't support array-length constraints, and a failed check triggers a retry.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const planTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  timeBlock: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(480),
});

export const actionPlanSchema = z.object({
  assumedDefaultTimeline: z.boolean(),
  note: z.string(),
  days: z
    .array(
      z.object({
        date: isoDate,
        focus: z.string().min(1),
        tasks: z.array(planTaskSchema).min(1),
      }),
    )
    .min(1),
});

export const studyGuideSchema = z.object({
  sections: z
    .array(z.object({ heading: z.string().min(1), points: z.array(z.string().min(1)).min(1) }))
    .min(1),
});

const quizItem = z.object({ question: z.string().min(1), answer: z.string().min(1), explanation: z.string() });
const flashcard = z.object({ term: z.string().min(1), definition: z.string().min(1) });

// Extra items past the maximum are trimmed rather than costing a retry.
export const practiceQuizSchema = z.array(quizItem).min(3).transform((q) => q.slice(0, 5));
export const flashcardsSchema = z.array(flashcard).min(5).transform((f) => f.slice(0, 10));

export const studyPacketSchema = z.object({
  summary: z.string().min(1),
  actionPlan: actionPlanSchema,
  studyGuide: studyGuideSchema,
  practiceQuiz: practiceQuizSchema,
  flashcards: flashcardsSchema,
});

export type StudyPacketContent = z.output<typeof studyPacketSchema>;
export type ActionPlan = z.output<typeof actionPlanSchema>;
export type StudyGuide = z.output<typeof studyGuideSchema>;
export type QuizItem = z.output<typeof quizItem>;
export type Flashcard = z.output<typeof flashcard>;

/** Claude's tool input omits task ids; assign stable ones for checklist progress. */
export const toolInputSchema = studyPacketSchema.extend({
  actionPlan: actionPlanSchema.extend({
    days: z
      .array(
        z.object({
          date: isoDate,
          focus: z.string().min(1),
          tasks: z.array(planTaskSchema.omit({ id: true })).min(1),
        }),
      )
      .min(1),
  }),
});

export function withTaskIds(input: z.output<typeof toolInputSchema>): StudyPacketContent {
  return {
    ...input,
    actionPlan: {
      ...input.actionPlan,
      days: input.actionPlan.days.map((day, d) => ({
        ...day,
        tasks: day.tasks.map((task, t) => ({ id: `d${d}-t${t}`, ...task })),
      })),
    },
  };
}

const str = { type: "string" } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/** JSON schema for the `create_study_packet` tool (strict mode compatible). */
export const studyPacketJsonSchema = obj({
  summary: { ...str, description: "2-4 sentence breakdown of what the assignment asks for and how it is assessed." },
  actionPlan: obj({
    assumedDefaultTimeline: {
      type: "boolean",
      description: "true when the assignment has no due date and you planned the 5-day default.",
    },
    note: { ...str, description: "One sentence about the plan; say so explicitly if the 5-day default was used." },
    days: {
      type: "array",
      description: "One entry per study day, from today through the due date, in chronological order.",
      items: obj({
        date: { ...str, description: "YYYY-MM-DD in the student's time zone." },
        focus: { ...str, description: "Short theme for the day." },
        tasks: {
          type: "array",
          items: obj({
            title: { ...str, description: "Concrete, checkable task." },
            timeBlock: { ...str, description: "Suggested local time window, e.g. '4:00 PM - 4:45 PM'." },
            durationMinutes: { type: "integer" },
          }),
        },
      }),
    },
  }),
  studyGuide: obj({
    sections: {
      type: "array",
      items: obj({
        heading: str,
        points: { type: "array", items: str, description: "Key concepts, formulas, or themes as bullets." },
      }),
    },
  }),
  practiceQuiz: {
    type: "array",
    description: "3-5 review questions.",
    items: obj({ question: str, answer: str, explanation: { ...str, description: "Why the answer is correct." } }),
  },
  flashcards: {
    type: "array",
    description: "5-10 term/definition pairs.",
    items: obj({ term: str, definition: str }),
  },
});

/** Parse a stored packet's JSON columns back into typed content (null if corrupt). */
export function parseStoredPacket(row: {
  summary: string;
  actionPlan: unknown;
  studyGuide: unknown;
  practiceQuiz: unknown;
  flashcards: unknown;
}): StudyPacketContent | null {
  const parsed = studyPacketSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Validation shared by API mode (tool input) and manual mode (pasted replies).

const SECTION_LABELS: Record<string, string> = {
  summary: "Summary",
  actionPlan: "Action plan",
  studyGuide: "Study guide",
  practiceQuiz: "Practice quiz",
  flashcards: "Flashcards",
};

/** "actionPlan.days.0.tasks" -> "Action plan › days[0] › tasks" so students can see which part broke. */
function describePath(path: PropertyKey[]): string {
  if (!path.length) return "Packet";
  return path
    .map((p, i) => (i === 0 && typeof p === "string" ? (SECTION_LABELS[p] ?? p) : typeof p === "number" ? `[${p}]` : String(p)))
    .join(" › ")
    .replace(/ › \[/g, "[");
}

/** Readable label for students, plus the JSON path so Claude knows exactly what to fix. */
export function formatIssues(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => {
    const raw = i.path.map(String).join(".");
    return `${prefix}${describePath(i.path)}${raw ? ` (${raw})` : ""}: ${i.message}`;
  });
}

export interface PacketCheckContext {
  timeZone: string;
  dueDate: Date | null;
  /** Earliest allowed plan date (YYYY-MM-DD). */
  earliestDate: string;
}

export type PacketCheck = { ok: true; packet: StudyPacketContent } | { ok: false; errors: string[] };

/** Schema check plus the date rules that depend on the assignment (today..due date). */
export function checkPacket(raw: unknown, ctx: PacketCheckContext, prefix = ""): PacketCheck {
  const parsed = toolInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error, prefix) };

  const due = ctx.dueDate ? localDate(ctx.dueDate, ctx.timeZone) : null;
  const dates = parsed.data.actionPlan.days.map((d) => d.date);
  const errors: string[] = [];
  dates.forEach((date, i) => {
    const where = `${prefix}Action plan › days[${i}] (actionPlan.days.${i}.date)`;
    if (date < ctx.earliestDate) errors.push(`${where}: date ${date} is before today (${ctx.earliestDate})`);
    if (due && date > due && due >= ctx.earliestDate) errors.push(`${where}: date ${date} is after the due date (${due})`);
    if (i > 0 && date < dates[i - 1]) errors.push(`${where}: dates must be in chronological order`);
  });
  if (!ctx.dueDate && !parsed.data.actionPlan.assumedDefaultTimeline) {
    errors.push(`${prefix}Action plan (actionPlan.assumedDefaultTimeline): must be true because there is no due date`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, packet: withTaskIds(parsed.data) };
}

/**
 * Pull the JSON value out of whatever the user pasted: a ```json fenced block, a bare
 * object/array, or JSON surrounded by Claude's chatter.
 */
export function extractJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "The answer box is empty. Paste Claude's reply first." };

  const candidates: string[] = [];
  for (const m of trimmed.matchAll(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/g)) candidates.push(m[1].trim());
  const start = trimmed.search(/[[{]/);
  if (start >= 0) {
    const close = trimmed[start] === "{" ? "}" : "]";
    const end = trimmed.lastIndexOf(close);
    // No closing bracket: keep the tail anyway so it fails as "cut off" below.
    candidates.push(end > start ? trimmed.slice(start, end + 1) : trimmed.slice(start));
  }
  if (!candidates.length) {
    return { ok: false, error: "Couldn't find any JSON in the pasted text. Copy Claude's code block (use its copy button)." };
  }

  let firstError = "";
  for (const c of candidates) {
    try {
      return { ok: true, value: JSON.parse(c) };
    } catch (err) {
      firstError ||= (err as Error).message;
    }
  }
  const truncated = !/[}\]]\s*(```)?\s*$/.test(trimmed);
  return {
    ok: false,
    error: truncated
      ? "The JSON looks cut off. Make sure you copied Claude's whole reply."
      : `The JSON couldn't be read (${firstError}).`,
  };
}

export const batchReplySchema = z.array(z.object({ assignmentId: z.string().min(1), packet: z.unknown() }));
