import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ta" | "es";

export const languages: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ta", label: "தமிழ்" },
  { id: "es", label: "Español" },
];

const en = {
  "nav.home": "Active alerts",
  "nav.alerts": "Alerts",
  "nav.prescriptions": "Prescriptions",
  "nav.lifestyle": "Lifestyle",
  "nav.menu": "Menu",
  "nav.language": "Language",
  "signup.button": "Sign up",
  "signup.title": "Create your account",
  "signup.password": "Password (min 6 characters)",
  "common.cancel": "Cancel",

  "home.today": "Today",
  "home.title": "Active alerts",
  "home.subtitle": "Every dose you need to take, in one calm place.",
  "home.add": "+ Add prescription",
  "home.lifestyleHintBefore": "Add your meal times on the",
  "home.lifestyleHintLink": "Lifestyle page",
  "home.lifestyleHintAfter": "so we can set your alarm times.",
  "home.emptyTitle": "No active alerts",
  "home.emptyBody": "Add a prescription to start receiving reminders.",
  "home.take": "Take {dosage}",
  "home.noDosage": "Dosage not set",
  "cal.add": "Add to Google Calendar",
  "cal.adding": "Adding…",
  "cal.added": "In Google Calendar",
  "cal.needsTime": "Set a time to add it to your calendar",
  "cal.notConfigured": "Google Calendar isn't set up for this site yet.",
  "cal.denied": "Google sign-in was cancelled.",
  "cal.failed": "Couldn't add to Google Calendar. Please try again.",
  "cal.disconnect": "Disconnect Google",
  "cal.eventTitle": "Take {dosage} of {name}",
  "cal.eventTitleNoDose": "Take {name}",
  "cal.eventBody": "Medicine reminder from Dose.",
  "cal.courseEnds": "Repeats every day until {date}, the last day of the course.",
  "cal.howToStop":
    "Repeats every day until you remove this prescription in Dose. To stop it yourself, delete this event and choose “All events”.",
  "rx.removing": "Removing…",
  "rx.calRemoveFailed":
    "Removed here, but it couldn't be deleted from Google Calendar. Please delete the event there and choose “All events”.",
  "cal.autoOn": "New alerts are added to your Google Calendar automatically.",
  "signup.calTitle": "Add your alerts to Google Calendar?",
  "signup.calBody":
    "Get a daily reminder in your Google Calendar for every prescription, including ones you add later. Google will ask for permission next.",
  "signup.calYes": "Yes, add all alerts",
  "signup.calNo": "Not now",
  "signup.calConnecting": "Connecting to Google…",
  "common.saving": "Saving…",

  "rx.title": "Add a prescription",
  "rx.tabImage": "Upload image",
  "rx.tabManual": "Enter manually",
  "rx.tabNumber": "Prescription number",
  "rx.dropPhoto": "Drop or choose a photo",
  "rx.photoHint": "JPG or PNG of your prescription",
  "rx.previewAlt": "Prescription preview",
  "rx.number": "Prescription number",
  "rx.numberPlaceholder": "e.g. 4820193",
  "rx.medName": "Medication name",
  "rx.medPlaceholder": "e.g. Amoxicillin",
  "rx.dosage": "Dosage",
  "rx.when": "When",
  "rx.food": "Food",
  "rx.select": "Select",
  "rx.save": "Save prescription",
  "rx.yours": "Your prescriptions",
  "rx.none": "None added yet.",
  "rx.fromPhoto": "From photo",
  "rx.fromNumber": "From number",
  "rx.manual": "Manual",
  "rx.remove": "Remove",
  "rx.photoName": "Prescription photo",
  "rx.course": "Course length",
  "rx.days": "Days",
  "rx.lifetime": "Lifetime",
  "rx.courseHint": "Leave empty if it's for life.",
  "rx.forDays": "{n} days",
  "rx.finished": "Course finished",
  "home.daysLeft": "{n} days left",
  "home.lastDay": "Last day today",

  "slot.morning": "Morning",
  "slot.evening": "Evening",
  "slot.night": "Night",
  "meal.before": "Before food",
  "meal.after": "After food",

  "alert.kicker": "Time for your medicine",
  "alert.dosage": "Dosage",
  "alert.later": "Later",
  "alert.taken": "Taken",
  "alert.takenMsg": "Marked as taken. Well done!",
  "alert.laterMsg": "We'll remind you again later.",
  "alert.undo": "Undo",
  "alert.speak": "Time to take your medicine. Take {dosage} of {name}.",
  "alert.speakNoDose": "Time to take your medicine: {name}.",
  "alert.speakMany": "Time to take your medicines. Take {list}.",
  "alert.item": "{dosage} of {name}",
  "alert.count": "{n} medicines",
  "common.and": "and",
  "alert.play": "Play alert",
  "alert.stop": "Stop",
  "alert.playing": "Speaking…",
  "alert.blocked": "Your browser blocked the sound. Tap “Play alert” to hear it.",
  "alert.volumeHint": "Keep your volume turned up so you don't miss your alerts.",
  "alert.dueAt": "Due at {time}",
  "alert.emptyTitle": "No prescriptions yet",
  "alert.emptyBody": "Add a prescription and its alert will show up here.",

  "life.title": "Your daily routine",
  "life.subtitle": "When do you usually eat? We'll time your reminders around your meals.",
  "life.breakfast": "Breakfast time",
  "life.lunch": "Lunch time",
  "life.dinner": "Dinner time",
  "life.warn": "Please fill in all meal times and press Continue before leaving this page.",
  "life.continue": "Continue",
};

