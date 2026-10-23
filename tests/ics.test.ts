import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseIcs } from "../src/lib/ics";

const FEED = readFileSync(new URL("./fixtures/canvas-calendar.ics", import.meta.url), "utf8");
const ctx = { timeZone: "America/New_York", now: new Date("2026-10-21T16:00:00Z"), defaultCourse: "My calendar" };

// Same results as the Check AI app's calendar-feed parser on this file.
const EXPECTED = [
  ["event-assignment-48213", "Lab Report: Enzyme Kinetics", "BIO-210-02", "2026-10-28T05:59:00.000Z", "https://riverside.instructure.com/courses/1234/assignments/48213", "assignment"],
  ["event-assignment-48299", "Reading Response 6", "ENG-101-01", "2026-10-31T03:59:00.000Z", "https://riverside.instructure.com/courses/5678/assignments/48299", "assignment"],
  ["event-quiz-551", "Unit 3 Quiz: Stoichiometry", "CHEM-150", "2026-11-03T16:00:00.000Z", null, "assignment"],
  ["event-assignment-48400", "Poster session slides due", "BIO-210-02", "2026-11-05T21:00:00.000Z", null, "assignment"],
  ["event-calendar-event-90001", "BIO 210 Lecture", "BIO-210-02", "2026-10-19T14:00:00.000Z", null, "not_assignment"],
  ["event-calendar-event-90002", "Thanksgiving Break - No Classes", "My calendar", "2026-11-26T04:59:00.000Z", null, "not_assignment"],
  ["event-calendar-event-90003", "Group check-in with Ms. Ortiz", "ENG-101-01", "2026-11-09T20:00:00.000Z", null, "unclear"],
];

test("reads a Canvas calendar file: courses, due times, links and event kinds", () => {
  const events = parseIcs(FEED, ctx).map((e) => [e.uid, e.title, e.courseName, e.dueDate.toISOString(), e.link, e.kind]);
  assert.deepEqual(events, EXPECTED);
});

test("handles Outlook zone names, escaped text, and the 'not a calendar' case", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:o1",
    "DTSTART;TZID=Pacific Standard Time:20261030T170000",
    "DTEND;TZID=Pacific Standard Time:20261030T170000",
    "SUMMARY:Essay\\, final draft due",
    "DESCRIPTION:Line one\\nLine two",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const [e] = parseIcs(ics, ctx);
  assert.equal(e.dueDate.toISOString(), "2026-10-31T00:00:00.000Z"); // 5 PM PDT
  assert.equal(e.title, "Essay, final draft due");
  assert.equal(e.description, "Line one\nLine two");
  assert.equal(e.kind, "assignment");
  assert.throws(() => parseIcs("<html>not a calendar</html>", ctx), /isn't a calendar/);
});
