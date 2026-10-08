/**
 * index.js — DoseDial Express server
 * Serves /public and all JSON API endpoints.
 */

require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const os      = require('os');
const path    = require('path');

const { buildSchedule, resetIdCounter } = require('./scheduler');
const { handleExtract } = require('./extract');
const { generateICS } = require('./ical');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ── In-memory state ───────────────────────────────────────────────────────────
let state = freshState();

function freshState() {
  return {
    doses:     [],
    meals:     { breakfast: '08:00', lunch: '13:00', dinner: '20:00', bedtime: '22:00' },
    nudges:    [],          // caregiver messages queued for watch
    alerts:    [],          // missed / repeat / help alerts for dashboard
    adherence: { takenOnTime: 0, takenLate: 0, missed: 0 },
    inventory: {
      "Metformin 500mg": { remaining: 14, total: 30, unit: "tablets" },
      "Lisinopril 10mg": { remaining: 3, total: 30, unit: "tablets" },
      "Atorvastatin 20mg": { remaining: 20, total: 30, unit: "tablets" }
    },
    contacts: [
      { id: "c1", name: "Dr. Sarah Jenkins", phone: "+1 (555) 234-5678", role: "Primary Caregiver", alertOnMissed: true },
      { id: "c2", name: "Robert Miller", phone: "+1 (555) 987-6543", role: "Secondary Emergency Contact", alertOnMissed: false }
    ],
    language:  "en",
    demo:      false,
    SOFT_AFTER:  5 * 60,   // seconds after due → soft reminder
    MISSED_AFTER: 20 * 60, // seconds after due → mark missed
  };
}

// ── Background tick ───────────────────────────────────────────────────────────
setInterval(tick, 1000);

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function hhmm2sec(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 3600 + m * 60;
}

