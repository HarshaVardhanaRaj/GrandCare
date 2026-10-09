# GrandCare

**Live long, live free.** GrandCare is a senior-centered medication management and caregiver support prototype. It is designed around **understand → remember → act → confirm → support**. Patients stay in control of their routine; caregivers get a timely signal when support may help.

> Prototype only. Not a medical device and not a substitute for professional medical advice.

## Problem and solution

Remembering several medicines, their timing, and whether a dose was already confirmed can be difficult. GrandCare pairs a patient routine with a caregiver view. It shows caregiver-entered prescription details clearly, offers a gentle reminder and a one-tap Taken/Later/Help action, and escalates only after repeated postponement or an explicit help request.

## Features

- Separate patient and caregiver sign-ins with role-checked API access.
- Patient home, medicines, prescriptions, history, and help views; caregiver dashboard, patient profile, medication management, support inbox, messages, and reports.
- Patient **Lifestyle** view for setting breakfast, lunch, dinner, and sleep times. The caregiver sees the saved routine; the patient can edit only these time preferences.
- Patient-only prescription import for digital PDFs and photos of handwritten prescriptions. Text-based PDFs are read directly; scanned PDFs and photos use locally hosted Tesseract.js OCR in the browser. The original file and extracted text are stored in the local app data folder for patient review. OCR output never changes the medication schedule.
- Patient home shows a four-second visual guide for tablet or capsule doses when the caregiver-entered directions mention water. It switches to a still image when reduced motion is preferred; the saved directions remain the source of truth.
- If the prescription API is unavailable, scans stay in browser IndexedDB on that device and remain available to review or remove there.
- Medication records with dose, quantity, caregiver-entered instruction, frequency, duration, start/end dates, meal relation, and reminder time.
- Caregiver-editable patient meal anchors, sleep/wake preferences, contact details, and a visible audit trail for routine and medicine changes.
- Deterministic timing based on the patient’s meal anchors: 30 minutes before, at the meal, or 15 minutes after. Before-bed uses the configured rest time. Custom time remains editable.
- Warm patient reminder voice speaks automatically when a dose becomes due when browser speech is available; a large replay button stays on the reminder card.
- Patient-only watch simulator with a glanceable reminder and Taken/Later/Help actions.
- Duplicate-dose protection, action timestamp/source, reminder history, caregiver notification on the second postpone, and one high-priority escalation after the next cycle.
- Configurable fast demo mode (15 seconds by default) or the normal 15-minute snooze interval.
- Seeded adherence history, a repeated-pattern observation, audit entries for caregiver medication changes, private check-in messages, and a downloadable PDF summary.
- Browser notification support when permission is granted. The app itself polls the local API while open to keep the two views in sync.
- Taken/Later/Help actions made during temporary connection loss are held in the browser and replayed with the original action time when the connection returns.

## Architecture and stack

This prototype uses plain HTML, CSS, and JavaScript for an installable portrait-first Progressive Web App (PWA), plus a dependency-free Node.js HTTP server for its REST API. On supported phones, install GrandCare from the browser menu to open it as a standalone app. The local database is a JSON file at `data/store.json`; new installations create it from seeded demo data. Passwords are hashed with Node’s `scrypt`, and the server issues an HttpOnly session cookie. No external service or package install is required.

```text
public/index.html + styles.css + app.js
             │ same-origin REST / cookie session
             ▼
        server.mjs (Node HTTP API)
             │
             ▼
        data/store.json
```

The JSON store includes users, patient preferences, medication records, dose instances, events, support alerts, messages, app settings, caregiver audit entries, and prescription metadata. Uploaded prescription files are kept under `data/prescriptions/`. The caregiver is scoped to the linked patient; prescription uploads are only available to the patient account.

OCR and PDF.js browser assets and the English OCR model are included under `public/vendor/`, so scanning does not send prescription images to an external OCR service. See the bundled license files in those folders.

## Project structure

```text
server.mjs                 API, session checks, scheduler and local persistence
public/index.html           App entry point
public/styles.css           Responsive accessible visual system
public/app.js               Patient/caregiver views and client interactions
scripts/generate-medication-guide.py  Builds the short guide GIF and still poster
public/medication-guide-tablet.gif    Four-second tablet/water visual guide
public/manifest.json        Installable standalone app settings (portrait)
public/sw.js                Cached app shell for installed launches
public/icons/                GrandCare home-screen and browser icons
public/vendor/              Local PDF parsing and browser OCR libraries/model
data/store.json             Created on first start; seeded local demo database
data/prescriptions/         Patient prescription uploads
test/integration.test.mjs   Node built-in API integration test
```

## Setup and running

Requirements: Node.js 20 or newer. There are no npm dependencies.

