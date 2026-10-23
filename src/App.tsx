import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "./components/layout";
import { useRoute } from "./lib/router";
import { useData } from "./lib/store";
import { useTheme } from "./lib/theme";
import { AddPage } from "./pages/add";
import { CalendarPage } from "./pages/calendar";
import { GuidesPage } from "./pages/guides";
import { OverviewPage } from "./pages/overview";
import { ReviewPage } from "./pages/review";
import { SettingsPage } from "./pages/settings";

const TITLES: Array<[RegExp, string]> = [
  [/^\/guides/, "Study guides"],
  [/^\/calendar/, "Calendar"],
  [/^\/add/, "Add assignments"],
  [/^\/review/, "Review"],
  [/^\/settings/, "Settings"],
];

export function App() {
  const data = useData();
  const { path, query } = useRoute();
  useTheme(data.settings.theme);
  // Re-render every minute so "due in…" labels stay current.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const page = TITLES.find(([re]) => re.test(path))?.[1];
    document.title = page ? `${page} · Check AI` : "Check AI — Study Planner";
  }, [path]);

  let page: React.ReactNode;
  const review = /^\/review\/(.+)$/.exec(path);
  const add = /^\/add(?:\/(manual|syllabus|calendar))?$/.exec(path);
  if (path === "/") page = <OverviewPage data={data} now={now} />;
  else if (path === "/guides") page = <GuidesPage data={data} now={now} openId={query.get("open")} />;
  else if (path === "/calendar") page = <CalendarPage data={data} now={now} />;
  else if (add) page = <AddPage data={data} method={add[1] ?? null} />;
  else if (review) page = <ReviewPage data={data} id={decodeURIComponent(review[1])} />;
  else if (path === "/settings") page = <SettingsPage data={data} />;
  else page = <OverviewPage data={data} now={now} />;

  return (
    <Layout path={path}>
      {/* Remount per route so page state (filters, forms) resets on navigation. */}
      <div key={path}>{page}</div>
      <Toaster position="top-center" richColors theme={data.settings.theme} />
    </Layout>
  );
}
