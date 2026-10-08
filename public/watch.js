/**
 * watch.js — DoseDial Watch UI logic
 * Polls /api/state every 2s, drives card, progress ring, voice, haptics.
 */

const POLL_MS = 2000;

let voiceEnabled   = false;
let currentDoseId  = null;
let guardDoseId    = null;
let lastSpokenId   = null;
let lastNudgeId    = null;
let state          = { doses: [], nudges: [], demo: false };

// ── DOM refs ──────────────────────────────────────────────────────────────────
const voiceGate     = document.getElementById('voiceGate');
const enableVoiceBtn= document.getElementById('enableVoiceBtn');
const demoBadge     = document.getElementById('demoBadge');

const nudgeOverlay  = document.getElementById('nudgeOverlay');
const nudgeMsg      = document.getElementById('nudgeMsg');
const nudgeOkBtn    = document.getElementById('nudgeOkBtn');

const guardOverlay  = document.getElementById('guardOverlay');
const guardMsg      = document.getElementById('guardMsg');
const guardYes      = document.getElementById('guardYes');
const guardNo       = document.getElementById('guardNo');

const historyPanel  = document.getElementById('historyPanel');
const historyList   = document.getElementById('historyList');
const historyClose  = document.getElementById('historyClose');

const watchClock    = document.getElementById('watchClock');
const ringBar       = document.getElementById('ringBar');
const doseCard      = document.getElementById('doseCard');
const emptyState    = document.getElementById('emptyState');
const cardContent   = document.getElementById('cardContent');
const cardName      = document.getElementById('cardName');
const cardStrength  = document.getElementById('cardStrength');
const foodIcon      = document.getElementById('foodIcon');
const foodLabel     = document.getElementById('foodLabel');
const cardTime      = document.getElementById('cardTime');
const doneCount     = document.getElementById('doneCount');
const totalCount    = document.getElementById('totalCount');
const statusDots    = document.getElementById('statusDots');
const watchActions  = document.getElementById('watchActions');
const btnTaken      = document.getElementById('btnTaken');
const btnLater      = document.getElementById('btnLater');
const btnHelp       = document.getElementById('btnHelp');

// ── Voice gate ────────────────────────────────────────────────────────────────
const langSelect = document.getElementById('langSelect');
let currentLangCode = 'en';

if (langSelect) {
  langSelect.addEventListener('change', async () => {
    currentLangCode = langSelect.value;
    try {
      await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentLangCode })
      });
    } catch(e) {}
  });
}

enableVoiceBtn.addEventListener('click', () => {
  voiceEnabled = true;
  voiceGate.style.display = 'none';
  // Unlock audio context
  const readyMsg = currentLangCode === 'hi' ? 'दवा घड़ी तैयार है' : (currentLangCode === 'es' ? 'DoseDial listo' : (currentLangCode === 'ta' ? 'மருந்து கடிகாரம் தயார்' : 'DoseDial ready'));
  const u = new SpeechSynthesisUtterance(readyMsg);
  u.volume = 0.5;
  u.rate = 0.85;
  speechSynthesis.speak(u);
  startPolling();
});

// ── Clock ─────────────────────────────────────────────────────────────────────
function updateClock() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  watchClock.textContent = `${h}:${m}`;
}
updateClock();
setInterval(updateClock, 1000);

// ── Food rule helpers ─────────────────────────────────────────────────────────
function foodIconFor(rule) {
  switch(rule) {
    case 'BF':      return '🍽️';  // empty plate = before food
    case 'AF':      return '🍛';  // full plate = after food
    case 'WITH':    return '🥗';
    case 'EMPTY':   return '⭕';
    case 'BEDTIME': return '🌙';
    default:        return '💊';
  }
}
function foodLabelFor(rule) {
  switch(rule) {
    case 'BF':      return 'Before food';
    case 'AF':      return 'After food';
    case 'WITH':    return 'With food';
    case 'EMPTY':   return 'Empty stomach';
    case 'BEDTIME': return 'At bedtime';
    default:        return 'As directed';
  }
}

