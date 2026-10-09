import http from 'node:http';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.CAREMATE_DATA_DIR ? path.resolve(process.env.CAREMATE_DATA_DIR) : path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.RAILWAY_SERVICE_ID ? '0.0.0.0' : '127.0.0.1';
const FAST_DEMO_SECONDS = Math.max(5, Number(process.env.FAST_DEMO_SECONDS || 15));
const SNOOZE_MINUTES = 15;
const SESSIONS = new Map();
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif' };
const PRESCRIPTION_DIR = path.join(DATA_DIR, 'prescriptions');
const MAX_PRESCRIPTION_BYTES = 25 * 1024 * 1024;

const id = (prefix) => `${prefix}_${randomUUID().slice(0, 8)}`;
const isoNow = () => new Date().toISOString();
const validTime = (value) => /^\d{2}:\d{2}$/.test(String(value)) && Number(value.slice(0, 2)) <= 23 && Number(value.slice(3)) <= 59;
const hashPassword = (password, salt = randomBytes(16).toString('hex')) => ({ salt, hash: scryptSync(password, salt, 64).toString('hex') });
const passwordMatches = (password, record) => {
  const attempt = scryptSync(password, record.salt, 64);
  const expected = Buffer.from(record.hash, 'hex');
  return attempt.length === expected.length && timingSafeEqual(attempt, expected);
};
const dateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const shiftDate = (date, amount) => { const d = new Date(`${date}T12:00:00+05:30`); d.setUTCDate(d.getUTCDate() + amount); return dateKey(d); };
const makeScheduledAt = (date, time) => `${date}T${time}:00+05:30`;
const stamp = (value) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' });

function freshStore() {
  const patientId = 'patient_ravi';
  const caregiverId = 'caregiver_anita';
  const medRows = [
    { id: 'med_metformin', patientId, name: 'Metformin', genericName: 'Metformin hydrochloride', dosage: '500', unit: 'mg', quantity: '1 tablet', frequency: 'Once daily', mealRelation: 'After breakfast', scheduledTime: '08:15', instructions: 'Take with water after breakfast.', duration: 'Ongoing', startDate: '2026-01-01', endDate: '', notes: 'Demonstration prescription entered by caregiver.', active: true, demo: true },
    { id: 'med_amlodipine', patientId, name: 'Amlodipine', genericName: 'Amlodipine', dosage: '5', unit: 'mg', quantity: '1 tablet', frequency: 'Once daily', mealRelation: 'After lunch', scheduledTime: '13:15', instructions: 'Take with water after lunch.', duration: 'Ongoing', startDate: '2026-01-01', endDate: '', notes: 'Demonstration prescription entered by caregiver.', active: true, demo: true },
    { id: 'med_atorvastatin', patientId, name: 'Atorvastatin', genericName: 'Atorvastatin', dosage: '10', unit: 'mg', quantity: '1 tablet', frequency: 'Once daily', mealRelation: 'After dinner', scheduledTime: '20:15', instructions: 'Take with water after dinner.', duration: 'Ongoing', startDate: '2026-01-01', endDate: '', notes: 'Demonstration prescription entered by caregiver.', active: true, demo: true }
  ];
  const doses = [];
  const pattern = ['TAKEN', 'TAKEN', 'DELAYED', 'TAKEN', 'MISSED', 'TAKEN', 'TAKEN', 'TAKEN', 'TAKEN', 'DELAYED', 'TAKEN', 'TAKEN', 'TAKEN', 'MISSED', 'TAKEN', 'TAKEN', 'TAKEN', 'TAKEN', 'TAKEN', 'TAKEN', 'TAKEN', 'TAKEN'];
  for (let i = 0; i < pattern.length; i += 1) {
    const med = medRows[i % medRows.length];
    const dayOffset = 8 - Math.floor(i / 3);
    const date = shiftDate(dateKey(), -dayOffset);
    const scheduledAt = makeScheduledAt(date, med.scheduledTime);
    const status = pattern[i];
    const takenAt = status === 'TAKEN' || status === 'DELAYED' ? new Date(new Date(scheduledAt).getTime() + (status === 'DELAYED' ? 19 : 2) * 60000).toISOString() : null;
    doses.push({ id: id('dose'), patientId, medicationId: med.id, medicationName: med.name, dosage: `${med.dosage} ${med.unit}`, quantity: med.quantity, mealRelation: med.mealRelation, instructions: med.instructions, date, scheduledTime: med.scheduledTime, scheduledAt, state: status, takenAt, snoozeCount: status === 'DELAYED' ? 1 : 0, snoozeUntil: null, source: 'mobile', demo: true });
  }
  const events = doses.filter((d) => d.state !== 'TAKEN').map((d) => ({ id: id('event'), patientId, doseId: d.id, type: d.state === 'MISSED' ? 'missed' : 'delayed', at: d.takenAt || new Date(new Date(d.scheduledAt).getTime() + 35 * 60000).toISOString(), description: d.state === 'MISSED' ? `${d.medicationName} was not confirmed.` : `${d.medicationName} was confirmed after a delay.`, source: 'system' }));
  return {
    version: 1,
    config: { snoozeMinutes: SNOOZE_MINUTES, fastDemo: true, fastDemoSeconds: FAST_DEMO_SECONDS },
    users: [
      { id: patientId, name: 'Ravi Kumar', role: 'patient', email: 'patient@caremate.demo', password: hashPassword('caremate123'), patientId, caregiverIds: [caregiverId] },
      { id: caregiverId, name: 'Anita Kumar', role: 'caregiver', email: 'caregiver@caremate.demo', password: hashPassword('caremate123'), caregiverPatientIds: [patientId] }
    ],
    patients: [{ id: patientId, userId: patientId, name: 'Ravi Kumar', age: 74, relationship: 'Father', emergencyContact: 'Anita Kumar · Daughter', phone: '+91 98765 43210', meals: { breakfast: '08:00', lunch: '13:00', dinner: '20:00' }, wakeTime: '06:30', sleepTime: '22:00', timezone: 'Asia/Kolkata' }],
    medications: medRows,
    doses,
    events,
    alerts: [],
    audit: [],
    messages: [{ id: id('msg'), patientId, from: 'caregiver', text: 'Your schedule is all set. Call me if you need anything.', at: isoNow() }],
    prescriptions: []
  };
}

