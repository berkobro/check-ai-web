import { ArrowLeft, CalendarPlus, ChevronDown, FileText, FileUp, PenLine } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CopyToClaudeButton } from "@/components/manual/copy-to-claude-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildManualExtractionPrompt, MAX_EXTRACTION_CHARS } from "@/lib/prompts";
import { cn } from "@/lib/utils";
import { AssignmentForm } from "../components/assignment-form";
import { PageHeader } from "../components/bits";
import { PasteBox } from "../components/paste-box";
import { parseExtraction } from "../lib/extract";
import { IcsError, parseIcs } from "../lib/ics";
import { href, navigate } from "../lib/router";
import { createReview, upsertAssignments, type Data } from "../lib/store";

const METHODS = [
  { to: "/add/manual", key: "manual", icon: PenLine, title: "Type it in", text: "One assignment at a time" },
  { to: "/add/syllabus", key: "syllabus", icon: FileText, title: "Paste a syllabus", text: "Claude finds the assignments" },
  { to: "/add/calendar", key: "calendar", icon: CalendarPlus, title: "Import a calendar", text: "Upload an .ics file" },
] as const;

function MethodTabs({ active }: { active: string }) {
  return (
    <nav className="grid grid-cols-3 gap-2" aria-label="How to add">
      {METHODS.map(({ to, key, icon: Icon, title, text }) => (
        <a
          key={key}
          href={href(to)}
          aria-current={active === key ? "page" : undefined}
          className={cn(
            "flex flex-col items-center gap-1 rounded-2xl border bg-card p-3 text-center shadow-xs transition hover:border-primary/40 sm:flex-row sm:gap-3 sm:p-4 sm:text-left",
            active === key && "border-primary bg-accent ring-2 ring-primary/20",
          )}
        >
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted", active === key && "bg-primary text-primary-foreground")}>
            <Icon className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-medium">{title}</span>
            <span className="hidden text-xs text-muted-foreground sm:block">{text}</span>
          </span>
        </a>
      ))}
    </nav>
  );
}

function ManualForm({ data }: { data: Data }) {
  const [formKey, setFormKey] = useState(0);
  const courses = useMemo(() => [...new Set(data.assignments.map((a) => a.courseName))].sort(), [data.assignments]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Type in an assignment</CardTitle>
        <CardDescription>Then make its study guide with Claude from the Guides page.</CardDescription>
      </CardHeader>
      <CardContent>
        <AssignmentForm
          key={formKey}
          courses={courses}
          timeZone={data.settings.timeZone}
          submitLabel="Add assignment"
          onSubmit={(fields) => {
            upsertAssignments([{ ...fields, source: "manual", sourceLabel: "Added by you" }]);
            setFormKey((k) => k + 1);
            toast.success(`Added “${fields.title}”.`, { action: { label: "View guides", onClick: () => navigate("/guides") } });
          }}
        />
      </CardContent>
    </Card>
  );
}

