import { Download, Laptop, Moon, Sun, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { PageHeader } from "../components/bits";
import { clearAll, exportBackup, importBackup, updateSettings, type Data } from "../lib/store";

const THEMES = [
  { value: "system", label: "Device", icon: Laptop },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function SettingsPage({ data }: { data: Data }) {
  const zones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const [confirmClear, setConfirmClear] = useState(false);
  const s = data.settings;

  function download() {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `check-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded.");
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    const r = importBackup(await file.text());
    if (r.ok) toast.success(`Restored ${r.count} assignment${r.count === 1 ? "" : "s"}.`);
    else toast.error(r.error);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <Card>
        <CardHeader>
          <CardTitle>You</CardTitle>
          <CardDescription>Used for greetings and to place due dates and study schedules in your time zone.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">First name (optional)</Label>
            <Input id="name" value={s.name} onChange={(e) => updateSettings({ name: e.target.value.slice(0, 60) })} placeholder="e.g. Jordan" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tz">Time zone</Label>
            <NativeSelect id="tz" value={s.timeZone} onChange={(e) => (updateSettings({ timeZone: e.target.value }), toast.success("Time zone saved."))}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-flex rounded-xl border p-1" role="radiogroup" aria-label="Theme">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={s.theme === value}
                onClick={() => updateSettings({ theme: value })}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm", s.theme === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent")}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Everything is saved only in this browser — nothing is uploaded. Download a backup to keep it safe or to move it to another phone or computer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={download}>
            <Download /> Download backup
          </Button>
          <Button variant="outline" asChild>
            <label htmlFor="restore" className="cursor-pointer">
              <Upload /> Restore backup
              <input id="restore" type="file" accept="application/json,.json" className="sr-only" onChange={(e) => (void restore(e.target.files?.[0]), (e.target.value = ""))} />
            </label>
          </Button>
          {confirmClear ? (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              Delete all {data.assignments.length} assignments and study guides?
              <Button size="sm" variant="destructive" onClick={() => (clearAll(), setConfirmClear(false), toast.success("All data deleted."))}>
                Delete everything
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmClear(true)}>
              <Trash2 /> Delete all data
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About this version</CardTitle>
          <CardDescription>
            This is the free, browser-only version of Check AI. Study guides are made with your own Claude account (Copy to Claude). The full version adds Google
            Classroom and Canvas syncing, live calendar links, class websites, automatic background checks, and automatic study guides with an API key.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="https://github.com/berkobro/check-ai-web" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            View this site's code on GitHub
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
