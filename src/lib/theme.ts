import { useEffect } from "react";
import type { Settings } from "./store";

/** Apply light/dark (or follow the device) to <html class="dark">. */
export function useTheme(theme: Settings["theme"]) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}
