"use client";

import { ChevronLeft, ChevronRight, Eye, EyeOff, RotateCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDay } from "@/lib/format";
import type { StudyPacketContent } from "@/lib/study-packet";

function Quiz({ items }: { items: StudyPacketContent["practiceQuiz"] }) {
  const [shown, setShown] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <ol className="space-y-3">
      {items.map((q, i) => (
        <li key={i} className="rounded-lg border p-3">
          <p className="font-medium">
            {i + 1}. {q.question}
          </p>
          {shown.has(i) ? (
            <div className="mt-2 space-y-1 text-sm">
              <p>
                <span className="font-medium">Answer:</span> {q.answer}
              </p>
              {q.explanation && <p className="text-muted-foreground">{q.explanation}</p>}
            </div>
          ) : null}
          <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => toggle(i)} aria-expanded={shown.has(i)}>
            {shown.has(i) ? <EyeOff /> : <Eye />} {shown.has(i) ? "Hide answer" : "Show answer"}
          </Button>
        </li>
      ))}
    </ol>
  );
}

function Flashcards({ cards }: { cards: StudyPacketContent["flashcards"] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];
  const go = (d: number) => {
    setIndex((i) => (i + d + cards.length) % cards.length);
    setFlipped(false);
  };
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted/40 p-6 text-center transition hover:bg-muted"
        aria-label={flipped ? `Definition of ${card.term}. Tap to show the term.` : `Term: ${card.term}. Tap to show the definition.`}
      >
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{flipped ? "Definition" : "Term"}</span>
        <span className={flipped ? "text-base" : "text-xl font-semibold"}>{flipped ? card.definition : card.term}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <RotateCw className="size-3" /> Tap to flip
        </span>
      </button>
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => go(-1)} aria-label="Previous card">
          <ChevronLeft />
        </Button>
        <span className="text-sm text-muted-foreground">
          {index + 1} / {cards.length}
        </span>
        <Button size="sm" variant="outline" onClick={() => go(1)} aria-label="Next card">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function PacketDetails({ packet, timeZone }: { packet: StudyPacketContent; timeZone: string }) {
  const plan = packet.actionPlan;
  return (
    <Tabs defaultValue="summary" className="w-full">
      <TabsList className="flex h-auto w-full flex-wrap justify-start">
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
        <TabsTrigger value="guide">Study guide</TabsTrigger>
        <TabsTrigger value="quiz">Quiz</TabsTrigger>
        <TabsTrigger value="cards">Flashcards</TabsTrigger>
      </TabsList>
      <TabsContent value="summary" className="pt-2 text-sm leading-relaxed">
        {packet.summary}
      </TabsContent>
      <TabsContent value="schedule" className="space-y-3 pt-2">
        {plan.assumedDefaultTimeline && <Badge variant="outline">No due date — default 5-day plan</Badge>}
        {plan.note && <p className="text-sm text-muted-foreground">{plan.note}</p>}
        <ol className="space-y-3">
          {plan.days.map((day) => (
            <li key={day.date}>
              <p className="text-sm font-medium">
                {formatDay(`${day.date}T12:00:00Z`, "UTC")} · {day.focus}
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {day.tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                    <span className="tabular-nums">{t.timeBlock}</span>
                    <span className="text-foreground">{t.title}</span>
                    <span>({t.durationMinutes} min)</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Times are in {timeZone.replace(/_/g, " ")}.</p>
      </TabsContent>
      <TabsContent value="guide" className="space-y-3 pt-2">
        {packet.studyGuide.sections.map((s) => (
          <section key={s.heading}>
            <h4 className="text-sm font-semibold">{s.heading}</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </TabsContent>
      <TabsContent value="quiz" className="pt-2">
        <Quiz items={packet.practiceQuiz} />
      </TabsContent>
      <TabsContent value="cards" className="pt-2">
        <Flashcards cards={packet.flashcards} />
      </TabsContent>
    </Tabs>
  );
}
