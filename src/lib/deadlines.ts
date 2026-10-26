import type { Category } from './categories';
import { addDays, addMonths, diffDays, endOfMonth, parseISO, toISO, type ISODate } from './dates';

export interface ContractTerms {
  category: Category | string;
  startDate: ISODate | null;
  minTermMonths: number;
  /** 0 = nach der Mindestlaufzeit unbefristet; sonst automatische Verlängerung um n Monate */
  renewalMonths: number;
  noticeMonths: number;
  /** Kündigung nur auf ein Monatsende möglich */
  toMonthEnd: boolean;
}

export type DeadlineKind = 'befristet' | 'unbefristet' | 'krankenkasse';

export interface DeadlineInfo {
  kind: DeadlineKind;
  /** frühestes Vertragsende, das noch erreichbar ist */
  endDate: ISODate;
  /** letzter Tag, an dem die Kündigung beim Anbieter eintreffen muss */
  deadline: ISODate;
  daysLeft: number;
  note: string;
}

export type Urgency = 'rot' | 'orange' | 'gelb' | 'gruen' | 'frei';

/** Letzter Eingangstag einer Kündigung für ein Vertragsende mit n Monaten Frist. */
export function latestReceipt(end: Date, noticeMonths: number): Date {
  return addDays(addMonths(addDays(end, 1), -noticeMonths), -1);
}

function openEnded(terms: ContractTerms, ref: Date, earliest: Date): { end: Date; deadline: Date } {
  const notice = terms.noticeMonths;
  if (terms.toMonthEnd) {
    let candidate = endOfMonth(earliest > ref ? earliest : ref);
    for (let i = 0; i < 120; i++) {
      const deadline = latestReceipt(candidate, notice);
      if (deadline >= ref && candidate >= earliest) return { end: candidate, deadline };
      candidate = endOfMonth(addDays(candidate, 1));
    }
  }
  let end = notice > 0 ? addDays(addMonths(ref, notice), -1) : ref;
  if (end < earliest) end = earliest;
  const deadline = latestReceipt(end, notice);
  return { end, deadline: deadline < ref ? ref : deadline };
}

export function computeDeadline(terms: ContractTerms, todayISO: ISODate): DeadlineInfo {
  const ref = parseISO(todayISO);
  const result = (kind: DeadlineKind, end: Date, deadline: Date, note: string): DeadlineInfo => ({
    kind,
    endDate: toISO(end),
    deadline: toISO(deadline),
    daysLeft: diffDays(ref, deadline),
    note,
  });

  if (terms.category === 'krankenkasse_grund') {
    // Art. 7 KVG: nach Mitteilung der neuen Prämie Kündigung auf Jahresende, Eingang bis 30. November.
    let year = ref.getUTCFullYear();
    if (toISO(ref) > `${year}-11-30`) year += 1;
    return result(
      'krankenkasse',
      parseISO(`${year}-12-31`),
      parseISO(`${year}-11-30`),
      'Grundversicherung: Kündigung muss bis 30. November beim Versicherer eintreffen. Die alte Kasse bleibt zuständig, bis die neue die Aufnahme bestätigt.',
    );
  }

  if (terms.minTermMonths > 0 && terms.startDate) {
    const start = parseISO(terms.startDate);
    const minEnd = addDays(addMonths(start, terms.minTermMonths), -1);
    if (latestReceipt(minEnd, terms.noticeMonths) >= ref) {
      return result('befristet', minEnd, latestReceipt(minEnd, terms.noticeMonths), 'Ende der Mindestlaufzeit.');
    }
    if (terms.renewalMonths > 0) {
      for (let k = 1; k < 200; k++) {
        const end = addDays(addMonths(start, terms.minTermMonths + k * terms.renewalMonths), -1);
        const deadline = latestReceipt(end, terms.noticeMonths);
        if (deadline >= ref) {
          return result('befristet', end, deadline, `Verlängert sich sonst automatisch um ${terms.renewalMonths} Monate.`);
        }
      }
    }
    const { end, deadline } = openEnded(terms, ref, addDays(minEnd, 1));
    return result('unbefristet', end, deadline, 'Mindestlaufzeit abgelaufen, jederzeit mit Frist kündbar.');
  }

  const { end, deadline } = openEnded(terms, ref, ref);
  const note =
    terms.minTermMonths > 0 && !terms.startDate
      ? 'Vertragsbeginn fehlt: Mindestlaufzeit kann nicht berechnet werden.'
      : 'Unbefristet, jederzeit mit Frist kündbar.';
  return result('unbefristet', end, deadline, note);
}

export function urgency(info: DeadlineInfo): Urgency {
  if (info.kind === 'unbefristet') return 'frei';
  if (info.daysLeft <= 7) return 'rot';
  if (info.daysLeft <= 30) return 'orange';
  if (info.daysLeft <= 60) return 'gelb';
  return 'gruen';
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  rot: 'Frist in ≤ 7 Tagen',
  orange: 'Frist in ≤ 30 Tagen',
  gelb: 'Frist in ≤ 60 Tagen',
  gruen: 'Frist später',
  frei: 'Jederzeit kündbar',
};
