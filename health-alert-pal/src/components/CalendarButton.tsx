import { useState } from "react";
import { CalendarCheck, CalendarPlus } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { Prescription } from "@/lib/prescriptions";
import { addDailyEvent, calendarConfigured } from "@/lib/google-calendar";
import { calendarErrorKey, eventFor, type CalendarErrorKey } from "@/lib/calendar-sync";

type Props = { rx: Prescription; at: string | null; onAdded: (eventId: string) => void };

export function CalendarButton({ rx, at, onAdded }: Props) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CalendarErrorKey | null>(null);

  if (rx.calendarEventId) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        <CalendarCheck className="h-4 w-4" /> {t("cal.added")}
      </p>
    );
  }
  if (!at) return <p className="mt-2 text-xs text-muted-foreground">{t("cal.needsTime")}</p>;

  const add = async () => {
    if (!calendarConfigured()) return setError("cal.notConfigured");
    setBusy(true);
    setError(null);
    try {
      onAdded(await addDailyEvent(eventFor(rx, at, t)));
    } catch (e) {
      setError(calendarErrorKey(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
      >
        <CalendarPlus className="h-4 w-4" /> {t(busy ? "cal.adding" : "cal.add")}
      </button>
      {error && <p className="mt-1 text-xs font-semibold text-destructive">{t(error)}</p>}
    </div>
  );
}
