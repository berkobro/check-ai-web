import { AlertCircle, CheckCircle2, Clock, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dueLabel, formatDue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { courseColor } from "../lib/colors";
import type { AssignmentState } from "../lib/store";

export function CourseChip({ name, className }: { name: string; className?: string }) {
  const c = courseColor(name);
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", c.chip, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", c.dot)} aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** "Due tomorrow · Thu, Oct 22, 11:59 PM", tinted by urgency. */
export function DueChip({ due, timeZone, now }: { due: string | null; timeZone: string; now: Date }) {
  if (!due) return <span className="text-xs text-muted-foreground">No due date</span>;
  const ms = Date.parse(due) - now.getTime();
  const tone = ms < 0 ? "text-red-700 dark:text-red-400" : ms < 2 * 86_400_000 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", tone)} title={formatDue(due, timeZone)}>
      <Clock className="size-3.5" aria-hidden />
      {dueLabel(due, timeZone, now)} · {formatDue(due, timeZone)}
    </span>
  );
}

const STATE = {
  needs_guide: { label: "Needs a study guide", icon: Sparkles, cls: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100" },
  ready: { label: "Study guide ready", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" },
  outdated: { label: "Changed — refresh guide", icon: RefreshCw, cls: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100" },
  past: { label: "Past due", icon: AlertCircle, cls: "bg-muted text-muted-foreground" },
} as const;

export function StateBadge({ state }: { state: AssignmentState }) {
  const s = STATE[state];
  return (
    <Badge className={cn("border-transparent", s.cls)}>
      <s.icon aria-hidden /> {s.label}
    </Badge>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:size-7">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