let store;
async function persist() { await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8'); }
async function loadStore() {
  await mkdir(DATA_DIR, { recursive: true });
  try { store = JSON.parse(await readFile(STORE_PATH, 'utf8')); }
  catch { store = freshStore(); await persist(); }
  if (!store.config) store.config = { snoozeMinutes: SNOOZE_MINUTES, fastDemo: true, fastDemoSeconds: FAST_DEMO_SECONDS };
  if (!Array.isArray(store.prescriptions)) store.prescriptions = [];
}

function safeUser(user) { const { password, ...rest } = user; return rest; }
function json(res, status, payload) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(payload)); }
function fail(res, status, message, code = 'request_failed', details = undefined) { json(res, status, { error: { code, message, ...(details ? { details } : {}) } }); }
async function body(req) {
  let raw = ''; for await (const part of req) { raw += part; if (raw.length > 1_000_000) throw Object.assign(new Error('Request is too large.'), { status: 413 }); }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Please check the information and try again.'), { status: 400 }); }
}
async function requestBuffer(req, limit) {
  const chunks = []; let size = 0; let tooLarge = false;
  for await (const part of req) { size += part.length; if (size > limit) tooLarge = true; else chunks.push(part); }
  if (tooLarge) throw Object.assign(new Error('The prescription file is too large. Choose a file smaller than 25 MB.'), { status: 413 });
  return Buffer.concat(chunks, size);
}
async function multipartBody(req) {
  const boundary = req.headers['content-type']?.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundary) throw Object.assign(new Error('Choose a prescription file and try again.'), { status: 400 });
  const marker = Buffer.from(`--${(boundary[1] || boundary[2]).trim()}`);
  const raw = await requestBuffer(req, MAX_PRESCRIPTION_BYTES + 64 * 1024);
  const fields = {}; let file = null; let cursor = 0;
  while (cursor < raw.length) {
    const start = raw.indexOf(marker, cursor); if (start < 0) break;
    cursor = start + marker.length;
    if (raw.subarray(cursor, cursor + 2).toString() === '--') break;
    if (raw.subarray(cursor, cursor + 2).toString() === '\r\n') cursor += 2;
    const headerEnd = raw.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd < 0) throw Object.assign(new Error('The uploaded file could not be read.'), { status: 400 });
    const headers = raw.subarray(cursor, headerEnd).toString('utf8');
    const disposition = headers.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || '';
    const name = disposition.match(/(?:^|;)\s*name="([^"]+)"/i)?.[1];
    const filename = disposition.match(/(?:^|;)\s*filename="([^"]*)"/i)?.[1];
    const partStart = headerEnd + 4;
    const next = raw.indexOf(Buffer.concat([Buffer.from('\r\n'), marker]), partStart);
    if (next < 0) throw Object.assign(new Error('The uploaded file could not be read.'), { status: 400 });
    const data = raw.subarray(partStart, next);
    if (filename !== undefined && name === 'file') {
      if (file) throw Object.assign(new Error('Upload one prescription at a time.'), { status: 400 });
      file = { name: filename, type: headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || '', data: Buffer.from(data) };
      if (file.data.length > MAX_PRESCRIPTION_BYTES) throw Object.assign(new Error('Choose a file smaller than 25 MB.'), { status: 413 });
    } else if (name) fields[name] = data.toString('utf8').slice(0, 24_000);
    cursor = next + 2;
  }
  return { fields, file };
}
function identifyPrescriptionType(data) {
  if (data.subarray(0, 5).toString('ascii') === '%PDF-') return { mimeType: 'application/pdf', extension: 'pdf' };
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mimeType: 'image/png', extension: 'png' };
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') return { mimeType: 'image/webp', extension: 'webp' };
  return null;
}
function prescriptionView(item) {
  const { fileName, ...visible } = item;
  return { ...visible, fileUrl: `/api/prescriptions/${encodeURIComponent(item.id)}/file` };
}
function auth(req, res) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers.cookie?.match(/(?:^|;\s*)cm_session=([^;]+)/)?.[1];
  const session = token && SESSIONS.get(token);
  if (!session || session.expiresAt < Date.now()) { fail(res, 401, 'Please sign in to continue.', 'unauthenticated'); return null; }
  const user = store.users.find((u) => u.id === session.userId);
  if (!user) { fail(res, 401, 'Your session has ended. Please sign in again.', 'unauthenticated'); return null; }
  return user;
}
function patientFor(user, patientId) {
  if (user.role === 'patient') return user.patientId === patientId ? store.patients.find((p) => p.id === patientId) : null;
  return user.role === 'caregiver' && user.caregiverPatientIds?.includes(patientId) ? store.patients.find((p) => p.id === patientId) : null;
}
function patientIdFor(user) { return user.role === 'patient' ? user.patientId : user.caregiverPatientIds?.[0]; }
function requireRole(res, user, role) { if (user.role !== role) { fail(res, 403, 'This action is not available for your account.', 'forbidden'); return false; } return true; }
function summarizeDose(d) { return { ...d, medication: store.medications.find((m) => m.id === d.medicationId) || null }; }
function makeAlert(patientId, dose, type, priority, message) {
  const existing = store.alerts.find((a) => a.doseId === dose.id && a.type === type && !a.resolvedAt);
  if (existing) return existing;
  const alert = { id: id('alert'), patientId, doseId: dose.id, type, priority, message, createdAt: isoNow(), resolvedAt: null };
  store.alerts.unshift(alert); return alert;
}
function logEvent(patientId, dose, type, description, source = 'mobile') {
  store.events.unshift({ id: id('event'), patientId, doseId: dose.id, type, at: isoNow(), description, source });
}
function activeDose(patientId) {
  return store.doses.find((d) => d.patientId === patientId && ['DUE', 'SNOOZED', 'CAREGIVER_NOTIFIED'].includes(d.state)) || store.doses.find((d) => d.patientId === patientId && d.demo && d.date === dateKey() && !['TAKEN', 'MISSED', 'RESOLVED'].includes(d.state));
}
function ensureTodayDoses(patientId) {
  const date = dateKey();
  const intervalMs = store.config.fastDemo ? store.config.fastDemoSeconds * 1000 : SNOOZE_MINUTES * 60000;
  for (const med of store.medications.filter((m) => m.patientId === patientId && m.active && (!m.startDate || date >= m.startDate) && (!m.endDate || date <= m.endDate))) {
    if (store.doses.some((d) => d.patientId === patientId && d.medicationId === med.id && d.date === date && !d.demo)) continue;
    const scheduledAt = makeScheduledAt(date, med.scheduledTime);
    const alreadyDue = new Date(scheduledAt).getTime() <= Date.now();
    store.doses.push({ id: id('dose'), patientId, medicationId: med.id, medicationName: med.name, dosage: `${med.dosage} ${med.unit}`, quantity: med.quantity, mealRelation: med.mealRelation, instructions: med.instructions, date, scheduledTime: med.scheduledTime, scheduledAt, state: alreadyDue ? 'DUE' : 'UPCOMING', takenAt: null, snoozeCount: 0, snoozeUntil: alreadyDue ? new Date(Date.now() + intervalMs).toISOString() : null, source: null, demo: false });
  }
  for (const dose of store.doses.filter((d) => d.patientId === patientId && d.date === date)) {
    if (dose.state === 'UPCOMING' && new Date(dose.scheduledAt).getTime() <= Date.now()) { dose.state = 'DUE'; dose.snoozeUntil = new Date(Date.now() + intervalMs).toISOString(); logEvent(patientId, dose, 'due', `${dose.medicationName} is due.`, 'system'); }
    if (dose.state === 'DUE' && dose.snoozeUntil && new Date(dose.snoozeUntil).getTime() <= Date.now()) {
      dose.state = 'CAREGIVER_NOTIFIED'; dose.snoozeUntil = new Date(Date.now() + intervalMs).toISOString();
      makeAlert(patientId, dose, 'check_in', 'medium', `${store.patients.find((p) => p.id === patientId).name} has not confirmed ${dose.medicationName}. A friendly check-in may help.`);
      logEvent(patientId, dose, 'caregiver_notified', `Caregiver notified after ${dose.medicationName} remained unconfirmed.`, 'system');
    }
    if (['SNOOZED', 'CAREGIVER_NOTIFIED'].includes(dose.state) && dose.snoozeUntil && new Date(dose.snoozeUntil).getTime() <= Date.now()) {
      if (dose.state === 'CAREGIVER_NOTIFIED') {
        dose.state = 'MISSED'; dose.snoozeUntil = null;
        makeAlert(patientId, dose, 'escalation', 'high', `${dose.medicationName} may have been skipped. Three reminder cycles have elapsed.`);
        logEvent(patientId, dose, 'missed', `${dose.medicationName} needs a caregiver check-in after three reminder cycles.`, 'system');
      } else { dose.state = 'DUE'; dose.snoozeUntil = new Date(Date.now() + intervalMs).toISOString(); logEvent(patientId, dose, 'reminder', `A gentle follow-up reminder for ${dose.medicationName} is ready.`, 'system'); }
    }
  }
}
function dashboardFor(patientId) {
  ensureTodayDoses(patientId);
  const patient = store.patients.find((p) => p.id === patientId);
  const today = dateKey();
  const todaysDoses = store.doses.filter((d) => d.patientId === patientId && d.date === today).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  const history = store.doses.filter((d) => d.patientId === patientId && d.date !== today).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const denominator = Math.max(1, history.length);
  const onTime = history.filter((d) => d.state === 'TAKEN').length;
  const confirmed = history.filter((d) => ['TAKEN', 'DELAYED'].includes(d.state)).length;
  const missed = history.filter((d) => d.state === 'MISSED').length;
  const last7 = history.slice(0, 21);
  const recentMisses = last7.filter((d) => d.state === 'MISSED').length;
  const recentAlerts = store.alerts.filter((a) => a.patientId === patientId && !a.resolvedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const trend = [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => {
    const date = shiftDate(today, -daysAgo); const rows = store.doses.filter((d) => d.patientId === patientId && d.date === date);
    return { date, value: rows.length ? Math.round(rows.filter((d) => d.state === 'TAKEN').length / rows.length * 100) : [78, 82, 86, 79, 91, 84, 88][6 - daysAgo] };
  });
  return { patient, medications: store.medications.filter((m) => m.patientId === patientId), today: todaysDoses.map(summarizeDose), alerts: recentAlerts, events: store.events.filter((e) => e.patientId === patientId).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 18), history: history.slice(0, 30).map(summarizeDose), audit: store.audit.filter((e) => e.patientId === patientId).slice(0, 12), metrics: { adherence: Math.round(onTime / denominator * 100), confirmed: Math.round(confirmed / denominator * 100), onTime, confirmedCount: confirmed, total: history.length, missed, snoozes: history.reduce((n, d) => n + d.snoozeCount, 0), recentMisses, needsSupport: recentMisses >= 2 }, trend, config: store.config, messages: store.messages.filter((m) => m.patientId === patientId).sort((a, b) => b.at.localeCompare(a.at)) };
}
function cleanText(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function mealTime(relation, patient) {
  if (relation === 'Before bed') return patient.sleepTime;
  const match = String(relation).toLowerCase().match(/^(before|with|after) (breakfast|lunch|dinner)$/);
  if (!match) return null;
  const [, timing, meal] = match; const [hours, minutes] = patient.meals[meal].split(':').map(Number);
  const delta = timing === 'before' ? -30 : timing === 'after' ? 15 : 0;
  const total = (hours * 60 + minutes + delta + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function pdfEscape(value) { return String(value).normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/[\\()]/g, '\\$&'); }
function buildPdf(lines) {
  const content = ['BT', '/F1 10 Tf', '52 748 Td', '14 TL'];
  lines.slice(0, 46).forEach((line, index) => { if (index) content.push('T*'); content.push(`(${pdfEscape(line)}) Tj`); });
  content.push('ET');
  const stream = content.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, service: 'GrandCare local prototype', version: 1 });

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const input = await body(req); const email = cleanText(input.email, 160).toLowerCase(); const role = input.role;
    const user = store.users.find((u) => u.email.toLowerCase() === email && u.role === role);
    if (!user || !passwordMatches(String(input.password || ''), user.password)) return fail(res, 401, 'That email and password did not match. Please try again.', 'invalid_credentials');
    const token = randomBytes(32).toString('base64url'); SESSIONS.set(token, { userId: user.id, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    res.setHeader('Set-Cookie', `cm_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
    return json(res, 200, { user: safeUser(user) });
  }
  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers.cookie?.match(/(?:^|;\s*)cm_session=([^;]+)/)?.[1];
    if (token) SESSIONS.delete(token); res.setHeader('Set-Cookie', 'cm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); return json(res, 200, { ok: true });
  }

  if (pathname.startsWith('/api/')) {
    const user = auth(req, res); if (!user) return;
    if (req.method === 'GET' && pathname === '/api/me') return json(res, 200, { user: safeUser(user), patient: store.patients.find((p) => p.id === patientIdFor(user)) });
    const patientId = patientIdFor(user);
    if (!patientId || !patientFor(user, patientId)) return fail(res, 403, 'No connected patient is available to this account.', 'forbidden');

    const prescriptionFileMatch = pathname.match(/^\/api\/prescriptions\/([\w-]+)\/file$/);
    if (prescriptionFileMatch && req.method === 'GET') {
      if (!requireRole(res, user, 'patient')) return;
      const item = store.prescriptions.find((entry) => entry.id === prescriptionFileMatch[1] && entry.patientId === patientId);
      if (!item) return fail(res, 404, 'This prescription could not be found.', 'not_found');
      const content = await readFile(path.join(PRESCRIPTION_DIR, item.fileName));
      res.writeHead(200, { 'Content-Type': item.mimeType, 'Content-Disposition': `inline; filename="grandcare-prescription.${item.fileName.split('.').pop()}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
      return res.end(content);
    }
    if (pathname === '/api/prescriptions') {
      if (!requireRole(res, user, 'patient')) return;
      if (req.method === 'GET') {
        const prescriptions = store.prescriptions.filter((entry) => entry.patientId === patientId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).map(prescriptionView);
        return json(res, 200, { prescriptions });
      }
      if (req.method === 'POST') {
        const { fields, file } = await multipartBody(req);
        if (!file?.data.length) return fail(res, 400, 'Choose a prescription file first.', 'file_required');
        const type = identifyPrescriptionType(file.data);
        if (!type) return fail(res, 415, 'Use a PDF, JPEG, PNG, or WebP prescription.', 'unsupported_file');
        const extractedText = cleanText(fields.extractedText, 20_000);
        const method = fields.extractionMethod === 'pdf-text' ? 'pdf-text' : 'ocr';
        const prescriptionId = id('prescription'); const fileName = `${randomUUID()}.${type.extension}`;
        const originalName = cleanText(path.basename(file.name.replace(/\\/g, '/')), 120) || `Prescription.${type.extension}`;
        await mkdir(PRESCRIPTION_DIR, { recursive: true });
        await writeFile(path.join(PRESCRIPTION_DIR, fileName), file.data, { flag: 'wx' });
        const item = { id: prescriptionId, patientId, originalName, fileName, mimeType: type.mimeType, size: file.data.length, uploadedAt: isoNow(), extractedText, extractionMethod: method, status: extractedText ? 'review' : 'no_text' };
        store.prescriptions.unshift(item); await persist();
        return json(res, 201, { prescription: prescriptionView(item) });
      }
      return fail(res, 405, 'This prescription action is not available.', 'method_not_allowed');
    }
    const prescriptionDeleteMatch = pathname.match(/^\/api\/prescriptions\/([\w-]+)$/);
    if (prescriptionDeleteMatch && req.method === 'DELETE') {
      if (!requireRole(res, user, 'patient')) return;
      const index = store.prescriptions.findIndex((entry) => entry.id === prescriptionDeleteMatch[1] && entry.patientId === patientId);
      if (index < 0) return fail(res, 404, 'This prescription could not be found.', 'not_found');
      const [item] = store.prescriptions.splice(index, 1);
      await unlink(path.join(PRESCRIPTION_DIR, item.fileName)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
      await persist(); return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/api/dashboard') { const payload = dashboardFor(patientId); await persist(); return json(res, 200, payload); }
    if (req.method === 'PATCH' && pathname === '/api/patient') {
      if (!requireRole(res, user, 'caregiver')) return;
      const input = await body(req); const patient = store.patients.find((p) => p.id === patientId);
      const before = `${patient.meals.breakfast}/${patient.meals.lunch}/${patient.meals.dinner}`;
      const next = { ...patient, meals: { ...patient.meals } };
      for (const key of ['name', 'relationship', 'emergencyContact', 'phone', 'wakeTime', 'sleepTime']) if (input[key] !== undefined) next[key] = cleanText(input[key], 120);
      if (input.age !== undefined && input.age !== '' && Number.isFinite(Number(input.age))) next.age = Math.max(1, Math.min(120, Number(input.age)));
      if (input.meals && typeof input.meals === 'object') {
        for (const key of ['breakfast', 'lunch', 'dinner']) if (input.meals[key] !== undefined) {
          if (!validTime(input.meals[key])) return fail(res, 400, 'Enter valid breakfast, lunch, and dinner times.', 'invalid_routine');
          next.meals[key] = input.meals[key];
        }
      }
      if (!validTime(next.wakeTime) || !validTime(next.sleepTime) || !next.name) return fail(res, 400, 'Check the patient name and daily routine times.', 'invalid_routine');
      Object.assign(patient, next);
      const patientUser = store.users.find((u) => u.id === patient.userId); if (patientUser) patientUser.name = patient.name;
      store.audit.unshift({ id: id('audit'), patientId, actor: user.name, at: isoNow(), description: `Daily routine updated by ${user.name}${before !== `${patient.meals.breakfast}/${patient.meals.lunch}/${patient.meals.dinner}` ? ` · meal anchors ${patient.meals.breakfast}, ${patient.meals.lunch}, ${patient.meals.dinner}` : ''}.` });
      await persist(); return json(res, 200, { patient });
    }
    if (req.method === 'GET' && pathname === '/api/medications') return json(res, 200, { medications: store.medications.filter((m) => m.patientId === patientId) });
    if (req.method === 'POST' && pathname === '/api/medications') {
      if (!requireRole(res, user, 'caregiver')) return;
      const input = await body(req); const name = cleanText(input.name, 100); const dosage = cleanText(input.dosage, 24); const unit = cleanText(input.unit, 24); const mealRelation = cleanText(input.mealRelation, 50) || 'Custom time'; const scheduledTime = cleanText(input.scheduledTime, 5) || mealTime(mealRelation, store.patients.find((p) => p.id === patientId)) || '';
      if (!name || !dosage || !unit || !validTime(scheduledTime)) return fail(res, 400, 'Add a medicine name, dose, unit, and valid time.', 'invalid_medication');
      const med = { id: id('med'), patientId, name, genericName: cleanText(input.genericName, 100), dosage, unit, quantity: cleanText(input.quantity, 60) || '1 tablet', frequency: cleanText(input.frequency, 80) || 'Once daily', mealRelation, scheduledTime, instructions: cleanText(input.instructions, 300), duration: cleanText(input.duration, 60), startDate: cleanText(input.startDate, 20), endDate: cleanText(input.endDate, 20), notes: cleanText(input.notes, 500), active: input.active !== false, demo: false };
      store.medications.push(med); store.audit.unshift({ id: id('audit'), patientId, actor: user.name, at: isoNow(), description: `${med.name} ${med.dosage} ${med.unit} added to the schedule.` }); await persist(); return json(res, 201, { medication: med });
    }
    const medMatch = pathname.match(/^\/api\/medications\/([^/]+)$/);
    if (req.method === 'PATCH' && medMatch) {
      if (!requireRole(res, user, 'caregiver')) return;
      const med = store.medications.find((m) => m.id === medMatch[1] && m.patientId === patientId); if (!med) return fail(res, 404, 'This medicine could not be found.', 'not_found');
      const input = await body(req); const before = `${med.dosage} ${med.unit}`; const beforeMeal = med.mealRelation; const beforeActive = med.active; const next = { ...med }; const allowed = ['name', 'genericName', 'dosage', 'unit', 'quantity', 'frequency', 'mealRelation', 'scheduledTime', 'instructions', 'duration', 'startDate', 'endDate', 'notes', 'active'];
      for (const key of allowed) if (input[key] !== undefined) next[key] = key === 'active' ? Boolean(input[key]) : cleanText(input[key], key === 'instructions' || key === 'notes' ? 500 : 100);
      if (input.scheduledTime === undefined && input.mealRelation !== undefined && next.mealRelation !== beforeMeal) next.scheduledTime = mealTime(next.mealRelation, store.patients.find((p) => p.id === patientId)) || next.scheduledTime;
      if (!validTime(next.scheduledTime) || !next.name || !next.dosage) return fail(res, 400, 'Please check the medicine name, dose, and time.', 'invalid_medication');
      Object.assign(med, next);
      const today = dateKey();
      for (const dose of store.doses.filter((d) => d.medicationId === med.id && d.date >= today && ['UPCOMING', 'RESOLVED'].includes(d.state))) {
        const inDuration = (!med.startDate || dose.date >= med.startDate) && (!med.endDate || dose.date <= med.endDate);
        if (!med.active || !inDuration) { if (dose.state === 'UPCOMING') dose.state = 'RESOLVED'; continue; }
        if (dose.state === 'RESOLVED' && !beforeActive && med.active) dose.state = 'UPCOMING';
        if (dose.state === 'UPCOMING') {
          dose.medicationName = med.name; dose.dosage = `${med.dosage} ${med.unit}`; dose.quantity = med.quantity; dose.mealRelation = med.mealRelation; dose.instructions = med.instructions; dose.scheduledTime = med.scheduledTime; dose.scheduledAt = makeScheduledAt(dose.date, med.scheduledTime);
        }
      }
      ensureTodayDoses(patientId);
      store.audit.unshift({ id: id('audit'), patientId, actor: user.name, at: isoNow(), description: `${med.name} updated by ${user.name}${before !== `${med.dosage} ${med.unit}` ? ` · dose changed from ${before} to ${med.dosage} ${med.unit}` : ''}.` }); await persist(); return json(res, 200, { medication: med });
    }
    const doseMatch = pathname.match(/^\/api\/doses\/([^/]+)\/action$/);
    if (req.method === 'POST' && doseMatch) {
      const dose = store.doses.find((d) => d.id === doseMatch[1] && d.patientId === patientId); if (!dose) return fail(res, 404, 'This medication reminder could not be found.', 'not_found');
      const input = await body(req); const action = input.action; const source = input.source === 'watch' ? 'watch' : 'mobile';
      const requestedAt = new Date(input.actionAt || Date.now()); const actionAt = Number.isNaN(requestedAt.getTime()) || requestedAt.getTime() > Date.now() ? new Date() : requestedAt;
      if (action === 'taken') {
        if (dose.state === 'TAKEN' || dose.state === 'DELAYED') return fail(res, 409, `${dose.medicationName} was already confirmed at ${stamp(dose.takenAt)}.`, 'already_confirmed', { takenAt: dose.takenAt });
        if (['MISSED', 'RESOLVED'].includes(dose.state)) return fail(res, 409, 'This reminder is already closed. Ask your caregiver if it needs an update.', 'dose_closed');
        const delay = Math.max(0, Math.round((actionAt.getTime() - new Date(dose.scheduledAt).getTime()) / 60000)); dose.takenAt = actionAt.toISOString(); dose.source = source; dose.state = delay > 15 ? 'DELAYED' : 'TAKEN'; dose.snoozeUntil = null;
        logEvent(patientId, dose, 'taken', `${dose.medicationName} confirmed at ${stamp(dose.takenAt)}${delay ? ` · ${delay} minutes after schedule` : ''}.`, source);
        for (const alert of store.alerts.filter((a) => a.doseId === dose.id && !a.resolvedAt)) alert.resolvedAt = isoNow();
        await persist(); return json(res, 200, { dose, delay, message: 'Thank you. Your medication has been recorded.' });
      }
      if (action === 'later') {
        if (['TAKEN', 'DELAYED'].includes(dose.state)) return fail(res, 409, 'This medication has already been confirmed.', 'already_confirmed');
        if (dose.state === 'MISSED') return fail(res, 409, 'This reminder is already closed.', 'dose_closed');
        dose.snoozeCount = (dose.snoozeCount || 0) + 1;
        if (dose.snoozeCount === 1) {
          dose.state = 'SNOOZED'; dose.snoozeUntil = new Date(actionAt.getTime() + (store.config.fastDemo ? store.config.fastDemoSeconds * 1000 : SNOOZE_MINUTES * 60000)).toISOString();
          logEvent(patientId, dose, 'snoozed', `${dose.medicationName} reminder postponed. A gentle reminder will return in ${store.config.fastDemo ? `${store.config.fastDemoSeconds} seconds` : '15 minutes'}.`, source);
          await persist(); return json(res, 200, { dose, message: `That's okay. I'll remind you again in ${store.config.fastDemo ? `${store.config.fastDemoSeconds} seconds` : '15 minutes'}.` });
        }
        if (dose.snoozeCount === 2) {
          dose.state = 'CAREGIVER_NOTIFIED'; dose.snoozeUntil = new Date(actionAt.getTime() + (store.config.fastDemo ? store.config.fastDemoSeconds * 1000 : SNOOZE_MINUTES * 60000)).toISOString();
          makeAlert(patientId, dose, 'check_in', 'medium', `${store.patients.find((p) => p.id === patientId).name} has not confirmed ${dose.medicationName} after two reminders. A friendly check-in may help.`);
          logEvent(patientId, dose, 'caregiver_notified', `Caregiver notified after a second postponement for ${dose.medicationName}.`, source);
          await persist(); return json(res, 200, { dose, message: "I've let your caregiver know so they can check in if needed." });
        }
        dose.state = 'MISSED'; dose.snoozeUntil = null;
        makeAlert(patientId, dose, 'escalation', 'high', `${dose.medicationName} may have been skipped. Three reminder cycles have elapsed.`);
        logEvent(patientId, dose, 'missed', `${dose.medicationName} needs a caregiver check-in after three reminder cycles.`, source);
        await persist(); return json(res, 200, { dose, message: 'Your caregiver has been notified and can help if needed.' });
      }
      if (action === 'help') {
        makeAlert(patientId, dose, 'help', 'high', `${store.patients.find((p) => p.id === patientId).name} asked for help with ${dose.medicationName}.`);
        dose.state = 'HELP_REQUESTED'; logEvent(patientId, dose, 'help_requested', `Help requested for ${dose.medicationName}.`, source); await persist(); return json(res, 200, { dose, message: 'Your caregiver has been notified. You can call them directly if you need urgent help.' });
      }
      return fail(res, 400, 'Choose Taken, Later, or Help.', 'invalid_action');
    }
    if (req.method === 'POST' && pathname === '/api/demo/trigger') {
      if (!store.config.fastDemo && user.role === 'patient') return fail(res, 403, 'Demo controls are available from the caregiver view.', 'forbidden');
      const input = await body(req); const med = store.medications.find((m) => m.id === input.medicationId && m.patientId === patientId && m.active) || store.medications.find((m) => m.patientId === patientId && m.active);
      if (!med) return fail(res, 404, 'Add an active medicine before triggering a reminder.', 'no_medication');
      const date = dateKey(); const scheduledAt = isoNow(); const intervalMs = store.config.fastDemo ? store.config.fastDemoSeconds * 1000 : SNOOZE_MINUTES * 60000; const dose = { id: id('dose'), patientId, medicationId: med.id, medicationName: med.name, dosage: `${med.dosage} ${med.unit}`, quantity: med.quantity, mealRelation: med.mealRelation, instructions: med.instructions, date, scheduledTime: med.scheduledTime, scheduledAt, state: 'DUE', takenAt: null, snoozeCount: 0, snoozeUntil: new Date(Date.now() + intervalMs).toISOString(), source: null, demo: true };
      store.doses.unshift(dose); logEvent(patientId, dose, 'due', `${med.name} reminder triggered for the demo.`, 'system'); await persist(); return json(res, 201, { dose: summarizeDose(dose) });
    }
    if (req.method === 'POST' && pathname === '/api/demo/settings') {
      if (!requireRole(res, user, 'caregiver')) return;
      const input = await body(req); store.config.fastDemo = Boolean(input.fastDemo); await persist(); return json(res, 200, { config: store.config });
    }
    if (req.method === 'POST' && pathname === '/api/demo/reset') {
      if (!requireRole(res, user, 'caregiver')) return;
      const oldConfig = store.config; store = freshStore(); store.config = oldConfig; await persist(); return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && pathname === '/api/alerts/resolve') {
      if (!requireRole(res, user, 'caregiver')) return;
      const input = await body(req); const alert = store.alerts.find((a) => a.id === input.alertId && a.patientId === patientId); if (!alert) return fail(res, 404, 'This support alert could not be found.', 'not_found');
      alert.resolvedAt = isoNow(); const dose = store.doses.find((d) => d.id === alert.doseId); if (dose && ['MISSED', 'HELP_REQUESTED', 'CAREGIVER_NOTIFIED'].includes(dose.state)) dose.state = 'RESOLVED';
      logEvent(patientId, dose || { id: alert.doseId, medicationName: 'Medication' }, 'resolved', `Caregiver ${user.name} marked a support alert as resolved.`, 'caregiver'); await persist(); return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && pathname === '/api/messages') {
      const input = await body(req); const text = cleanText(input.text, 500); if (!text) return fail(res, 400, 'Write a short message first.', 'empty_message');
      const message = { id: id('msg'), patientId, from: user.role, text, at: isoNow() }; store.messages.unshift(message); await persist(); return json(res, 201, { message });
    }
    if (req.method === 'POST' && pathname === '/api/help') {
      const input = await body(req); const text = cleanText(input.text, 300) || 'Patient would like a caregiver check-in.';
      const alert = { id: id('alert'), patientId, doseId: null, type: 'help', priority: 'high', message: `${store.patients.find((p) => p.id === patientId).name} asked for help: ${text}`, createdAt: isoNow(), resolvedAt: null };
      store.alerts.unshift(alert); store.events.unshift({ id: id('event'), patientId, doseId: null, type: 'help_requested', at: isoNow(), description: 'Ravi asked for a caregiver check-in.', source: user.role }); await persist(); return json(res, 201, { alert, message: 'Your caregiver has been notified.' });
    }
    if (req.method === 'POST' && pathname === '/api/demo/pattern') {
      if (!requireRole(res, user, 'caregiver')) return;
      const meds = store.medications.filter((m) => m.patientId === patientId && m.active);
      for (let i = 0; i < 2; i += 1) {
        const med = meds[i % Math.max(1, meds.length)]; if (!med) break;
        const date = shiftDate(dateKey(), -(i + 1)); const scheduledAt = makeScheduledAt(date, med.scheduledTime);
        const dose = { id: id('dose'), patientId, medicationId: med.id, medicationName: med.name, dosage: `${med.dosage} ${med.unit}`, quantity: med.quantity, mealRelation: med.mealRelation, instructions: med.instructions, date, scheduledTime: med.scheduledTime, scheduledAt, state: 'MISSED', takenAt: null, snoozeCount: 2, snoozeUntil: null, source: 'system', demo: true };
        store.doses.unshift(dose); logEvent(patientId, dose, 'missed', `${med.name} was not confirmed in the generated demo pattern.`, 'system');
      }
      const first = store.doses.find((d) => d.patientId === patientId && d.state === 'MISSED');
      if (first) makeAlert(patientId, first, 'pattern', 'medium', 'A repeated missed-reminder pattern appears in recent history. A kind conversation may help identify useful support.');
      await persist(); return json(res, 201, { ok: true });
    }
    if (req.method === 'POST' && pathname === '/api/reports') {
      if (!requireRole(res, user, 'caregiver')) return;
      const data = dashboardFor(patientId); const rows = [
        'GRANDCARE  |  MEDICATION SUPPORT REPORT', `Generated ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, '',
        `Patient: ${data.patient.name}  |  Age: ${data.patient.age}`, `Caregiver: ${user.name}  |  Relationship: ${data.patient.relationship}`, 'Report period: Recent medication history', '',
        `On-time adherence: ${data.metrics.adherence}%`, `Confirmed (including delayed): ${data.metrics.confirmed}%`, `Confirmed doses: ${data.metrics.confirmedCount} of ${data.metrics.total}`, `Missed doses: ${data.metrics.missed}`, `Repeated missed-dose pattern: ${data.metrics.needsSupport ? 'Support suggested' : 'No pattern detected'}`, '', 'MEDICATIONS'
      ];
      data.medications.forEach((m) => rows.push(`- ${m.name} ${m.dosage} ${m.unit} · ${m.quantity} · ${m.mealRelation} · ${m.scheduledTime}`));
      rows.push('', 'RECENT ACTIVITY'); data.events.slice(0, 12).forEach((e) => rows.push(`- ${stamp(e.at)} · ${e.description}`));
      rows.push('', 'Support observations are based on reminder confirmations only.', 'Prescription instructions are entered by the caregiver.', '', 'Prototype only. Not a medical device and not a substitute for professional medical advice.');
      const pdf = buildPdf(rows); res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="grandcare-medication-report.pdf"', 'Content-Length': pdf.length }); return res.end(pdf);
    }
    return fail(res, 404, 'We could not find that page.', 'not_found');
  }

  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(PUBLIC, relative);
  if (!file.startsWith(PUBLIC + path.sep) && file !== path.join(PUBLIC, 'index.html')) return fail(res, 404, 'We could not find that page.', 'not_found');
  try { const content = await readFile(file); res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(content); }
  catch { fail(res, 404, 'We could not find that page.', 'not_found'); }
}

await loadStore();
const server = http.createServer((req, res) => { route(req, res).catch((error) => { console.error('Request error:', error.message); if (!res.headersSent) fail(res, error.status || 500, error.status ? error.message : 'Something went wrong. Please try again.', 'server_error'); else res.end(); }); 
});
server.listen(PORT, HOST, () => console.log(`GrandCare prototype listening on ${HOST}:${PORT}`));
