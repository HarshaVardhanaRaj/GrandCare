import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { useEffect, useState } from "react";
import { Clock, Infinity as InfinityIcon } from "lucide-react";
import { usePrescriptions, readLifestyle, alarmTime, daysLeft, isActive, type Lifestyle, type Prescription } from "@/lib/prescriptions";
import { useT } from "@/lib/i18n";
import { CalendarButton } from "@/components/CalendarButton";
import { disconnect, isConnected, preloadGoogle } from "@/lib/google-calendar";
import { autoSyncOn } from "@/lib/calendar-sync";
import { setAutoCalendar } from "@/lib/prescriptions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dose — Your medication alerts" },
      { name: "description", content: "See your active medication alerts at a glance." },
      { property: "og:title", content: "Dose — Your medication alerts" },
      { property: "og:description", content: "See your active medication alerts at a glance." },
    ],
  }),
  component: Home,
});

function Home() {
  const { t } = useT();
  // How long this alert keeps going: course countdown, or lifetime.
  const duration = (p: Prescription) => {
    const left = daysLeft(p);
    if (left === null) return t("rx.lifetime");
    return left === 1 ? t("home.lastDay") : t("home.daysLeft", { n: String(left) });
  };
  const { items, update } = usePrescriptions();
  const [life, setLife] = useState<Lifestyle | null>(null);
  const [connected, setConnected] = useState(false);
  const [autoOn, setAutoOn] = useState(false);
  useEffect(() => {
    setLife(readLifestyle());
    setConnected(isConnected());
    setAutoOn(autoSyncOn());
    preloadGoogle();
  }, []);
  // Courses that have finished no longer raise alerts.
  const sorted = items
    .filter((p) => isActive(p))
    .map((p) => ({ ...p, at: alarmTime(p, life) }))
    .sort((a, b) => (a.at ?? "99").localeCompare(b.at ?? "99"));
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <section className="flex flex-col gap-5 py-6 sm:py-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">{t("home.today")}</p>
            <h1 className="mt-2 break-words text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">{t("home.title")}</h1>
            <p className="mt-3 max-w-md text-muted-foreground">{t("home.subtitle")}</p>
          </div>
          <Link
            to="/prescriptions"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
          >
            {t("home.add")}
          </Link>
        </section>

        {!life && (
          <div className="mb-6 rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
            {t("home.lifestyleHintBefore")}{" "}
            <Link to="/lifestyle" className="font-semibold underline">{t("home.lifestyleHintLink")}</Link>{" "}
            {t("home.lifestyleHintAfter")}
          </div>
        )}
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
            <h2 className="text-2xl font-semibold">{t("home.emptyTitle")}</h2>
            <p className="mt-2 text-muted-foreground">{t("home.emptyBody")}</p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {sorted.map((p) => (
              <li key={p.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 sm:gap-5 sm:p-5">
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <span className="font-display text-lg font-semibold">{p.at ?? "--:--"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xl font-semibold">{p.source === "image" ? t("rx.photoName") : p.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {p.dosage ? t("home.take", { dosage: p.dosage }) : t("home.noDosage")}
                    {p.meal && ` · ${t(p.meal === "before" ? "meal.before" : "meal.after")}`}
                    {" · "}
                    <span className={`whitespace-nowrap font-semibold ${p.courseDays ? "text-primary" : ""}`}>
                      {p.courseDays ? (
                        <Clock className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
                      ) : (
                        <InfinityIcon className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
                      )}
                      {duration(p)}
                    </span>
                  </p>
                  <CalendarButton
                    rx={p}
                    at={p.at}
                    onAdded={(calendarEventId) => {
                      update(p.id, { calendarEventId });
                      setConnected(true);
                    }}
                  />
                </div>
                <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-warning" />
              </li>
            ))}
          </ul>
        )}
        {(connected || autoOn) && (
          <div className="mt-6 space-y-1 text-sm text-muted-foreground">
            {autoOn && <p>{t("cal.autoOn")}</p>}
            <button
              type="button"
              onClick={() => {
                disconnect();
                setAutoCalendar(false);
                setConnected(false);
                setAutoOn(false);
              }}
              className="underline"
            >
              {t("cal.disconnect")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
