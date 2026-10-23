/**
 * Browser test of the GitHub Pages build. Serves dist/ under /check-ai-web/ (like
 * https://<user>.github.io/check-ai-web/) and drives every flow in Chromium.
 *   npm run build && npm run test:e2e          (SCREENSHOTS=dir to save images)
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";

const ROOT = fileURLToPath(new URL("../dist/", import.meta.url));
const FIXTURE = fileURLToPath(new URL("../tests/fixtures/canvas-calendar.ics", import.meta.url));
const SHOTS = process.env.SCREENSHOTS;
const CHROMIUM = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const NOW = new Date("2026-10-21T16:00:00Z"); // matches the calendar fixture
const TZ = "America/New_York";
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (!url.pathname.startsWith("/check-ai-web/")) return void ((res.statusCode = 404), res.end());
    let file = normalize(join(ROOT, url.pathname.slice("/check-ai-web/".length) || "index.html"));
    if (!file.startsWith(ROOT)) return void ((res.statusCode = 403), res.end());
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return void ((res.statusCode = 404), res.end());
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.end(readFileSync(file));
  });
  return new Promise<{ base: string; close: () => void }>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/check-ai-web/`, close: () => server.close() })),
  );
}

async function newContext(browser: Browser, base: string, opts: { viewport?: { width: number; height: number }; colorScheme?: "light" | "dark" } = {}) {
  const context = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 900 }, timezoneId: TZ, colorScheme: opts.colorScheme ?? "light", acceptDownloads: true });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(base).origin });
  await context.route("https://claude.ai/**", (r) => r.fulfill({ body: "Claude stub", contentType: "text/html" }));
  await context.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { context, page, errors };
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function noHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `${where}: page scrolls sideways by ${overflow}px`);
}

/** A valid study packet whose plan runs Oct 21–23 (within the fixed "today" and due date). */
function packetJson(title = "Lab report") {
  return {
    summary: `Write the ${title}.`,
    actionPlan: {
      assumedDefaultTimeline: false,
      note: "Spread the work out.",
      days: ["2026-10-21", "2026-10-22", "2026-10-23"].map((date, i) => ({
        date,
        focus: ["Research", "Draft", "Revise"][i],
        tasks: [
          { title: `Step ${i + 1}a`, timeBlock: "4:00 PM - 4:45 PM", durationMinutes: 45 },
          { title: `Step ${i + 1}b`, timeBlock: "5:00 PM - 5:30 PM", durationMinutes: 30 },
        ],
      })),
    },
    studyGuide: { sections: [{ heading: "Key ideas", points: ["Photosynthesis makes glucose", "Light reactions happen in the thylakoids"] }] },
    practiceQuiz: [1, 2, 3].map((n) => ({ question: `Question ${n}?`, answer: `Answer ${n}`, explanation: "Because." })),
    flashcards: [1, 2, 3, 4, 5].map((n) => ({ term: `Term ${n}`, definition: `Definition ${n}` })),
  };
}

async function headingIs(page: Page, text: string | RegExp) {
  await page.getByRole("heading", { level: 1, name: text }).waitFor();
}

