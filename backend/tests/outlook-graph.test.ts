import test from "node:test";
import assert from "node:assert/strict";

import {
  getCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
} from "../src/lib/outlook/graph";

test("weist einen ungültigen Kalenderzeitraum zurück", async () => {
  const start = new Date("2026-10-26T12:00:00.000Z");
  const end = new Date("2026-10-26T12:00:00.000Z");

  await assert.rejects(
    getCalendarEvents(start, end),
    /Kalenderzeitraum ist ungültig/
  );
});

test("weist einen Termin zurück, dessen Ende vor dem Start liegt", async () => {
  const startUtc = new Date("2026-10-26T12:00:00.000Z");
  const endUtc = new Date("2026-10-26T11:00:00.000Z");

  await assert.rejects(
    createCalendarEvent({
      subject: "Automatisierter Test",
      startUtc,
      endUtc,
    }),
    /Endzeit muss nach der Startzeit liegen/
  );
});

test("weist das Löschen mit leerer Outlook-Termin-ID zurück", async () => {
  await assert.rejects(
    deleteCalendarEvent("   "),
    /Outlook-Termin-ID fehlt/
  );
});

test("bricht ohne Outlook-Konfiguration verständlich ab", async () => {
  const start = new Date("2026-10-26T09:00:00.000Z");
  const end = new Date("2026-10-26T10:00:00.000Z");

  await assert.rejects(
    getCalendarEvents(start, end),
    /Outlook ist nicht konfiguriert/
  );
});
