import { ClipboardPaste, Wrench } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { startCopy } from "@/lib/clipboard";

export interface PasteOutcome {
  ok: boolean;
  errors?: string[];
  fixPrompt?: string;
  message?: string;
}

/** "Paste Claude's answer" — shows exactly what was wrong and offers a fix-it prompt. */
export function PasteBox({ onSubmit, label = "Paste Claude's answer", placeholder = "Paste Claude's JSON code block here…" }: { onSubmit: (text: string) => PasteOutcome; label?: string; placeholder?: string }) {
  const id = useId();
  const [text, setText] = useState("");
  const [result, setResult] = useState<PasteOutcome | null>(null);

  function submit() {
    const r = onSubmit(text);
    setResult(r);
    if (r.ok) {
      if (r.message) toast.success(r.message);
      if (!r.errors?.length) setText("");
    }
  }

  const errors = result?.errors ?? [];
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="max-h-60 min-h-24 font-mono text-xs" aria-invalid={errors.length > 0} />
      <Button type="button" onClick={submit} disabled={!text.trim()}>
        <ClipboardPaste /> Save answer
      </Button>
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{result?.ok ? "Saved some, but parts need fixing" : "That answer needs fixing"}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-0.5 pl-4">
              {errors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {errors.length > 8 && <li>…and {errors.length - 8} more</li>}
            </ul>
            {result?.fixPrompt && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() =>
                  void startCopy(result.fixPrompt!).then((ok) =>
                    ok ? toast.success("Fix-it message copied. Paste it into the same Claude chat.") : toast.error("Couldn't copy. Select the text manually."),
                  )
                }
              >
                <Wrench /> Copy fix-it prompt
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
