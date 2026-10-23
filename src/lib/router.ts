import { useSyncExternalStore } from "react";

// Hash routes (#/guides) work on GitHub Pages without any server-side rewrites.

function current(): string {
  return typeof window === "undefined" ? "/" : window.location.hash.replace(/^#/, "") || "/";
}

export function useRoute(): { path: string; query: URLSearchParams } {
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    current,
    () => "/",
  );
  const [path, search = ""] = raw.split("?");
  return { path: path || "/", query: new URLSearchParams(search) };
}

export function navigate(to: string) {
  window.location.hash = to;
  window.scrollTo({ top: 0 });
}

export const href = (to: string) => `#${to}`;
