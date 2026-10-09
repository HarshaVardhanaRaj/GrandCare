import type { Translate } from "@/lib/i18n";
import {
  alarmTime,
  courseEnd,
  isActive,
  patchPrescription,
  readLifestyle,
  readPrescriptions,
  readUser,
  type Prescription,
} from "@/lib/prescriptions";
import { addDailyEvent, calendarConfigured, connect, type DailyEvent } from "@/lib/google-calendar";

export function eventFor(rx: Prescription, at: string, t: Translate): DailyEvent {
  const name = rx.source === "image" ? t("rx.photoName") : rx.name;
  const until = courseEnd(rx);
  const lang = typeof document === "undefined" ? undefined : document.documentElement.lang;
  const stop = until
    ? t("cal.courseEnds", { date: until.toLocaleDateString(lang, { dateStyle: "long" }) })
    : t("cal.howToStop");
  return {
    ...(until ? { until } : {}),
    title: rx.dosage
      ? t("cal.eventTitle", { dosage: rx.dosage, name })
      : t("cal.eventTitleNoDose", { name }),
    description: [rx.meal && t(`meal.${rx.meal}`), t("cal.eventBody"), stop]
      .filter(Boolean)
      .join("\n"),
    time: at,
  };
}

/** True when the signed-up user chose to have every alert added to Google Calendar. */
export const autoSyncOn = () => calendarConfigured() && !!readUser()?.autoCalendar;

/**
 * Adds every prescription that has an alarm time and isn't in the calendar yet.
 * Signs in to Google first if needed, so call it from a click.
 */
export async function syncAllAlerts(t: Translate, loginHint?: string) {
  await connect(loginHint);
  const life = readLifestyle();
  let added = 0;
  for (const rx of readPrescriptions()) {
    const at = alarmTime(rx, life);
    if (!at || rx.calendarEventId || !isActive(rx)) continue;
    patchPrescription(rx.id, { calendarEventId: await addDailyEvent(eventFor(rx, at, t)) });
    added++;
  }
  return added;
}

export type CalendarErrorKey = "cal.notConfigured" | "cal.denied" | "cal.failed";

export function calendarErrorKey(e: unknown): CalendarErrorKey {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "not-configured") return "cal.notConfigured";
  return /popup_closed|access_denied|denied/.test(msg) ? "cal.denied" : "cal.failed";
}
