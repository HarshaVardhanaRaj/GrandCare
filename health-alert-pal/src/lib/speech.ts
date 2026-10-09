import type { Lang } from "@/lib/i18n";

export type SpeakResult = "ok" | "blocked" | "unsupported";

const speechLang: Record<Lang, string> = { en: "en-US", ta: "ta-IN", es: "es-ES" };

let audioCtx: AudioContext | null = null;

/** Three loud, rising beeps to grab attention before the voice starts. */
async function chime(): Promise<boolean> {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return true;
  audioCtx ??= new Ctx();
  if (audioCtx.state === "suspended") await audioCtx.resume().catch(() => {});
  if (audioCtx.state !== "running") return false;

  const start = audioCtx.currentTime + 0.05;
  [660, 880, 1100].forEach((freq, i) => {
    const t = start + i * 0.32;
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain).connect(audioCtx!.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
  await new Promise((r) => setTimeout(r, 1100));
  return true;
}

/** Voices load asynchronously in some browsers; wait briefly for them. */
function voices(): Promise<SpeechSynthesisVoice[]> {
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1000);
  });
}

/**
 * Chime, then read `text` aloud at full volume in `lang`. If the device has no
 * voice for that language, `fallbackText` (English) is read instead so the user
 * still hears which medicine to take.
 */
export async function speakAlert(
  text: string,
  lang: Lang,
  fallbackText: string,
): Promise<SpeakResult> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return "unsupported";
  if (!(await chime())) return "blocked";

  const all = await voices();
  const code = speechLang[lang];
  const pick = (c: string) =>
    all.find((v) => v.lang.replace("_", "-") === c && v.localService) ??
    all.find((v) => v.lang.replace("_", "-").startsWith(c.slice(0, 2)));
  const voice = pick(code);
  const useFallback = !voice && lang !== "en";

  const u = new SpeechSynthesisUtterance(useFallback ? fallbackText : text);
  u.lang = useFallback ? speechLang.en : code;
  u.voice = useFallback ? (pick(speechLang.en) ?? null) : (voice ?? null);
  u.volume = 1;
  u.rate = 0.9;

  speechSynthesis.cancel();
  return new Promise((resolve) => {
    u.onend = () => resolve("ok");
    u.onerror = (e) => resolve(e.error === "not-allowed" ? "blocked" : "ok");
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
}
