import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let serverProcess; let baseUrl; let tempData;
const tokens = {};

before(async () => {
  const portProbe = createServer();
  await new Promise((resolve) => portProbe.listen(0, '127.0.0.1', resolve));
  const port = portProbe.address().port; await new Promise((resolve) => portProbe.close(resolve));
  tempData = await mkdtemp(path.join(os.tmpdir(), 'caremate-test-'));
  serverProcess = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), CAREMATE_DATA_DIR: tempData, FAST_DEMO_SECONDS: '5' }, stdio: 'ignore' });
  baseUrl = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i += 1) {
    try { const response = await fetch(`${baseUrl}/api/health`); if (response.ok) return; } catch {}
    await wait(100);
  }
  throw new Error('GrandCare API did not start for integration tests.');
});

after(async () => {
  if (serverProcess && !serverProcess.killed) { serverProcess.kill(); await wait(150); }
  if (tempData && path.basename(tempData).startsWith('caremate-test-')) await rm(tempData, { recursive: true, force: true });
});

async function request(url, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${url}`, { method, headers: { ...(token ? { Cookie: `cm_session=${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.arrayBuffer();
  return { response, payload };
}
async function signIn(role) {
  const { response, payload } = await request('/api/auth/login', { method: 'POST', body: { role, email: `${role}@caremate.demo`, password: 'caremate123' } });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie'); tokens[role] = cookie.match(/cm_session=([^;]+)/)[1];
}

test('GrandCare demo API covers role access, prescription imports, meals, dose flow, escalation, help, analytics and PDF', async () => {
  assert.equal((await request('/api/health')).payload.ok, true);
  const appPage = await fetch(baseUrl);
  assert.equal(appPage.status, 200); assert.match(await appPage.text(), /GrandCare/);
  const appScript = await (await fetch(`${baseUrl}/app.js`)).text();
  assert.match(appScript, /id="login-email" name="email"/);
  assert.match(appScript, /id="login-password" name="password"/);
  await signIn('caregiver'); await signIn('patient');
  assert.equal((await request('/api/prescriptions', { token: tokens.patient })).payload.prescriptions.length, 0);
  assert.equal((await request('/api/prescriptions', { token: tokens.caregiver })).response.status, 403, 'prescription scans are private to the patient account');
  const uploadForm = new FormData();
  uploadForm.append('file', new Blob([Buffer.from('%PDF-1.4\nGrandCare prescription sample', 'utf8')], { type: 'application/pdf' }), 'sample-prescription.pdf');
  uploadForm.append('extractedText', 'Metformin 500 mg · Take after breakfast');
  uploadForm.append('extractionMethod', 'pdf-text');
  const uploadResponse = await fetch(`${baseUrl}/api/prescriptions`, { method: 'POST', headers: { Cookie: `cm_session=${tokens.patient}` }, body: uploadForm });
  assert.equal(uploadResponse.status, 201);
  const uploaded = await uploadResponse.json();
  assert.equal(uploaded.prescription.extractedText, 'Metformin 500 mg · Take after breakfast');
  const storedFile = await fetch(`${baseUrl}${uploaded.prescription.fileUrl}`, { headers: { Cookie: `cm_session=${tokens.patient}` } });
  assert.equal(storedFile.status, 200); assert.equal((await storedFile.arrayBuffer()).byteLength, Buffer.byteLength('%PDF-1.4\nGrandCare prescription sample'));
  assert.equal((await request(uploaded.prescription.fileUrl, { token: tokens.caregiver })).response.status, 403, 'caregivers cannot fetch the patient-only prescription file');
  assert.equal((await request(`/api/prescriptions/${uploaded.prescription.id}`, { token: tokens.patient, method: 'DELETE' })).response.status, 200);
  assert.equal((await request('/api/prescriptions', { token: tokens.patient })).payload.prescriptions.length, 0);
  const invalid = await request('/api/auth/login', { method: 'POST', body: { role: 'patient', email: 'patient@caremate.demo', password: 'wrong' } });
  assert.equal(invalid.response.status, 401);

  let caregiver = await request('/api/dashboard', { token: tokens.caregiver });
  assert.equal(caregiver.payload.metrics.adherence, 82);
  assert.equal(caregiver.payload.medications.length, 3);

  const created = await request('/api/medications', { token: tokens.caregiver, method: 'POST', body: { name: 'Demo medicine', dosage: '20', unit: 'mg', quantity: '1 tablet', mealRelation: 'After breakfast' } });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.medication.scheduledTime, '08:15', 'after breakfast uses the patient meal anchor plus 15 minutes');
  const medId = created.payload.medication.id;
  const updated = await request(`/api/medications/${medId}`, { token: tokens.caregiver, method: 'PATCH', body: { mealRelation: 'Before breakfast' } });
  assert.equal(updated.payload.medication.scheduledTime, '07:30', 'before breakfast uses the patient meal anchor minus 30 minutes');
  const routine = await request('/api/patient', { token: tokens.caregiver, method: 'PATCH', body: { meals: { breakfast: '08:10' } } });
  assert.equal(routine.payload.patient.meals.breakfast, '08:10');
  assert.equal((await request('/api/patient', { token: tokens.caregiver, method: 'PATCH', body: { meals: { breakfast: '09:00', lunch: '29:00' } } })).response.status, 400);
  assert.equal((await request('/api/dashboard', { token: tokens.caregiver })).payload.patient.meals.breakfast, '08:10', 'invalid routine updates do not partially apply');
  const mealAdjusted = await request(`/api/medications/${medId}`, { token: tokens.caregiver, method: 'PATCH', body: { mealRelation: 'After breakfast' } });
  assert.equal(mealAdjusted.payload.medication.scheduledTime, '08:25', 'reminder suggestions reflect updated meal anchors');
  assert.equal((await request(`/api/medications/${medId}`, { token: tokens.caregiver, method: 'PATCH', body: { scheduledTime: '99:99', dosage: '500' } })).response.status, 400);
  assert.equal((await request('/api/medications', { token: tokens.caregiver })).payload.medications.find((m) => m.id === medId).scheduledTime, '08:25', 'invalid medication updates do not partially apply');
  const patientRoutine = await request('/api/patient', { token: tokens.patient, method: 'PATCH', body: { meals: { breakfast: '09:00' }, sleepTime: '21:30' } });
  assert.equal(patientRoutine.response.status, 200, 'patients can save their own lifestyle times');
  assert.equal(patientRoutine.payload.patient.meals.breakfast, '09:00');
  assert.equal(patientRoutine.payload.patient.sleepTime, '21:30');
  assert.equal((await request('/api/patient', { token: tokens.patient, method: 'PATCH', body: { name: 'Changed by patient' } })).response.status, 403, 'patients cannot edit profile fields through the lifestyle endpoint');
  const patientMeds = await request('/api/medications', { token: tokens.patient });
  assert.ok(patientMeds.payload.medications.some((m) => m.id === medId));
  assert.ok((await request('/api/dashboard', { token: tokens.caregiver })).payload.audit.length >= 3);
  assert.equal((await request('/api/medications', { token: tokens.patient, method: 'POST', body: { name: 'Blocked', dosage: '1', unit: 'mg', scheduledTime: '10:00' } })).response.status, 403);
  assert.equal((await request(`/api/medications/${medId}`, { token: tokens.patient, method: 'PATCH', body: { dosage: '99' } })).response.status, 403);

  const takenDose = (await request('/api/demo/trigger', { token: tokens.caregiver, method: 'POST', body: {} })).payload.dose;
  const offlineActionAt = new Date(Date.now() - 120000).toISOString();
  const taken = await request(`/api/doses/${takenDose.id}/action`, { token: tokens.patient, method: 'POST', body: { action: 'taken', source: 'watch', actionAt: offlineActionAt } });
  assert.equal(taken.payload.dose.state, 'TAKEN'); assert.equal(taken.payload.dose.source, 'watch');
  assert.equal(taken.payload.dose.takenAt, offlineActionAt, 'offline actions preserve the original action timestamp');
  assert.equal((await request(`/api/doses/${takenDose.id}/action`, { token: tokens.patient, method: 'POST', body: { action: 'taken' } })).response.status, 409, 'duplicate confirmation is rejected');

  const laterDose = (await request('/api/demo/trigger', { token: tokens.caregiver, method: 'POST', body: {} })).payload.dose;
  const firstLater = await request(`/api/doses/${laterDose.id}/action`, { token: tokens.patient, method: 'POST', body: { action: 'later' } });
  assert.equal(firstLater.payload.dose.state, 'SNOOZED');
  assert.equal((await request('/api/dashboard', { token: tokens.caregiver })).payload.alerts.length, 0, 'first postpone does not alert caregiver');
  const secondLater = await request(`/api/doses/${laterDose.id}/action`, { token: tokens.patient, method: 'POST', body: { action: 'later' } });
  assert.equal(secondLater.payload.dose.state, 'CAREGIVER_NOTIFIED');
  assert.equal((await request('/api/dashboard', { token: tokens.caregiver })).payload.alerts.length, 1, 'second postpone notifies caregiver');
  await wait(5300);
  const escalated = await request('/api/dashboard', { token: tokens.caregiver });
  assert.equal(escalated.payload.today.find((d) => d.id === laterDose.id).state, 'MISSED', 'third cycle escalates after the demo timer');
  assert.ok(escalated.payload.alerts.some((a) => a.type === 'escalation'));

  const ignoredDose = (await request('/api/demo/trigger', { token: tokens.caregiver, method: 'POST', body: {} })).payload.dose;
  await wait(5300);
  const noActionWarning = await request('/api/dashboard', { token: tokens.caregiver });
  assert.equal(noActionWarning.payload.today.find((d) => d.id === ignoredDose.id).state, 'CAREGIVER_NOTIFIED', 'no response first creates a quiet caregiver check-in');
  await wait(5300);
  const noActionEscalated = await request('/api/dashboard', { token: tokens.caregiver });
  assert.equal(noActionEscalated.payload.today.find((d) => d.id === ignoredDose.id).state, 'MISSED', 'no response after caregiver check-in escalates once');

  const help = await request('/api/help', { token: tokens.patient, method: 'POST', body: { text: 'Please check in.' } });
  assert.equal(help.response.status, 201); assert.ok((await request('/api/dashboard', { token: tokens.caregiver })).payload.alerts.some((a) => a.type === 'help'));
  const pattern = await request('/api/demo/pattern', { token: tokens.caregiver, method: 'POST', body: {} }); assert.equal(pattern.response.status, 201);
  caregiver = await request('/api/dashboard', { token: tokens.caregiver }); assert.equal(caregiver.payload.metrics.needsSupport, true);
  const report = await request('/api/reports', { token: tokens.caregiver, method: 'POST', body: {} });
  assert.equal(report.response.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(report.payload).subarray(0, 8).toString('ascii'), '%PDF-1.4');
});