```bash
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). For live reload of the server process, run `npm run dev` instead. Optional environment settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | Local HTTP port |
| `FAST_DEMO_SECONDS` | `15` | Fast-mode snooze interval, minimum 5 seconds |
| `CAREMATE_DATA_DIR` | `./data` | Alternate local JSON store directory |

Locally, the service binds to `127.0.0.1`. On Railway, it detects the Railway service ID and binds to `0.0.0.0`, while continuing to use the injected `PORT` value so Railway can route public traffic to the app. GrandCare is still a prototype, not a medical device.

## Install on a device

GrandCare is a portrait-first Progressive Web App. In Chrome or Edge, open it on the device where the local server is running, then choose **Install app** from the browser menu. On iPhone or iPad, open the app from an HTTPS host in Safari and choose **Share → Add to Home Screen**. The manifest asks supported devices to launch GrandCare in portrait orientation and without browser chrome. To use it from a separate phone, host the app at an HTTPS address reachable by that phone; `127.0.0.1` always refers to the device currently running the browser.

## Demo credentials

Both accounts use `caremate123`:

| Role | Email | Name |
| --- | --- | --- |
| Caregiver | `caregiver@caremate.demo` | Anita Kumar |
| Patient | `patient@caremate.demo` | Ravi Kumar |

The login page includes quick demo access. Seed data includes breakfast at 8:00 AM, lunch at 1:00 PM, dinner at 8:00 PM, and Metformin, Amlodipine, and Atorvastatin schedules. Historical activity is seeded to show 82% on-time adherence.

## Suggested judge demo flow

1. Sign in as Anita and show Ravi’s adherence, daily routine, and activity timeline.
2. Edit or add a medication. Selecting a meal relation suggests a deterministic reminder time; the time remains editable.
3. Trigger a medication reminder from Demo controls. Open **Watch preview** or sign in as Ravi to see the patient view.
4. Play the warm voice reminder, inspect the caregiver-entered instruction, and record **Taken** or **Later**.
5. In the caregiver view, run **Later #2** to create the check-in alert, or run **Simulate miss** to see the high-priority escalation. With fast demo enabled, the second snooze automatically escalates after 15 seconds if it remains unconfirmed.
6. Try Help, mark an alert resolved, explore the history and repeated-pattern report, and download the PDF.

The demo panel also supports triggering a dose, simulating Taken/Later/Help, generating a historical pattern, switching between fast and normal snooze timing, generating a PDF, and resetting to the seeded sample data.

## Watch and voice implementation

The watch is a patient-only simulator in the web UI. The patient home includes a **Smartwatch Reminder** button to open it. It demonstrates a compact watch face, reminder details, and core actions that use the same API as the phone view. This is not an Apple Watch or Wear OS app and does not provide real haptics or watch-device synchronization.

Patient reminders are spoken automatically when a dose becomes due, with a large replay button on the reminder card. The voice copy is phrased warmly and prefers an available English (India) voice. Browser audio policies or missing system voices can still prevent automatic speech; the replay button offers a direct retry, and the prescribed details remain visible on screen.

## PDF reports

The backend builds a small self-contained PDF with patient and caregiver details, adherence summary, medication list, recent activity, support observations, and the prototype disclaimer. The report is produced locally and does not require a PDF package or cloud service.

## Known limitations

- Local prototype storage is a JSON file, not SQLite or PostgreSQL. It is suitable for one local demo process and does not provide database transactions or multi-host synchronization.
- Sessions are in memory and expire after 12 hours; restarting the server signs users out.
- The client refreshes from the API every five seconds while open. There is no Socket.IO service or push delivery when the app is closed.
- The offline action queue is local to the current browser and active app session; it is not a background service worker.
- Browser notifications need user permission and platform support. A browser app cannot replace the phone’s real lock screen.
- The watch simulator is not a native wearable application.
- This is a responsive web prototype, not a native Expo/React Native application. Each medicine currently has one scheduled reminder time per day; the free-text frequency field is descriptive.
- The four-second medication guide is a visual prompt for tablet or capsule directions that mention water. It does not cover other routes or replace the caregiver-entered prescription instructions.
- Demo data and credentials are public to anyone running this prototype. Do not enter real patient information. No HIPAA/GDPR or medical-device compliance is claimed.

## Testing

Run the API integration checks with Node’s built-in test runner:

```bash
node --test
```

The suite covers login, patient/caregiver authorization, meal-time calculation, medication creation and editing, duplicate protection, watch-origin confirmation, the first and second snooze behavior, timed escalation, help alerts, pattern analytics, and PDF generation. It uses an isolated temporary JSON database.

## Future enhancements

- Native Expo patient app and a real Wear OS / Apple Watch companion.
- SQLite/PostgreSQL migrations, durable sessions, encryption and deployment hardening.
- Push notifications and real-time event transport.
- More flexible schedules for multiple daily doses, weekdays, and prescription durations.
- Offline action queue and conflict-safe synchronization.
- Clinician-reviewed accessibility testing and caregiver-configurable escalation policies.
