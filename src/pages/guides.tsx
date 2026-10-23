import { BookOpenCheck, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AssignmentCard } from "../components/assignment-card";
import { EmptyState, PageHeader } from "../components/bits";
import { courseColor } from "../lib/colors";
import { href } from "../lib/router";
import { assignmentState, type Assignment, type Data } from "../lib/store";

const DAY = 86_400_000;
const FILTERS = {
  todo: { label: "To do", test: (a: Assignment, t: number) => assignmentState(a, t) !== "ready" && (!a.dueDate || Date.parse(a.dueDate) >= t - DAY) },
  ready: { label: "Ready", test: (a: Assignment, t: number) => assignmentState(a, t) === "ready" },
  upcoming: { label: "Upcoming", test: (a: Assignment, t: number) => !a.dueDate || Date.parse(a.dueDate) >= t - DAY },
  past: { label: "Past", test: (a: Assignment, t: number) => !!a.dueDate && Date.parse(a.dueDate) < t - DAY },
  all: { label: "All", test: () => true },
} as const;
type FilterKey = keyof typeof FILTERS;

export function GuidesPage({ data, now, openId }: { data: Data; now: Date; openId: string | null }) {
  const t = now.getTime();
  const tz = data.settings.timeZone;
  const focus = openId && data.assignments.some((a) => a.id === openId) ? openId : null;
  const [chosen, setFilter] = useState<FilterKey | null>(null);
  const filter: FilterKey = chosen ?? (focus ? "all" : "upcoming");
  const [course, setCourse] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const courses = useMemo(() => [...new Set(data.assignments.map((a) => a.courseName))].sort(), [data.assignments]);

  useEffect(() => {
    if (focus) requestAnimationFrame(() => document.getElementById(focus)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [focus]);

  const sorted = [...data.assignments].sort((x, y) => (x.dueDate ? Date.parse(x.dueDate) : Infinity) - (y.dueDate ? Date.parse(y.dueDate) : Infinity));
  const q = query.trim().toLowerCase();
  const base = sorted.filter((a) => (!course || a.courseName === course) && (!q || `${a.title} ${a.courseName} ${a.description ?? ""}`.toLowerCase().includes(q)));
  const shown = base.filter((a) => FILTERS[filter].test(a, t));

  if (!data.assignments.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Study guides" />
        <EmptyState icon={<BookOpenCheck />} title="No assignments yet">
          <p>Each assignment you add gets a summary, a day-by-day plan, a study guide, a quiz and flashcards.</p>
          <Button asChild className="mt-4">
            <a href={href("/add")}>
              <Plus /> Add assignments
            </a>
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Study guides" subtitle="Every assignment, its plan, and its study materials." />

      <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-xs">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assignments" className="pl-9" aria-label="Search assignments" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {FILTERS[k].label}
              <span className={cn("tabular-nums", filter === k ? "opacity-80" : "text-muted-foreground")}>{base.filter((a) => FILTERS[k].test(a, t)).length}</span>
            </Button>
          ))}
        </div>
        {courses.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by class">
            <button type="button" onClick={() => setCourse(null)} aria-pressed={!course} className={cn("rounded-full border px-3 py-1 text-xs", !course ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>
              All classes
            </button>
            {courses.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCourse(course === c ? null : c)}
                aria-pressed={course === c}
                className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", course === c ? "border-primary bg-accent font-medium" : "hover:bg-accent")}
              >
                <span className={cn("size-2 rounded-full", courseColor(c).dot)} aria-hidden /> {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {shown.map((a) => (
          <AssignmentCard key={a.id} a={a} timeZone={tz} now={now} courses={courses} defaultOpen={focus === a.id} />
        ))}
        {!shown.length && <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nothing matches these filters.</p>}
      </div>
    </div>
  );
}
