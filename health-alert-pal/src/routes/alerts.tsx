import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { translate, useT, type Translate } from "@/lib/i18n";
import {
  alarmTime,
  isActive,
  readLifestyle,
  usePrescriptions,
  type Lifestyle,
  type Prescription,
} from "@/lib/prescriptions";
import { speakAlert, stopSpeaking } from "@/lib/speech";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Medication alert — Dose" },
      {
        name: "description",
        content: "Time to take your medicine: mark it taken or snooze for later.",
      },
      { property: "og:title", content: "Medication alert — Dose" },
      {
        property: "og:description",
        content: "Time to take your medicine: mark it taken or snooze for later.",
      },
    ],
  }),
  component: AlertPage,
});

const REPEAT_MS = 20_000;
const MAX_PLAYS = 5;
const GRACE_MIN = 30;

type Group = { at: string | null; meal: Prescription["meal"]; items: Prescription[] };

/**
 * Demo: the next due timing (same time of day and before/after food) with every
 * active prescription that shares it. Alerts up to 30 min overdue still count as now.
 */
function nextDueGroup(items: Prescription[], life: Lifestyle | null): Group | undefined {
  const d = new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  const groups = new Map<string, Group & { rank: number }>();
  items
    .filter((p) => isActive(p))
    .forEach((p, i) => {
      const at = alarmTime(p, life);
      const [h = 0, m = 0] = (at ?? "").split(":").map(Number);
      const rank = at ? (h * 60 + m - now + GRACE_MIN + 1440) % 1440 : 1440 + i;
      const key = p.slot && p.meal ? `${p.slot}|${p.meal}` : p.id;
      const g = groups.get(key);
      if (g) g.items.push(p);
      else groups.set(key, { at, meal: p.meal, items: [p], rank });
    });
  return [...groups.values()].sort((a, b) => a.rank - b.rank)[0];
}

const drugName = (p: Prescription, tr: Translate) =>
  p.source === "image" ? tr("rx.photoName") : p.name;

/** Spoken text for a group, e.g. "Take 500 mg of A and 1 tablet of B. Before food." */
function spoken(g: Group, tr: Translate) {
  const [only] = g.items;
  let text: string;
  if (g.items.length === 1 && only) {
    const name = drugName(only, tr);
    text = only.dosage
      ? tr("alert.speak", { dosage: only.dosage, name })
      : tr("alert.speakNoDose", { name });
  } else {
    const parts = g.items.map((p) =>
      p.dosage ? tr("alert.item", { dosage: p.dosage, name: drugName(p, tr) }) : drugName(p, tr),
    );
    const list = `${parts.slice(0, -1).join(", ")} ${tr("common.and")} ${parts.at(-1)}`;
    text = tr("alert.speakMany", { list });
  }
  return g.meal ? `${text} ${tr(`meal.${g.meal}`)}.` : text;
}

