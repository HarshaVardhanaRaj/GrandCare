import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { isActive, usePrescriptions, type Slot, type Meal } from "@/lib/prescriptions";
import { useT, type Key } from "@/lib/i18n";
import { removeEvent } from "@/lib/google-calendar";
import { autoSyncOn, syncAllAlerts } from "@/lib/calendar-sync";

export const Route = createFileRoute("/prescriptions")({
  head: () => ({
    meta: [
      { title: "Add a prescription — Dose" },
      { name: "description", content: "Add a prescription by photo, manual entry, or prescription number." },
      { property: "og:title", content: "Add a prescription — Dose" },
      { property: "og:description", content: "Add a prescription by photo, manual entry, or prescription number." },
    ],
  }),
  component: PrescriptionsPage,
});

type Mode = "image" | "manual" | "number";
const field = "w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring";

function PrescriptionsPage() {
  const { t } = useT();
  const { items, add, remove } = usePrescriptions();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("image");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeNotice, setRemoveNotice] = useState(false);

  // Removing an alert also stops its repeating Google Calendar event.
  const removeRx = async (p: (typeof items)[number]) => {
    setRemoveNotice(false);
    if (p.calendarEventId) {
      setRemoving(p.id);
      await removeEvent(p.calendarEventId).catch(() => setRemoveNotice(true));
      setRemoving(null);
    }
    remove(p.id);
  };
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", dosage: "", slot: "", meal: "", reference: "", days: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  // Course length: empty means lifetime, otherwise a whole number of days.
  const courseDays = f.days.trim() === "" ? undefined : Number(f.days);
  const courseOk = courseDays === undefined || (Number.isInteger(courseDays) && courseDays >= 1);
  const canSubmit =
    mode === "image"
      ? !!file
      : mode === "number"
        ? f.reference.trim() !== ""
        : f.name.trim() !== "" && courseOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || saving) return;
    add({
      source: mode,
      name: f.name || (mode === "image" ? `Prescription photo` : `Rx #${f.reference}`),
      dosage: f.dosage,
      ...(mode !== "number" && f.slot ? { slot: f.slot as Slot } : {}),
      ...(mode !== "number" && f.meal ? { meal: f.meal as Meal } : {}),
      ...(f.reference ? { reference: f.reference } : {}),
      ...(file ? { imageName: file.name } : {}),
      ...(mode === "manual" && courseDays ? { courseDays } : {}),
    });
    // Opted in at sign-up: add the new alert to Google Calendar. On failure, the
    // per-alert button on the home page is the fallback.
    if (autoSyncOn()) {
      setSaving(true);
      await syncAllAlerts(t).catch(() => {});
    }
    navigate({ to: "/" });
  };

  const tabs: { id: Mode; label: Key }[] = [
    { id: "image", label: "rx.tabImage" },
    { id: "manual", label: "rx.tabManual" },
    { id: "number", label: "rx.tabNumber" },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid max-w-5xl gap-10 px-4 pb-20 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <section>
          <h1 className="break-words py-4 text-4xl font-semibold sm:py-6 sm:text-5xl">{t("rx.title")}</h1>
          <div className="mb-6 flex flex-wrap gap-1 rounded-3xl bg-muted p-1 sm:rounded-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`flex-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition ${
                  mode === tab.id ? "bg-card text-foreground shadow" : "text-muted-foreground"
                }`}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
            {mode === "image" && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted p-8 text-center">
                {preview ? (
                  <img src={preview} alt={t("rx.previewAlt")} className="max-h-56 rounded-lg" />
                ) : (
                  <>
                    <span className="font-display text-xl">{t("rx.dropPhoto")}</span>
                    <span className="text-sm text-muted-foreground">{t("rx.photoHint")}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setFile(file);
                    setPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </label>
            )}

            {mode === "number" && (
              <div>
                <label className="mb-1 block text-sm font-semibold">{t("rx.number")}</label>
                <input className={field} inputMode="numeric" placeholder={t("rx.numberPlaceholder")} value={f.reference} onChange={set("reference")} />
              </div>
            )}

            {mode === "manual" && (
              <div>
                <label className="mb-1 block text-sm font-semibold">{t("rx.medName")}</label>
                <input className={field} placeholder={t("rx.medPlaceholder")} value={f.name} onChange={set("name")} />
              </div>
            )}

            {mode !== "number" && <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-semibold">{t("rx.dosage")}</label>
                <input className={field} placeholder="500 mg" value={f.dosage} onChange={set("dosage")} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">{t("rx.when")}</label>
                <select className={field} value={f.slot} onChange={set("slot")}>
                  <option value="">{t("rx.select")}</option>
                  <option value="morning">{t("slot.morning")}</option>
                  <option value="evening">{t("slot.evening")}</option>
                  <option value="night">{t("slot.night")}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">{t("rx.food")}</label>
                <select className={field} value={f.meal} onChange={set("meal")}>
                  <option value="">{t("rx.select")}</option>
                  <option value="before">{t("meal.before")}</option>
                  <option value="after">{t("meal.after")}</option>
                </select>
              </div>
            </div>}

            {mode === "manual" && (
              <div>
                <label htmlFor="course-days" className="mb-1 block text-sm font-semibold">{t("rx.course")}</label>
                <div className="relative">
                  <input
                    id="course-days"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    className={`${field} pr-20`}
                    placeholder={`${t("rx.lifetime")} (∞)`}
                    value={f.days}
                    onChange={set("days")}
                    aria-describedby="course-hint"
                    aria-invalid={!courseOk}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted-foreground">
                    {t("rx.days")}
                  </span>
                </div>
                <p id="course-hint" className={`mt-1 text-xs ${courseOk ? "text-muted-foreground" : "font-semibold text-destructive"}`}>
                  {t("rx.courseHint")}
                </p>
              </div>
            )}

            <button
              disabled={!canSubmit || saving}
              className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {t(saving ? "common.saving" : "rx.save")}
            </button>
          </form>
        </section>

        <aside className="md:pt-28">
          <h2 className="mb-4 text-2xl font-semibold">{t("rx.yours")}</h2>
          {removeNotice && (
            <p className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {t("rx.calRemoveFailed")}
            </p>
          )}
          {items.length === 0 ? (
            <p className="text-muted-foreground">{t("rx.none")}</p>
          ) : (
            <ul className="space-y-3">
              {items.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
                  <div>
                    <p className="font-semibold">{p.source === "image" ? t("rx.photoName") : p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(p.source === "image" ? "rx.fromPhoto" : p.source === "number" ? "rx.fromNumber" : "rx.manual")}
                      {p.slot && ` · ${t(`slot.${p.slot}`)}`}{p.meal && `, ${t(`meal.${p.meal}`)}`}
                      {p.source === "manual" &&
                        ` · ${p.courseDays ? t("rx.forDays", { n: String(p.courseDays) }) : t("rx.lifetime")}`}
                    </p>
                    {!isActive(p) && (
                      <p className="text-xs font-semibold text-muted-foreground">{t("rx.finished")}</p>
                    )}
                  </div>
                  <button
                    disabled={removing === p.id}
                    onClick={() => void removeRx(p)}
                    className="text-sm text-destructive hover:underline">
                    {t(removing === p.id ? "rx.removing" : "rx.remove")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
    </div>
  );
}
