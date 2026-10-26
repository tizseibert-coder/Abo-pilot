import { describe, expect, it } from 'vitest';
import { addMonths, parseISO, parseCH, toISO } from '@/lib/dates';
import { computeDeadline, latestReceipt, urgency, type ContractTerms } from '@/lib/deadlines';

const terms = (t: Partial<ContractTerms>): ContractTerms => ({
  category: 'internet',
  startDate: null,
  minTermMonths: 0,
  renewalMonths: 0,
  noticeMonths: 1,
  toMonthEnd: true,
  ...t,
});

describe('dates', () => {
  it('keeps month ends when adding months', () => {
    expect(toISO(addMonths(parseISO('2027-03-31'), -1))).toBe('2027-02-28');
    expect(toISO(addMonths(parseISO('2028-02-29'), 12))).toBe('2029-02-28');
    expect(toISO(addMonths(parseISO('2026-01-15'), 1))).toBe('2026-02-15');
  });
  it('parses Swiss dates', () => {
    expect(parseCH('1.3.2026')).toBe('2026-03-01');
    expect(parseCH('31.02.2026')).toBeNull();
  });
});

describe('latestReceipt', () => {
  it('3 months notice to 31.12. means received by 30.09.', () => {
    expect(toISO(latestReceipt(parseISO('2026-12-31'), 3))).toBe('2026-09-30');
  });
  it('2 months notice to 14.03. means received by 14.01.', () => {
    expect(toISO(latestReceipt(parseISO('2027-03-14'), 2))).toBe('2027-01-14');
  });
});

describe('computeDeadline', () => {
  it('health insurance: 30.11. of this year, next year after the deadline', () => {
    const a = computeDeadline(terms({ category: 'krankenkasse_grund' }), '2026-10-26');
    expect(a).toMatchObject({ kind: 'krankenkasse', deadline: '2026-11-30', endDate: '2026-12-31', daysLeft: 35 });
    const b = computeDeadline(terms({ category: 'krankenkasse_grund' }), '2026-12-01');
    expect(b.deadline).toBe('2027-11-30');
  });

  it('fixed term: end of minimum term when still reachable', () => {
    const d = computeDeadline(terms({ startDate: '2025-03-15', minTermMonths: 24, noticeMonths: 2 }), '2026-10-26');
    expect(d).toMatchObject({ kind: 'befristet', endDate: '2027-03-14', deadline: '2027-01-14' });
  });

  it('automatic renewal: jumps to the next term when the first deadline passed', () => {
    const d = computeDeadline(terms({ startDate: '2024-01-01', minTermMonths: 36, renewalMonths: 12, noticeMonths: 3 }), '2026-10-26');
    expect(d).toMatchObject({ kind: 'befristet', endDate: '2027-12-31', deadline: '2027-09-30' });
  });

  it('open-ended to month end: earliest month end that the notice still reaches', () => {
    const d = computeDeadline(terms({ noticeMonths: 1 }), '2026-10-26');
    expect(d).toMatchObject({ kind: 'unbefristet', endDate: '2026-11-30', deadline: '2026-10-31' });
    expect(urgency(d)).toBe('frei');
  });

  it('after minimum term without renewal: becomes open-ended', () => {
    const d = computeDeadline(terms({ startDate: '2024-01-01', minTermMonths: 12, noticeMonths: 2 }), '2026-10-26');
    expect(d).toMatchObject({ kind: 'unbefristet', endDate: '2026-12-31', deadline: '2026-10-31' });
  });

  it('flags missing start date', () => {
    const d = computeDeadline(terms({ minTermMonths: 24 }), '2026-10-26');
    expect(d.note).toMatch(/Vertragsbeginn fehlt/);
  });

  it('urgency bands', () => {
    const d = computeDeadline(terms({ category: 'krankenkasse_grund' }), '2026-11-25');
    expect(urgency(d)).toBe('rot');
    expect(urgency(computeDeadline(terms({ category: 'krankenkasse_grund' }), '2026-11-01'))).toBe('orange');
    expect(urgency(computeDeadline(terms({ category: 'krankenkasse_grund' }), '2026-10-01'))).toBe('gelb');
  });
});
