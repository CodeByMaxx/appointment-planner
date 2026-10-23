import { isOutlookConfigured, outlookConfig } from "./config";

interface GraphTokenResponse {
  access_token: string;
  expires_in: number;
}

interface GraphErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface OutlookEvent {
  id: string;
  subject?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  showAs?: string;
  isCancelled?: boolean;
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (!isOutlookConfigured()) {
    throw new Error(
      "Outlook ist nicht konfiguriert. Microsoft-Einstellungen fehlen."
    );
  }

  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const tokenUrl =
    `https://login.microsoftonline.com/` +
    `${encodeURIComponent(outlookConfig.tenantId)}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: outlookConfig.clientId,
    client_secret: outlookConfig.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `Microsoft-Anmeldung fehlgeschlagen (HTTP ${response.status}).`
    );
  }

  const token = (await response.json()) as GraphTokenResponse;

  if (!token.access_token || !token.expires_in) {
    throw new Error("Microsoft hat kein gültiges Zugriffstoken geliefert.");
  }

  cachedToken = token.access_token;
  tokenExpiresAt = Date.now() + Math.max(token.expires_in - 60, 0) * 1000;

  return cachedToken;
}

function getGraphUrl(path: string): string {
  const url = path.startsWith("https://")
    ? new URL(path)
    : new URL(`/v1.0${path}`, "https://graph.microsoft.com");

  if (
    url.protocol !== "https:" ||
    url.hostname !== "graph.microsoft.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    !url.pathname.startsWith("/v1.0/")
  ) {
    throw new Error("Ungültige Microsoft-Graph-URL.");
  }

  return url.toString();
}

async function graphRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken();

  const url = path.startsWith("https://graph.microsoft.com/")
    ? path
    : `https://graph.microsoft.com/v1.0${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...options.headers,
    },
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    let details = "";

    try {
      const errorBody = (await response.json()) as GraphErrorResponse;
      details = errorBody.error?.code ?? "";
    } catch {
      // Die Fehlerantwort war kein JSON.
    }

    throw new Error(
      `Microsoft Graph fehlgeschlagen (HTTP ${response.status}` +
        `${details ? `, ${details}` : ""}).`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getCalendarEvents(
  startUtc: Date,
  endUtc: Date
): Promise<OutlookEvent[]> {
  if (startUtc >= endUtc) {
    throw new Error("Der Kalenderzeitraum ist ungültig.");
  }

  const query = new URLSearchParams({
    startDateTime: startUtc.toISOString(),
    endDateTime: endUtc.toISOString(),
    "$select": "id,subject,start,end,showAs,isCancelled",
    "$top": "100",
  });

  let nextUrl: string | undefined =
    `https://graph.microsoft.com/v1.0/users/` +
    `${encodeURIComponent(outlookConfig.calendarEmail)}` +
    `/calendarView?${query.toString()}`;

  const events: OutlookEvent[] = [];

  while (nextUrl) {
    const result: {
      value: OutlookEvent[];
      "@odata.nextLink"?: string;
    } = await graphRequest<{
      value: OutlookEvent[];
      "@odata.nextLink"?: string;
    }>(nextUrl, {
      headers: {
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    events.push(...result.value);
    nextUrl = result["@odata.nextLink"];
  }

  return events;
}

export async function createCalendarEvent(input: {
  subject: string;
  startUtc: Date;
  endUtc: Date;
  body?: string;
}): Promise<OutlookEvent> {
  if (input.startUtc >= input.endUtc) {
    throw new Error("Die Endzeit muss nach der Startzeit liegen.");
  }

  return graphRequest<OutlookEvent>(
    `/users/${encodeURIComponent(outlookConfig.calendarEmail)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: 'outlook.timezone="UTC"',
      },
      body: JSON.stringify({
        subject: input.subject,
        body: {
          contentType: "text",
          content: input.body ?? "",
        },
        start: {
          dateTime: input.startUtc.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: input.endUtc.toISOString(),
          timeZone: "UTC",
        },
        showAs: "busy",
      }),
    }
  );
}

export async function deleteCalendarEvent(
  eventId: string
): Promise<void> {
  if (!eventId.trim()) {
    throw new Error("Die Outlook-Termin-ID fehlt.");
  }

  const path =
    `/users/${encodeURIComponent(outlookConfig.calendarEmail)}` +
    `/events/${encodeURIComponent(eventId)}`;

  await graphRequest<void>(path, {
    method: "DELETE",
  });
}