function nowSec() {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function tick() {
  const now = nowSec();
  for (const dose of state.doses) {
    if (dose.status === 'taken' || dose.status === 'taken_late' ||
        dose.status === 'missed' || dose.status === 'overridden') continue;

    const due = hhmm2sec(dose.time);
    const elapsed = now - due;

    if (elapsed < 0) continue; // not yet due

    if (dose.status === 'pending') {
      dose.status = 'due';
      dose.dueAt = new Date().toISOString();
    }

    if (elapsed >= state.SOFT_AFTER && !dose.softReminder && dose.status === 'due') {
      dose.softReminder = true;
    }

    if (elapsed >= state.MISSED_AFTER && dose.status === 'due') {
      dose.status = 'missed';
      state.adherence.missed++;
      pushAlert({
        type: 'missed',
        doseId: dose.id,
        medicineName: dose.medicineName,
        time: dose.time,
        message: `${dose.medicineName} at ${dose.time} was not taken.`,
      });
    }
  }
}

function pushAlert(alert) {
  alert.id = `alert-${Date.now()}`;
  alert.createdAt = new Date().toISOString();
  state.alerts.push(alert);
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', product: 'DoseDial', version: '1.0.0' }));

// ── Prescription extract ──────────────────────────────────────────────────────
app.post('/api/prescription/extract', upload.single('image'), handleExtract);

// ── Build schedule ────────────────────────────────────────────────────────────
app.post('/api/schedule', (req, res) => {
  const { medicines, meals } = req.body;
  if (!Array.isArray(medicines) || medicines.length === 0) {
    return res.status(400).json({ error: 'medicines array required' });
  }
  resetIdCounter();
  state.doses = buildSchedule(medicines, meals || state.meals);
  if (meals) state.meals = { ...state.meals, ...meals };
  state.alerts = [];
  state.nudges = [];
  state.adherence = { takenOnTime: 0, takenLate: 0, missed: 0 };
  state.demo = false;
  res.json({ doses: state.doses, meals: state.meals });
});

// ── State ─────────────────────────────────────────────────────────────────────
app.get('/api/state', (_req, res) => {
  res.json({
    doses:     state.doses,
    meals:     state.meals,
    nudges:    state.nudges,
    alerts:    state.alerts,
    adherence: state.adherence,
    demo:      state.demo,
  });
});

// ── Dose actions ──────────────────────────────────────────────────────────────
app.post('/api/dose/:id/taken', (req, res) => {
  const dose = state.doses.find(d => d.id === req.params.id);
  if (!dose) return res.status(404).json({ error: 'Dose not found' });

  // Repeat-dose guard
  if (dose.status === 'taken' || dose.status === 'taken_late') {
    if (!req.body?.override) {
      return res.status(409).json({ takenAt: dose.takenAt, message: 'Already taken' });
    }
    // Override — record and alert
    dose.status = 'overridden';
    dose.overriddenAt = new Date().toISOString();
    pushAlert({
      type: 'repeat_override',
      doseId: dose.id,
      medicineName: dose.medicineName,
      message: `${dose.medicineName} was taken again (override) at ${dose.overriddenAt}.`,
    });
    return res.json({ status: 'overridden', dose });
  }

  const now = new Date();
  dose.takenAt = now.toISOString();

  const dueMs = hhmm2sec(dose.time) * 1000;
  const nowMs = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000;
  const delayMin = Math.round((nowMs - dueMs) / 60000);

  if (delayMin > 10) {
    dose.status = 'taken_late';
    dose.delayMinutes = delayMin;
    state.adherence.takenLate++;
  } else {
    dose.status = 'taken';
    state.adherence.takenOnTime++;
  }

  // Decrement inventory pill count
  if (state.inventory[dose.medicineName]) {
    const item = state.inventory[dose.medicineName];
    if (item.remaining > 0) item.remaining--;
    if (item.remaining <= 5) {
      pushAlert({
        type: 'low_inventory',
        medicineName: dose.medicineName,
        message: `⚠️ Low pill inventory alert: ${dose.medicineName} has only ${item.remaining} ${item.unit} remaining! Please order refill.`,
      });
    }
  }

  res.json({ status: dose.status, dose });
});

// ── Inventory & Caregiver Contacts API ───────────────────────────────────────
app.get('/api/inventory', (req, res) => {
  res.json({ inventory: state.inventory });
});

app.post('/api/inventory/refill', (req, res) => {
  const { medicineName, count = 30 } = req.body;
  if (!medicineName) return res.status(400).json({ error: 'medicineName required' });
  if (!state.inventory[medicineName]) {
    state.inventory[medicineName] = { remaining: count, total: count, unit: 'tablets' };
  } else {
    state.inventory[medicineName].remaining += count;
  }
  pushAlert({
    type: 'refill_success',
    medicineName,
    message: `📦 Refilled ${medicineName} (+${count} tablets). Current balance: ${state.inventory[medicineName].remaining}.`,
  });
  res.json({ status: 'ok', inventory: state.inventory[medicineName] });
});

app.get('/api/contacts', (req, res) => {
  res.json({ contacts: state.contacts });
});

app.post('/api/alerts/send-sms', (req, res) => {
  const { contactId, doseId, alertType } = req.body;
  const contact = state.contacts.find(c => c.id === contactId) || state.contacts[0];
  const alertMsg = `[DoseDial SMS Escalation] ALERT: Senior dose missed or SOS triggered! Dispatching SMS to ${contact.name} (${contact.phone}).`;
  
  pushAlert({
    type: 'sms_escalation_sent',
    message: alertMsg,
    timestamp: new Date().toISOString(),
  });
  
  res.json({ status: 'sent', recipient: contact.name, phone: contact.phone, message: alertMsg });
});

app.post('/api/dose/:id/later', (req, res) => {
  const dose = state.doses.find(d => d.id === req.params.id);
  if (!dose) return res.status(404).json({ error: 'Dose not found' });
  // Snooze 10 min: shift due time forward
  const [h, m] = dose.time.split(':').map(Number);
  const snoozeTotal = h * 60 + m + 10;
  dose.time = `${String(Math.floor(snoozeTotal / 60) % 24).padStart(2,'0')}:${String(snoozeTotal % 60).padStart(2,'0')}`;
  dose.status = 'pending';
  dose.snoozed = (dose.snoozed || 0) + 1;
  res.json({ status: 'snoozed', newTime: dose.time, dose });
});

app.post('/api/dose/:id/help', (req, res) => {
  const dose = state.doses.find(d => d.id === req.params.id);
  if (!dose) return res.status(404).json({ error: 'Dose not found' });
  pushAlert({
    type: 'help_requested',
    doseId: dose.id,
    medicineName: dose.medicineName,
    message: `Help requested for ${dose.medicineName} at ${dose.time}.`,
  });
  res.json({ status: 'help_requested' });
});

// ── Nudges ────────────────────────────────────────────────────────────────────
app.post('/api/nudge', (req, res) => {
  const msg = req.body?.message || 'Your family is thinking of you.';
  state.nudges.push({ id: `nudge-${Date.now()}`, message: msg, createdAt: new Date().toISOString() });
  res.json({ status: 'nudge_sent' });
});

app.post('/api/nudge/ack', (_req, res) => {
  state.nudges = [];
  res.json({ status: 'cleared' });
});

// ── Reset ─────────────────────────────────────────────────────────────────────
app.post('/api/reset', (_req, res) => {
  state = freshState();
  resetIdCounter();
  res.json({ status: 'reset' });
});

// ── Demo mode ─────────────────────────────────────────────────────────────────
app.post('/api/demo/start', (req, res) => {
  const samplePrescription = require('./sample-prescription.json');
  const now = new Date();

  // Demo timers: very short
  state.SOFT_AFTER  = 15;  // 15 seconds
  state.MISSED_AFTER = 30; // 30 seconds
  state.demo = true;

  // Build 3 demo doses at now+10s, now+45s, now+90s
  const offset = (sec) => {
    const t = new Date(now.getTime() + sec * 1000);
    return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
  };

  resetIdCounter();
  state.alerts = [];
  state.nudges = [];
  state.adherence = { takenOnTime: 0, takenLate: 0, missed: 0 };

  const meds = samplePrescription.medicines;
  state.doses = [
    {
      id: 'demo-1', medicineName: meds[0].name, strength: meds[0].strength,
      dose: meds[0].dose, time: offset(10), foodRule: 'AF',
      description: 'Take 15 min after food', notes: '', status: 'pending',
      _merged: true,
      medicines: [{ medicineName: meds[0].name, strength: meds[0].strength, dose: meds[0].dose, foodRule: 'AF', description: 'Take 15 min after food', notes: '' }],
    },
    {
      id: 'demo-2', medicineName: meds[1].name, strength: meds[1].strength,
      dose: meds[1].dose, time: offset(45), foodRule: 'BF',
      description: 'Take 30 min before food', notes: '', status: 'pending',
      _merged: true,
      medicines: [{ medicineName: meds[1].name, strength: meds[1].strength, dose: meds[1].dose, foodRule: 'BF', description: 'Take 30 min before food', notes: '' }],
    },
    {
      id: 'demo-3', medicineName: meds[2].name, strength: meds[2].strength,
      dose: meds[2].dose, time: offset(90), foodRule: 'WITH',
      description: 'Take with food', notes: '', status: 'pending',
      _merged: true,
      medicines: [{ medicineName: meds[2].name, strength: meds[2].strength, dose: meds[2].dose, foodRule: 'WITH', description: 'Take with food', notes: '' }],
    },
  ];

  res.json({ status: 'demo_started', doses: state.doses });
});


// ── Presets API ────────────────────────────────────────────────────────────────
const presets = require('./presets.json');

app.get('/api/presets', (req, res) => {
  res.json({ presets });
});

app.post('/api/presets/:id/load', (req, res) => {
  const preset = presets.find(p => p.id === req.params.id);
  if (!preset) return res.status(404).json({ error: 'Preset not found' });
  const scheduledDoses = buildSchedule(preset.medicines, state.meals);
  state.doses = scheduledDoses;
  state.alerts.unshift({
    type: 'preset_loaded',
    text: `Loaded prescription preset: "${preset.title}" (${preset.medicines.length} meds scheduled)`,
    timestamp: new Date().toISOString(),
  });
  res.json({ status: 'ok', preset, doses: state.doses });
});

// ── Calendar Export API ───────────────────────────────────────────────────────
app.get('/api/export-ical', (req, res) => {
  const icsData = generateICS(state.doses || []);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="dosedial-schedule.ics"');
  res.send(icsData);
});

// ── Regional Languages API ───────────────────────────────────────────────────
const languages = require('./languages.json');

app.get('/api/languages', (req, res) => {
  res.json({ languages, current: state.language });
});

app.post('/api/language', (req, res) => {
  const { code } = req.body;
  if (!languages[code]) return res.status(400).json({ error: 'Unsupported language code' });
  state.language = code;
  res.json({ status: 'ok', language: code, translations: languages[code] });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const ifaces = os.networkInterfaces();
  const lanIPs = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) lanIPs.push(iface.address);
    }
  }
  console.log('\n🩺  DoseDial is running!');
  console.log(`   Local:   http://localhost:${PORT}`);
  lanIPs.forEach(ip => console.log(`   Network: http://${ip}:${PORT}  ← open on phone`));
  console.log('\n   Watch:     /watch.html');
  console.log('   Dashboard: /dashboard.html');
  console.log('   Setup:     /setup.html\n');
  console.log('   Reminder: This is a reminder tool only. Always follow your doctor\'s advice.\n');
});
