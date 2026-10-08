# DoseDial ⌚💊

> **A smartwatch-first medication companion for seniors and their caregivers.**

Upload a prescription photo → AI extracts medicines → system builds a meal-aware schedule → a round watch UI gives voice-guided reminders → caregivers see status only when support is needed ("silence means safe").

---

## 🌟 Pitch & Value Proposition

- **Senior First**: Round Wear OS smartwatch interface with a single large action button, high-contrast text, Web Audio dual-tone chimes, and 0.85x speed voice guidance.
- **Meal-Aware Intelligence**: Calculates exact dose offsets around meal schedules (e.g. *15m after breakfast*, *30m before dinner*, *empty stomach*, *bedtime*).
- **Double-Dose Prevention**: Guard system warns and prompts confirmation if a senior attempts to take the same medication twice.
- **"Silence Means Safe" Caregiver Dashboard**: Caregivers are only interrupted when a dose is missed, double-taken, or when the senior presses **SOS Help**.
- **Full Offline & Calendar Sync**: Export complete routines to RFC 5545 `.ics` files for Google Calendar, Apple Calendar, or Outlook.

---

## 📊 Problem → Solution Mapping

| Stage | Challenge | DoseDial Solution |
|---|---|---|
| **Understand** | Complex prescription handwriting & multi-drug routines | Gemini Vision OCR extracts drugs, dosages & meal rules automatically |
| **Remember** | Forgetting timing rules (before vs after food) | Meal-aware scheduler calculates precise daily notification times |
| **Act** | Standard phone alarms are easily ignored or dismissed | Wear OS Watch UI fires TTS voice guidance, dual-tone chimes & haptics |
| **Confirm** | Accidental double-dosing or uncertainty | Repeat-dose guard blocks double medication & logs timestamps |
| **Support** | Caregiver anxiety & constant checking | Caregiver dashboard alerts **only** on missed doses, low inventory, or SOS |

---

## 🏗️ System Architecture

```
                                  ┌─────────────────────────────┐
                                  │   Prescription Upload       │
                                  │   (JPG/PNG or Presets)      │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│    Gemini 2.5 Flash Vision  │──▶│    Meal-Aware Scheduler     │
│    Prescription OCR Engine  │   │    Rules: BF, AF, WITH, BED  │
└─────────────────────────────┘   └──────────────┬──────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │   Express Server State      │
                                  │   Doses, Alerts, Inventory  │
                                  └──────────────┬──────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼                                                           ▼
┌─────────────────────────────────────┐                     ┌─────────────────────────────────────┐
│      Wear OS Watch Companion        │                     │         Caregiver Dashboard         │
│  - Round 360px OLED UI              │                     │  - Safe Status Badge ("Silence")    │
│  - Web Audio Chime & Haptic Pulse   │                     │  - Pill Inventory & Refill Warnings │
│  - 0.85x Senior Voice Guidance      │                     │  - Caregiver SMS Escalation         │
│  - Single Large Button Flow         │                     │  - Instant Nudge to Watch           │
└─────────────────────────────────────┘                     └─────────────────────────────────────┘
```

---

## 🔌 Complete REST API Specification

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/health` | `GET` | Server health check & LAN IP list |
| `POST /api/parse-prescription` | `POST` | Upload image for Gemini Vision OCR extraction |
| `POST /api/schedule` | `POST` | Generate meal-aware dose schedule |
| `GET /api/state` | `GET` | Fetch real-time doses, alerts, nudges, inventory & adherence |
| `POST /api/dose/:id/taken` | `POST` | Mark dose as taken (triggers inventory decrement & double-dose check) |
| `POST /api/dose/:id/later` | `POST` | Snooze dose for 10 minutes |
| `POST /api/dose/:id/help` | `POST` | Trigger senior SOS emergency alert |
| `GET /api/inventory` | `GET` | Retrieve pill balances and stock status |
| `POST /api/inventory/refill` | `POST` | Refill medication stock count (+30 tablets) |
| `GET /api/contacts` | `GET` | Retrieve caregiver escalation contacts |
| `POST /api/alerts/send-sms` | `POST` | Simulate multi-channel SMS alert dispatch |
| `GET /api/presets` | `GET` | Fetch pre-configured sample prescription profiles |
| `POST /api/presets/:id/load` | `POST` | Load prescription preset into live schedule |
| `GET /api/export-ical` | `GET` | Export schedule as RFC 5545 `.ics` file |

---

## ⚡ How to Run

```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables (optional for Vision OCR, preset demos work without key)
copy .env.example .env

# 3. Run unit tests
npm test

# 4. Start the application server
npm start
```

Open the following URLs in your browser:
- 📋 **Setup (Caregiver)**: `http://localhost:3000/setup.html`
- ⌚ **Watch UI (Senior)**: `http://localhost:3000/watch.html`
- 🛡️ **Caregiver Dashboard**: `http://localhost:3000/dashboard.html`

---

## 🎬 2-Minute Judge Demo Script

1. Open `/setup.html` → Click **"❤️ Cardiac & Diabetes Preset"** (instant schedule generated).
2. Click **"📅 Export Calendar (.ics)"** to show offline calendar integration.
3. Open `/watch.html` → Click **"Tap to Enable Voice"** (Web Audio dual-tone chime plays).
4. Use the floating **Pitch Dock** at the bottom: click **"⏩ +15 Mins"** to trigger a due dose.
5. Listen to the 0.85x senior voice guidance: *"Time for your Metformin 500mg after food"*.
6. Tap **Taken** → watch confirms *"Recorded! Well done."*
7. Open `/dashboard.html` → verify **Safe Status Badge** turns green & pill inventory decrements.
8. Click **"⚠️ Missed Dose"** on the Pitch Dock → watch alert turns red & dashboard triggers caregiver alert.
9. Click **"📲 Test SMS"** on dashboard to demonstrate multi-channel escalation.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, in-memory state engine
- **AI Vision**: `@google/genai` (Gemini 2.5 Flash Vision API)
- **Frontend**: Plain HTML5, CSS3, ES6 JavaScript (zero build step)
- **Audio & Speech**: Web Audio API Dual-Tone Synthesizer, Web Speech API (`speechSynthesis`)
- **Haptics**: `navigator.vibrate`
- **Calendar Standard**: RFC 5545 iCalendar (`.ics`) generator

---

> *Reminder: DoseDial is a supportive reminder companion tool. Always follow your doctor's official advice.*
