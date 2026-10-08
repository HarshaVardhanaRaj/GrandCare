/**
 * setup.js — Setup page logic
 * Handles file upload, AI extraction, medicine table editing, schedule build & preview.
 */

let extractedMedicines = [];

// ── DOM ───────────────────────────────────────────────────────────────────────
const uploadZone    = document.getElementById('uploadZone');
const fileInput     = document.getElementById('fileInput');
const imgPreview    = document.getElementById('imgPreview');
const extractBtn    = document.getElementById('extractBtn');
const sampleBtn     = document.getElementById('sampleBtn');
const demoStartBtn  = document.getElementById('demoStartBtn');
const extractStatus = document.getElementById('extractStatus');
const reviewCard    = document.getElementById('reviewCard');
const medTableBody  = document.getElementById('medTableBody');
const mealCard      = document.getElementById('mealCard');
const buildBtn      = document.getElementById('buildBtn');
const previewCard   = document.getElementById('previewCard');
const schedulePreview = document.getElementById('schedulePreview');

// ── File input ────────────────────────────────────────────────────────────────
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  imgPreview.src = url;
  imgPreview.style.display = 'block';
  extractBtn.disabled = false;
});

// Drag-and-drop
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

// ── Extract with AI ───────────────────────────────────────────────────────────
extractBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  setStatus('loading', '🔍 Extracting medicines with Gemini AI…');
  extractBtn.disabled = true;

  const fd = new FormData();
  fd.append('image', file);

  try {
    const res = await fetch('/api/prescription/extract', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Extraction failed');
    const src = data.source === 'gemini' ? '✅ Extracted by Gemini AI' :
                data.source === 'sample' ? '📦 Using sample prescription' :
                '📦 Using fallback sample';
    setStatus('success', src);
    showReview(data.medicines);
  } catch(e) {
    setStatus('error', `❌ ${e.message}`);
    extractBtn.disabled = false;
  }
});

// ── Sample prescription ───────────────────────────────────────────────────────
sampleBtn.addEventListener('click', async () => {
  setStatus('loading', '📦 Loading sample prescription…');
  try {
    const res = await fetch('/api/prescription/extract?sample=1');
    const data = await res.json();
    setStatus('success', '📦 Sample prescription loaded');
    showReview(data.medicines);
  } catch(e) {
    setStatus('error', `❌ ${e.message}`);
  }
});

