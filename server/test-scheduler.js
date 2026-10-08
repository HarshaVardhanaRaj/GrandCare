/**
 * test-scheduler.js — Phase 1 test for meal-aware scheduler
 * Run: node server/test-scheduler.js
 */

const assert = require('assert');
const { buildSchedule, resetIdCounter } = require('./scheduler');

resetIdCounter();

const medicines = [
  {
    name: 'Metformin',
    strength: '500 mg',
    dose: '1 tablet',
    frequency_per_day: 2,
    instruction: 'after_food',
    duration_days: 30,
    notes: '',
  },
];

const meals = {
  breakfast: '08:00',
  lunch: '13:00',
  dinner: '20:00',
  bedtime: '22:00',
};

const doses = buildSchedule(medicines, meals);

// Expect exactly 2 doses: 08:15 (after breakfast) and 20:15 (after dinner)
assert.strictEqual(doses.length, 2, `Expected 2 doses, got ${doses.length}`);
assert.strictEqual(doses[0].time, '08:15', `Expected 08:15, got ${doses[0].time}`);
assert.strictEqual(doses[1].time, '20:15', `Expected 20:15, got ${doses[1].time}`);
assert.strictEqual(doses[0].medicineName, 'Metformin');
assert.strictEqual(doses[0].foodRule, 'AF');

console.log('✅ All scheduler tests passed!');
console.log('   Dose 1:', doses[0].time, doses[0].medicineName, doses[0].foodRule);
console.log('   Dose 2:', doses[1].time, doses[1].medicineName, doses[1].foodRule);
