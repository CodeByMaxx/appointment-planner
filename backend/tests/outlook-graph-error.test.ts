import test from "node:test";
import assert from "node:assert/strict";

test("behandelt einen Berechtigungsfehler von Microsoft Graph korrekt", async (t) => {
  process.env.MS_TENANT_ID = "test-tenant";
  process.env.MS_CLIENT_ID = "test-client";
  process.env.MS_CLIENT_SECRET = "test-secret";
  process.env.MS_CALENDAR_EMAIL = "calendar@example.test";

  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = (async (
    input: string | URL | Request
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    requestedUrls.push(url);

    if (url.includes("/oauth2/v2.0/token")) {
      return new Response(
        JSON.stringify({
          access_token: "fake-error-test-token",
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: {
          code: "ErrorAccessDenied",
          message: "Access denied",
        },
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;

    delete process.env.MS_TENANT_ID;
    delete process.env.MS_CLIENT_ID;
    delete process.env.MS_CLIENT_SECRET;
    delete process.env.MS_CALENDAR_EMAIL;
  });

  const { getCalendarEvents } = await import("../src/lib/outlook/graph");

  await assert.rejects(
    getCalendarEvents(
      new Date("2026-10-26T08:00:00.000Z"),
      new Date("2026-10-26T12:00:00.000Z")
    ),
    /Microsoft Graph fehlgeschlagen \(HTTP 403, ErrorAccessDenied\)/
  );

  assert.equal(requestedUrls.length, 2);
});