function SyllabusFlow({ data }: { data: Data }) {
  const tz = data.settings.timeZone;
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [attach, setAttach] = useState(false);
  const [fileName, setFileName] = useState("");
  const sourceLabel = label.trim() || "My syllabus";
  const ready = attach ? !!fileName.trim() : text.trim().length > 20;
  // Built during render so the click handler copies without awaiting anything (Safari/iOS).
  const prompt = useMemo(
    () => buildManualExtractionPrompt({ sourceLabel, text: attach ? null : text, fileName: attach ? fileName.trim() || "syllabus.pdf" : null, timeZone: tz }),
    [sourceLabel, text, attach, fileName, tz],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span> What should Claude read?
          </CardTitle>
          <CardDescription>A syllabus, assignment sheet, or class schedule. Claude lists only the assignments; you check them before anything is saved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="syl-label">Name (usually the class)</Label>
            <Input id="syl-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. AP U.S. History" maxLength={100} />
          </div>
          {!attach ? (
            <div className="space-y-1.5">
              <Label htmlFor="syl-text">Paste the text</Label>
              <Textarea id="syl-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the syllabus or schedule here…" className="min-h-40" />
              {text.length > MAX_EXTRACTION_CHARS && <p className="text-xs text-amber-700">Only the first {MAX_EXTRACTION_CHARS.toLocaleString()} characters will be sent.</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="syl-file">File name</Label>
              <Input id="syl-file" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="e.g. biology-syllabus.pdf" />
              <p className="text-xs text-muted-foreground">You&apos;ll attach the PDF or photo yourself in Claude after it opens — the file never comes to this site.</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="syl-attach" checked={attach} onCheckedChange={(v) => setAttach(v === true)} />
            <Label htmlFor="syl-attach" className="font-normal">
              <FileUp className="size-4" /> I have a PDF or photo instead
            </Label>
          </div>
          {ready ? (
            <CopyToClaudeButton prompt={prompt} />
          ) : (
            <div className="space-y-1">
              <Button disabled>Copy to Claude</Button>
              <p className="text-xs text-muted-foreground">{attach ? "Enter the file name first." : "Paste the syllabus text first."}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span> Paste Claude&apos;s list
          </CardTitle>
          <CardDescription>Next you&apos;ll review the assignments and fix anything before saving.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasteBox
            placeholder="Paste the JSON list Claude sent back…"
            onSubmit={(reply) => {
              const r = parseExtraction(reply, { timeZone: tz, defaultCourse: sourceLabel });
              if (!r.ok) return { ok: false, errors: r.errors, fixPrompt: r.fixPrompt };
              const review = createReview("syllabus", sourceLabel, r.candidates);
              if (!review.count) return { ok: true, message: "Everything Claude found is already saved." };
              navigate(`/review/${review.id}`);
              return { ok: true };
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

const CALENDAR_HELP: Array<[string, string]> = [
  ["Canvas", "Calendar → Calendar Feed → open the link in your browser to download the .ics file."],
  ["Google Calendar", "Settings → Import & export → Export (unzip, then pick the .ics file)."],
  ["Outlook", "Calendar → Share → Publish → copy the ICS link, open it to download the file."],
  ["Schoology / Blackboard / Brightspace / Moodle", "Open the calendar's export or iCal link in your browser — it downloads an .ics file."],
];

function CalendarImport({ data }: { data: Data }) {
  const tz = data.settings.timeZone;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 8 * 1024 * 1024) return setError("That file is over 8 MB.");
    setBusy(true);
    try {
      const label = file.name.replace(/\.ics$/i, "") || "Calendar";
      const events = parseIcs(await file.text(), { timeZone: tz, now: new Date(), defaultCourse: label });
      const keep = events.filter((e) => e.kind !== "not_assignment");
      const skipped = events.length - keep.length;
      // Already-saved events are updated in place (e.g. a teacher moved the date); new ones go to review.
      const known = new Set(data.assignments.map((a) => a.key));
      const changed = upsertAssignments(
        keep.filter((e) => known.has(e.key)).map((e) => ({ key: e.key, title: e.title, courseName: e.courseName, description: e.description, dueDate: e.dueDate.toISOString(), link: e.link, source: "calendar" as const, sourceLabel: label })),
      );
      const review = createReview(
        "calendar",
        label,
        keep.filter((e) => !known.has(e.key)).map((e) => ({ key: e.key, title: e.title, courseName: e.courseName, description: e.description, dueDate: e.dueDate.toISOString(), link: e.link, suggested: e.kind === "assignment" })),
        skipped ? `Skipped ${skipped} event${skipped === 1 ? "" : "s"} that look like class meetings or holidays. Unchecked items weren't clearly assignments.` : null,
      );
      if (changed.updated) toast.info(`Updated ${changed.updated} assignment${changed.updated === 1 ? "" : "s"} that changed.`);
      if (review.count) navigate(`/review/${review.id}`);
      else toast.success(events.length ? "No new assignments in that calendar." : "That calendar has no events in the next year.");
    } catch (err) {
      setError(err instanceof IcsError ? err.message : "Couldn't read that file. Make sure it's an .ics calendar file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import a calendar file</CardTitle>
        <CardDescription>Assignments and due dates come straight from your school calendar — no AI needed. Re-import any time to pick up changes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label
          htmlFor="ics-file"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed bg-muted/30 px-6 py-10 text-center transition hover:border-primary/50 hover:bg-accent/50"
        >
          <CalendarPlus className="size-8 text-primary" />
          <span className="font-medium">{busy ? "Reading…" : "Choose an .ics file"}</span>
          <span className="text-sm text-muted-foreground">It stays on this device.</span>
          <input id="ics-file" type="file" accept=".ics,text/calendar" className="sr-only" onChange={(e) => (void onFile(e.target.files?.[0]), (e.target.value = ""))} />
        </label>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Collapsible className="rounded-xl border p-3 text-sm">
          <CollapsibleTrigger className="flex w-full items-center justify-between font-medium">
            Where do I get the .ics file? <ChevronDown className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ul className="space-y-1.5">
              {CALENDAR_HELP.map(([name, how]) => (
                <li key={name}>
                  <span className="font-medium">{name}:</span> <span className="text-muted-foreground">{how}</span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export function AddPage({ data, method }: { data: Data; method: string | null }) {
  return (
    <div className="space-y-6">
      {method ? (
        <a href={href("/add")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:hidden">
          <ArrowLeft className="size-4" /> All options
        </a>
      ) : null}
      <PageHeader title="Add assignments" subtitle="Pick how you'd like to bring them in. Everything stays in this browser." />
      <MethodTabs active={method ?? ""} />
      {method === "manual" && <ManualForm data={data} />}
      {method === "syllabus" && <SyllabusFlow data={data} />}
      {method === "calendar" && <CalendarImport data={data} />}
      {!method && <p className="text-center text-sm text-muted-foreground">Choose an option above to get started.</p>}
    </div>
  );
}