export type Key = keyof typeof en;

const ta: Record<Key, string> = {
  "nav.home": "செயலில் உள்ள நினைவூட்டல்கள்",
  "nav.alerts": "நினைவூட்டல்கள்",
  "nav.prescriptions": "மருந்துச் சீட்டுகள்",
  "nav.lifestyle": "வாழ்க்கை முறை",
  "nav.menu": "பட்டியல்",
  "nav.language": "மொழி",
  "signup.button": "பதிவு செய்க",
  "signup.title": "உங்கள் கணக்கை உருவாக்குங்கள்",
  "signup.password": "கடவுச்சொல் (குறைந்தது 6 எழுத்துகள்)",
  "common.cancel": "ரத்து செய்",

  "home.today": "இன்று",
  "home.title": "செயலில் உள்ள நினைவூட்டல்கள்",
  "home.subtitle": "நீங்கள் எடுக்க வேண்டிய ஒவ்வொரு மருந்தும், ஒரே அமைதியான இடத்தில்.",
  "home.add": "+ மருந்துச் சீட்டைச் சேர்",
  "home.lifestyleHintBefore": "உங்கள் அலாரம் நேரங்களை அமைக்க,",
  "home.lifestyleHintLink": "வாழ்க்கை முறை பக்கத்தில்",
  "home.lifestyleHintAfter": "உங்கள் உணவு நேரங்களைச் சேர்க்கவும்.",
  "home.emptyTitle": "செயலில் உள்ள நினைவூட்டல்கள் இல்லை",
  "home.emptyBody": "நினைவூட்டல்களைப் பெற ஒரு மருந்துச் சீட்டைச் சேர்க்கவும்.",
  "home.take": "{dosage} எடுக்கவும்",
  "home.noDosage": "அளவு அமைக்கப்படவில்லை",
  "cal.add": "Google Calendar-இல் சேர்",
  "cal.adding": "சேர்க்கிறது…",
  "cal.added": "Google Calendar-இல் உள்ளது",
  "cal.needsTime": "நாட்காட்டியில் சேர்க்க ஒரு நேரத்தை அமைக்கவும்",
  "cal.notConfigured": "இந்தத் தளத்திற்கு Google Calendar இன்னும் அமைக்கப்படவில்லை.",
  "cal.denied": "Google உள்நுழைவு ரத்து செய்யப்பட்டது.",
  "cal.failed": "Google Calendar-இல் சேர்க்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
  "cal.disconnect": "Google-இலிருந்து துண்டி",
  "cal.eventTitle": "{name} {dosage} எடுக்கவும்",
  "cal.eventTitleNoDose": "{name} எடுக்கவும்",
  "cal.eventBody": "Dose வழங்கும் மருந்து நினைவூட்டல்.",
  "cal.courseEnds": "சிகிச்சையின் கடைசி நாளான {date} வரை தினமும் மீண்டும் வரும்.",
  "cal.howToStop":
    "Dose-இல் இந்த மருந்துச் சீட்டை நீக்கும் வரை தினமும் மீண்டும் வரும். நீங்களே நிறுத்த, இந்த நிகழ்வை நீக்கி “அனைத்து நிகழ்வுகளும்” என்பதைத் தேர்ந்தெடுக்கவும்.",
  "rx.removing": "நீக்குகிறது…",
  "rx.calRemoveFailed":
    "இங்கே நீக்கப்பட்டது, ஆனால் Google Calendar-இலிருந்து நீக்க முடியவில்லை. அங்கே நிகழ்வை நீக்கி “அனைத்து நிகழ்வுகளும்” என்பதைத் தேர்ந்தெடுக்கவும்.",
  "cal.autoOn": "புதிய நினைவூட்டல்கள் தானாகவே உங்கள் Google Calendar-இல் சேர்க்கப்படும்.",
  "signup.calTitle": "உங்கள் நினைவூட்டல்களை Google Calendar-இல் சேர்க்கவா?",
  "signup.calBody":
    "நீங்கள் பின்னர் சேர்ப்பவை உட்பட ஒவ்வொரு மருந்துச் சீட்டுக்கும் உங்கள் Google Calendar-இல் தினசரி நினைவூட்டலைப் பெறுங்கள். அடுத்து Google அனுமதி கேட்கும்.",
  "signup.calYes": "ஆம், அனைத்தையும் சேர்",
  "signup.calNo": "இப்போது வேண்டாம்",
  "signup.calConnecting": "Google-உடன் இணைக்கிறது…",
  "common.saving": "சேமிக்கிறது…",

  "rx.title": "மருந்துச் சீட்டைச் சேர்",
  "rx.tabImage": "படத்தைப் பதிவேற்று",
  "rx.tabManual": "கைமுறையாக உள்ளிடு",
  "rx.tabNumber": "மருந்துச் சீட்டு எண்",
  "rx.dropPhoto": "ஒரு படத்தை இழுத்து விடுங்கள் அல்லது தேர்ந்தெடுங்கள்",
  "rx.photoHint": "உங்கள் மருந்துச் சீட்டின் JPG அல்லது PNG",
  "rx.previewAlt": "மருந்துச் சீட்டு முன்னோட்டம்",
  "rx.number": "மருந்துச் சீட்டு எண்",
  "rx.numberPlaceholder": "எ.கா. 4820193",
  "rx.medName": "மருந்தின் பெயர்",
  "rx.medPlaceholder": "எ.கா. Amoxicillin",
  "rx.dosage": "அளவு",
  "rx.when": "எப்போது",
  "rx.food": "உணவு",
  "rx.select": "தேர்ந்தெடு",
  "rx.save": "மருந்துச் சீட்டைச் சேமி",
  "rx.yours": "உங்கள் மருந்துச் சீட்டுகள்",
  "rx.none": "இன்னும் எதுவும் சேர்க்கப்படவில்லை.",
  "rx.fromPhoto": "படத்திலிருந்து",
  "rx.fromNumber": "எண்ணிலிருந்து",
  "rx.manual": "கைமுறை",
  "rx.remove": "நீக்கு",
  "rx.photoName": "மருந்துச் சீட்டு படம்",
  "rx.course": "சிகிச்சை காலம்",
  "rx.days": "நாட்கள்",
  "rx.lifetime": "வாழ்நாள் முழுவதும்",
  "rx.courseHint": "வாழ்நாள் முழுவதும் என்றால் காலியாக விடவும்.",
  "rx.forDays": "{n} நாட்கள்",
  "rx.finished": "சிகிச்சை முடிந்தது",
  "home.daysLeft": "இன்னும் {n} நாட்கள்",
  "home.lastDay": "இன்று கடைசி நாள்",

  "slot.morning": "காலை",
  "slot.evening": "மாலை",
  "slot.night": "இரவு",
  "meal.before": "உணவுக்கு முன்",
  "meal.after": "உணவுக்குப் பின்",

  "alert.kicker": "மருந்து எடுக்கும் நேரம்",
  "alert.dosage": "அளவு",
  "alert.later": "பிறகு",
  "alert.taken": "எடுத்துவிட்டேன்",
  "alert.takenMsg": "எடுத்ததாகக் குறிக்கப்பட்டது. நன்று!",
  "alert.laterMsg": "பிறகு மீண்டும் நினைவூட்டுவோம்.",
  "alert.undo": "செயல்தவிர்",
  "alert.speak": "உங்கள் மருந்து எடுக்கும் நேரம். {name} {dosage} எடுக்கவும்.",
  "alert.speakNoDose": "உங்கள் மருந்து எடுக்கும் நேரம்: {name}.",
  "alert.speakMany": "உங்கள் மருந்துகளை எடுக்கும் நேரம். {list} எடுக்கவும்.",
  "alert.item": "{name} {dosage}",
  "alert.count": "{n} மருந்துகள்",
  "common.and": "மற்றும்",
  "alert.play": "ஒலிக்கச் செய்",
  "alert.stop": "நிறுத்து",
  "alert.playing": "பேசுகிறது…",
  "alert.blocked": "உங்கள் உலாவி ஒலியைத் தடுத்தது. கேட்க “ஒலிக்கச் செய்” என்பதைத் தட்டவும்.",
  "alert.volumeHint": "நினைவூட்டல்களைத் தவறவிடாமல் இருக்க ஒலியளவை அதிகமாக வைத்திருங்கள்.",
  "alert.dueAt": "{time} மணிக்கு",
  "alert.emptyTitle": "இன்னும் மருந்துச் சீட்டுகள் இல்லை",
  "alert.emptyBody": "ஒரு மருந்துச் சீட்டைச் சேர்த்தால் அதன் நினைவூட்டல் இங்கே தோன்றும்.",

  "life.title": "உங்கள் தினசரி வழக்கம்",
  "life.subtitle":
    "நீங்கள் வழக்கமாக எப்போது சாப்பிடுவீர்கள்? உங்கள் உணவு நேரங்களைச் சுற்றி நினைவூட்டல்களை அமைப்போம்.",
  "life.breakfast": "காலை உணவு நேரம்",
  "life.lunch": "மதிய உணவு நேரம்",
  "life.dinner": "இரவு உணவு நேரம்",
  "life.warn":
    "இந்தப் பக்கத்தை விட்டு வெளியேறும் முன் அனைத்து உணவு நேரங்களையும் நிரப்பி, தொடர் என்பதை அழுத்தவும்.",
  "life.continue": "தொடர்",
};

