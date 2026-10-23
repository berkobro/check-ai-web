import { Checkbox } from "@/components/ui/checkbox";
import { formatDay } from "@/lib/format";
import type { ActionPlan } from "@/lib/study-packet";
import { cn } from "@/lib/utils";
import { toggleTask } from "../lib/store";

/** The action plan as a checklist; progress is saved on this device. */
export function Checklist({ assignmentId, plan, completed }: { assignmentId: string; plan: ActionPlan; completed: string[] }) {
  const done = new Set(completed);
  const total = plan.days.reduce((n, d) => n + d.tasks.length, 0);
  const pct = total ? Math.round((done.size / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-sm">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.size} aria-label="Plan progress">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="tabular-nums text-muted-foreground">
          {done.size}/{total} done
        </span>
      </div>
      <ul className="space-y-1.5">
        {plan.days.flatMap((day) =>
          day.tasks.map((t) => {
            const id = `${assignmentId}-${t.id}`;
            return (
              <li key={t.id} className="flex items-start gap-2.5">
                <Checkbox id={id} checked={done.has(t.id)} onCheckedChange={(v) => toggleTask(assignmentId, t.id, v === true)} className="mt-0.5" />
                <label htmlFor={id} className={cn("text-sm leading-snug", done.has(t.id) && "text-muted-foreground line-through")}>
                  <span className="text-muted-foreground">
                    {formatDay(`${day.date}T12:00:00Z`, "UTC")} · {t.timeBlock} —{" "}
                  </span>
                  {t.title}
                </label>
              </li>
            );
          }),
        )}
      </ul>
    </div>
  );
}
