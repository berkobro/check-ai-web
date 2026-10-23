"use client";

/** Hidden-textarea copy for browsers without the async Clipboard API (or non-HTTPS origins). */
function legacyCopy(text: string): boolean {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  el.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  el.remove();
  return ok;
}

/**
 * Starts the clipboard write *synchronously* and returns a promise for the result.
 * Call it first inside a click handler, before window.open and without awaiting,
 * so Safari/iOS still treat both as part of the user gesture.
 */
export function startCopy(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    );
  }
  return Promise.resolve(legacyCopy(text));
}

export const CLAUDE_NEW_CHAT_URL = "https://claude.ai/new";

/** Opens Claude in a new tab (on phones this usually hands off to the Claude app). */
export function openClaude(): boolean {
  const win = window.open(CLAUDE_NEW_CHAT_URL, "_blank");
  if (!win) return false;
  win.opener = null;
  return true;
}
