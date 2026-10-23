"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CLAUDE_NEW_CHAT_URL } from "@/lib/clipboard";

/** Shown when the browser blocked the clipboard: let the user copy the prompt by hand. */
export function PromptFallback({ prompt, showOpenLink }: { prompt: string; showOpenLink: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-2 rounded-md border border-dashed p-3">
      <p className="text-sm text-muted-foreground">
        Your browser blocked copying. Select the prompt below, copy it, then paste it into Claude.
      </p>
      <Textarea ref={ref} readOnly value={prompt} className="max-h-48 font-mono text-xs" aria-label="Prompt for Claude" />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            ref.current?.focus();
            ref.current?.select();
            ref.current?.setSelectionRange(0, prompt.length);
          }}
        >
          Select all
        </Button>
        {showOpenLink && <OpenClaudeLink />}
      </div>
    </div>
  );
}

export function OpenClaudeLink() {
  return (
    <Button asChild size="sm" variant="outline">
      <a href={CLAUDE_NEW_CHAT_URL} target="_blank" rel="noopener noreferrer">
        Open Claude
      </a>
    </Button>
  );
}
