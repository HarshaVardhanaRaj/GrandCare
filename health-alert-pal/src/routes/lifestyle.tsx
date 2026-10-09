import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { readLifestyle, saveLifestyle, type Lifestyle } from "@/lib/prescriptions";
import { useT, type Key } from "@/lib/i18n";
import { autoSyncOn, syncAllAlerts } from "@/lib/calendar-sync";

export const Route = createFileRoute("/lifestyle")({
  head: () => ({
    meta: [
      { title: "Your daily routine — Dose" },
      { name: "description", content: "Tell us when you eat so your medicine reminders match your day." },
      { property: "og:title", content: "Your daily routine — Dose" },
      { property: "og:description", content: "Tell us when you eat so your medicine reminders match your day." },
    ],
  }),
  component: LifestylePage,
});

const field = "w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring";

function LifestylePage() {
  const { t } = useT();
  const [l, setL] = useState<Lifestyle>({ breakfast: "", lunch: "", dinner: "" });
  const [warn, setWarn] = useState(false);
  const [saving, setSaving] = useState(false);
  const done = useRef(false);
  const navigate = useNavigate();
  useEffect(() => {
    const saved = readLifestyle();
    if (saved) setL(saved);
  }, []);
  const complete = !!(l.breakfast && l.lunch && l.dinner);

  useBlocker({
    shouldBlockFn: () => {
      if (done.current) return false;
      setWarn(true);
      return true;
    },
    enableBeforeUnload: () => !done.current,
  });

  const meals: { k: keyof Lifestyle; label: Key }[] = [
    { k: "breakfast", label: "life.breakfast" },
    { k: "lunch", label: "life.lunch" },
    { k: "dinner", label: "life.dinner" },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 pb-20 sm:px-6">
        <h1 className="break-words py-4 text-4xl font-semibold sm:py-6 sm:text-5xl">{t("life.title")}</h1>
        <p className="mb-6 text-muted-foreground">{t("life.subtitle")}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!complete) return setWarn(true);
            saveLifestyle(l);
            done.current = true;
            // Alerts now have times: add them to Google Calendar if the user opted in at sign-up.
            // On failure, the per-alert buttons on the home page are the fallback.
            if (autoSyncOn()) {
              setSaving(true);
              await syncAllAlerts(t).catch(() => {});
            }
            navigate({ to: "/" });
          }}
          className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6"
        >
          {meals.map((m) => (
            <div key={m.k}>
              <label className="mb-1 block text-sm font-semibold">{t(m.label)}</label>
              <input type="time" required className={field} value={l[m.k]} onChange={(e) => setL({ ...l, [m.k]: e.target.value })} />
            </div>
          ))}
          {warn && (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {t("life.warn")}
            </p>
          )}
          <button disabled={!complete || saving} className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40">
            {t(saving ? "common.saving" : "life.continue")}
          </button>
        </form>
      </main>
    </div>
  );
}