// ── Voice + haptics ───────────────────────────────────────────────────────────
function speak(text) {
  if (!voiceEnabled) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.85; // Senior-friendly slower speaking rate
  u.pitch = 1.05;
  const voices = speechSynthesis.getVoices();
  const naturalVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Karen')));
  if (naturalVoice) u.voice = naturalVoice;
  speechSynthesis.speak(u);
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ── Render ────────────────────────────────────────────────────────────────────
function render(newState) {
  state = newState;

  // Demo badge
  if (state.demo) demoBadge.classList.remove('hidden');

  const doses = state.doses || [];
  const done  = doses.filter(d => d.status === 'taken' || d.status === 'taken_late' || d.status === 'overridden').length;
  const total = doses.length;

  // Progress ring
  const pct = total > 0 ? done / total : 0;
  const circumference = 2 * Math.PI * 172; // r=172
  const offset = circumference * (1 - pct);
  ringBar.style.strokeDasharray  = circumference;
  ringBar.style.strokeDashoffset = offset;
  if (pct >= 1) ringBar.classList.add('complete');

  doneCount.textContent  = done;
  totalCount.textContent = total;

  // Status dots
  statusDots.innerHTML = doses.map(d => {
    const cls = `dot dot-${d.status.replace('_','-')}`;
    return `<div class="${cls}" title="${d.medicineName} ${d.time}" data-id="${d.id}"></div>`;
  }).join('');
  statusDots.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => showHistory(doses));
  });

  // Find current dose to show: first due/pending
  const active = doses.find(d => d.status === 'due') || doses.find(d => d.status === 'pending');

  if (!active) {
    emptyState.classList.remove('hidden');
    cardContent.classList.add('hidden');
    doseCard.classList.remove('due');
    currentDoseId = null;
    watchActions.style.opacity = '0.4';
  } else {
    emptyState.classList.add('hidden');
    cardContent.classList.remove('hidden');
    currentDoseId = active.id;

    if (active.status === 'due') {
      doseCard.classList.add('due');
      watchActions.style.opacity = '1';

      // Voice & haptics for new due dose
      if (lastSpokenId !== active.id) {
        lastSpokenId = active.id;
        const txt = `Time for your ${active.medicineName}, ${active.dose}, ${foodLabelFor(active.foodRule)}`;
        playChime();
        speak(txt);
        vibrate([200, 100, 200]);
      }

      // Soft reminder
      if (active.softReminder && lastSpokenId !== `soft-${active.id}`) {
        lastSpokenId = `soft-${active.id}`;
        playChime();
        speak(`Gentle reminder: ${active.medicineName} is waiting for you.`);
        vibrate([100]);
      }
    } else {
      doseCard.classList.remove('due');
      watchActions.style.opacity = '0.8';
    }

    cardName.textContent     = active.medicineName;
    cardStrength.textContent = active.strength ? `${active.strength} · ${active.dose}` : active.dose;
    foodIcon.textContent     = foodIconFor(active.foodRule);
    foodLabel.textContent    = foodLabelFor(active.foodRule);
    cardTime.textContent     = `Next: ${active.time}`;
  }

  // Nudge
  const nudge = state.nudges?.[0];
  if (nudge && nudge.id !== lastNudgeId) {
    lastNudgeId = nudge.id;
    nudgeMsg.textContent = nudge.message || 'Your family is thinking of you. Tap if you need anything.';
    nudgeOverlay.classList.remove('hidden');
    speak('You have a message from your caregiver.');
    vibrate([300, 200, 300]);
  }
}

// ── Polling ───────────────────────────────────────────────────────────────────
function startPolling() {
  poll();
  setInterval(poll, POLL_MS);
}

async function poll() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    render(data);
  } catch(e) {
    // silent — server may be starting
  }
}

// ── Buttons ───────────────────────────────────────────────────────────────────
btnTaken.addEventListener('click', async () => {
  if (!currentDoseId) return;
  try {
    const res = await fetch(`/api/dose/${currentDoseId}/taken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.status === 409) {
      const data = await res.json();
      const t = data.takenAt ? new Date(data.takenAt).toLocaleTimeString() : 'earlier';
      guardMsg.textContent = `You already took this at ${t}. Take again?`;
      guardDoseId = currentDoseId;
      guardOverlay.classList.remove('hidden');
      return;
    }
    speak('Recorded! Well done.');
    vibrate([100, 50, 100]);
    poll();
  } catch(e) { console.error(e); }
});

btnLater.addEventListener('click', async () => {
  if (!currentDoseId) return;
  await fetch(`/api/dose/${currentDoseId}/later`, { method: 'POST' });
  speak('Okay, I\'ll remind you in 10 minutes.');
  poll();
});

btnHelp.addEventListener('click', async () => {
  if (!currentDoseId) return;
  await fetch(`/api/dose/${currentDoseId}/help`, { method: 'POST' });
  speak('Help request sent to your caregiver.');
  vibrate([500]);
  poll();
});

// ── Guard overlay ─────────────────────────────────────────────────────────────
guardYes.addEventListener('click', async () => {
  if (!guardDoseId) return;
  guardOverlay.classList.add('hidden');
  await fetch(`/api/dose/${guardDoseId}/taken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ override: true }),
  });
  speak('Noted. Your caregiver has been informed.');
  guardDoseId = null;
  poll();
});
guardNo.addEventListener('click', () => {
  guardOverlay.classList.add('hidden');
  guardDoseId = null;
});

// ── Nudge overlay ─────────────────────────────────────────────────────────────
nudgeOkBtn.addEventListener('click', async () => {
  nudgeOverlay.classList.add('hidden');
  await fetch('/api/nudge/ack', { method: 'POST' });
});

// ── History panel ─────────────────────────────────────────────────────────────
function showHistory(doses) {
  historyList.innerHTML = doses.map(d => {
    const statusMap = {
      taken: '✅', taken_late: '🟡', missed: '❌', due: '🔔', pending: '⏳', overridden: '⚠️',
    };
    const icon = statusMap[d.status] || '💊';
    const detail = d.takenAt ? `taken at ${new Date(d.takenAt).toLocaleTimeString()}` : d.status;
    return `<div class="history-item">${icon} <strong>${d.medicineName}</strong> ${d.strength} — ${d.time} — <em>${detail}</em></div>`;
  }).join('') || '<div class="history-item">No doses scheduled yet.</div>';
  historyPanel.classList.remove('hidden');
}

historyClose.addEventListener('click', () => historyPanel.classList.add('hidden'));

// Ring click → show history
document.getElementById('watchShell').addEventListener('click', (e) => {
  // Only trigger on clicks near the ring edge (outside inner 220px)
  const shell = document.getElementById('watchShell');
  const rect  = shell.getBoundingClientRect();
  const cx    = rect.left + rect.width  / 2;
  const cy    = rect.top  + rect.height / 2;
  const dist  = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2);
  if (dist > 120) showHistory(state.doses || []);
});

// ── Web Audio Synthesizer for Watch Chime ─────────────────────────────────────
function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Dual-tone chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.frequency.setValueAtTime(987.77, now + 0.15); // B5
    gain2.gain.setValueAtTime(0.2, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.65);
  } catch (e) {
    console.log('Web Audio chime not supported', e);
  }
}
