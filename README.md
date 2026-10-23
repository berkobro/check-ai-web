# Check AI (web)

Organize your assignments and turn each one into a study plan with Claude, right in your browser. There's no account and no server, and nothing is uploaded.

**Open it: https://berkobro.github.io/check-ai-web/**

## What it does

- **Add assignments** three ways:
  - Type them in.
  - Paste a syllabus. Claude lists the assignments and you review them before anything is saved.
  - Import a calendar `.ics` file (Canvas, Schoology, Google, Outlook…). No AI is needed. Re-import anytime to pick up changes.
- **Copy to Claude** for any assignment, or **Copy all new** for up to 5 at once. Then paste Claude's answer back. If an answer has problems, you get a clear list and a **Copy fix-it prompt** button.
- **Study guides** with:
  - a progress checklist
  - a day-by-day schedule
  - a study guide
  - a practice quiz, with answers hidden until you tap
  - flip-card flashcards
- **Overview** of what's due this week, an **Up next** list, and a **Calendar** month view. It has light and dark mode and works on phones.

Your data stays in this browser. To move it to another device, use **Settings → Download backup**, then **Restore** on the other device.

## Publishing (one time)

1. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. Push to `main`, or go to **Actions → Deploy to GitHub Pages → Run workflow**.

The workflow in `.github/workflows/pages.yml` type-checks, tests, builds, and publishes the site.

## Developing

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # -> dist/
npm test             # calendar-file parser
npm run test:e2e     # browser test of the built site (Playwright + Chromium)
npm run typecheck
```

`src/shared/` holds the UI components, Claude prompts, and answer checking. They're shared with the Check AI app, so both ask Claude for the same study packets.

Privacy: the only outside requests are the Geist web font, and claude.ai when you tap Copy to Claude.
