/**
 * dashboard.js — Caregiver dashboard logic
 * Polls /api/state every 2s and renders status, alerts, adherence.
 */

const POLL_MS = 2000;

// DOM
const alertBanner = document.getElementById('alertBanner');
const alertList   = document.getElementById('alertList');
const statusBoard = document.getElementById('statusBoard');
const barOnTime   = document.getElementById('barOnTime');
const barLate     = document.getElementById('barLate');
const barMissed   = document.getElementById('barMissed');
const cntOnTime   = document.getElementById('cntOnTime');
const cntLate     = document.getElementById('cntLate');
const cntMissed   = document.getElementById('cntMissed');
const nudgeInput  = document.getElementById('nudgeInput');
const sendNudgeBtn= document.getElementById('sendNudgeBtn');
const demoBadge   = document.getElementById('demoBadge');

// ── Nudge helpers ─────────────────────────────────────────────────────────────
function setNudge(msg) { nudgeInput.value = msg; }

sendNudgeBtn.addEventListener('click', async () => {
  const msg = nudgeInput.value.trim();
  if (!msg) return;
  sendNudgeBtn.textContent = 'Sending…';
  sendNudgeBtn.disabled = true;
  try {
    await fetch('/api/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });
    nudgeInput.value = '';
    sendNudgeBtn.textContent = '✅ Sent!';
    setTimeout(() => {
      sendNudgeBtn.textContent = 'Send to Watch →';
      sendNudgeBtn.disabled = false;
    }, 2000);
  } catch(e) {
    sendNudgeBtn.textContent = 'Send to Watch →';
    sendNudgeBtn.disabled = false;
  }
});

// ── Render ────────────────────────────────────────────────────────────────────
function statusDotClass(status) {
  switch(status) {
    case 'taken':      return 'dot-green';
    case 'taken_late': return 'dot-amber';
    case 'missed':     return 'dot-red';
    case 'due':        return 'dot-amber';
    default:           return 'dot-grey';
  }
}
function statusBadgeClass(status) {
  return `dose-status-badge status-${status}`;
}
function statusLabel(dose) {
  switch(dose.status) {
    case 'taken':      return 'Taken on time';
    case 'taken_late': return `Taken (${dose.delayMinutes}m late)`;
    case 'missed':     return 'Missed';
    case 'due':        return 'Due now';
    case 'overridden': return 'Repeat (override)';
    default:           return 'Upcoming';
  }
}

function render(data) {
  const doses     = data.doses     || [];
  const alerts    = data.alerts    || [];
  const adherence = data.adherence || { takenOnTime: 0, takenLate: 0, missed: 0 };

  // Demo badge
  if (data.demo) demoBadge.classList.remove('hidden');

  // Alert banner
  if (alerts.length === 0) {
    alertBanner.className = 'alert-banner safe';
    alertBanner.innerHTML = '<span>✅</span><span>All doses on track. Nothing needs your attention.</span>';
    alertList.classList.add('hidden');
  } else {
    alertBanner.className = 'alert-banner danger';
    alertBanner.innerHTML = `<span>🚨</span><span>${alerts.length} alert${alerts.length>1?'s':''} need your attention</span>`;
    alertList.classList.remove('hidden');
    alertList.innerHTML = alerts.map(a => `
      <div class="alert-item">
        <span>${alertIcon(a.type)}</span>
        <div>
          <div>${a.message}</div>
          <div class="alert-item-time">${new Date(a.createdAt).toLocaleTimeString()}</div>
        </div>
      </div>
    `).join('');
  }

  // Status board
  if (doses.length === 0) {
    statusBoard.innerHTML = '<div class="empty">No schedule loaded. Go to Setup to upload a prescription.</div>';
  } else {
    statusBoard.innerHTML = doses.map(d => `
      <div class="dose-row">
        <div class="dose-dot ${statusDotClass(d.status)}"></div>
        <div class="dose-name">${d.medicineName} <span style="color:#555;font-size:0.78rem">${d.strength}</span></div>
        <div class="dose-time">${d.time}</div>
        <div class="${statusBadgeClass(d.status)}">${statusLabel(d)}</div>
      </div>
    `).join('');
  }

  // Adherence bars
  const total = adherence.takenOnTime + adherence.takenLate + adherence.missed;
  const pct = (n) => total > 0 ? `${Math.round(n / total * 100)}%` : '0%';
  barOnTime.style.width = pct(adherence.takenOnTime);
  barLate.style.width   = pct(adherence.takenLate);
  barMissed.style.width = pct(adherence.missed);
  cntOnTime.textContent = adherence.takenOnTime;
  cntLate.textContent   = adherence.takenLate;
  cntMissed.textContent = adherence.missed;
}

function alertIcon(type) {
  switch(type) {
    case 'missed':         return '⏰';
    case 'repeat_override': return '⚠️';
    case 'help_requested': return '🆘';
    default:               return '🔔';
  }
}

// ── Poll ──────────────────────────────────────────────────────────────────────
async function poll() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    render(data);
  } catch(e) { /* silent */ }
}

poll();
setInterval(poll, POLL_MS);
