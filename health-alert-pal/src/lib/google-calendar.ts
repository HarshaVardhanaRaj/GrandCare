/**
 * Google Calendar via Google Identity Services (browser-only OAuth token flow).
 * The access token lives in sessionStorage like the rest of the app's data, so it
 * survives a refresh but closing the tab signs the user out.
 */

const CLIENT_ID = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined;
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void };
type Gis = {
  accounts: {
    oauth2: {
      initTokenClient: (c: {
        client_id: string;
        scope: string;
        login_hint?: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string }) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  };
};
declare global {
  interface Window {
    google?: Gis;
  }
}

export const calendarConfigured = () => !!CLIENT_ID;

type Token = { value: string; expires: number };
const TOKEN_KEY = "gcal_token";

function getToken(): Token | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null") as Token | null;
    return t && t.expires > Date.now() ? t : null;
  } catch {
    return null;
  }
}

function setToken(t: Token | null) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: user will be asked to sign in again
  }
}
let gisLoading: Promise<Gis> | null = null;

function loadGis(): Promise<Gis> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error("gis")));
    s.onerror = () => {
      gisLoading = null;
      reject(new Error("gis"));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** Start loading Google's script early so the sign-in popup opens straight from the click. */
export const preloadGoogle = () => {
  if (CLIENT_ID) loadGis().catch(() => {});
};

export const isConnected = () => !!getToken();

/** Opens Google's consent popup if needed. Must be called from a click. */
export async function connect(loginHint?: string): Promise<string> {
  if (!CLIENT_ID) throw new Error("not-configured");
  const saved = getToken();
  if (saved) return saved.value;
  const gis = await loadGis();
  return new Promise((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ...(loginHint ? { login_hint: loginHint } : {}),
      callback: (r) => {
        if (!r.access_token) return reject(new Error(r.error ?? "denied"));
        setToken({
          value: r.access_token,
          expires: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000,
        });
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.type)),
    });
    client.requestAccessToken();
  });
}

export function disconnect() {
  const t = getToken();
  if (t && window.google) window.google.accounts.oauth2.revoke(t.value);
  setToken(null);
}

export type DailyEvent = {
  title: string;
  description: string;
  time: string;
  /** Last moment the event may occur; omit to repeat forever. */
  until?: Date;
};

/** Creates a daily repeating event at `time` (HH:MM, local) with a pop-up reminder. Returns the event id. */
export async function addDailyEvent(e: DailyEvent): Promise<string> {
  const access = await connect();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [h = 0, m = 0] = e.time.split(":").map(Number);
  const start = new Date();
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + 10 * 60_000);
  const local = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: e.title,
      description: e.description,
      start: { dateTime: local(start), timeZone: tz },
      end: { dateTime: local(end), timeZone: tz },
      recurrence: [e.until ? `RRULE:FREQ=DAILY;UNTIL=${utcStamp(e.until)}` : "RRULE:FREQ=DAILY"],
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] },
    }),
  });
  if (res.status === 401) setToken(null);
  if (!res.ok) throw new Error(`calendar-${res.status}`);
  return ((await res.json()) as { id: string }).id;
}

/** Deletes an event we created, signing in to Google again if needed, so call it from a click. */
export async function removeEvent(id: string): Promise<void> {
  const access = await connect();
  const res = await fetch(`${API}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${access}` },
  });
  if (res.status === 401) setToken(null);
  // 404/410: the user already deleted it in Google Calendar, which is fine.
  if (!res.ok && res.status !== 404 && res.status !== 410)
    throw new Error(`calendar-${res.status}`);
}

const pad = (n: number) => String(n).padStart(2, "0");
/** RFC 5545 UTC timestamp, e.g. 20261015T183000Z (Google requires UTC for UNTIL). */
const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
