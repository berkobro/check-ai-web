import { ArrowRight, CalendarPlus, ClipboardList, FileText, ListChecks, PenLine, Sparkles, Target } from "lucide-react";
import { CopyToClaudeButton } from "@/components/manual/copy-to-claude-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_BATCH } from "@/lib/prompts";
import { cn } from "@/lib/utils";
import { CourseChip, DueChip, StateBadge } from "../components/bits";
import { PasteBox } from "../components/paste-box";
import { courseColor } from "../lib/colors";
import { applyPacketReply, batchFor } from "../lib/packets";
import { href } from "../lib/router";
import { assignmentState, type Data } from "../lib/store";

function greeting(now: Date, timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const WAYS = [
  { to: "/add/manual", icon: PenLine, title: "Type it in", text: "Add an assignment and its details in a few seconds." },
  { to: "/add/syllabus", icon: FileText, title: "Paste a syllabus", text: "Claude finds every assignment and due date; you review the list." },
  { to: "/add/calendar", icon: CalendarPlus, title: "Import a calendar", text: "Upload the .ics calendar file from Canvas, Schoology, Google, Outlook…" },
];

function Welcome() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 px-6 py-10 text-white shadow-lg sm:px-10 sm:py-14">
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <p className="text-sm font-medium text-indigo-100">Welcome to Check AI</p>
        <h1 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">All your assignments in one place, with a study plan for each.</h1>
        <p className="mt-3 max-w-xl text-indigo-100">
          Add your work, then let Claude turn each assignment into a summary, a day-by-day schedule, a study guide, a practice quiz and flashcards — using your own Claude account.
        </p>
        <Button asChild size="lg" variant="secondary" className="mt-6 bg-white text-indigo-700 hover:bg-indigo-50">
          <a href={href("/add")}>
            Add your first assignments <ArrowRight />
          </a>
        </Button>
      </section>

      <section aria-labelledby="ways">
        <h2 id="ways" className="mb-4 text-lg font-semibold">
          Three ways to add assignments
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {WAYS.map(({ to, icon: Icon, title, text }) => (
            <a key={to} href={href(to)} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <p className="mt-3 font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Start <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section aria-labelledby="how" className="rounded-2xl border bg-card p-6">
        <h2 id="how" className="text-lg font-semibold">
          How “Copy to Claude” works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ["Tap Copy to Claude", "The prompt is copied and Claude opens in a new tab (or the Claude app on your phone)."],
            ["Paste and send", "Paste into Claude and send. Claude replies with one code block."],
            ["Paste the answer back", "Copy Claude's code block and paste it here. Your study guide is ready."],
          ].map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
              <span>
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={cn("flex size-7 items-center justify-center rounded-lg [&_svg]:size-4", tone)}>{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function OverviewPage({ data, now }: { data: Data; now: Date }) {
  const { assignments, reviews, settings } = data;
  if (!assignments.length && !reviews.length) return <Welcome />;
  const tz = settings.timeZone;
  const t = now.getTime();
  const weekEnd = t + 7 * 86_400_000;

  const upcoming = assignments
    .filter((a) => !a.dueDate || Date.parse(a.dueDate) >= t - 86_400_000)
    .sort((x, y) => (x.dueDate ? Date.parse(x.dueDate) : Infinity) - (y.dueDate ? Date.parse(y.dueDate) : Infinity));
  const dueThisWeek = assignments.filter((a) => a.dueDate && Date.parse(a.dueDate) >= t && Date.parse(a.dueDate) <= weekEnd).length;
  const needs = assignments.filter((a) => assignmentState(a, t) === "needs_guide").length;
  const ready = assignments.filter((a) => assignmentState(a, t) === "ready").length;
  const tasks = assignments.reduce(
    (acc, a) => {
      if (!a.packet) return acc;
      acc.total += a.packet.content.actionPlan.days.reduce((n, d) => n + d.tasks.length, 0);
      acc.done += a.packet.completedTaskIds.length;
      return acc;
    },
    { done: 0, total: 0 },
  );
  const batch = batchFor(assignments, tz);
  const dateLine = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(now);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 px-6 py-7 text-white shadow-lg sm:px-8">
        <p className="text-sm text-indigo-100">{dateLine}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting(now, tz)}
          {settings.name ? `, ${settings.name}` : ""}!
        </h1>
        <p className="mt-2 text-indigo-100">
          {dueThisWeek ? `${dueThisWeek} assignment${dueThisWeek === 1 ? "" : "s"} due in the next 7 days` : "Nothing due in the next 7 days"}
          {needs ? ` · ${needs} waiting for a study guide` : ""}.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <Stat icon={<Target />} label="Due this week" value={dueThisWeek} tone="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" />
        <Stat icon={<Sparkles />} label="Need a guide" value={needs} tone="bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" />
        <Stat icon={<ClipboardList />} label="Guides ready" value={ready} tone="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" />
        <Stat
          icon={<ListChecks />}
          label="Plan progress"
          value={tasks.total ? `${Math.round((tasks.done / tasks.total) * 100)}%` : "—"}
          hint={tasks.total ? `${tasks.done} of ${tasks.total} tasks` : "Make a study guide to start"}
          tone="bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200"
        />
      </section>

      {reviews.map((r) => (
        <a key={r.id} href={href(`/review/${r.id}`)} className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-accent/60 p-4 transition hover:bg-accent">
          <ClipboardList className="size-5 shrink-0 text-primary" />
          <span className="flex-1 text-sm">
            <span className="font-medium">
              {r.candidates.length} item{r.candidates.length === 1 ? "" : "s"} from {r.sourceLabel} to review
            </span>
            <span className="block text-muted-foreground">Nothing is saved until you check the list.</span>
          </span>
          <ArrowRight className="size-4 text-primary" />
        </a>
      ))}

      {batch.ids.length > 1 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> {needs} assignments are waiting for study guides
            </CardTitle>
            <CardDescription>Do up to {MAX_BATCH} at once: copy them into one Claude chat, then paste Claude&apos;s answer below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CopyToClaudeButton prompt={batch.prompt} label={`Copy all new (${batch.ids.length})`} />
            <PasteBox
              placeholder="Paste the JSON list Claude sent back…"
              onSubmit={(text) => {
                const r = applyPacketReply(text);
                return { ok: r.saved > 0, errors: r.errors, fixPrompt: r.fixPrompt, message: r.saved ? `Saved ${r.saved} study guide${r.saved === 1 ? "" : "s"}.` : undefined };
              }}
            />
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="next" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="next" className="text-lg font-semibold">
            Up next
          </h2>
          <Button asChild variant="ghost" size="sm">
            <a href={href("/guides")}>
              All guides <ArrowRight />
            </a>
          </Button>
        </div>
        {upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.slice(0, 6).map((a) => (
              <li key={a.id}>
                <a href={href(`/guides?open=${a.id}`)} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-xs transition hover:border-primary/40 hover:shadow-sm">
                  <span className={cn("h-10 w-1 shrink-0 rounded-full", courseColor(a.courseName).bar)} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <CourseChip name={a.courseName} />
                      <DueChip due={a.dueDate} timeZone={tz} now={now} />
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <StateBadge state={assignmentState(a, t)} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing coming up. 🎉</p>
        )}
      </section>
    </div>
  );
}
