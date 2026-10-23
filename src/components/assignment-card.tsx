import { ChevronDown, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PacketDetails } from "@/components/assignments/packet-details";
import { CopyToClaudeButton } from "@/components/manual/copy-to-claude-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { courseColor } from "../lib/colors";
import { applyPacketReply, promptFor } from "../lib/packets";
import { assignmentState, editAssignment, removeAssignment, type Assignment } from "../lib/store";
import { AssignmentForm } from "./assignment-form";
import { CourseChip, DueChip, StateBadge } from "./bits";
import { Checklist } from "./checklist";
import { PasteBox } from "./paste-box";

const SOURCE_NAMES = { manual: "Added by you", syllabus: "From a syllabus", calendar: "From a calendar" } as const;

export function AssignmentCard({ a, timeZone, now, courses, defaultOpen = false }: { a: Assignment; timeZone: string; now: Date; courses: string[]; defaultOpen?: boolean }) {
  const state = assignmentState(a, now.getTime());
  const [userOpen, setOpen] = useState<boolean | null>(null);
  const open = userOpen ?? defaultOpen;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Compact until needed: the paste box opens after Copy to Claude (or "I have Claude's answer").
  const [showPaste, setShowPaste] = useState(false);
  const color = courseColor(a.courseName);
  const needsGuide = state !== "ready";

  return (
    <Card id={a.id} className="relative scroll-mt-24 gap-0 overflow-hidden py-0">
      <div className={cn("absolute inset-y-0 left-0 w-1", color.bar)} aria-hidden />
      <div className="space-y-4 p-5 pl-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CourseChip name={a.courseName} />
              <StateBadge state={state} />
            </div>
            <h2 className="text-lg font-semibold leading-snug">{a.title}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <DueChip due={a.dueDate} timeZone={timeZone} now={now} />
              <span className="text-xs text-muted-foreground">{SOURCE_NAMES[a.source]}{a.source !== "manual" && ` · ${a.sourceLabel}`}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit ${a.title}`}>
              <Pencil />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label={`Remove ${a.title}`}>
              <Trash2 />
            </Button>
          </div>
        </div>

        {a.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{a.description}</p>}
        {a.link && (
          <a href={a.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
            Open assignment <ExternalLink className="size-3.5" />
          </a>
        )}

        {confirmDelete && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
            Remove this assignment{a.packet ? " and its study guide" : ""}? Imports won&apos;t add it back.
            <Button size="sm" variant="destructive" onClick={() => (removeAssignment(a.id), toast.success("Removed."))}>
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        )}

        {a.packet && <Checklist assignmentId={a.id} plan={a.packet.content.actionPlan} completed={a.packet.completedTaskIds} />}

        {a.packet && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
                {open ? "Hide study guide" : "Open study guide"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <PacketDetails packet={a.packet.content} timeZone={timeZone} />
            </CollapsibleContent>
          </Collapsible>
        )}

        {needsGuide && (
          <div className="space-y-3 rounded-xl border border-dashed bg-muted/30 p-4">
            <p className="text-sm">
              {state === "outdated"
                ? "This assignment changed since its study guide was made. Make a fresh one:"
                : state === "past"
                  ? "This is past due, but you can still make a study guide."
                  : "Get a summary, day-by-day plan, study guide, quiz and flashcards from Claude:"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {/* Capture (not replace) the button's click: copying still happens in the same gesture. */}
              <span onClickCapture={() => setShowPaste(true)}>
                <CopyToClaudeButton prompt={promptFor(a, timeZone)} label={state === "outdated" ? "Refresh with Claude" : "Copy to Claude"} />
              </span>
              {!showPaste && (
                <Button variant="ghost" size="sm" onClick={() => setShowPaste(true)}>
                  I have Claude&apos;s answer
                </Button>
              )}
            </div>
            {showPaste && (
              <PasteBox
                onSubmit={(text) => {
                  const r = applyPacketReply(text, a.id);
                  return { ok: r.saved > 0, errors: r.errors, fixPrompt: r.fixPrompt, message: r.saved ? "Study guide saved!" : undefined };
                }}
              />
            )}
          </div>
        )}
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit assignment</DialogTitle>
            <DialogDescription>Changing it marks its study guide as out of date.</DialogDescription>
          </DialogHeader>
          <AssignmentForm
            initial={a}
            courses={courses}
            timeZone={timeZone}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={(fields) => {
              editAssignment(a.id, fields);
              setEditing(false);
              toast.success("Saved.");
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
