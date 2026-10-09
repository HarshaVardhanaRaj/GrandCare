import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarPlus, Globe, Menu, X } from "lucide-react";
import { saveUser, setAutoCalendar } from "@/lib/prescriptions";
import { calendarConfigured } from "@/lib/google-calendar";
import { calendarErrorKey, syncAllAlerts, type CalendarErrorKey } from "@/lib/calendar-sync";
import { languages, useT, type Key, type Lang } from "@/lib/i18n";

const links: { to: "/" | "/alerts" | "/prescriptions" | "/lifestyle"; label: Key }[] = [
  { to: "/", label: "nav.home" },
  { to: "/alerts", label: "nav.alerts" },
  { to: "/prescriptions", label: "nav.prescriptions" },
  { to: "/lifestyle", label: "nav.lifestyle" },
];

export function SiteHeader() {
  const { t, lang, setLang } = useT();
  const cls =
    "rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground";
  const active = { className: "bg-secondary text-secondary-foreground" };
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const valid = /^\S+@\S+\.\S+$/.test(email) && password.length >= 6;
  const [step, setStep] = useState<"account" | "calendar">("account");
  const [calBusy, setCalBusy] = useState(false);
  const [calError, setCalError] = useState<CalendarErrorKey | null>(null);

  const closeSignup = () => {
    if (calBusy) return;
    setOpen(false);
    setStep("account");
    setCalError(null);
  };
  const finishSignup = () => {
    setOpen(false);
    setStep("account");
    setCalError(null);
    navigate({ to: "/lifestyle" });
  };

  const navLinks = (extra = "") =>
    links.map((l) => (
      <Link
        key={l.to}
        to={l.to}
        className={`${cls} ${extra}`}
        activeProps={active}
        activeOptions={{ exact: l.to === "/" }}
        onClick={() => setMenuOpen(false)}
      >
        {t(l.label)}
      </Link>
    ));

  return (
    <header className="mx-auto max-w-5xl px-4 py-3 sm:px-6 lg:py-6">
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="font-display text-2xl font-semibold text-primary">
          Dose.
        </Link>

        <div className="flex items-center gap-1">
          <nav className="hidden items-center gap-1 lg:flex">{navLinks()}</nav>

          <label className="relative flex items-center rounded-full text-muted-foreground hover:text-foreground">
            <span className="sr-only">{t("nav.language")}</span>
            <Globe className="pointer-events-none absolute left-2.5 h-4 w-4" aria-hidden />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="cursor-pointer appearance-none rounded-full bg-transparent py-2 pl-8 pr-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
            >
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => setOpen(true)}
            className="whitespace-nowrap rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 lg:ml-2 lg:px-5"
          >
            {t("signup.button")}
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={t("nav.menu")}
            className="rounded-full p-2 text-foreground hover:bg-muted lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="mt-3 flex flex-col gap-1 rounded-2xl border bg-card p-2 shadow-lg lg:hidden">
          {navLinks("block")}
        </nav>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={closeSignup}
        >
          {step === "account" ? (
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                if (!valid) return;
                saveUser(email.trim());
                if (calendarConfigured()) setStep("calendar");
                else finishSignup();
              }}
              className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-6 shadow-xl"
            >
              <h2 className="text-2xl font-semibold">{t("signup.title")}</h2>
              <input
                type="email"
                required
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder={t("signup.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeSignup}
                  className="flex-1 rounded-full border py-3 font-semibold"
                >
                  {t("common.cancel")}
                </button>
                <button
                  disabled={!valid}
                  className="flex-1 rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40"
                >
                  {t("signup.button")}
                </button>
              </div>
            </form>
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="cal-step-title"
              className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-6 shadow-xl"
            >
              <CalendarPlus className="h-8 w-8 text-primary" aria-hidden />
              <h2 id="cal-step-title" className="text-2xl font-semibold">
                {t("signup.calTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("signup.calBody")}</p>
              <p className="text-sm font-semibold">{email.trim()}</p>
              {calError && <p className="text-sm font-semibold text-destructive">{t(calError)}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={calBusy}
                  onClick={() => {
                    setAutoCalendar(false);
                    finishSignup();
                  }}
                  className="flex-1 rounded-full border py-3 font-semibold disabled:opacity-40"
                >
                  {t("signup.calNo")}
                </button>
                <button
                  type="button"
                  disabled={calBusy}
                  onClick={async () => {
                    setCalBusy(true);
                    setCalError(null);
                    setAutoCalendar(true);
                    try {
                      await syncAllAlerts(t, email.trim());
                      finishSignup();
                    } catch (err) {
                      setAutoCalendar(false);
                      setCalError(calendarErrorKey(err));
                    } finally {
                      setCalBusy(false);
                    }
                  }}
                  className="flex-1 rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40"
                >
                  {t(calBusy ? "signup.calConnecting" : "signup.calYes")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
