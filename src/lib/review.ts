import { addDays, addMonths, parseISO, toISO, type ISODate } from './dates';
import type { DeadlineInfo } from './deadlines';

/**
 * Vorschlag für die nächste Überprüfung eines laufenden Vertrags:
 * - Krankenkasse: 1. Oktober (neue Prämien sind Ende September publiziert)
 * - befristet: 60 Tage vor der Kündigungsfrist
 * - unbefristet: in 6 Monaten
 * Nie in der Vergangenheit; frühestens morgen.
 */
export function suggestReview(info: DeadlineInfo, todayISO: ISODate): ISODate {
  const tomorrow = toISO(addDays(parseISO(todayISO), 1));
  let target: ISODate;
  if (info.kind === 'krankenkasse') {
    const year = info.deadline.slice(0, 4);
    target = `${year}-10-01`;
    if (target < tomorrow) target = toISO(addDays(parseISO(todayISO), 7));
    if (target > info.deadline) target = info.deadline;
  } else if (info.kind === 'befristet') {
    target = toISO(addDays(parseISO(info.deadline), -60));
  } else {
    target = toISO(addMonths(parseISO(todayISO), 6));
  }
  return target < tomorrow ? tomorrow : target;
}

export function reviewDue(reviewOn: ISODate | null, todayISO: ISODate): boolean {
  return reviewOn !== null && reviewOn <= todayISO;
}
