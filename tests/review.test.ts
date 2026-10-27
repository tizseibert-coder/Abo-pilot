import { describe, expect, it } from 'vitest';
import { rankOffers, savingsWindow } from '@/lib/benefit';
import type { DeadlineInfo } from '@/lib/deadlines';
import type { Offer } from '@/lib/offer-types';
import { reviewDue, suggestReview } from '@/lib/review';

const info = (o: Partial<DeadlineInfo>): DeadlineInfo => ({ kind: 'befristet', endDate: '2027-03-31', deadline: '2027-01-31', daysLeft: 96, note: '', ...o });

describe('Überprüfung', () => {
  it('schlägt 60 Tage vor der Frist vor, nie in der Vergangenheit', () => {
    expect(suggestReview(info({}), '2026-10-27')).toBe('2026-12-02');
    expect(suggestReview(info({ deadline: '2026-11-15' }), '2026-10-27')).toBe('2026-10-28');
  });
  it('Krankenkasse: 1. Oktober, im Herbst eine Woche später, höchstens bis zur Frist', () => {
    expect(suggestReview(info({ kind: 'krankenkasse', deadline: '2027-11-30' }), '2026-12-05')).toBe('2027-10-01');
    expect(suggestReview(info({ kind: 'krankenkasse', deadline: '2026-11-30' }), '2026-10-27')).toBe('2026-11-03');
    expect(suggestReview(info({ kind: 'krankenkasse', deadline: '2026-11-30' }), '2026-11-28')).toBe('2026-11-30');
  });
  it('unbefristet: in 6 Monaten', () => {
    expect(suggestReview(info({ kind: 'unbefristet' }), '2026-10-27')).toBe('2027-04-27');
  });
  it('fällig ab dem Datum', () => {
    expect(reviewDue('2026-10-27', '2026-10-27')).toBe(true);
    expect(reviewDue('2026-10-28', '2026-10-27')).toBe(false);
    expect(reviewDue(null, '2026-10-27')).toBe(false);
  });
});

describe('Sparpotenzial im Zeitraum', () => {
  it('rechnet Monat, erstes Jahr und 24 Monate mit Aktion, Prämie und Gebühr', () => {
    const offer: Offer = {
      id: 'x', category: 'mobile', provider: 'X', name: 'Y', monthlyPrice: 30, promoPrice: 15, promoMonths: 12, bonusChf: 50,
      oneTimeFeeChf: 20, newCustomerLockMonths: 0, commissionChf: 0, dataGb: null, roamingEu: true, speedMbps: null, includesTv: false,
      minTermMonths: 0, validUntil: null, sourceUrl: 'https://x.ch', checkedAt: '2026-10-20', status: 'geprüft', notes: '',
    };
    const [r] = rankOffers(50, [offer], [], '2026-10-27');
    // 24 Mt.: 1200 − (12×15 + 12×30) + 50 − 20 = 690; erstes Jahr: 600 − 180 + 50 − 20 = 450
    expect(savingsWindow(50, r, '2026-12-01')).toEqual({ from: '2026-12-01', perMonth: 28.75, firstYear: 450, horizon: 690 });
  });
});
