import { applyTranslations, languages, localeFor, readLanguage, saveLanguage, speechLocaleFor, translateText } from './i18n.js';

const root = document.querySelector('#app');
const toastRegion = document.querySelector('#toast-region');
const state = { user: null, data: null, page: 'dashboard', role: 'caregiver', language: readLanguage(), loginError: '', loading: false, watchOpen: false, activeDoseId: null, modal: null, polling: null, lastStates: new Map(), online: navigator.onLine, prescriptions: [], prescriptionsLoading: false, scanBusy: false, scanStatus: '', installPrompt: null };
const PENDING_KEY = 'caremate.pendingActions.v1';
const LOCAL_PRESCRIPTION_DB = 'grandcare.local-prescriptions.v1';
function readPending() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; } }
let pendingActions = readPending();
function savePending() { try { localStorage.setItem(PENDING_KEY, JSON.stringify(pendingActions)); } catch {} }

const esc = (value = '') => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const time = (value) => {
  if (!value) return '—';
  const [h, m] = String(value).split(':').map(Number);
  return new Intl.DateTimeFormat(localeFor(state.language), { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(Date.UTC(2026, 0, 1, h - 5, m - 30)));
};
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateShort = (value) => new Intl.DateTimeFormat(localeFor(state.language), { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
const stamp = (value) => value ? new Intl.DateTimeFormat(localeFor(state.language), { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : '';
const initials = (name = '') => name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
const greeting = () => { const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date())); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; };
const mealOptions = ['Before breakfast', 'With breakfast', 'After breakfast', 'Before lunch', 'With lunch', 'After lunch', 'Before dinner', 'With dinner', 'After dinner', 'Before bed', 'Custom time'];

async function api(url, options = {}) {
  const formData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body && !formData ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  if (options.raw && response.ok) return response;
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) { const error = new Error(payload.error?.message || 'Something went wrong. Please try again.'); error.code = payload.error?.code; error.status = response.status; throw error; }
  return payload;
}
function toast(message, kind = 'ok') {
  const node = document.createElement('div'); node.className = `toast${kind === 'error' ? ' error' : ''}`; node.textContent = translateText(message, state.language); toastRegion.append(node); setTimeout(() => node.remove(), 3600);
}
function setLoading(value) { state.loading = value; }
function loginScreen() {
  root.innerHTML = `<main class="login-screen">
    <section class="login-aside"><div class="brand"><img class="brand-mark" src="./icons/grandcare.svg" alt="" aria-hidden="true"><div class="brand-name">GrandCare<small>Live long, live free</small></div></div>
      <div class="login-message"><div class="eyebrow">Medication support, with heart</div><h1>Confidence in every <em>little moment.</em></h1><p>A calm companion for daily medication routines, with a thoughtful safety net for the people who care.</p><div class="principle-row"><span>◉ Patient first</span><span>♡ Gentle reminders</span><span>⌁ Support when needed</span></div></div>
      <div class="login-foot">A prototype for more confident, independent care.</div></section>
    <section class="login-main"><div class="login-card"><div class="field language-field"><label for="app-language">Language</label><select id="app-language" aria-label="Language">${languages.map((language) => `<option value="${language.code}" ${state.language === language.code ? 'selected' : ''}>${language.name}</option>`).join('')}</select></div><div class="eyebrow">Welcome to GrandCare</div><h2>Sign in to continue</h2><p>Choose your experience. Demo accounts are ready to explore.</p>
      <div class="role-switch" role="tablist"><button class="role-option ${state.role === 'caregiver' ? 'active' : ''}" data-action="select-role" data-role="caregiver" role="tab" aria-selected="${state.role === 'caregiver'}">Caregiver</button><button class="role-option ${state.role === 'patient' ? 'active' : ''}" data-action="select-role" data-role="patient" role="tab" aria-selected="${state.role === 'patient'}">Patient</button></div>
      <form id="login-form" class="login-form"><div class="field"><label for="login-email">Email address</label><input id="login-email" name="email" type="email" autocomplete="username" required placeholder="name@example.com" value="${state.role === 'caregiver' ? 'caregiver@caremate.demo' : 'patient@caremate.demo'}"></div><div class="field"><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required value="caremate123"></div><div id="login-error" class="login-error ${state.loginError ? 'show' : ''}">${esc(state.loginError)}</div><button class="btn btn-primary" type="submit">Sign in <span>→</span></button></form>
      <div class="demo-login"><div class="demo-login-label">Quick demo access</div><div class="demo-account" data-action="quick-login" data-role="caregiver"><div class="avatar">AK</div><div class="demo-account-copy"><strong>Anita Kumar</strong><span>Caregiver · Daughter</span></div><span class="demo-arrow">→</span></div><div class="demo-account" data-action="quick-login" data-role="patient"><div class="avatar">RK</div><div class="demo-account-copy"><strong>Ravi Kumar</strong><span>Patient · Independent routine</span></div><span class="demo-arrow">→</span></div></div>
      ${state.installPrompt ? '<button class="btn btn-secondary install-app-cta" data-action="install-app">Install GrandCare on this device</button>' : ''}<div class="disclaimer">Prototype only. Not a medical device and not a substitute for professional medical advice.</div></div></section></main>`;
  applyTranslations(root, state.language);
}
function navItems() {
  return state.user.role === 'caregiver'
    ? [['dashboard', '⌂', 'Dashboard'], ['patient', '♙', 'Patient'], ['medications', '▤', 'Medications'], ['alerts', '♧', 'Alerts'], ['reports', '▧', 'Reports'], ['messages', '✉', 'Messages']]
    : [['home', '⌂', 'Home'], ['lifestyle', '☀', 'Lifestyle'], ['medications', '▤', 'Medicines'], ['prescriptions', '▧', 'Prescriptions'], ['history', '◷', 'History'], ['help', '♡', 'Help']];
}
function currentDateTime() {
  return new Intl.DateTimeFormat(localeFor(state.language), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    .format(new Date()).replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());
}
function titleFor(page) {
  if (page === 'home' && state.user.role === 'patient') return currentDateTime();
  return ({ dashboard: 'Care overview', patient: 'Patient profile', medications: state.user.role === 'patient' ? 'My medicines' : 'Medication schedule', prescriptions: 'My prescriptions', alerts: 'Support alerts', reports: 'Care reports', messages: 'Messages', home: 'My day', lifestyle: 'My lifestyle', history: 'Medication history', help: 'Help & support' })[page] || 'Care overview';
}
function badge(stateName) {
  const map = { TAKEN: ['Confirmed', 'good'], DELAYED: ['Taken · delayed', 'pending'], MISSED: ['Needs attention', 'alert'], DUE: ['Due now', 'pending'], UPCOMING: ['Upcoming', 'info'], SNOOZED: ['Remind me later', 'pending'], CAREGIVER_NOTIFIED: ['Caregiver notified', 'alert'], HELP_REQUESTED: ['Help requested', 'alert'], RESOLVED: ['Resolved', 'good'] };
  const [label, cls] = map[stateName] || [stateName || 'Upcoming', 'info']; return `<span class="badge ${cls}">${esc(label)}</span>`;
}
function navIcon(icon) { return `<span class="nav-icon" aria-hidden="true">${icon}</span>`; }
function shell(content) {
  const alerts = state.data?.alerts || [];
  root.innerHTML = `<div class="app-shell ${state.user.role === 'patient' ? 'patient-app' : 'caregiver-app'}"><aside class="sidebar"><div class="brand"><img class="brand-mark" src="./icons/grandcare.svg" alt="" aria-hidden="true"><div class="brand-name">GrandCare<small>Live long, live free</small></div></div><div><div class="nav-label">${state.user.role === 'caregiver' ? 'Care space' : 'My routine'}</div><nav class="nav-list">${navItems().map(([key, icon, label]) => `<button class="nav-item ${state.page === key ? 'active' : ''}" data-action="navigate" data-page="${key}">${navIcon(icon)}<span>${label}</span>${key === 'alerts' && alerts.length ? `<span class="nav-count">${alerts.length}</span>` : ''}</button>`).join('')}</nav></div><div class="side-bottom"><div class="profile-mini"><div class="avatar">${initials(state.user.name)}</div><div class="profile-copy"><strong>${esc(state.user.name)}</strong><span>${state.user.role === 'caregiver' ? 'Caregiver' : 'Patient'} account</span></div><button class="profile-menu" data-action="logout" title="Sign out" aria-label="Sign out">↪</button></div></div></aside>
    <section class="main-area"><header class="topbar"><div><div class="topbar-title">${esc(titleFor(state.page))}</div><div class="topbar-sub">${state.user.role === 'caregiver' ? 'Ravi Kumar · Connected care' : `${greeting()}, Ravi`}</div></div><div class="topbar-space"></div>${state.installPrompt ? '<button class="install-app-button" data-action="install-app" aria-label="Install GrandCare">⇩ <span>Install</span></button>' : ''}${state.online ? '<span class="connection"><i></i>Synced</span>' : `<span class="offline">● ${pendingActions.length ? `${pendingActions.length} saved · waiting to sync` : 'Waiting to sync'}</span>`}<button class="icon-button" data-action="toggle-watch" title="Open watch simulator" aria-label="Open watch simulator">◌<i class="live-dot"></i></button><button class="icon-button" data-action="navigate" data-page="${state.user.role === 'caregiver' ? 'alerts' : 'help'}" title="Support" aria-label="Support">♡</button><button class="avatar topbar-signout" data-action="logout" title="Sign out" aria-label="Sign out of GrandCare">${initials(state.user.name)}</button></header><main class="main-content">${content}</main></section></div>${state.watchOpen ? renderWatch() : ''}${state.modal ? renderModal() : ''}`;
  applyTranslations(root, state.language);
}
function statCard(label, value, note, glyph, color = '') { return `<article class="card stat-card"><div class="stat-head"><span>${label}</span><span class="stat-glyph">${glyph}</span></div><div class="stat-value ${color}">${value}</div><div class="stat-note">${note}</div></article>`; }
function patientBanner() {
  const p = state.data.patient;
  return `<section class="card patient-banner"><div class="avatar large">${initials(p.name)}</div><div class="banner-copy"><div class="eyebrow">Connected patient</div><h2>${esc(p.name)} <span style="font:500 11px 'DM Sans';color:#87938d">· ${p.age} years</span></h2><p>${esc(p.relationship)} · Breakfast ${time(p.meals.breakfast)} · Lunch ${time(p.meals.lunch)} · Dinner ${time(p.meals.dinner)}</p></div><span class="connection"><i></i>Care circle active</span></section>`;
}
function doseRow(d) {
  return `<div class="dose-row"><div class="dose-time">${time(d.scheduledTime)}<small>${d.date === todayKey() ? 'Today' : esc(dateShort(d.scheduledAt))}</small></div><div class="dose-med"><div class="pill-icon">◒</div><div><strong>${esc(d.medicationName)} <span style="font-weight:500;color:#7b8982">${esc(d.dosage)}</span></strong><span>${esc(d.quantity)} · ${esc(d.mealRelation)}</span></div></div>${badge(d.state)}</div>`;
}
function chartMarkup() {
  const trend = state.data.trend;
  return `<div class="chart" role="img" aria-label="Daily on-time confirmation trend">${trend.map((item, idx) => `<div class="chart-col ${idx === trend.length - 1 ? 'today' : ''}"><span class="chart-value">${item.value}%</span><div class="chart-bar" style="height:${Math.max(8, item.value)}%"></div><span class="chart-label">${idx === trend.length - 1 ? 'Today' : new Intl.DateTimeFormat(localeFor(state.language), { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(`${item.date}T12:00:00+05:30`))}</span></div>`).join('')}</div><div class="chart-legend"><span><i class="legend-dot"></i>On-time confirmations</span><span>Last 7 days</span></div>`;
}
function eventTimeline(events = state.data.events) {
  if (!events.length) return `<div class="empty-state"><div class="empty-icon">◷</div><strong>No activity recorded yet</strong>Medication activity will appear here.</div>`;
  return `<div class="timeline">${events.slice(0, 6).map((event) => `<div class="timeline-item"><span class="timeline-node ${event.type === 'missed' || event.type === 'help_requested' ? 'danger' : ['snoozed','delayed','caregiver_notified'].includes(event.type) ? 'warning' : ''}"></span><div class="timeline-copy"><strong>${esc(event.description)}</strong><span>${stamp(event.at)} · ${esc(event.source || 'system')}</span></div></div>`).join('')}</div>`;
}
function alertTeaser() {
  const alerts = state.data.alerts.slice(0, 3);
  if (!alerts.length) return `<div class="empty-state"><div class="empty-icon">♡</div><strong>Everything looks good</strong>No support is needed right now.</div>`;
  return `<div class="alert-list">${alerts.map((a) => `<div class="alert-item ${a.priority === 'high' ? 'high' : ''}"><span class="alert-icon">${a.type === 'help' ? '♡' : '!'}</span><div class="alert-copy"><strong>${esc(a.message)}</strong><small>${stamp(a.createdAt)} · ${a.priority === 'high' ? 'Priority support' : 'Check-in suggested'}</small></div></div>`).join('')}</div>`;
}
function demoPanel() {
  return `<section class="card demo-bar"><div class="demo-label">✳ Demo controls <span class="demo-chip">${state.data.config.fastDemo ? `${state.data.config.fastDemoSeconds}s fast reminders` : '15 min reminders'}</span></div><button class="btn btn-secondary btn-small" data-action="trigger">▶ Trigger next medication</button><button class="btn btn-secondary btn-small" data-action="simulate" data-sim="taken">✓ Simulate taken</button><button class="btn btn-secondary btn-small" data-action="simulate" data-sim="later1">◷ Later #1</button><button class="btn btn-secondary btn-small" data-action="simulate" data-sim="later2">◷ Later #2</button><button class="btn btn-secondary btn-small" data-action="simulate" data-sim="miss">↗ Simulate miss</button><button class="btn btn-secondary btn-small" data-action="simulate" data-sim="help">♡ Simulate help</button><button class="btn btn-secondary btn-small" data-action="pattern">⌁ Generate pattern</button><button class="btn btn-secondary btn-small" data-action="report">▧ Generate PDF</button><label class="settings-toggle"><input type="checkbox" data-action="fast-toggle" ${state.data.config.fastDemo ? 'checked' : ''}> Fast demo</label><button class="btn btn-quiet btn-small" data-action="reset">Reset</button></section>`;
}
function caregiverDashboard() {
  const d = state.data; const upcoming = d.today;
  return `<div class="page-heading"><div><div class="eyebrow">${greeting()}, Anita</div><h1>Care, at a glance.</h1><p>Here’s how Ravi’s medication routine is going today.</p></div><div class="heading-actions"><button class="btn btn-secondary" data-action="toggle-watch"><span class="button-icon">◌</span> Watch preview</button><button class="btn btn-primary" data-action="add-med"><span class="button-icon">＋</span> Add medication</button></div></div>
    ${patientBanner()}<section class="stat-grid">${statCard('On-time adherence', `${d.metrics.adherence}%`, 'Across recent scheduled doses', '↗')}${statCard('Confirmed with support', `${d.metrics.confirmed}%`, `${d.metrics.confirmedCount} doses confirmed`, '✓')}${statCard('Today’s medicines', `${upcoming.length}`, `${upcoming.filter((x) => ['TAKEN','DELAYED'].includes(x.state)).length} confirmed so far`, '◒')}${statCard('Needs your attention', `${d.alerts.length}`, d.metrics.needsSupport ? 'A repeated pattern was noticed' : 'No urgent concern', '♡')}</section>
    <div class="dashboard-grid"><div class="stack"><section class="card panel"><div class="panel-title-row"><div><h2>Today’s medication plan</h2><p>A clear view of what’s due and what’s been confirmed.</p></div><button class="text-link" data-action="navigate" data-page="medications">Manage plan →</button></div><div class="dose-list">${upcoming.length ? upcoming.map(doseRow).join('') : '<div class="empty-state"><div class="empty-icon">◒</div><strong>No medications scheduled yet</strong>Add the caregiver-entered prescription details to get started.</div>'}</div></section>
      <section class="card panel"><div class="panel-title-row"><div><h2>Routine over time</h2><p>Confirmed reminders, shown without judgement.</p></div><button class="text-link" data-action="navigate" data-page="reports">View report →</button></div>${chartMarkup()}</section>
      <section class="card panel"><div class="panel-title-row"><div><h2>Recent activity</h2><p>Reminder and support timeline</p></div><button class="text-link" data-action="navigate" data-page="history">Full history →</button></div>${eventTimeline()}</section></div>
    <div class="stack"><section class="card panel"><div class="panel-title-row"><div><h2>Support inbox</h2><p>Only moments that may need a check-in.</p></div><button class="text-link" data-action="navigate" data-page="alerts">All ${d.alerts.length} →</button></div>${alertTeaser()}</section>
      <section class="card panel"><div class="panel-title-row"><div><h2>Ravi’s routine</h2><p>Daily anchors and support contact</p></div></div><div class="meal-list"><div class="meal-row"><span class="meal-icon">☀</span>Breakfast <span>${time(d.patient.meals.breakfast)}</span></div><div class="meal-row"><span class="meal-icon">◒</span>Lunch <span>${time(d.patient.meals.lunch)}</span></div><div class="meal-row"><span class="meal-icon">☾</span>Dinner <span>${time(d.patient.meals.dinner)}</span></div><div class="meal-row"><span class="meal-icon">♡</span>Wake / rest <span>${time(d.patient.wakeTime)}–${time(d.patient.sleepTime)}</span></div></div><div style="border-top:1px solid #edf0ed;margin-top:14px;padding-top:13px;display:flex;align-items:center;justify-content:space-between"><div style="font-size:10px;color:#748179">${esc(d.patient.emergencyContact)}</div><a class="phone-link" href="tel:${esc(d.patient.phone)}">Call Ravi ↗</a></div></section>
      <section class="card panel"><div class="panel-title-row"><div><h2>Care note</h2><p>A gentle safety net</p></div><span class="stat-glyph">♡</span></div><p style="font-size:11px;color:#748179;line-height:1.65;margin:0">Ravi stays in control of his routine. You’ll see a prompt here only when a reminder needs extra support.</p></section></div></div>${demoPanel()}`;
}
function medicationCard(m) {
  if (state.user.role === 'patient') return `<article class="card med-card patient-med-card"><div class="pill-icon" aria-hidden="true">◒</div><div class="med-main"><div class="med-top"><div><strong>${esc(m.name)}</strong><div class="patient-med-dose">${esc(m.dosage)} ${esc(m.unit)} · ${esc(m.quantity)}</div></div><span class="badge ${m.active ? 'good' : ''}">${m.active ? 'Active' : 'Paused'}</span></div><div class="patient-med-timing"><strong>${time(m.scheduledTime)}</strong><span>${esc(m.frequency)} · ${esc(m.mealRelation)}</span></div>${m.instructions ? `<p class="med-instructions">${esc(m.instructions)}</p>` : ''}</div></article>`;
  return `<article class="card med-card"><div class="pill-icon" style="width:40px;height:40px;font-size:17px">◒</div><div class="med-main"><div class="med-top"><div><strong>${esc(m.name)}</strong><div class="med-dose">${esc(m.genericName || m.name)} · ${esc(m.dosage)} ${esc(m.unit)} · ${esc(m.quantity)}</div></div><div class="med-actions">${state.user.role === 'caregiver' ? `<button class="btn btn-secondary btn-small" data-action="edit-med" data-med="${m.id}">Edit</button>` : ''}${m.active ? '<span class="badge good">Active</span>' : '<span class="badge">Inactive</span>'}</div></div><div class="med-info-grid"><span><b>Reminder</b>${time(m.scheduledTime)}</span><span><b>Meal timing</b>${esc(m.mealRelation)}</span><span><b>Frequency</b>${esc(m.frequency)}</span><span><b>Duration</b>${esc(m.duration || 'Ongoing')}</span></div><p class="med-instructions">${esc(m.instructions || 'No additional instruction entered.')}${m.demo ? ' <span style="color:#9b875c">· Demonstration content</span>' : ''}</p></div></article>`;
}
function medicationsPage() {
  const caregiver = state.user.role === 'caregiver';
  const audit = caregiver && state.data.audit.length ? `<section class="card panel" style="margin-top:16px"><div class="panel-title-row"><div><h2>Caregiver change history</h2><p>Schedule and routine edits</p></div></div>${state.data.audit.slice(0,6).map((entry) => `<div class="timeline-item"><span class="timeline-node"></span><div class="timeline-copy"><strong>${esc(entry.description)}</strong><span>${stamp(entry.at)} · ${esc(entry.actor)}</span></div></div>`).join('')}</section>` : '';
  return `<div class="page-heading"><div>${caregiver ? '<div class="eyebrow">Caregiver managed</div>' : ''}<h1>${caregiver ? 'Medication schedule' : 'My medicines'}</h1>${caregiver ? '<p>Prescription details entered by the caregiver and shared with Ravi.</p>' : ''}</div>${caregiver ? '<div class="heading-actions"><button class="btn btn-primary" data-action="add-med">＋ Add medication</button></div>' : ''}</div><div class="med-list">${state.data.medications.length ? state.data.medications.map(medicationCard).join('') : `<section class="card empty-state"><strong>No medicines yet</strong>${caregiver ? 'Add the prescription schedule when it is ready.' : 'Ask your caregiver to add your schedule.'}</section>`}</div>${audit}${caregiver ? demoPanel() : ''}`;
}
function prescriptionsPage() {
  const cards = state.prescriptions.map((item) => `<article class="card prescription-card"><div class="prescription-card-head"><div class="prescription-file-icon" aria-hidden="true">▧</div><div class="prescription-file-copy"><strong>${esc(item.originalName)}</strong><span>${stamp(item.uploadedAt)} · ${item.mimeType === 'application/pdf' ? 'PDF' : 'Photo'}${item.local ? ' · On this device' : ''}</span></div>${item.local ? `<button class="btn btn-secondary btn-small" data-action="open-local-prescription" data-prescription="${esc(item.id)}">Open file</button>` : `<a class="btn btn-secondary btn-small" href="${esc(item.fileUrl)}" target="_blank" rel="noopener">Open file</a>`}</div><div class="prescription-status ${item.extractedText ? 'good' : 'pending'}">${item.extractedText ? 'Scanned text ready to review' : 'No text found'}</div>${item.extractedText ? `<details class="prescription-text"><summary>Review scanned text</summary><pre>${esc(item.extractedText)}</pre></details>` : '<p class="prescription-no-text">Try a clearer photo.</p>'}<button class="text-link prescription-remove" data-action="delete-prescription" data-prescription="${esc(item.id)}">Remove</button></article>`).join('');
  return `<div class="page-heading"><div><h1>Prescriptions</h1><p>Add a paper or digital prescription.</p></div></div><section class="card panel prescription-upload"><div class="panel-title-row"><div><h2>Add prescription</h2><p>PDF or photo · up to 25 MB</p></div></div><form id="prescription-form"><label class="prescription-drop" for="prescription-file"><span class="upload-icon" aria-hidden="true">↑</span><strong>Choose a photo or PDF</strong><span>Take a photo or choose a file</span><span id="prescription-file-name" class="prescription-file-name">No file selected</span><input id="prescription-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" capture="environment" required></label><div id="ocr-status" class="ocr-status" aria-live="polite">${esc(state.scanStatus)}</div><div class="prescription-form-foot"><span>Please check scanned text against the original.</span><button class="btn btn-primary" type="submit" ${state.scanBusy ? 'disabled' : ''}>${state.scanBusy ? 'Scanning…' : 'Scan prescription'}</button></div></form></section><section class="prescription-list-section"><div class="panel-title-row"><div><h2>Saved prescriptions</h2></div></div>${state.prescriptionsLoading ? '<div class="card empty-state">Loading…</div>' : cards || '<div class="card empty-state"><strong>No prescriptions yet</strong></div>'}</section>`;
}
function setScanStatus(message) {
  state.scanStatus = message;
  const status = document.querySelector('#ocr-status'); if (status) status.textContent = translateText(message, state.language);
}
async function loadPrescriptions() {
  if (state.user?.role !== 'patient') return;
  state.prescriptionsLoading = true; render();
  try {
    let serverItems = [];
    try { serverItems = (await api('/api/prescriptions')).prescriptions; }
    catch (error) { if (error.status !== 404 && navigator.onLine) throw error; }
    const localItems = await listLocalPrescriptions();
    state.prescriptions = [...serverItems, ...localItems].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }
  catch (error) { toast(error.message, 'error'); }
  finally { state.prescriptionsLoading = false; render(); }
}
function openLocalPrescriptionDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_PRESCRIPTION_DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('prescriptions')) request.result.createObjectStore('prescriptions', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('Device storage is unavailable.'));
  });
}
function idbRequest(request) { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('Could not read this prescription.')); }); }
async function listLocalPrescriptions() {
  const db = await openLocalPrescriptionDb();
  try {
    const rows = await idbRequest(db.transaction('prescriptions', 'readonly').objectStore('prescriptions').getAll());
    return rows.filter((item) => item.patientId === state.data.patient.id).map(({ file, ...item }) => ({ ...item, local: true }));
  } finally { db.close(); }
}
async function readLocalPrescription(prescriptionId) {
  const db = await openLocalPrescriptionDb();
  try { const item = await idbRequest(db.transaction('prescriptions', 'readonly').objectStore('prescriptions').get(prescriptionId)); return item?.patientId === state.data.patient.id ? item : null; }
  finally { db.close(); }
}
async function saveLocalPrescription(file, extractedText, extractionMethod) {
  const db = await openLocalPrescriptionDb(); const item = { id: `local_${crypto.randomUUID()}`, patientId: state.data.patient.id, originalName: file.name.slice(0, 120), mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'), size: file.size, uploadedAt: new Date().toISOString(), extractedText, extractionMethod, status: extractedText ? 'review' : 'no_text', file };
  try {
    await new Promise((resolve, reject) => { const transaction = db.transaction('prescriptions', 'readwrite'); transaction.objectStore('prescriptions').put(item); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error || new Error('Could not save this prescription on your device.')); });
    const { file: savedFile, ...visible } = item; return { ...visible, local: true };
  } finally { db.close(); }
}
async function removeLocalPrescription(prescriptionId) {
  const db = await openLocalPrescriptionDb();
  try {
    await new Promise((resolve, reject) => { const transaction = db.transaction('prescriptions', 'readwrite'); transaction.objectStore('prescriptions').delete(prescriptionId); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error || new Error('Could not remove this prescription.')); });
  } finally { db.close(); }
}
async function openSavedPrescription(prescriptionId) {
  try {
    const item = await readLocalPrescription(prescriptionId); if (!item?.file) throw new Error('This prescription is not available on this device.');
    const url = URL.createObjectURL(item.file); const opened = window.open(url, '_blank');
    if (!opened) { URL.revokeObjectURL(url); toast('Allow pop-ups for this app to open the prescription.', 'error'); return; }
    opened.opener = null;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) { toast(error.message, 'error'); }
}
async function scanPrescription(file) {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  let pdf = null; let pages = [];
  if (isPdf) {
    setScanStatus('Reading the PDF…');
    const pdfjs = await import('/vendor/pdfjs/pdf.min.js');
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
    pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (pdf.numPages > 10) throw new Error('This PDF has more than 10 pages. Please choose a shorter file.');
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber); const content = await page.getTextContent();
      pages.push({ page, text: content.items.map((item) => item.str || '').filter(Boolean).join(' ').trim() });
    }
    const selectableText = pages.map((page) => page.text).filter(Boolean).join('\n\n').trim();
    if (selectableText.replace(/\s/g, '').length >= 24) return { text: selectableText.slice(0, 20_000), method: 'pdf-text' };
  }

  setScanStatus(isPdf ? 'Starting OCR for the scanned pages…' : 'Starting OCR for the photo…');
  const { createWorker } = (await import('/vendor/ocr/tesseract.esm.min.js')).default;
  const worker = await createWorker('eng', 1, {
    workerPath: '/vendor/ocr/worker.min.js',
    corePath: '/vendor/ocr/tesseract-core-lstm.wasm.js',
    langPath: '/vendor/tessdata/4.0.0',
    cacheMethod: 'write',
    logger: (update) => {
      const progress = Number.isFinite(update.progress) ? ` ${Math.round(update.progress * 100)}%` : '';
      setScanStatus(`${update.status || 'Scanning prescription'}${progress}`);
    }
  });
  try {
    const sections = [];
    if (isPdf) {
      for (let index = 0; index < pages.length; index += 1) {
        setScanStatus(`Scanning PDF page ${index + 1} of ${pages.length}…`);
        const { page } = pages[index]; const initial = page.getViewport({ scale: 2 }); const scale = Math.min(1, 3600 / Math.max(initial.width, initial.height)); const viewport = page.getViewport({ scale: 2 * scale });
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
        const result = await worker.recognize(canvas); if (result.data.text.trim()) sections.push(result.data.text.trim());
        canvas.width = 0; canvas.height = 0;
      }
    } else {
      const image = await decodePrescriptionImage(file);
      const scale = Math.min(2, 3600 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image.source || image, 0, 0, canvas.width, canvas.height); image.close?.();
      const result = await worker.recognize(canvas); if (result.data.text.trim()) sections.push(result.data.text.trim());
      canvas.width = 0; canvas.height = 0;
    }
    return { text: sections.join('\n\n').slice(0, 20_000), method: 'ocr' };
  } finally { await worker.terminate(); }
}
async function decodePrescriptionImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* Fall back to the browser's image element decoder. */ }
  }
  const url = URL.createObjectURL(file); const image = new Image();
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('This photo could not be opened. Choose a JPG, PNG, or WebP image and try again.')); image.src = url; });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('This photo could not be opened. Choose a JPG, PNG, or WebP image and try again.');
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}
async function submitPrescription(form) {
  const file = form.elements.file.files?.[0]; if (!file) { toast('Choose a prescription file first.', 'error'); return; }
  if (file.size > 25 * 1024 * 1024) { setScanStatus('This file is larger than 25 MB. Choose a smaller file and try again.'); toast(state.scanStatus, 'error'); return; }
  state.scanBusy = true; const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Preparing scan…';
  let savedSuccessfully = false;
  try {
    const { text, method } = await scanPrescription(file);
    setScanStatus(text ? 'Text extracted. Saving the prescription…' : 'No readable text found. Saving the original for review…');
    const upload = new FormData(); upload.append('file', file); upload.append('extractedText', text); upload.append('extractionMethod', method);
    let saved;
    try { saved = (await api('/api/prescriptions', { method: 'POST', body: upload })).prescription; }
    catch (error) { if (![404, 413].includes(error.status) && navigator.onLine) throw error; saved = await saveLocalPrescription(file, text, method); }
    state.prescriptions = [saved, ...state.prescriptions.filter((item) => item.id !== saved.id)];
    state.scanStatus = `${text ? 'Saved. Review the extracted text below.' : 'Saved. Try a clearer photo if you want to scan again.'}${saved.local ? ' This copy is stored in this browser.' : ''}`;
    savedSuccessfully = true; form.reset(); toast(text ? 'Prescription scanned and saved.' : 'Prescription saved; no readable text was detected.');
  } catch (error) { state.scanStatus = error.message || 'The scan could not be completed.'; toast(state.scanStatus, 'error'); }
  finally {
    state.scanBusy = false;
    if (savedSuccessfully) render();
    else { const currentButton = document.querySelector('#prescription-form button[type="submit"]'); if (currentButton) { currentButton.disabled = false; currentButton.textContent = 'Scan and save'; } setScanStatus(state.scanStatus); }
  }
}
async function deletePrescription(prescriptionId) {
  if (!confirm(translateText('Remove this prescription and its saved scan?', state.language))) return;
  try { if (state.prescriptions.find((item) => item.id === prescriptionId)?.local) await removeLocalPrescription(prescriptionId); else await api(`/api/prescriptions/${encodeURIComponent(prescriptionId)}`, { method: 'DELETE' }); state.prescriptions = state.prescriptions.filter((item) => item.id !== prescriptionId); render(); toast('Prescription removed.'); }
  catch (error) { toast(error.message, 'error'); }
}
function patientCurrentDose() {
  const today = state.data.today;
  return today.find((d) => d.id === state.activeDoseId) || today.find((d) => ['DUE','SNOOZED','CAREGIVER_NOTIFIED','HELP_REQUESTED'].includes(d.state)) || today.find((d) => d.state === 'UPCOMING') || null;
}
function medicationGuide(dose) {
  const doseText = `${dose.quantity || ''} ${dose.dosage || ''}`;
  const directions = dose.instructions || '';
  const saysWithWater = /\bwith(?:\s+(?:a\s+)?(?:full\s+)?glass\s+of)?\s+water\b/i.test(directions) && !/\b(?:do not|don't|never|avoid)\b[^.!?]{0,40}\bwater\b/i.test(directions);
  if (!/\b(tablet|capsule|pill)\b/i.test(doseText) || !saysWithWater) return '';
  return `<figure class="patient-med-guide"><picture><source srcset="./medication-guide-tablet.png?v=2" media="(prefers-reduced-motion: reduce)"><img src="./medication-guide-tablet.gif?v=2" width="400" height="140" alt="Four-step guide: check the directions, take the prescribed medicine with water, then confirm when ready." decoding="async"></picture><figcaption>4-second guide</figcaption></figure>`;
}
function voiceText(dose) {
  const name = state.data.patient.name.split(' ')[0]; const h = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const dosage = String(dose.dosage || '').replace(/\bmg\b/gi, 'milligrams').replace(/\bmcg\b/gi, 'micrograms').replace(/\bmL\b/gi, 'milliliters').replace(/\bg\b/gi, 'grams');
  const quantity = String(dose.quantity || 'your prescribed amount').replace(/^1\s+tablet\b/i, 'one tablet').replace(/^1\s+capsule\b/i, 'one capsule');
  const relation = String(dose.mealRelation || '').trim().toLowerCase();
  const spokenRelation = ['custom time', 'custom'].includes(relation) ? '' : relation;
  const instructions = String(dose.instructions || '').trim();
  const repeatedWaterInstruction = spokenRelation && instructions.replace(/[.!?]+$/, '').toLowerCase() === `take with water ${spokenRelation}`;
  const repeatsRelation = spokenRelation && instructions.toLowerCase().includes(spokenRelation);
  const timing = spokenRelation && (!repeatsRelation || repeatedWaterInstruction) ? ` ${spokenRelation}` : '';
  const takeDirections = repeatedWaterInstruction
    ? `Please take ${quantity}${timing}, with water.`
    : `Please take ${quantity}${timing}.${instructions ? ` ${instructions}` : ''}`;
  if (state.language === 'ta') {
    const greetingTa = h < 12 ? 'காலை வணக்கம்' : h < 17 ? 'மதிய வணக்கம்' : 'மாலை வணக்கம்';
    return `${greetingTa}, ${name}. இப்போது ${dose.medicationName}${dosage ? `, ${dosage}` : ''} எடுத்துக்கொள்ளும் நேரம். ${translateText(quantity, 'ta')}${timing ? ` ${translateText(spokenRelation, 'ta')}` : ''}${repeatedWaterInstruction ? ' தண்ணீருடன்' : ''} எடுத்துக்கொள்ளுங்கள்.${instructions && !repeatedWaterInstruction ? ` ${instructions}` : ''} மெதுவாக எடுத்துக்கொள்ளுங்கள். அவசரமில்லை.`;
  }
  if (state.language === 'hi') {
    const greetingHi = h < 12 ? 'सुप्रभात' : h < 17 ? 'नमस्कार' : 'शुभ संध्या';
    return `${greetingHi}, ${name}. अब ${dose.medicationName}${dosage ? `, ${dosage}` : ''} लेने का समय है। ${translateText(quantity, 'hi')}${timing ? ` ${translateText(spokenRelation, 'hi')}` : ''}${repeatedWaterInstruction ? ' पानी के साथ' : ''} लें।${instructions && !repeatedWaterInstruction ? ` ${instructions}` : ''} आराम से लें, कोई जल्दी नहीं है।`;
  }
  if (state.language === 'es') {
    const greetingEs = h < 12 ? 'Buenos días' : h < 17 ? 'Buenas tardes' : 'Buenas noches';
    return `${greetingEs}, ${name}. Es hora de ${dose.medicationName}${dosage ? `, ${dosage}` : ''}. Tome ${translateText(quantity, 'es')}${timing ? ` ${translateText(spokenRelation, 'es')}` : ''}${repeatedWaterInstruction ? ' con agua' : ''}.${instructions && !repeatedWaterInstruction ? ` ${instructions}` : ''} Tómese su tiempo, no hay prisa.`;
  }
  return `${hello}, ${name}. It is time for ${dose.medicationName}${dosage ? `, ${dosage}` : ''}. ${takeDirections} Take your time. There is no rush.`;
}
function patientHome() {
  const d = state.data; const current = patientCurrentDose(); const actionable = current && ['DUE','SNOOZED','CAREGIVER_NOTIFIED','HELP_REQUESTED'].includes(current.state);
  const firstName = d.patient.name.split(/\s+/)[0];
  const guide = current ? medicationGuide(current) : '';
  const voiceReplay = current ? `<button class="patient-voice-replay" data-action="voice" data-dose="${current.id}">🔊 &nbsp; ${actionable ? 'Hear reminder again' : 'Hear reminder'}</button>` : '';
  const doseActions = current && actionable
    ? `<div class="patient-actions"><button class="btn btn-primary" data-action="dose-action" data-dose="${current.id}" data-kind="taken">✓ &nbsp; I took it</button><button class="btn btn-secondary" data-action="dose-action" data-dose="${current.id}" data-kind="later">Remind me later</button><button class="patient-help-action" data-action="dose-action" data-dose="${current.id}" data-kind="help">I need help</button>${voiceReplay}</div>`
    : current ? `<div class="patient-actions">${voiceReplay}</div>` : '';
  const medicine = current ? `<section class="card patient-due-card"><div class="patient-due-head"><small>${actionable ? 'Medicine time' : 'Next medicine'}</small></div><h2>${esc(current.medicationName)}</h2><div class="patient-dose-line">${esc(current.dosage)} · ${esc(current.quantity)}</div><div class="patient-time-line">${time(current.scheduledTime)} · ${esc(current.mealRelation)}</div>${current.instructions ? `<div class="instruction-box"><strong>Instructions</strong><p>${esc(current.instructions)}</p></div>` : ''}${actionable ? `${doseActions}${guide}` : `${guide}${doseActions}`}</section>` : `<section class="card patient-due-card patient-all-done"><div class="patient-due-head"><small>Today</small></div><h2>${d.today.length ? 'You’re all set' : state.data.medications.length ? 'No more medicines today' : 'No schedule yet'}</h2><button class="btn btn-secondary" data-action="navigate" data-page="medications">See all medicines</button></section>`;
  return `<div class="patient-layout"><div class="page-heading patient-welcome"><div><h1>${greeting()}, ${esc(firstName)}</h1></div><button class="patient-watch-demo" data-action="toggle-watch"><span aria-hidden="true">⌚</span> Smartwatch Reminder</button></div>${medicine}<section class="card patient-support"><h2>Need help?</h2><div class="patient-support-actions"><button class="btn btn-secondary" data-action="patient-help">Ask Anita</button><a class="btn btn-secondary" href="tel:${esc(d.patient.phone)}">☎ &nbsp; Call Anita</a></div></section></div>`;
}
function lifestylePage() {
  const patient = state.data.patient;
  return `<div class="patient-layout"><div class="page-heading"><div><h1>My lifestyle</h1><p>Set your usual times for meals and sleep.</p></div></div><section class="card panel patient-lifestyle-card"><form id="lifestyle-form"><div class="lifestyle-fields"><label class="lifestyle-field" for="lifestyle-breakfast"><span>☀ &nbsp; Breakfast time</span><input id="lifestyle-breakfast" name="breakfast" type="time" value="${esc(patient.meals.breakfast)}" required></label><label class="lifestyle-field" for="lifestyle-lunch"><span>◒ &nbsp; Lunch time</span><input id="lifestyle-lunch" name="lunch" type="time" value="${esc(patient.meals.lunch)}" required></label><label class="lifestyle-field" for="lifestyle-dinner"><span>☾ &nbsp; Dinner time</span><input id="lifestyle-dinner" name="dinner" type="time" value="${esc(patient.meals.dinner)}" required></label><label class="lifestyle-field" for="lifestyle-sleep"><span>♡ &nbsp; Sleep time</span><input id="lifestyle-sleep" name="sleepTime" type="time" value="${esc(patient.sleepTime)}" required></label></div><p class="lifestyle-note">Your times help GrandCare fit your daily routine. Medicine instructions stay as prescribed.</p><button class="btn btn-primary lifestyle-save" type="submit">Save my times</button></form></section></div>`;
}
function patientProfilePage() {
  const p = state.data.patient;
  return `<div class="page-heading"><div><div class="eyebrow">Connected care circle</div><h1>${esc(p.name)}’s profile</h1><p>Routine preferences and support details.</p></div><div class="heading-actions"><button class="btn btn-secondary" data-action="edit-routine">Edit routine</button><button class="btn btn-secondary" data-action="navigate" data-page="messages">✉ Message Ravi</button></div></div><section class="card panel" style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:14px"><div class="avatar large">${initials(p.name)}</div><div><h2 style="font:700 17px Manrope;margin:0 0 4px">${esc(p.name)}</h2><span style="color:#7a8780;font-size:11px">Age ${p.age} · ${esc(p.relationship)} · ${esc(p.phone)}</span></div><span class="connection" style="margin-left:auto"><i></i>Connected</span></div></section><div class="dashboard-grid"><section class="card panel"><div class="panel-title-row"><div><h2>Daily anchors</h2><p>Meal times help contextualize caregiver-entered reminders.</p></div></div><div class="meal-list"><div class="meal-row"><span class="meal-icon">☀</span>Breakfast <span>${time(p.meals.breakfast)}</span></div><div class="meal-row"><span class="meal-icon">◒</span>Lunch <span>${time(p.meals.lunch)}</span></div><div class="meal-row"><span class="meal-icon">☾</span>Dinner <span>${time(p.meals.dinner)}</span></div><div class="meal-row"><span class="meal-icon">◷</span>Wake time <span>${time(p.wakeTime)}</span></div><div class="meal-row"><span class="meal-icon">☾</span>Rest time <span>${time(p.sleepTime)}</span></div></div></section><section class="card panel"><div class="panel-title-row"><div><h2>Support contact</h2></div></div><p style="font-size:11px;color:#64746c">${esc(p.emergencyContact)}</p><a class="btn btn-secondary" href="tel:${esc(p.phone)}">Call patient ↗</a></section></div>${demoPanel()}`;
}
function alertsPage() {
  const alerts = state.data.alerts;
  return `<div class="page-heading"><div><div class="eyebrow">Only when support may help</div><h1>Support inbox</h1><p>Timely, actionable notes. No need to continuously monitor.</p></div></div><div class="alert-page-grid"><section class="card">${alerts.length ? alerts.map((a) => `<div class="alert-full ${a.priority === 'high' ? 'high' : ''}"><span class="alert-icon">${a.type === 'help' ? '♡' : '!'}</span><div class="alert-full-main"><strong>${a.priority === 'high' ? 'A check-in may be helpful' : 'Gentle check-in suggested'}</strong><p>${esc(a.message)}</p><small>${stamp(a.createdAt)} · ${a.type === 'help' ? 'Help request' : 'Medication reminder'}</small><div class="alert-tools"><a class="btn btn-secondary btn-small" href="tel:${esc(state.data.patient.phone)}">☎ Call Ravi</a><button class="btn btn-primary btn-small" data-action="resolve" data-alert="${a.id}">Mark resolved</button></div></div></div>`).join('') : '<div class="empty-state"><div class="empty-icon">♡</div><strong>Everything looks good</strong>No support is needed right now.</div>'}</section><section class="card panel"><div class="panel-title-row"><div><h2>Escalation, with care</h2><p>How the support loop works</p></div></div><div class="timeline"><div class="timeline-item"><span class="timeline-node"></span><div class="timeline-copy"><strong>Gentle reminder</strong><span>Patient chooses what to do.</span></div></div><div class="timeline-item"><span class="timeline-node warning"></span><div class="timeline-copy"><strong>First postpone</strong><span>No caregiver alert. A quiet reminder returns.</span></div></div><div class="timeline-item"><span class="timeline-node warning"></span><div class="timeline-copy"><strong>Second postpone</strong><span>A caregiver check-in is suggested.</span></div></div><div class="timeline-item"><span class="timeline-node danger"></span><div class="timeline-copy"><strong>Third cycle</strong><span>Escalates once, then the patient is not repeatedly disturbed.</span></div></div></div></section></div>${demoPanel()}`;
}
function reportsPage() {
  const d = state.data;
  return `<div class="page-heading"><div><div class="eyebrow">Patterns, not judgement</div><h1>Care reports</h1><p>A useful summary to support conversations with the care team.</p></div></div><section class="card report-hero"><div class="report-hero-icon">▧</div><div class="report-hero-copy"><h2>Medication adherence report</h2><p>${esc(d.patient.name)} · Recent history · Includes activity, delays and caregiver support notes.</p></div><button class="btn btn-primary" data-action="report">↓ Download PDF</button></section><div class="stat-grid" style="margin-top:17px">${statCard('On-time confirmations', `${d.metrics.adherence}%`, `${d.metrics.onTime} on time`, '↗')}${statCard('Confirmed overall', `${d.metrics.confirmed}%`, `${d.metrics.confirmedCount} confirmed doses`, '✓')}${statCard('Delayed', `${d.history.filter((x) => x.state === 'DELAYED').length}`, 'Confirmed after scheduled time', '◷')}${statCard('Missed', `${d.metrics.missed}`, 'May benefit from a conversation', '♡')}</div><div class="dashboard-grid"><section class="card panel"><div class="panel-title-row"><div><h2>Weekly rhythm</h2><p>On-time confirmations, last 7 days</p></div></div>${chartMarkup()}</section><section class="card panel"><div class="panel-title-row"><div><h2>Support observation</h2><p>Based on reminder activity</p></div></div>${d.metrics.needsSupport ? `<div class="alert-item high"><span class="alert-icon">♡</span><div class="alert-copy"><strong>A repeated missed-reminder pattern appears in the recent history.</strong><small>A kind conversation may help understand what support would be useful.</small></div></div>` : `<div class="empty-state"><div class="empty-icon">✓</div><strong>No repeated pattern detected</strong>Keep the routine visible and supportive.</div>`}<p style="font-size:9px;color:#9aa49f;line-height:1.5;margin:13px 0 0">This observation is based on reminder confirmations only. It does not infer a medical condition.</p></section></div><section class="card panel" style="margin-top:16px"><div class="panel-title-row"><div><h2>Recent dose history</h2><p>Caregiver-entered schedule and patient confirmations</p></div><button class="text-link" data-action="navigate" data-page="history">All history →</button></div>${historyTable(d.history.slice(0, 9))}</section>${demoPanel()}`;
}
function historyTable(rows) {
  if (!rows.length) return '<div class="empty-state"><strong>No medication history yet</strong>Confirmed activity will appear here.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Medication</th><th>Scheduled</th><th>Recorded</th><th>Status</th></tr></thead><tbody>${rows.map((d) => `<tr><td>${esc(dateShort(d.scheduledAt))}</td><td><strong>${esc(d.medicationName)}</strong><div style="color:#97a29c;font-size:9px;margin-top:3px">${esc(d.dosage)}</div></td><td>${time(d.scheduledTime)}</td><td>${d.takenAt ? stamp(d.takenAt) : '—'}</td><td>${badge(d.state)}</td></tr>`).join('')}</tbody></table></div>`;
}
function historyPage() {
  if (state.user.role === 'patient') {
    const rows = state.data.history;
    const labels = { TAKEN: 'Taken', DELAYED: 'Taken later', MISSED: 'Missed', DUE: 'Due', UPCOMING: 'Upcoming', SNOOZED: 'Later', CAREGIVER_NOTIFIED: 'Anita notified', HELP_REQUESTED: 'Help requested', RESOLVED: 'Resolved' };
    const historyItems = (items) => `<div class="patient-history-list">${items.map((dose) => `<article class="patient-history-item"><div><strong>${esc(dose.medicationName)}</strong><span>${esc(dateShort(dose.scheduledAt))} · ${time(dose.scheduledTime)}</span></div><span class="patient-history-state ${['TAKEN','DELAYED'].includes(dose.state) ? 'done' : dose.state === 'MISSED' ? 'missed' : ''}">${labels[dose.state] || 'Recorded'}</span></article>`).join('')}</div>`;
    const older = rows.slice(8);
    const history = rows.length ? `${historyItems(rows.slice(0, 8))}${older.length ? `<details class="patient-more-activity"><summary>Older entries (${older.length})</summary>${historyItems(older)}</details>` : ''}` : '<div class="empty-state"><strong>No history yet</strong></div>';
    return `<div class="page-heading"><div><h1>History</h1></div></div><section class="card panel patient-history-card">${history}<details class="patient-more-activity"><summary>More activity</summary>${eventTimeline(state.data.events)}</details></section>`;
  }
  return `<div class="page-heading"><div><div class="eyebrow">Your record</div><h1>Medication history</h1><p>Every reminder and confirmation, in one place.</p></div></div><section class="card panel">${historyTable(state.data.history)}${eventTimeline(state.data.events)}</section>`;
}
function messagesPage() {
  const messages = state.data.messages.slice().reverse();
  return `<div class="page-heading"><div><div class="eyebrow">A simple way to check in</div><h1>Messages</h1><p>${state.user.role === 'patient' ? 'Send a note to Anita when you’d like support.' : 'A private note between you and Ravi.'}</p></div></div><section class="card panel" style="max-width:760px"><div class="messages">${messages.length ? messages.map((m) => `<div class="message ${m.from === state.user.role ? 'mine' : ''}">${esc(m.text)}<small>${m.from === 'caregiver' ? 'Anita' : 'Ravi'} · ${stamp(m.at)}</small></div>`).join('') : '<div class="empty-state"><strong>No messages yet</strong>Send a kind check-in when it helps.</div>'}</div><form id="message-form" class="message-form"><input name="text" maxlength="500" placeholder="Write a short message…" aria-label="Write a short message" required><button class="btn btn-primary" type="submit">Send</button></form></section>`;
}
function helpPage() {
  const messagePanel = messagesPage().match(/<section class="card panel"[\s\S]*?<\/section>/)?.[0] || '';
  return `<div class="page-heading"><div><h1>Help</h1></div></div><section class="card panel patient-help-card"><h2>Need a hand?</h2><button class="btn btn-primary" data-action="patient-help">Ask Anita to check in</button><a class="btn btn-secondary" href="tel:${esc(state.data.patient.phone)}">☎ &nbsp; Call Anita <span>${esc(state.data.patient.phone)}</span></a><details class="patient-message-disclosure"><summary>Message Anita</summary>${messagePanel}</details><p class="patient-emergency-note">Emergency? Call your local emergency number.</p></section>`;
}
function renderWatch() {
  const d = patientCurrentDose();
  const active = d && ['DUE','SNOOZED','CAREGIVER_NOTIFIED','HELP_REQUESTED'].includes(d.state);
  return `<div class="watch-overlay" data-action="close-watch"><section class="watch-panel" role="dialog" aria-label="Patient smartwatch simulator" data-watch-panel><div class="watch-top"><span>◌ PATIENT WATCH</span><button class="close-button" data-action="close-watch" aria-label="Close watch">×</button></div><div class="watch-face"><div class="watch-time">${new Intl.DateTimeFormat(localeFor(state.language), { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date())}</div><div class="watch-date">${new Intl.DateTimeFormat(localeFor(state.language), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date())}</div>${d ? `<div class="watch-kicker">${active ? 'MEDICATION DUE' : 'NEXT MEDICATION'}</div><div class="watch-med">${esc(d.medicationName)}</div><div class="watch-detail">${esc(d.dosage)}<br>${esc(d.quantity)}<br>${esc(d.mealRelation)}</div>${active ? `<div class="watch-actions"><button class="watch-taken" data-action="dose-action" data-dose="${d.id}" data-kind="taken" data-source="watch">✓ &nbsp; TAKEN</button><button class="watch-later" data-action="dose-action" data-dose="${d.id}" data-kind="later" data-source="watch">◷ &nbsp; LATER</button><button class="watch-help" data-action="dose-action" data-dose="${d.id}" data-kind="help" data-source="watch">♡ &nbsp; HELP</button></div>` : `<div class="watch-actions"><button class="watch-taken" data-action="trigger">Show reminder</button></div>`}` : '<div class="watch-kicker">ALL SET</div><div class="watch-empty">No medication is scheduled yet.</div>'}</div><div class="watch-foot">Patient-only glanceable view · Actions sync with GrandCare</div></section></div>`;
}
function renderModal() {
  if (state.modal.type === 'routine') {
    const p = state.data.patient;
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="routine-modal-title" data-modal-panel><div class="modal-head"><div class="avatar">${initials(p.name)}</div><div class="modal-head-copy"><h2 id="routine-modal-title">Edit patient routine</h2><p>These meal anchors can suggest reminder times for caregiver-managed medicines.</p></div><button class="close-button" data-action="close-modal" aria-label="Close">×</button></div><form id="routine-form"><div class="form-grid"><div class="field"><label for="patient-name">Patient name</label><input id="patient-name" name="name" value="${esc(p.name)}" required></div><div class="field"><label for="patient-age">Age</label><input id="patient-age" name="age" type="number" min="1" max="120" value="${p.age}"></div><div class="field"><label for="patient-relationship">Caregiver relationship</label><input id="patient-relationship" name="relationship" value="${esc(p.relationship)}"></div><div class="field"><label for="patient-phone">Contact phone</label><input id="patient-phone" name="phone" value="${esc(p.phone)}"></div><div class="field"><label for="patient-contact">Emergency contact</label><input id="patient-contact" name="emergencyContact" value="${esc(p.emergencyContact)}"></div><div class="field"><label for="wake-time">Typical wake time</label><input id="wake-time" name="wakeTime" type="time" value="${esc(p.wakeTime)}"></div><div class="field"><label for="breakfast-time">Breakfast time</label><input id="breakfast-time" name="breakfast" type="time" value="${esc(p.meals.breakfast)}" required></div><div class="field"><label for="lunch-time">Lunch time</label><input id="lunch-time" name="lunch" type="time" value="${esc(p.meals.lunch)}" required></div><div class="field"><label for="dinner-time">Dinner time</label><input id="dinner-time" name="dinner" type="time" value="${esc(p.meals.dinner)}" required></div><div class="field"><label for="sleep-time">Typical rest time</label><input id="sleep-time" name="sleepTime" type="time" value="${esc(p.sleepTime)}"></div></div><div class="form-foot"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Save routine</button></div></form></section></div>`;
  }
  if (state.modal.type === 'med') {
    const m = state.modal.med || { name: '', genericName: '', dosage: '', unit: 'mg', quantity: '1 tablet', frequency: 'Once daily', mealRelation: 'After breakfast', scheduledTime: '08:15', instructions: 'Take with water after breakfast.', duration: 'Ongoing', startDate: '', endDate: '', notes: '', active: true };
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="med-modal-title" data-modal-panel><div class="modal-head"><div class="pill-icon" style="width:42px;height:42px;font-size:18px">◒</div><div class="modal-head-copy"><h2 id="med-modal-title">${m.id ? 'Edit medication' : 'Add medication'}</h2><p>Use details from the prescription or caregiver instructions.</p></div><button class="close-button" data-action="close-modal" aria-label="Close">×</button></div><form id="med-form" data-id="${esc(m.id || '')}"><div class="form-grid"><div class="field"><label for="med-name">Medicine name *</label><input id="med-name" name="name" required value="${esc(m.name)}" placeholder="e.g. Metformin"></div><div class="field"><label for="med-generic">Generic name</label><input id="med-generic" name="genericName" value="${esc(m.genericName)}"></div><div class="field"><label for="med-dose">Dose *</label><input id="med-dose" name="dosage" required value="${esc(m.dosage)}" placeholder="500"></div><div class="field"><label for="med-unit">Unit</label><select id="med-unit" name="unit">${['mg','mcg','g','mL','tablet','capsule','puff','drop'].map((u) => `<option ${m.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div><div class="field"><label for="med-quantity">Quantity per dose</label><input id="med-quantity" name="quantity" value="${esc(m.quantity)}" placeholder="1 tablet"></div><div class="field"><label for="med-frequency">Frequency</label><input id="med-frequency" name="frequency" value="${esc(m.frequency)}" placeholder="Once daily"></div><div class="field"><label for="med-meal">Meal relation</label><select id="med-meal" name="mealRelation">${mealOptions.map((o) => `<option ${m.mealRelation === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div><div class="field"><label for="scheduled-time">Reminder time</label><input id="scheduled-time" type="time" name="scheduledTime" value="${esc(m.scheduledTime)}" required></div><div class="field"><label for="med-start">Start date</label><input id="med-start" type="date" name="startDate" value="${esc(m.startDate)}"></div><div class="field"><label for="med-end">End date</label><input id="med-end" type="date" name="endDate" value="${esc(m.endDate)}"></div><div class="field full"><label for="med-instructions">Caregiver-entered instructions</label><textarea id="med-instructions" name="instructions" placeholder="Enter the prescription instructions as written">${esc(m.instructions)}</textarea></div><div class="field full"><label for="med-notes">Prescription notes</label><textarea id="med-notes" name="notes">${esc(m.notes)}</textarea></div><div class="field full"><label class="active-check"><input id="med-active" name="active" type="checkbox" value="true" ${m.active ? 'checked' : ''}><span>Medication schedule is active</span></label></div></div><div class="form-foot"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Save schedule</button></div></form></section></div>`;
  }
  return '';
}
function render() {
  if (!state.user) return loginScreen();
  if (!state.data) { root.innerHTML = '<main style="max-width:1100px;margin:12vh auto;padding:30px"><div class="skeleton" style="width:150px;height:24px"></div><div class="skeleton" style="height:90px;margin-top:24px"></div><div class="skeleton" style="height:250px;margin-top:18px"></div></main>'; applyTranslations(root, state.language); return; }
  let content;
  if (state.user.role === 'caregiver') content = ({ dashboard: caregiverDashboard, patient: patientProfilePage, medications: medicationsPage, alerts: alertsPage, reports: reportsPage, messages: messagesPage, history: historyPage })[state.page]?.() || caregiverDashboard();
  else content = ({ home: patientHome, lifestyle: lifestylePage, medications: medicationsPage, prescriptions: prescriptionsPage, history: historyPage, help: helpPage })[state.page]?.() || patientHome();
  shell(content);
}
async function refresh({ quiet = false } = {}) {
  if (!state.user) return;
  try {
    const data = await api('/api/dashboard');
    let reminderToSpeak = null;
    for (const dose of data.today) {
      const old = state.lastStates.get(dose.id);
      if (!reminderToSpeak && state.user.role === 'patient' && dose.state === 'DUE' && old !== 'DUE') reminderToSpeak = dose;
      if (old && old !== dose.state && ['DUE','CAREGIVER_NOTIFIED','MISSED','HELP_REQUESTED'].includes(dose.state)) {
        if (!quiet) toast(dose.state === 'DUE' ? `A gentle reminder is ready for ${dose.medicationName}.` : dose.state === 'MISSED' ? `${dose.medicationName} may need a caregiver check-in.` : `Support updated for ${dose.medicationName}.`);
        if (['UPCOMING','SNOOZED'].includes(old) && dose.state === 'DUE' && 'Notification' in window && Notification.permission === 'granted') new Notification(translateText('GrandCare · gentle reminder', state.language), { body: translateText(`${dose.medicationName} ${dose.dosage} · ${dose.quantity} · ${dose.mealRelation}. ${dose.instructions || 'Ready when you are.'}`, state.language), tag: dose.id });
      }
      state.lastStates.set(dose.id, dose.state);
    }
    state.data = applyPending(data); state.online = true; render();
    if (reminderToSpeak && !pendingActions.some((action) => action.doseId === reminderToSpeak.id)) playVoice(reminderToSpeak.id, { automatic: true });
  } catch (error) {
    state.online = false;
    if (!quiet) toast(error.message, 'error');
    if (!state.data) { root.innerHTML = `<main style="max-width:600px;margin:12vh auto;padding:24px;text-align:center"><div class="card panel"><div class="empty-icon">⌁</div><strong>GrandCare couldn’t connect</strong><p style="color:#71807a;font-size:12px;line-height:1.6">${esc(error.message)} Check that the local server is running, then try again.</p><button class="btn btn-primary" data-action="retry">Try again</button></div></main>`; applyTranslations(root, state.language); }
  }
}
function applyPending(data) {
  for (const action of pendingActions) {
    const dose = data.today.find((d) => d.id === action.doseId); if (!dose) continue;
    if (action.action === 'taken') { dose.state = 'TAKEN'; dose.takenAt = action.actionAt; dose.source = action.source; }
    else if (action.action === 'later') { dose.snoozeCount = (dose.snoozeCount || 0) + 1; dose.state = dose.snoozeCount === 1 ? 'SNOOZED' : dose.snoozeCount === 2 ? 'CAREGIVER_NOTIFIED' : 'MISSED'; dose.snoozeUntil = action.actionAt; }
    else if (action.action === 'help') dose.state = 'HELP_REQUESTED';
    dose.pendingSync = true;
  }
  return data;
}
async function flushPendingActions() {
  if (!navigator.onLine || !pendingActions.length || !state.user) return;
  let changed = false;
  while (pendingActions.length) {
    const item = pendingActions[0];
    try {
      await api(`/api/doses/${encodeURIComponent(item.doseId)}/action`, { method: 'POST', body: JSON.stringify(item) });
      pendingActions.shift(); savePending(); changed = true;
    } catch (error) {
      if (error.status === 409) { pendingActions.shift(); savePending(); changed = true; toast('A newer medication record already exists. Please check the history.'); continue; }
      break;
    }
  }
  if (changed) { toast(pendingActions.length ? 'Some actions are still waiting to sync.' : 'Your saved medication action has synced.'); await refresh({ quiet: true }); }
}
async function login(role, email, password) {
  try {
    const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ role, email, password }) });
    state.user = result.user; state.role = role; state.page = role === 'caregiver' ? 'dashboard' : 'home'; state.loginError = ''; state.lastStates.clear();
    await refresh({ quiet: true }); clearInterval(state.polling); state.polling = setInterval(() => refresh({ quiet: true }), 5000);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
  } catch (error) { state.loginError = error.message; render(); }
}
function onOnline() { state.online = true; flushPendingActions().then(() => refresh({ quiet: true })); }
function onOffline() { state.online = false; render(); }
async function actionDose(doseId, action, source = 'mobile') {
  const actionAt = new Date().toISOString();
  try {
    const result = await api(`/api/doses/${encodeURIComponent(doseId)}/action`, { method: 'POST', body: JSON.stringify({ action, source, actionAt }) });
    state.activeDoseId = doseId; const messages = { taken: result.message, later: result.message, help: result.message };
    toast(messages[action] || result.message); if (action === 'help') state.page = state.user.role === 'patient' ? 'help' : 'alerts';
    await refresh({ quiet: true });
    if (action === 'taken') state.modal = null;
  } catch (error) {
    if (!navigator.onLine || error instanceof TypeError) {
      pendingActions.push({ doseId, action, source, actionAt }); savePending();
      if (state.data) { state.data = applyPending(state.data); state.online = false; render(); }
      toast('Saved on this device. Waiting to sync.'); return;
    }
    toast(error.message, 'error'); await refresh({ quiet: true });
  }
}
async function triggerDose() {
  try { const result = await api('/api/demo/trigger', { method: 'POST', body: JSON.stringify({}) }); state.activeDoseId = result.dose.id; toast(`${result.dose.medicationName} reminder is ready.`); await refresh({ quiet: true }); }
  catch (error) { toast(error.message, 'error'); }
}
async function simulate(kind) {
  try {
    const triggered = await api('/api/demo/trigger', { method: 'POST', body: JSON.stringify({}) }); const doseId = triggered.dose.id; state.activeDoseId = doseId;
    if (kind === 'taken') await actionDose(doseId, 'taken');
    else if (kind === 'help') await actionDose(doseId, 'help');
    else {
      const count = kind === 'later1' ? 1 : kind === 'later2' ? 2 : 3;
      for (let i = 0; i < count; i += 1) {
        const result = await api(`/api/doses/${doseId}/action`, { method: 'POST', body: JSON.stringify({ action: 'later' }) });
        if (i === count - 1) toast(result.message);
      }
      await refresh({ quiet: true });
    }
  } catch (error) { toast(error.message, 'error'); await refresh({ quiet: true }); }
}
async function setFastDemo(value) {
  try { await api('/api/demo/settings', { method: 'POST', body: JSON.stringify({ fastDemo: value }) }); toast(value ? `${state.data.config.fastDemoSeconds} second demo reminders enabled.` : 'Reminder delay set to 15 minutes.'); await refresh({ quiet: true }); }
  catch (error) { toast(error.message, 'error'); }
}
async function downloadReport() {
  try { const response = await api('/api/reports', { method: 'POST', body: JSON.stringify({}), raw: true }); const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'grandcare-medication-report.pdf'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1500); toast('Your medication support report is ready.'); }
  catch (error) { toast(error.message, 'error'); }
}
async function resolveAlert(alertId) {
  try { await api('/api/alerts/resolve', { method: 'POST', body: JSON.stringify({ alertId }) }); toast('Support alert marked as resolved.'); await refresh({ quiet: true }); }
  catch (error) { toast(error.message, 'error'); }
}
async function submitMedication(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const activeField = form.querySelector('[name="active"]'); if (activeField) data.active = activeField.checked;
  try {
    if (form.dataset.id) await api(`/api/medications/${form.dataset.id}`, { method: 'PATCH', body: JSON.stringify(data) });
    else await api('/api/medications', { method: 'POST', body: JSON.stringify(data) });
    state.modal = null; toast('Medication schedule saved.'); await refresh({ quiet: true });
  } catch (error) { toast(error.message, 'error'); }
}
async function submitRoutine(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const body = { ...values, meals: { breakfast: values.breakfast, lunch: values.lunch, dinner: values.dinner } };
  delete body.breakfast; delete body.lunch; delete body.dinner;
  try { await api('/api/patient', { method: 'PATCH', body: JSON.stringify(body) }); state.modal = null; toast('Patient routine updated.'); await refresh({ quiet: true }); }
  catch (error) { toast(error.message, 'error'); }
}
async function submitLifestyle(form) {
  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  try {
    const result = await api('/api/patient', { method: 'PATCH', body: JSON.stringify({ meals: { breakfast: form.elements.breakfast.value, lunch: form.elements.lunch.value, dinner: form.elements.dinner.value }, sleepTime: form.elements.sleepTime.value }) });
    state.data.patient = result.patient;
    render();
    toast('Lifestyle times saved.');
  } catch (error) {
    toast(error.message, 'error');
    saveButton.disabled = false;
  }
}
async function sendMessage(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  try { await api('/api/messages', { method: 'POST', body: JSON.stringify(data) }); toast('Message sent.'); await refresh({ quiet: true }); }
  catch (error) { toast(error.message, 'error'); }
}
async function resetDemo() {
  if (!window.confirm(translateText('Reset the demo to Ravi and Anita’s sample data? Any changes in this prototype will be replaced.', state.language))) return;
  try { await api('/api/demo/reset', { method: 'POST', body: JSON.stringify({}) }); state.activeDoseId = null; state.lastStates.clear(); toast('Demo data has been reset.'); await refresh({ quiet: true }); }
  catch (error) { toast(error.message, 'error'); }
}
async function generatePattern() {
  try { await api('/api/demo/pattern', { method: 'POST', body: JSON.stringify({}) }); toast('A repeated missed-reminder pattern was added to the demo history.'); await refresh({ quiet: true }); }
  catch (error) { toast(error.message, 'error'); }
}
function playVoice(doseId, { automatic = false } = {}) {
  const dose = state.data.today.find((d) => d.id === doseId) || state.data.today[0]; if (!dose) return;
  const text = voiceText(dose);
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    toast(automatic ? 'Voice playback is unavailable here. Please follow the directions on screen.' : text, automatic ? 'error' : 'ok');
    return;
  }
  const synthesis = window.speechSynthesis;
  synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = synthesis.getVoices();
  const preferredLocale = speechLocaleFor(state.language);
  const localePrefix = preferredLocale.split('-')[0].toLowerCase();
  const localizedVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(`${localePrefix}-`));
  utterance.voice = localizedVoices.find((voice) => /natural|neural|online|google|microsoft/i.test(voice.name)) || localizedVoices[0] || null;
  utterance.rate = 0.93;
  utterance.pitch = 1.02;
  utterance.volume = 1;
  utterance.lang = utterance.voice?.lang || preferredLocale;
  utterance.onerror = (event) => {
    if (automatic && event.error === 'not-allowed') toast('Tap “Hear reminder again” once to allow voice reminders on this device.', 'error');
  };
  synthesis.speak(utterance);
}
function mealTimeFor(relation) {
  const meal = relation.toLowerCase().match(/(breakfast|lunch|dinner)/)?.[1];
  if (relation === 'Before bed') return state.data.patient.sleepTime;
  if (!meal) return null;
  const base = state.data.patient.meals[meal]; let delta = relation.startsWith('Before') ? -30 : relation.startsWith('After') ? 15 : 0;
  let [h, m] = base.split(':').map(Number); let total = (h * 60 + m + delta + 1440) % 1440; return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]'); if (!target) return;
  const action = target.dataset.action;
  if (action === 'select-role') { state.role = target.dataset.role; state.loginError = ''; render(); }
  else if (action === 'install-app') { const prompt = state.installPrompt; if (prompt) { await prompt.prompt(); await prompt.userChoice; state.installPrompt = null; document.querySelectorAll('.install-app-button,.install-app-cta').forEach((button) => button.remove()); } }
  else if (action === 'quick-login') { const role = target.dataset.role; await login(role, role === 'patient' ? 'patient@caremate.demo' : 'caregiver@caremate.demo', 'caremate123'); }
  else if (action === 'navigate') { state.page = target.dataset.page; state.watchOpen = false; render(); if (state.page === 'prescriptions') await loadPrescriptions(); }
  else if (action === 'retry') { render(); await start(); }
  else if (action === 'toggle-watch') { state.watchOpen = true; render(); }
  else if (action === 'close-watch') { if (target.classList.contains('watch-overlay') && event.target !== target) return; state.watchOpen = false; render(); }
  else if (action === 'close-modal') { state.modal = null; render(); }
  else if (action === 'backdrop-close') { if (event.target === target) { state.modal = null; render(); } }
  else if (action === 'add-med') { state.modal = { type: 'med' }; render(); }
  else if (action === 'edit-med') { state.modal = { type: 'med', med: state.data.medications.find((m) => m.id === target.dataset.med) }; render(); }
  else if (action === 'edit-routine') { state.modal = { type: 'routine' }; render(); }
  else if (action === 'logout') { clearInterval(state.polling); window.speechSynthesis?.cancel(); await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); state.user = null; state.data = null; state.prescriptions = []; state.page = 'dashboard'; state.watchOpen = false; state.modal = null; render(); }
  else if (action === 'dose-action') { event.preventDefault(); window.speechSynthesis?.cancel(); await actionDose(target.dataset.dose, target.dataset.kind, target.dataset.source || 'mobile'); }
  else if (action === 'trigger') await triggerDose();
  else if (action === 'simulate') await simulate(target.dataset.sim);
  else if (action === 'fast-toggle') await setFastDemo(target.checked);
  else if (action === 'report') await downloadReport();
  else if (action === 'delete-prescription') await deletePrescription(target.dataset.prescription);
  else if (action === 'open-local-prescription') await openSavedPrescription(target.dataset.prescription);
  else if (action === 'resolve') await resolveAlert(target.dataset.alert);
  else if (action === 'reset') await resetDemo();
  else if (action === 'pattern') await generatePattern();
  else if (action === 'voice') playVoice(target.dataset.dose);
  else if (action === 'patient-help') {
    const dose = patientCurrentDose();
    if (dose) await actionDose(dose.id, 'help');
    else { try { const result = await api('/api/help', { method: 'POST', body: JSON.stringify({ text: 'I would like a check-in when you have a moment.' }) }); toast(result.message); await refresh({ quiet: true }); } catch (error) { toast(error.message, 'error'); } }
  }
  else if (action === 'enable-notifications') {
    if (!('Notification' in window)) toast('Gentle reminders are shown in the app. This browser does not support notifications.');
    else { const permission = await Notification.requestPermission(); toast(permission === 'granted' ? 'Gentle browser notifications are enabled.' : 'You can still see reminders in the app.'); }
  }
});
document.addEventListener('submit', async (event) => {
  if (event.target.id === 'login-form') { event.preventDefault(); const form = new FormData(event.target); await login(state.role, form.get('email'), form.get('password')); }
  else if (event.target.id === 'prescription-form') { event.preventDefault(); await submitPrescription(event.target); }
  else if (event.target.id === 'med-form') { event.preventDefault(); await submitMedication(event.target); }
  else if (event.target.id === 'routine-form') { event.preventDefault(); await submitRoutine(event.target); }
  else if (event.target.id === 'lifestyle-form') { event.preventDefault(); await submitLifestyle(event.target); }
  else if (event.target.id === 'message-form') { event.preventDefault(); await sendMessage(event.target); event.target.reset(); }
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'app-language') { state.language = saveLanguage(event.target.value); render(); return; }
  if (event.target.id === 'med-meal') { const recommended = mealTimeFor(event.target.value); if (recommended) { const field = document.querySelector('#scheduled-time'); if (field) field.value = recommended; } }
  if (event.target.id === 'prescription-file') { const file = event.target.files?.[0]; const name = document.querySelector('#prescription-file-name'); if (name) name.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : 'No file selected'; }
});
document.addEventListener('click', (event) => {
  const panel = document.querySelector('[data-watch-panel]'); if (state.watchOpen && panel && !panel.contains(event.target) && !event.target.closest('[data-action="toggle-watch"]') && !event.target.closest('[data-action="dose-action"]')) { /* overlay handler owns dismissal */ }
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); state.installPrompt = event;
  const space = document.querySelector('.topbar-space');
  if (space && !document.querySelector('.install-app-button')) {
    const button = document.createElement('button'); button.className = 'install-app-button'; button.dataset.action = 'install-app'; button.setAttribute('aria-label', translateText('Install GrandCare', state.language));
    button.append(document.createTextNode('⇩ ')); const label = document.createElement('span'); label.textContent = translateText('Install', state.language); button.append(label); space.after(button);
  }
});
window.addEventListener('appinstalled', () => { state.installPrompt = null; document.querySelectorAll('.install-app-button,.install-app-cta').forEach((button) => button.remove()); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

async function start() {
  try { const result = await api('/api/me'); state.user = result.user; state.role = result.user.role; state.page = state.user.role === 'caregiver' ? 'dashboard' : 'home'; await refresh({ quiet: true }); state.polling = setInterval(() => refresh({ quiet: true }), 5000); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); }
  catch { render(); }
}
start();
