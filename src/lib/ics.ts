import type { ISODate } from './dates';

export interface CalendarEvent {
  uid: string;
  date: ISODate;
  summary: string;
  description: string;
  /** Erinnerungen n Tage vorher */
  alarmsDaysBefore: number[];
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** RFC 5545: Zeilen über 75 Oktette falten */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
    }
    current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildCalendar(events: CalendarEvent[], stamp: Date = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Abo-Pilot//Fristen//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Abo-Pilot Fristen'];
  for (const e of events) {
    const day = e.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${dtstamp}`, `DTSTART;VALUE=DATE:${day}`, `SUMMARY:${escapeText(e.summary)}`, `DESCRIPTION:${escapeText(e.description)}`);
    for (const d of e.alarmsDaysBefore) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.summary)}`, `TRIGGER:-P${d}D`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
