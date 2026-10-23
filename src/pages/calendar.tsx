import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { dayKey, formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CourseChip, DueChip, PageHeader, StateBadge } from "../components/bits";
import { courseColor } from "../lib/colors";
import { href } from "../lib/router";
import { assignmentState, type Assignment, type Data } from "../lib/store";

function monthDays(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });
}

export function CalendarPage({ data, now }: { data: Data; now: Date }) {
  const tz = data.settings.timeZone;
  const today = dayKey(now, tz);
  const [cursor, setCursor] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 });
  const [selected, setSelected] = useState(today);
  const byDay = useMemo(() => {
    const m = new Map<string, Assignment[]>();
    for (const a of data.assignments) {
      if (!a.dueDate) continue;
      const k = dayKey(a.dueDate, tz);
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  }, [data.assignments, tz]);
  const days = monthDays(cursor.year, cursor.month);
  const title = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(cursor.year, cursor.month, 1)));
  const move = (n: number) => setCursor(({ year, month }) => ({ year: month + n < 0 ? year - 1 : month + n > 11 ? year + 1 : year, month: (month + n + 12) % 12 }));
  const goToday = () => {
    setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 });
    setSelected(today);
  };
  const list = byDay.get(selected) ?? [];
  const undated = data.assignments.filter((a) => !a.dueDate).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" subtitle={undated ? `${undated} assignment${undated === 1 ? " has" : "s have"} no due date and aren't shown here.` : "Tap a day to see what's due."} />
      <div className="rounded-2xl border bg-card p-3 shadow-xs sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-lg font-semibold">{title}</h2>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => move(-1)} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs" role="grid" aria-label={title}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1 text-center font-medium text-muted-foreground" role="columnheader">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const key = d.toISOString().slice(0, 10);
            const items = byDay.get(key) ?? [];
            const inMonth = d.getUTCMonth() === cursor.month;
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-selected={selected === key}
                aria-label={`${formatDay(`${key}T12:00:00Z`, "UTC")}: ${items.length} due`}
                onClick={() => setSelected(key)}
                className={cn(
                  "flex min-h-14 flex-col gap-1 rounded-lg border p-1.5 text-left transition hover:border-primary/40 sm:min-h-24",
                  !inMonth && "border-transparent bg-muted/40 text-muted-foreground",
                  selected === key && "border-primary ring-2 ring-primary/30",
                )}
              >
                <span className={cn("flex size-6 items-center justify-center rounded-full tabular-nums", key === today && "bg-primary font-semibold text-primary-foreground")}>{d.getUTCDate()}</span>
                <span className="hidden flex-col gap-0.5 sm:flex">
                  {items.slice(0, 3).map((a) => (
                    <span key={a.id} className={cn("truncate rounded px-1 py-0.5 text-[11px]", courseColor(a.courseName).chip)}>
                      {a.title}
                    </span>
                  ))}
                  {items.length > 3 && <span className="text-[11px] text-muted-foreground">+{items.length - 3} more</span>}
                </span>
                {items.length > 0 && (
                  <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                    {items.slice(0, 4).map((a) => (
                      <span key={a.id} className={cn("size-1.5 rounded-full", courseColor(a.courseName).dot)} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section aria-live="polite" className="space-y-2">
        <h2 className="font-semibold">Due {formatDay(`${selected}T12:00:00Z`, "UTC")}</h2>
        {list.length ? (
          <ul className="space-y-2">
            {list.map((a) => (
              <li key={a.id}>
                <a href={href(`/guides?open=${a.id}`)} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{a.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <CourseChip name={a.courseName} />
                      <DueChip due={a.dueDate} timeZone={tz} now={now} />
                    </span>
                  </span>
                  <StateBadge state={assignmentState(a, now.getTime())} />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing due this day.</p>
        )}
      </section>
    </div>
  );
}
