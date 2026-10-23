import test from "node:test";
import assert from "node:assert/strict";

test("liest Kalendertermine über simulierte Microsoft-Graph-Antworten", async (t) => {
  // Konfiguration vor dem Import des Graph-Moduls setzen.
  process.env.MS_TENANT_ID = "test-tenant";
  process.env.MS_CLIENT_ID = "test-client";
  process.env.MS_CLIENT_SECRET = "test-secret";
  process.env.MS_CALENDAR_EMAIL = "calendar@example.test";

  const originalFetch = globalThis.fetch;

  const requests: Array<{
    url: string;
    init?: RequestInit;
  }> = [];

  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    requests.push({ url, init });

    if (url.includes("/oauth2/v2.0/token")) {
      return new Response(
        JSON.stringify({
          access_token: "fake-test-token",
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (url.includes("/calendarView?")) {
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "event-123",
              subject: "Testtermin",
              start: {
                dateTime: "2026-10-26T09:00:00.000",
                timeZone: "UTC",
              },
              end: {
                dateTime: "2026-10-26T10:00:00.000",
                timeZone: "UTC",
              },
              showAs: "busy",
              isCancelled: false,
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    throw new Error(`Unerwartete Testanfrage: ${url}`);
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;

    delete process.env.MS_TENANT_ID;
    delete process.env.MS_CLIENT_ID;
    delete process.env.MS_CLIENT_SECRET;
    delete process.env.MS_CALENDAR_EMAIL;
  });

  // Erst nach dem Setzen der Umgebungsvariablen importieren.
  const { getCalendarEvents } = await import("../src/lib/outlook/graph");

  const events = await getCalendarEvents(
    new Date("2026-10-26T08:00:00.000Z"),
    new Date("2026-10-26T12:00:00.000Z")
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].id, "event-123");
  assert.equal(events[0].subject, "Testtermin");

  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /oauth2\/v2\.0\/token/);
  assert.match(requests[1].url, /calendarView/);

  const authHeader = new Headers(requests[1].init?.headers)
    .get("Authorization");

  assert.equal(authHeader, "Bearer fake-test-token");
});