async function run(browser: Browser, base: string) {
  const { context, page, errors } = await newContext(browser, base);

  // 1. First visit: welcome screen with the three ways to add.
  await page.goto(base);
  await headingIs(page, /All your assignments in one place/);
  for (const t of ["Type it in", "Paste a syllabus", "Import a calendar"]) await page.getByRole("link", { name: new RegExp(t) }).first().waitFor();
  await shot(page, "01-welcome");
  console.log("✓ Welcome screen with the three ways to add");

  // 2. Type in an assignment.
  await page.getByRole("link", { name: "Add", exact: true }).first().click();
  await headingIs(page, "Add assignments");
  await page.getByRole("link", { name: /Type it in/ }).click();
  await page.getByLabel("What's the assignment?").fill("Photosynthesis Lab Report");
  await page.getByLabel("Class").fill("AP Biology");
  await page.getByLabel(/^Due/).fill("2026-10-23T23:59");
  await page.getByLabel("Details from your teacher (optional)").fill("2 pages on the Elodea lab with a graph.");
  await page.getByRole("button", { name: "Add assignment" }).click();
  await page.getByText("Added “Photosynthesis Lab Report”.").waitFor();
  await shot(page, "02-add-manual");
  console.log("✓ Type it in: assignment added");

  // 3. Copy to Claude: clipboard + claude.ai/new in one click.
  await page.getByRole("link", { name: "Guides" }).first().click();
  await headingIs(page, "Study guides");
  const card = page.locator('[data-slot="card"]').filter({ hasText: "Photosynthesis Lab Report" });
  await card.getByText("Needs a study guide").waitFor();
  const [popup] = await Promise.all([context.waitForEvent("page"), card.getByRole("button", { name: "Copy to Claude" }).click()]);
  assert.equal(popup.url(), "https://claude.ai/new");
  await popup.close();
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(prompt.includes("<title>Photosynthesis Lab Report</title>") && prompt.includes("<course>AP Biology</course>") && prompt.includes("Today: 2026-10-21"));
  await page.getByText("Copied! Paste it into Claude").waitFor();
  console.log("✓ Copy to Claude: prompt copied and claude.ai opened");

  // 4. A bad answer explains what's wrong; a good one saves the guide.
  await card.getByLabel("Paste Claude's answer").fill('```json\n{"summary": "x"}\n```');
  await card.getByRole("button", { name: "Save answer" }).click();
  await card.getByText("That answer needs fixing").waitFor();
  await card.getByRole("button", { name: "Copy fix-it prompt" }).waitFor();
  await card.getByLabel("Paste Claude's answer").fill("Here you go!\n```json\n" + JSON.stringify(packetJson()) + "\n```");
  await card.getByRole("button", { name: "Save answer" }).click();
  await page.getByText("Study guide saved!").waitFor();
  await card.getByText("Study guide ready").waitFor();
  await card.getByText("0/6 done").waitFor();
  console.log("✓ Paste-back: errors explained, valid answer saved");

  // 5. Checklist + study guide tabs; progress survives a reload.
  await card.getByRole("checkbox").first().click();
  await card.getByText("1/6 done").waitFor();
  await page.reload();
  await card.getByText("1/6 done").waitFor();
  await card.getByRole("button", { name: "Open study guide" }).click();
  await card.getByRole("tab", { name: "Quiz" }).click();
  assert.equal(await card.getByText("Answer 1").count(), 0);
  await card.getByRole("button", { name: "Show answer" }).first().click();
  await card.getByText("Answer 1").waitFor();
  await card.getByRole("tab", { name: "Flashcards" }).click();
  await card.getByRole("button", { name: /Term: Term 1/ }).click();
  await card.getByText("Definition 1").waitFor();
  await shot(page, "03-guide-open");
  console.log("✓ Checklist saved across reload; quiz answers hidden until tapped; flashcards flip");

  // 6. Paste a syllabus -> Claude's list -> review -> save.
  await page.goto(`${base}#/add/syllabus`);
  await page.getByRole("button", { name: "Copy to Claude" }).waitFor(); // disabled until text is added
  assert.equal(await page.getByRole("button", { name: "Copy to Claude" }).isDisabled(), true);
  await page.getByLabel("Name (usually the class)").fill("AP U.S. History");
  await page.getByLabel("Paste the text").fill("Week of Oct 26: Chapter 9 reading questions due Friday Oct 30. Unit 4 DBQ essay due Friday Nov 6. Office hours Tuesdays.");
  await page.getByRole("button", { name: "Copy to Claude" }).click();
  await page.waitForEvent("popup").then((p) => p.close()).catch(() => {});
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /untrusted data[\s\S]*Chapter 9 reading questions/);
  const reply = {
    assignments: [
      { courseName: "AP U.S. History", title: "Chapter 9 reading questions", description: null, dueDate: "2026-10-30", link: null },
      { courseName: "AP U.S. History", title: "Unit 4 DBQ essay", description: "5 paragraphs", dueDate: "2026-11-06", link: null },
      { courseName: "AP U.S. History", title: "Office hours", description: null, dueDate: null, link: null },
    ],
  };
  await page.getByLabel("Paste Claude's answer").fill("```json\n" + JSON.stringify(reply) + "\n```");
  await page.getByRole("button", { name: "Save answer" }).click();
  await headingIs(page, "Review: AP U.S. History");
  await page.getByLabel("Title").first().fill("Ch. 9 reading questions (AMSCO)");
  await page.getByLabel("Include Office hours").click();
  await shot(page, "04-review");
  await page.getByRole("button", { name: "Save 2 assignments" }).click();
  await headingIs(page, "Study guides");
  await page.getByText("Ch. 9 reading questions (AMSCO)").waitFor();
  console.log("✓ Syllabus: Claude's list reviewed, edited, unchecked item left out");

  // 7. Import the Canvas calendar file; unclear events start unchecked; re-import adds nothing.
  await page.goto(`${base}#/add/calendar`);
  await page.locator("#ics-file").setInputFiles(FIXTURE);
  await headingIs(page, /Review: canvas-calendar/);
  await page.getByText(/Skipped 2 events that look like class meetings or holidays/).waitFor();
  assert.equal(await page.getByLabel("Include Group check-in with Ms. Ortiz").isChecked(), false, "unclear event starts unchecked");
  assert.equal(await page.getByLabel("Include Lab Report: Enzyme Kinetics").isChecked(), true);
  await page.getByRole("button", { name: "Save 4 assignments" }).click();
  await headingIs(page, "Study guides");
  await page.goto(`${base}#/add/calendar`);
  await page.locator("#ics-file").setInputFiles(FIXTURE);
  await page.getByText("No new assignments in that calendar.").waitFor();
  await page.goto(base);
  assert.equal(await page.getByText(/to review/).count(), 0, "a re-import with nothing new leaves no empty review");
  console.log("✓ Calendar file: imported with rules, unclear left unchecked, re-import doesn't duplicate");

  // 8. Overview: stats, Copy all new, up next.
  await page.goto(base);
  await headingIs(page, /Good (morning|afternoon|evening)!/);
  await page.getByText("6 assignments are waiting for study guides").waitFor();
  await page.getByRole("button", { name: "Copy all new (5)" }).waitFor();
  const batchPrompt = await (async () => {
    await page.getByRole("button", { name: "Copy all new (5)" }).click();
    await page.waitForEvent("popup").then((p) => p.close()).catch(() => {});
    return page.evaluate(() => navigator.clipboard.readText());
  })();
  const ids = [...batchPrompt.matchAll(/<assignment id="([^"]+)">/g)].map((m) => m[1]).filter((id) => id !== "..."); // skip the format example
  assert.equal(ids.length, 5);
  await shot(page, "05-overview");
  console.log("✓ Overview: greeting, stats, Copy all new (5)");

  // 9. Calendar page shows items on their days.
  await page.getByRole("link", { name: "Calendar" }).first().click();
  await headingIs(page, "Calendar");
  await page.getByRole("button", { name: "Next month" }).click();
  await page.getByRole("gridcell", { name: /Fri, Nov 6: 1 due/ }).click();
  await page.getByRole("link", { name: /Unit 4 DBQ essay/ }).waitFor(); // the day agenda below the grid
  await page.getByRole("button", { name: "Previous month" }).click();
  await page.getByRole("gridcell", { name: /Wed, Oct 28: 1 due/ }).click();
  await page.getByRole("link", { name: /Lab Report: Enzyme Kinetics/ }).waitFor();
  await shot(page, "06-calendar");
  console.log("✓ Calendar: month grid and day agenda");

  // 10. Settings: dark theme, backup download, delete, restore.
  await page.getByRole("link", { name: "Settings" }).first().click();
  await page.getByRole("radio", { name: "Dark" }).click();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), true);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download backup" }).click()]);
  // Playwright deletes downloads when the context closes; keep a copy for the phone test.
  const backupPath = join(mkdtempSync(join(tmpdir(), "check-ai-backup-")), "backup.json");
  await download.saveAs(backupPath);
  await page.getByRole("button", { name: "Delete all data" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.goto(base);
  await headingIs(page, /All your assignments in one place/);
  await page.goto(`${base}#/settings`);
  await page.locator("#restore").setInputFiles(backupPath);
  await page.getByText("Restored 7 assignments.").waitFor();
  await page.goto(`${base}#/guides`);
  await page.getByText("1/6 done").waitFor();
  await shot(page, "07-guides-dark");
  console.log("✓ Settings: dark mode, backup, delete all, restore");

  assert.deepEqual(errors, [], `browser errors: ${errors.join(" | ")}`);
  await context.close();
  return backupPath;
}

async function phone(browser: Browser, base: string, backupPath: string) {
  const { context, page, errors } = await newContext(browser, base, { viewport: { width: 390, height: 844 } });
  await page.goto(base);
  await noHorizontalScroll(page, "welcome");
  await page.goto(`${base}#/settings`);
  await page.locator("#restore").setInputFiles(backupPath);
  await page.getByText(/Restored/).waitFor();
  for (const [route, h1] of [["", /Good/], ["guides", "Study guides"], ["calendar", "Calendar"], ["add/syllabus", "Add assignments"], ["settings", "Settings"]] as const) {
    await page.goto(`${base}#/${route}`);
    await headingIs(page, h1);
    await noHorizontalScroll(page, route || "overview");
  }
  // Bottom tab bar navigation, including the raised Add button.
  await page.getByRole("link", { name: "Add assignments" }).click();
  await headingIs(page, "Add assignments");
  await page.getByRole("navigation", { name: "Main" }).last().getByRole("link", { name: "Guides" }).click();
  await headingIs(page, "Study guides");
  await page.goto(base);
  await shot(page, "08-overview-phone");
  await page.goto(`${base}#/guides`);
  await shot(page, "09-guides-phone");
  assert.deepEqual(errors, []);
  await context.close();
  console.log("✓ Phone: bottom tab bar, no sideways scrolling on any page");
}

async function main() {
  if (!existsSync(join(ROOT, "index.html"))) throw new Error("Build first: npm run build");
  const srv = await serve();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    const backup = await run(browser, srv.base);
    await phone(browser, srv.base, backup);
  } finally {
    await browser.close();
    srv.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
