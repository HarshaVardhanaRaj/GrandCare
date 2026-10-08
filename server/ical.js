/**
 * ical.js — iCalendar (.ics) schedule generator
 * Generates RFC 5545 compliant .ics content for medication routines.
 */

function generateICS(doses) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DoseDial//Medication Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:DoseDial Medication Schedule',
    'X-WR-TIMEZONE:UTC',
  ];

  const now = new Date();
  const dtStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  doses.forEach((d, idx) => {
    const [h, m] = d.time.split(':').map(Number);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
    const end = new Date(start.getTime() + 15 * 60000); // 15 min duration

    const fmt = (dt) => dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push(
      'BEGIN:VEVENT',
      `UID:dosedial-${idx}-${dtStamp}@dosedial.app`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:💊 ${d.medicineName} (${d.dose})`,
      `DESCRIPTION:${d.description} - Rule: ${d.foodRule}`,
      'RRULE:FREQ=DAILY',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT5M',
      'ACTION:DISPLAY',
      `DESCRIPTION:Reminder: Take ${d.medicineName}`,
      'END:VALARM',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

module.exports = { generateICS };
