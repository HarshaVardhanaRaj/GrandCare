/**
 * demo-dock.js — Floating Hackathon Pitch Dock
 * Automatically attaches floating demo controls to setup.html, watch.html, and dashboard.html
 */

(function () {
  const page = window.location.pathname.split('/').pop() || 'setup.html';

  const dock = document.createElement('div');
  dock.className = 'demo-dock';
  dock.innerHTML = `
    <div class="demo-dock-label">⚡ Pitch Dock</div>
    <button class="demo-dock-btn" id="dockDemo2Min">🚀 2-Min Demo</button>
    <button class="demo-dock-btn" id="dockFastForward">⏩ +15 Mins</button>
    <button class="demo-dock-btn danger" id="dockMissed">⚠️ Missed Dose</button>
    <div class="demo-dock-nav">
      <a href="setup.html" class="demo-dock-link ${page === 'setup.html' ? 'active' : ''}">Setup</a>
      <a href="watch.html" class="demo-dock-link ${page === 'watch.html' ? 'active' : ''}">Watch</a>
      <a href="dashboard.html" class="demo-dock-link ${page === 'dashboard.html' ? 'active' : ''}">Dashboard</a>
    </div>
  `;

  document.body.appendChild(dock);

  // Link stylesheet if not already present
  if (!document.querySelector('link[href*="demo-dock.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'demo-dock.css';
    document.head.appendChild(link);
  }

  // Event handlers
  document.getElementById('dockDemo2Min').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/demo/start', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'demo_started') {
        alert('🚀 2-Minute Demo Started! Check Watch & Dashboard screens.');
        if (typeof fetchSchedule === 'function') fetchSchedule();
        if (typeof poll === 'function') poll();
      }
    } catch (e) {
      console.error(e);
    }
  });

  document.getElementById('dockFastForward').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/doses');
      const data = await res.json();
      const pending = (data.doses || []).find(d => d.status === 'pending');
      if (pending) {
        alert(`⏩ Simulated time fast-forward! Dose "${pending.medicineName}" is now due.`);
      } else {
        alert('⏩ Fast-forward simulated. No pending doses found.');
      }
    } catch (e) {
      console.error(e);
    }
  });

  document.getElementById('dockMissed').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/doses');
      const data = await res.json();
      const pending = (data.doses || []).find(d => d.status === 'pending');
      if (pending) {
        await fetch('/api/log-dose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doseId: pending.id, status: 'missed' })
        });
        alert(`⚠️ Simulated missed dose for "${pending.medicineName}"! Alert generated on Caregiver Dashboard.`);
        if (typeof fetchSchedule === 'function') fetchSchedule();
        if (typeof poll === 'function') poll();
      } else {
        alert('No pending dose available to mark as missed.');
      }
    } catch (e) {
      console.error(e);
    }
  });
})();
