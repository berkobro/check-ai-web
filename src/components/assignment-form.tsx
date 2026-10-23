import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseLocalDateTime, toLocalInputValue } from "@/lib/dates";

export interface AssignmentFields {
  title: string;
  courseName: string;
  dueDate: string | null;
  description: string | null;
  link: string | null;
}

/** Shared by "Type it in" and Edit. Due dates are entered in the student's time zone. */
export function AssignmentForm({
  initial,
  courses,
  timeZone,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<AssignmentFields>;
  courses: string[];
  timeZone: string;
  submitLabel: string;
  onSubmit: (fields: AssignmentFields) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [course, setCourse] = useState(initial?.courseName ?? "");
  const [due, setDue] = useState(initial?.dueDate ? toLocalInputValue(initial.dueDate, timeZone) : "");
  const [details, setDetails] = useState(initial?.description ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !course.trim()) return setError("Add a title and a class.");
    let url: string | null = null;
    if (link.trim()) {
      try {
        const u = new URL(link.trim());
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
        url = u.toString();
      } catch {
        return setError("The link should start with https://");
      }
    }
    setError(null);
    onSubmit({
      title: title.trim(),
      courseName: course.trim(),
      dueDate: due ? (parseLocalDateTime(due, timeZone)?.toISOString() ?? null) : null,
      description: details.trim() || null,
      link: url,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-title`}>What&apos;s the assignment?</Label>
        <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 5 reading questions" maxLength={500} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-course`}>Class</Label>
        <Input id={`${id}-course`} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. AP Biology" list={`${id}-courses`} maxLength={200} required />
        <datalist id={`${id}-courses`}>
          {courses.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-due`}>Due ({timeZone.replace(/_/g, " ")})</Label>
        <Input id={`${id}-due`} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-details`}>Details from your teacher (optional)</Label>
        <Textarea id={`${id}-details`} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Requirements, length, chapters, rubric… The more detail, the better the study guide." className="min-h-24" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-link`}>Link (optional)</Label>
        <Input id={`${id}-link`} type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
      </div>
      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit">{submitLabel}</Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
