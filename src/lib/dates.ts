// Datumsrechnung in UTC auf Basis von ISO-Strings (YYYY-MM-DD), damit Fristen
// unabhängig von Zeitzone und Sommerzeit stabil bleiben.

export type ISODate = string;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const d = parseISO(s);
  return toISO(d) === s;
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function today(): ISODate {
  return toISO(new Date());
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function isMonthEnd(d: Date): boolean {
  return d.getUTCDate() === daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
}

/** Monate addieren; ein Monatsende bleibt ein Monatsende (31.03. − 1 Monat = 28./29.02.). */
export function addMonths(d: Date, n: number): Date {
  const total = d.getUTCMonth() + n;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  const dim = daysInMonth(year, month0);
  const day = isMonthEnd(d) ? dim : Math.min(d.getUTCDate(), dim);
  return new Date(Date.UTC(year, month0, day));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), daysInMonth(d.getUTCFullYear(), d.getUTCMonth())));
}

export function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** 2026-11-30 → 30.11.2026 */
export function formatCH(s: ISODate | Date | null | undefined): string {
  if (!s) return '–';
  const iso = typeof s === 'string' ? s : toISO(s);
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** 30.11.2026 oder 30.11.26 → 2026-11-30 */
export function parseCH(s: string): ISODate | null {
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const iso = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isISODate(iso) ? iso : null;
}