const es: Record<Key, string> = {
  "nav.home": "Alertas activas",
  "nav.alerts": "Alertas",
  "nav.prescriptions": "Recetas",
  "nav.lifestyle": "Estilo de vida",
  "nav.menu": "Menú",
  "nav.language": "Idioma",
  "signup.button": "Registrarse",
  "signup.title": "Crea tu cuenta",
  "signup.password": "Contraseña (mínimo 6 caracteres)",
  "common.cancel": "Cancelar",

  "home.today": "Hoy",
  "home.title": "Alertas activas",
  "home.subtitle": "Cada dosis que necesitas tomar, en un solo lugar tranquilo.",
  "home.add": "+ Añadir receta",
  "home.lifestyleHintBefore": "Añade tus horarios de comida en la",
  "home.lifestyleHintLink": "página de Estilo de vida",
  "home.lifestyleHintAfter": "para que podamos fijar tus alarmas.",
  "home.emptyTitle": "No hay alertas activas",
  "home.emptyBody": "Añade una receta para empezar a recibir recordatorios.",
  "home.take": "Tomar {dosage}",
  "home.noDosage": "Dosis sin definir",
  "cal.add": "Añadir a Google Calendar",
  "cal.adding": "Añadiendo…",
  "cal.added": "En Google Calendar",
  "cal.needsTime": "Fija una hora para añadirla a tu calendario",
  "cal.notConfigured": "Google Calendar aún no está configurado en este sitio.",
  "cal.denied": "Se canceló el inicio de sesión con Google.",
  "cal.failed": "No se pudo añadir a Google Calendar. Inténtalo de nuevo.",
  "cal.disconnect": "Desconectar Google",
  "cal.eventTitle": "Tomar {dosage} de {name}",
  "cal.eventTitleNoDose": "Tomar {name}",
  "cal.eventBody": "Recordatorio de medicina de Dose.",
  "cal.courseEnds": "Se repite cada día hasta el {date}, último día del tratamiento.",
  "cal.howToStop":
    "Se repite cada día hasta que elimines esta receta en Dose. Para detenerlo tú, elimina este evento y elige “Todos los eventos”.",
  "rx.removing": "Eliminando…",
  "rx.calRemoveFailed":
    "Se eliminó aquí, pero no se pudo borrar de Google Calendar. Borra el evento allí y elige “Todos los eventos”.",
  "cal.autoOn": "Las nuevas alertas se añaden automáticamente a tu Google Calendar.",
  "signup.calTitle": "¿Añadir tus alertas a Google Calendar?",
  "signup.calBody":
    "Recibe un recordatorio diario en tu Google Calendar para cada receta, incluidas las que añadas más tarde. A continuación, Google te pedirá permiso.",
  "signup.calYes": "Sí, añadir todas",
  "signup.calNo": "Ahora no",
  "signup.calConnecting": "Conectando con Google…",
  "common.saving": "Guardando…",

  "rx.title": "Añadir una receta",
  "rx.tabImage": "Subir imagen",
  "rx.tabManual": "Introducir a mano",
  "rx.tabNumber": "Número de receta",
  "rx.dropPhoto": "Arrastra o elige una foto",
  "rx.photoHint": "JPG o PNG de tu receta",
  "rx.previewAlt": "Vista previa de la receta",
  "rx.number": "Número de receta",
  "rx.numberPlaceholder": "p. ej. 4820193",
  "rx.medName": "Nombre del medicamento",
  "rx.medPlaceholder": "p. ej. Amoxicilina",
  "rx.dosage": "Dosis",
  "rx.when": "Cuándo",
  "rx.food": "Comida",
  "rx.select": "Elegir",
  "rx.save": "Guardar receta",
  "rx.yours": "Tus recetas",
  "rx.none": "Aún no has añadido ninguna.",
  "rx.fromPhoto": "Desde foto",
  "rx.fromNumber": "Desde número",
  "rx.manual": "Manual",
  "rx.remove": "Eliminar",
  "rx.photoName": "Foto de receta",
  "rx.course": "Duración del tratamiento",
  "rx.days": "Días",
  "rx.lifetime": "De por vida",
  "rx.courseHint": "Déjalo vacío si es de por vida.",
  "rx.forDays": "{n} días",
  "rx.finished": "Tratamiento terminado",
  "home.daysLeft": "Quedan {n} días",
  "home.lastDay": "Hoy es el último día",

  "slot.morning": "Mañana",
  "slot.evening": "Tarde",
  "slot.night": "Noche",
  "meal.before": "Antes de comer",
  "meal.after": "Después de comer",

  "alert.kicker": "Hora de tu medicina",
  "alert.dosage": "Dosis",
  "alert.later": "Más tarde",
  "alert.taken": "Tomada",
  "alert.takenMsg": "Marcada como tomada. ¡Bien hecho!",
  "alert.laterMsg": "Te lo recordaremos más tarde.",
  "alert.undo": "Deshacer",
  "alert.speak": "Es hora de tomar tu medicina. Toma {dosage} de {name}.",
  "alert.speakNoDose": "Es hora de tomar tu medicina: {name}.",
  "alert.speakMany": "Es hora de tomar tus medicinas. Toma {list}.",
  "alert.item": "{dosage} de {name}",
  "alert.count": "{n} medicinas",
  "common.and": "y",
  "alert.play": "Reproducir alerta",
  "alert.stop": "Detener",
  "alert.playing": "Hablando…",
  "alert.blocked": "Tu navegador bloqueó el sonido. Pulsa “Reproducir alerta” para oírla.",
  "alert.volumeHint": "Mantén el volumen alto para no perderte tus alertas.",
  "alert.dueAt": "A las {time}",
  "alert.emptyTitle": "Aún no hay recetas",
  "alert.emptyBody": "Añade una receta y su alerta aparecerá aquí.",

  "life.title": "Tu rutina diaria",
  "life.subtitle": "¿Cuándo sueles comer? Ajustaremos tus recordatorios a tus comidas.",
  "life.breakfast": "Hora del desayuno",
  "life.lunch": "Hora del almuerzo",
  "life.dinner": "Hora de la cena",
  "life.warn":
    "Rellena todos los horarios de comida y pulsa Continuar antes de salir de esta página.",
  "life.continue": "Continuar",
};

const dictionaries: Record<Lang, Record<Key, string>> = { en, ta, es };
const STORAGE_KEY = "lang";

export type Translate = (k: Key, vars?: Record<string, string>) => string;

/** Translate outside React, e.g. to build text in a language other than the current one. */
export const translate =
  (lang: Lang): Translate =>
  (k, vars) =>
    Object.entries(vars ?? {}).reduce(
      (s, [name, v]) => s.replace(`{${name}}`, v),
      dictionaries[lang][k],
    );

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translate;
};
const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Server render is always English; the saved choice is applied after hydration.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved && saved in dictionaries) setLangState(saved as Lang);
    } catch {
      // storage unavailable: stay on English
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      sessionStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  };

  const t = translate(lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useT must be used inside LanguageProvider");
  return ctx;
}
