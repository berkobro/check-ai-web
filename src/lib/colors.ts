// Each class gets a consistent color (full class strings so Tailwind keeps them).
const PALETTE = [
  { dot: "bg-sky-500", chip: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100", bar: "bg-sky-500" },
  { dot: "bg-violet-500", chip: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100", bar: "bg-violet-500" },
  { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100", bar: "bg-emerald-500" },
  { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100", bar: "bg-amber-500" },
  { dot: "bg-rose-500", chip: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100", bar: "bg-rose-500" },
  { dot: "bg-teal-500", chip: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-100", bar: "bg-teal-500" },
  { dot: "bg-indigo-500", chip: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100", bar: "bg-indigo-500" },
  { dot: "bg-orange-500", chip: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100", bar: "bg-orange-500" },
] as const;

export function courseColor(courseName: string) {
  let h = 0;
  for (const ch of courseName.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