function AlertPage() {
  const { t, lang } = useT();
  const { items } = usePrescriptions();
  const [life, setLife] = useState<Lifestyle | null>(null);
  useEffect(() => setLife(readLifestyle()), []);
  const [status, setStatus] = useState<"pending" | "taken" | "later">("pending");
  const [voice, setVoice] = useState<"idle" | "playing" | "blocked" | "unsupported">("idle");
  const run = useRef(0);

  const due = nextDueGroup(items, life);
  const rx = due?.items[0];
  const many = (due?.items.length ?? 0) > 1;

  const stop = () => {
    run.current++;
    stopSpeaking();
    setVoice((v) => (v === "playing" ? "idle" : v));
  };

  // Chime + spoken reminder, repeated until the user responds.
  const announce = async () => {
    if (!due) return;
    const id = ++run.current;

    for (let i = 0; i < MAX_PLAYS && run.current === id; i++) {
      setVoice("playing");
      const result = await speakAlert(spoken(due, t), lang, spoken(due, translate("en")));
      if (run.current !== id) return;
      if (result !== "ok") return setVoice(result);
      setVoice("idle");
      await new Promise((r) => setTimeout(r, REPEAT_MS));
    }
  };

  useEffect(() => {
    if (status === "pending" && rx) void announce();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due?.items.map((p) => p.id).join(), status, lang]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-8 text-center sm:px-6 sm:py-12">
        {!due || !rx ? (
          <div className="w-full rounded-3xl border border-dashed bg-card p-8">
            <h1 className="text-3xl font-semibold">{t("alert.emptyTitle")}</h1>
            <p className="mt-2 text-muted-foreground">{t("alert.emptyBody")}</p>
            <Link
              to="/prescriptions"
              className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground"
            >
              {t("home.add")}
            </Link>
          </div>
        ) : (
          <>
            <span className="mb-6 h-4 w-4 animate-pulse rounded-full bg-warning" />
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              {t("alert.kicker")}
            </p>
            {due.at && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("alert.dueAt", { time: due.at })}
              </p>
            )}
            <div className="mt-6 w-full rounded-3xl border bg-card p-6 shadow-lg sm:p-10">
              {many ? (
                <>
                  <h1 className="text-3xl font-semibold sm:text-4xl">
                    {t("alert.count", { n: String(due.items.length) })}
                  </h1>
                  <ul className="mt-5 divide-y text-left">
                    {due.items.map((p) => (
                      <li key={p.id} className="flex items-baseline justify-between gap-4 py-3">
                        <span className="min-w-0 break-words text-xl font-semibold">
                          {drugName(p, t)}
                        </span>
                        <span className="shrink-0 font-display text-xl font-semibold text-primary">
                          {p.dosage || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <h1 className="break-words text-4xl font-semibold sm:text-5xl">
                    {drugName(rx, t)}
                  </h1>
                  <p className="mt-4 text-muted-foreground">{t("alert.dosage")}</p>
                  <p className="font-display text-4xl font-semibold text-primary">
                    {rx.dosage || "—"}
                  </p>
                </>
              )}
              {due.meal && (
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  {t(`meal.${due.meal}`)}
                </p>
              )}

              {status === "pending" && (
                <button
                  type="button"
                  onClick={() => (voice === "playing" ? stop() : void announce())}
                  className={`mt-6 inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold ${
                    voice === "playing" ? "border-primary text-primary" : ""
                  }`}
                >
                  {voice === "playing" ? (
                    <>
                      <VolumeX className="h-4 w-4" /> {t("alert.stop")}
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" /> {t("alert.play")}
                    </>
                  )}
                </button>
              )}
              {voice === "playing" && (
                <p
                  className="mt-2 animate-pulse text-sm font-semibold text-primary"
                  aria-live="polite"
                >
                  {t("alert.playing")}
                </p>
              )}
              {voice === "blocked" && (
                <p className="mt-3 rounded-xl bg-warning/15 p-3 text-sm font-semibold">
                  {t("alert.blocked")}
                </p>
              )}

              {status === "pending" ? (
                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => setStatus("later")}
                    className="flex-1 rounded-full border py-3 font-semibold"
                  >
                    {t("alert.later")}
                  </button>
                  <button
                    onClick={() => setStatus("taken")}
                    className="flex-1 rounded-full bg-primary py-3 font-semibold text-primary-foreground"
                  >
                    {t("alert.taken")}
                  </button>
                </div>
              ) : (
                <div className="mt-8 space-y-3">
                  <p className="font-semibold">
                    {t(status === "taken" ? "alert.takenMsg" : "alert.laterMsg")}
                  </p>
                  <button
                    onClick={() => setStatus("pending")}
                    className="text-sm text-muted-foreground underline"
                  >
                    {t("alert.undo")}
                  </button>
                </div>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{t("alert.volumeHint")}</p>
          </>
        )}
      </main>
    </div>
  );
}
