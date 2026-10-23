"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openClaude, startCopy } from "@/lib/clipboard";
import { OpenClaudeLink, PromptFallback } from "./prompt-fallback";

/**
 * Manual mode: copy the prompt AND open claude.ai in one tap. The prompt is rendered
 * into the page ahead of time so nothing is awaited before the clipboard write and
 * window.open, which keeps both inside the click's user gesture on Safari/iOS.
 */
export function CopyToClaudeButton({
  prompt,
  label = "Copy to Claude",
  variant = "default",
}: {
  prompt: string;
  label?: string;
  variant?: "default" | "outline" | "secondary";
}) {
  const [copyFailed, setCopyFailed] = useState(false);
  const [tabBlocked, setTabBlocked] = useState(false);

  function handleClick() {
    const copied = startCopy(prompt); // 1. start the clipboard write (no await)
    const opened = openClaude(); //      2. open Claude in the same tick
    setTabBlocked(!opened);
    void copied.then((ok) => {
      setCopyFailed(!ok);
      if (ok) toast.success("Copied! Paste it into Claude, then come back and paste the answer here.");
      else toast.error("Couldn't copy automatically. Copy the prompt from the box below.");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant={variant} onClick={handleClick}>
          <Copy /> {label}
        </Button>
        {tabBlocked && !copyFailed && <OpenClaudeLink />}
      </div>
      {copyFailed && <PromptFallback prompt={prompt} showOpenLink={tabBlocked} />}
    </div>
  );
}
