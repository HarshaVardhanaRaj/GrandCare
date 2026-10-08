/**
 * scheduler.js — Meal-aware dose scheduler for DoseDial
 * Converts medicines + meal times into a flat, time-sorted dose list.
 */

/**
 * Add minutes to an HH:MM string, returns HH:MM.
 */
function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mm = ((total % 1440) + 1440) % 1440 % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Build a human-readable description for a food rule.
 */
function foodRuleDescription(rule) {
  switch (rule) {
    case 'BF':   return 'Take 30 min before food';
    case 'AF':   return 'Take 15 min after food';
    case 'WITH': return 'Take with food';
    case 'EMPTY': return 'Take on empty stomach (before first meal)';
    case 'BEDTIME': return 'Take at bedtime';
    default:     return 'Take as directed';
  }
}

/**
 * Map instruction string to a food rule code.
 */
function instructionToRule(instruction) {
  if (!instruction) return 'NONE';
  const i = instruction.toLowerCase();
  if (i.includes('before_food') || i.includes('before food')) return 'BF';
  if (i.includes('after_food') || i.includes('after food'))   return 'AF';
  if (i.includes('with_food') || i.includes('with food'))     return 'WITH';
  if (i.includes('empty_stomach') || i.includes('empty stomach')) return 'EMPTY';
  if (i.includes('bedtime') || i.includes('night') || i.includes('bed')) return 'BEDTIME';
  return 'NONE';
}

/**
 * Given a food rule and meal times, return the dose time (HH:MM).
 */
function resolveTime(rule, mealTime, meals) {
  switch (rule) {
    case 'BF':      return addMinutes(mealTime, -30);
    case 'AF':      return addMinutes(mealTime, +15);
    case 'WITH':    return mealTime;
    case 'EMPTY':   return addMinutes(meals.breakfast, -60);
    case 'BEDTIME': return meals.bedtime;
    default:        return mealTime;
  }
}

/**
 * Pick meal anchors based on frequency and rule.
 */
function pickMealAnchors(freq, rule, meals) {
  if (rule === 'BEDTIME') return [meals.bedtime];
  if (rule === 'EMPTY')   return [meals.breakfast]; // once, before first meal

  const anchors = [];
  if (freq >= 1) anchors.push(meals.breakfast);
  if (freq >= 3) anchors.push(meals.lunch);
  if (freq >= 2) anchors.push(meals.dinner);
  if (freq >= 4) anchors.push(meals.bedtime);
  return anchors.slice(0, freq);
}

let _idCounter = 1;

/**
 * Main export.
 * @param {Array} medicines
 * @param {Object} meals  { breakfast, lunch, dinner, bedtime } as HH:MM
 * @returns {Array} dose objects sorted by time
 */
function buildSchedule(medicines, meals) {
  const doses = [];

  for (const med of medicines) {
    const freq = Number(med.frequency_per_day) || (med.instructions && med.instructions.toLowerCase().includes('twice') ? 2 : 1);
    const rule = med.foodRule || med.timing_code || instructionToRule(med.instruction || med.instructions);
    const anchors = pickMealAnchors(freq, rule, meals);

    for (const anchor of anchors) {
      const time = (rule === 'BEDTIME' || rule === 'EMPTY')
        ? resolveTime(rule, anchor, meals)
        : resolveTime(rule, anchor, meals);

      doses.push({
        id: `dose-${_idCounter++}`,
        medicineName: med.name,
        strength: med.strength || '',
        dose: med.dose || '1 tablet',
        time,
        foodRule: rule === 'BEDTIME' ? 'BEDTIME' : rule,
        description: foodRuleDescription(rule === 'BEDTIME' ? 'BEDTIME' : rule),
        notes: med.notes || '',
        durationDays: med.duration_days || null,
        status: 'pending',
      });
    }
  }

  // Sort by time
  doses.sort((a, b) => a.time.localeCompare(b.time));

  // Merge doses at the same minute into a combined card
  const merged = [];
  for (const dose of doses) {
    const last = merged[merged.length - 1];
    if (last && last.time === dose.time && last._merged) {
      last.medicines.push({
        medicineName: dose.medicineName,
        strength: dose.strength,
        dose: dose.dose,
        foodRule: dose.foodRule,
        description: dose.description,
        notes: dose.notes,
      });
      last.medicineName += ` + ${dose.medicineName}`;
    } else {
      dose._merged = true;
      dose.medicines = [{
        medicineName: dose.medicineName,
        strength: dose.strength,
        dose: dose.dose,
        foodRule: dose.foodRule,
        description: dose.description,
        notes: dose.notes,
      }];
      merged.push(dose);
    }
  }

  return merged;
}

function resetIdCounter() { _idCounter = 1; }

module.exports = { buildSchedule, addMinutes, resetIdCounter };