// ── Demo mode ─────────────────────────────────────────────────────────────────
demoStartBtn.addEventListener('click', async () => {
  demoStartBtn.disabled = true;
  demoStartBtn.innerHTML = '<span class="spinner"></span> Starting demo…';
  try {
    const res = await fetch('/api/demo/start', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error('Demo failed');
    // Show preview of demo doses
    renderSchedulePreview(data.doses);
    previewCard.classList.remove('hidden');
    previewCard.scrollIntoView({ behavior: 'smooth' });
    demoStartBtn.textContent = '✅ Demo started!';
  } catch(e) {
    demoStartBtn.textContent = '🚀 Start 2-Minute Demo';
    demoStartBtn.disabled = false;
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function setStatus(type, msg) {
  extractStatus.className = `extract-status ${type}`;
  extractStatus.classList.remove('hidden');
  if (type === 'loading') {
    extractStatus.innerHTML = `<span class="spinner"></span> ${msg}`;
  } else {
    extractStatus.textContent = msg;
  }
}

function confClass(c) {
  if (c >= 0.9) return 'conf conf-high';
  if (c >= 0.7) return 'conf conf-medium';
  return 'conf conf-low';
}
function confLabel(c) {
  if (c >= 0.9) return `${Math.round(c*100)}%`;
  if (c >= 0.7) return `${Math.round(c*100)}%`;
  return `${Math.round(c*100)}%`;
}

const INSTRUCTIONS = ['before_food','after_food','with_food','empty_stomach','bedtime','none'];

function showReview(medicines) {
  extractedMedicines = medicines;
  medTableBody.innerHTML = medicines.map((m, i) => `
    <tr>
      <td><input type="text" data-i="${i}" data-f="name" value="${esc(m.name)}"/></td>
      <td><input type="text" data-i="${i}" data-f="strength" value="${esc(m.strength)}"/></td>
      <td><input type="text" data-i="${i}" data-f="dose" value="${esc(m.dose)}"/></td>
      <td><input type="number" data-i="${i}" data-f="frequency_per_day" value="${m.frequency_per_day}" min="1" max="6" style="width:50px"/></td>
      <td>
        <select data-i="${i}" data-f="instruction">
          ${INSTRUCTIONS.map(ins => `<option value="${ins}" ${ins===m.instruction?'selected':''}>${ins.replace(/_/g,' ')}</option>`).join('')}
        </select>
      </td>
      <td><input type="number" data-i="${i}" data-f="duration_days" value="${m.duration_days}" min="1" style="width:55px"/></td>
      <td><input type="text" data-i="${i}" data-f="notes" value="${esc(m.notes||'')}"/></td>
      <td><span class="${confClass(m.confidence)}">${confLabel(m.confidence)}</span></td>
    </tr>
  `).join('');

  // Live-update extractedMedicines on input
  medTableBody.querySelectorAll('input,select').forEach(el => {
    el.addEventListener('input', () => {
      const i = parseInt(el.dataset.i);
      const f = el.dataset.f;
      const val = (f === 'frequency_per_day' || f === 'duration_days') ? Number(el.value) : el.value;
      extractedMedicines[i][f] = val;
    });
  });

  reviewCard.classList.remove('hidden');
  mealCard.classList.remove('hidden');
  reviewCard.scrollIntoView({ behavior: 'smooth' });
}

function esc(s) { return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

// ── Build schedule ────────────────────────────────────────────────────────────
buildBtn.addEventListener('click', async () => {
  buildBtn.disabled = true;
  buildBtn.innerHTML = '<span class="spinner"></span> Building…';

  const meals = {
    breakfast: document.getElementById('mealBreakfast').value,
    lunch:     document.getElementById('mealLunch').value,
    dinner:    document.getElementById('mealDinner').value,
    bedtime:   document.getElementById('mealBedtime').value,
  };

  try {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicines: extractedMedicines, meals }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Schedule build failed');

    renderSchedulePreview(data.doses);
    previewCard.classList.remove('hidden');
    previewCard.scrollIntoView({ behavior: 'smooth' });
    buildBtn.textContent = '✅ Schedule Built';
  } catch(e) {
    alert(`Error: ${e.message}`);
    buildBtn.textContent = '📅 Build Schedule';
    buildBtn.disabled = false;
  }
});

// ── Schedule preview ──────────────────────────────────────────────────────────
function renderSchedulePreview(doses) {
  if (!doses || doses.length === 0) {
    schedulePreview.innerHTML = '<p style="color:#777">No doses generated.</p>';
    return;
  }

  schedulePreview.innerHTML = doses.map(d => {
    const ruleClass = { BF:'rule-bf', AF:'rule-af', WITH:'rule-with', EMPTY:'rule-empty', BEDTIME:'rule-bed' }[d.foodRule] || 'rule-none';
    const ruleLabel = { BF:'Before food', AF:'After food', WITH:'With food', EMPTY:'Empty stomach', BEDTIME:'Bedtime', NONE:'As directed' }[d.foodRule] || '';

    // Google Calendar link (Phase 9 stretch)
    const calDate = new Date();
    const [h,m]   = d.time.split(':').map(Number);
    calDate.setHours(h, m, 0, 0);
    const calEnd  = new Date(calDate.getTime() + 15*60000);
    const fmt = (dt) => dt.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
    const calUrl  = `https://calendar.google.com/calendar/render?action=TEMPLATE`
      + `&text=${encodeURIComponent('💊 ' + d.medicineName)}`
      + `&dates=${fmt(calDate)}/${fmt(calEnd)}`
      + `&details=${encodeURIComponent(d.description + ' — ' + d.dose)}`
      + `&recur=RRULE:FREQ=DAILY`;

    return `
      <div class="schedule-row">
        <div class="schedule-time">${d.time}</div>
        <div class="schedule-name">${d.medicineName} <span style="color:#666;font-size:0.78rem">${d.strength}</span></div>
        <div class="schedule-rule ${ruleClass}">${ruleLabel}</div>
        <a class="cal-link" href="${calUrl}" target="_blank" rel="noopener">📅 Add</a>
      </div>
    `;
  }).join('');
}
