# DoseDial ⌚💊

> **A smartwatch-first medication companion for seniors and their caregivers.**

Upload a prescription photo → AI extracts medicines → system builds a meal-aware schedule → a round watch UI gives voice-guided reminders → caregivers see status only when support is needed ("silence means safe").

---

## The Problem → Our Journey

| Stage | What DoseDial Does |
|---|---|
| **Understand** | Plain-language medicine cards with food-rule icons |
| **Remember** | Meal-aware schedule (before / after / with food) |
| **Act** | Voice + haptic alerts on the watch UI |
| **Confirm** | One-tap "Taken" with repeat-dose guard (prevents double doses) |
| **Support** | Caregiver dashboard alerts *only* when missed, repeated, or help requested |

---

## Architecture

```
Browser (phone / laptop)
  ├── /watch.html   ← senior's round watch UI (speechSynthesis + vibrate)
  ├── /dashboard.html ← caregiver status & nudge panel
  └── /setup.html   ← prescription upload + schedule builder

Express Server (Node.js)
  ├── GET  /api/health
  ├── POST /api/prescription/extract  ← Gemini Vision OCR
  ├── POST /api/schedule              ← meal-aware scheduler
  ├── GET  /api/state                 ← doses, alerts, nudges, adherence
  ├── POST /api/dose/:id/taken|later|help
  ├── POST /api/nudge  /api/nudge/ack
  ├── POST /api/reset
  └── POST /api/demo/start            ← 2-minute demo mode
```

---

## How to Run

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in your API key
copy .env.example .env
# Edit .env — add your GEMINI_API_KEY (optional; demo works without it)

# 3. Start the server
npm start

# 4. Open in browser
#    Setup:     http://localhost:3000/setup.html
#    Watch:     http://localhost:3000/watch.html
#    Dashboard: http://localhost:3000/dashboard.html

# 5. Run tests
npm test
```

---

## Demo Script (2 minutes)

1. Open **`/setup.html`** — click **"Start 2-Minute Demo"**
2. Open **`/watch.html`** on a phone (same Wi-Fi, use the LAN URL printed in terminal)
3. Tap **"Tap to Enable Voice"** on the watch
4. In ~10 seconds: watch vibrates, voice says *"Time for your Metformin…"*
5. Tap **Taken** → caregiver dashboard turns green
6. Wait 30 seconds → second dose fires
7. Tap **Need Help** → dashboard shows a red alert instantly
8. Send a nudge from the dashboard → watch shows warm message
9. Tap **Taken** again on the same dose → repeat-dose guard triggers

---

## Tech Stack

- **Backend**: Node.js + Express, in-memory state, no database needed
- **AI**: Google Gemini Vision API (`@google/genai`) for prescription OCR
- **Frontend**: Plain HTML/CSS/JS — no build step, loads instantly
- **Voice**: Browser `speechSynthesis` API
- **Haptics**: `navigator.vibrate`
- **Live sync**: polling every 2 seconds

---

## Roadmap

- **Wear OS native app** — replace the phone watch prototype with real Wear OS
- **Google Calendar API sync** — full OAuth sync, not just add-link
- **Multi-patient support** — professional caregivers managing 5–20 patients
- **Regional languages** — Tamil, Hindi, Telugu voice reminders
- **Pill photo verification** — second Gemini call to confirm the right pill was taken
- **Offline PWA** — service worker for connectivity-poor homes

---

*Reminder: This is a reminder tool only. Always follow your doctor's advice.*
