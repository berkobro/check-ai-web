import { BookOpenCheck, CalendarDays, Home, Plus, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { href } from "../lib/router";
import { storageFailed } from "../lib/store";

const NAV = [
  { to: "/", label: "Overview", icon: Home, match: (p: string) => p === "/" },
  { to: "/guides", label: "Guides", icon: BookOpenCheck, match: (p: string) => p.startsWith("/guides") },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") },
  { to: "/settings", label: "Settings", icon: SettingsIcon, match: (p: string) => p.startsWith("/settings") },
];

function Logo() {
  return (
    <a href={href("/")} className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4 4L19 7" />
        </svg>
      </span>
      Check AI
    </a>
  );
}

export function Layout({ path, children }: { path: string; children: React.ReactNode }) {
  const addActive = path.startsWith("/add") || path.startsWith("/review");
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-accent/60 via-background to-background pb-24 sm:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <Logo />
          <nav className="ml-auto hidden items-center gap-1 sm:flex" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, match }) => (
              <a
                key={to}
                href={href(to)}
                aria-current={match(path) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
                  match(path) && "bg-accent font-medium text-accent-foreground",
                )}
              >
                <Icon className="size-4" /> {label}
              </a>
            ))}
            <a
              href={href("/add")}
              aria-current={addActive ? "page" : undefined}
              className="ml-2 flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              <Plus className="size-4" /> Add
            </a>
          </nav>
        </div>
      </header>

      {storageFailed() && (
        <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" role="alert">
          This browser isn&apos;t letting the app save (private mode or storage is full). Changes will be lost when you close the tab.
        </p>
      )}

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
        {children}
      </main>

      <footer className="mx-auto hidden w-full max-w-5xl px-4 pb-8 text-xs text-muted-foreground sm:block">
        Your assignments are saved only in this browser. Use Settings → Download backup to move them to another device.
      </footer>

      {/* Phones: bottom tab bar with a raised Add button */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden" aria-label="Main">
        <div className="grid grid-cols-5 items-end">
          {[NAV[0], NAV[1]].map(({ to, label, icon: Icon, match }) => (
            <a key={to} href={href(to)} aria-current={match(path) ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground", match(path) && "font-medium text-primary")}>
              <Icon className="size-5" /> {label}
            </a>
          ))}
          <a href={href("/add")} aria-current={addActive ? "page" : undefined} aria-label="Add assignments" className="flex flex-col items-center gap-0.5 pb-2 text-[11px] font-medium text-primary">
            <span className="-mt-5 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background">
              <Plus className="size-6" />
            </span>
            Add
          </a>
          {[NAV[2], NAV[3]].map(({ to, label, icon: Icon, match }) => (
            <a key={to} href={href(to)} aria-current={match(path) ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground", match(path) && "font-medium text-primary")}>
              <Icon className="size-5" /> {label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
