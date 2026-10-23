import { SearchX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseLocalDateTime, toLocalInputValue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader } from "../components/bits";
import { href, navigate } from "../lib/router";
import { applyReview, discardReview, type Candidate, type Data, type Review } from "../lib/store";

interface Row extends Candidate {
  include: boolean;
  localDue: string;
}

function Editor({ review, timeZone }: { review: Review; timeZone: string }) {
  const [rows, setRows] = useState<Row[]>(() => review.candidates.map((c) => ({ ...c, include: c.suggested, localDue: c.dueDate ? toLocalInputValue(c.dueDate, timeZone) : "" })));
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const selected = rows.filter((r) => r.include).length;

  function save() {
    if (rows.some((r) => r.include && (!r.title.trim() || !r.courseName.trim()))) return toast.error("Every checked item needs a title and a class.");
    const result = applyReview(
      review.id,
      rows.map((r) => ({ ...r, title: r.title.trim(), courseName: r.courseName.trim(), description: r.description?.trim() || null, dueDate: r.localDue ? (parseLocalDateTime(r.localDue, timeZone)?.toISOString() ?? null) : null })),
    );
    toast.success(`Saved ${result.added} assignment${result.added === 1 ? "" : "s"}. Next: make study guides!`);
    navigate("/guides");
  }

  return (
    <div className="space-y-3">
      {review.note && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{review.note}</p>}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {selected} of {rows.length} selected
        </span>
        <Button size="sm" variant="ghost" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: true })))}>
          Select all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: false })))}>
          Select none
        </Button>
      </div>
      {rows.map((r, i) => (
        <Card key={r.key} className={cn("gap-0 py-4 transition", !r.include && "opacity-60")}>
          <CardContent className="space-y-3 px-4">
            <div className="flex items-center gap-2">
              <Checkbox id={`inc-${i}`} checked={r.include} onCheckedChange={(v) => set(i, { include: v === true })} aria-label={`Include ${r.title}`} />
              <Label htmlFor={`inc-${i}`} className="text-sm font-normal text-muted-foreground">
                {r.include ? "Will be saved" : "Won't be saved (and won't be suggested again)"}
              </Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`title-${i}`}>Title</Label>
                <Input id={`title-${i}`} value={r.title} onChange={(e) => set(i, { title: e.target.value })} disabled={!r.include} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`course-${i}`}>Class</Label>
                <Input id={`course-${i}`} value={r.courseName} onChange={(e) => set(i, { courseName: e.target.value })} disabled={!r.include} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`due-${i}`}>Due ({timeZone.replace(/_/g, " ")})</Label>
                <Input id={`due-${i}`} type="datetime-local" value={r.localDue} onChange={(e) => set(i, { localDue: e.target.value })} disabled={!r.include} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`desc-${i}`}>Details</Label>
                <Textarea id={`desc-${i}`} value={r.description ?? ""} onChange={(e) => set(i, { description: e.target.value })} disabled={!r.include} className="min-h-12" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="sticky bottom-24 z-30 flex flex-wrap gap-2 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:bottom-4">
        <Button onClick={save}>
          Save {selected} assignment{selected === 1 ? "" : "s"}
        </Button>
        <Button variant="ghost" onClick={() => (discardReview(review.id), toast.info("Discarded. Nothing was saved."), navigate("/add"))}>
          Discard all
        </Button>
      </div>
    </div>
  );
}

export function ReviewPage({ data, id }: { data: Data; id: string }) {
  const review = data.reviews.find((r) => r.id === id);
  if (!review) {
    return (
      <EmptyState icon={<SearchX />} title="This review is finished">
        <p>It was already saved or discarded.</p>
        <Button asChild variant="outline" className="mt-4">
          <a href={href("/guides")}>Go to guides</a>
        </Button>
      </EmptyState>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader title={`Review: ${review.sourceLabel}`} subtitle="Fix titles or dates and uncheck anything that isn't an assignment. Nothing is saved until you press Save." />
      {review.candidates.length ? (
        <Editor review={review} timeZone={data.settings.timeZone} />
      ) : (
        <EmptyState icon={<SearchX />} title="No new assignments found">
          Everything here is already saved, or you removed it before.
        </EmptyState>
      )}
    </div>
  );
}
