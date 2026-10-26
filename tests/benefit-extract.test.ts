import { describe, expect, it } from 'vitest';
import { SAMPLE_OFFERS, offersFor, type Offer } from '@/data/offers';
import { bonusEligibility, formatChf, offerCost, rankOffers } from '@/lib/benefit';
import { extractContract } from '@/lib/extract';
import { buildCalendar } from '@/lib/ics';

const offer = (o: Partial<Offer>): Offer => ({ ...SAMPLE_OFFERS[0], ...o });

describe('benefit', () => {
  it('costs promo months at promo price', () => {
    expect(offerCost(offer({ monthlyPrice: 30, promoPrice: 15, promoMonths: 12 }))).toBe(540);
    expect(offerCost(offer({ monthlyPrice: 20, promoPrice: null, promoMonths: 6 }))).toBe(480);
  });

  it('ranks by net benefit, never by commission', () => {
    const cheapLowCommission = offer({ id: 'x', provider: 'X', monthlyPrice: 10, promoPrice: null, bonusChf: 0, oneTimeFeeChf: 0, commissionChf: 1 });
    const dearHighCommission = offer({ id: 'y', provider: 'Y', monthlyPrice: 30, promoPrice: null, bonusChf: 0, oneTimeFeeChf: 0, commissionChf: 500 });
    const ranked = rankOffers(40, [dearHighCommission, cheapLowCommission], [], '2026-10-26');
    expect(ranked.map((r) => r.offer.id)).toEqual(['x', 'y']);
    expect(ranked[0].netBenefit).toBe(720);
  });

  it('drops the bonus inside the new-customer lock period', () => {
    const o = offer({ provider: 'Beispiel Mobil A', newCustomerLockMonths: 12, bonusChf: 50 });
    expect(bonusEligibility(o, [{ provider: 'beispiel mobil a', endedOn: '2026-03-01' }], '2026-10-26')).toMatch(/Sperrfrist/);
    expect(bonusEligibility(o, [{ provider: 'Beispiel Mobil A', endedOn: '2025-03-01' }], '2026-10-26')).toBeNull();
    expect(bonusEligibility(o, [{ provider: 'Beispiel Mobil A', endedOn: null }], '2026-10-26')).toMatch(/bereits/);
    const [r] = rankOffers(40, [o], [{ provider: 'Beispiel Mobil A', endedOn: '2026-03-01' }], '2026-10-26');
    expect(r.bonus).toBe(0);
  });

  it('only offers stage-1 categories', () => {
    expect(offersFor('krankenkasse_grund')).toEqual([]);
    expect(offersFor('mobile').length).toBeGreaterThan(0);
  });

  it('formats Swiss francs', () => {
    expect(formatChf(1234.5)).toBe("CHF 1'234.50");
    expect(formatChf(-12)).toBe('−CHF 12.00');
  });
});

describe('extractContract', () => {
  it('reads a telecom invoice', () => {
    const r = extractContract(`Swisscom (Schweiz) AG\nRechnung Oktober 2026\nKundennummer: 1-ABC1234\nblue Mobile S\nTotal CHF 49.90\nVertragsbeginn: 15.03.2025`);
    expect(r).toMatchObject({ provider: 'Swisscom', category: 'mobile', monthlyPrice: 49.9, customerNumber: '1-ABC1234', startDate: '2025-03-15' });
  });

  it('detects internet and converts yearly premiums', () => {
    expect(extractContract('Sunrise Internet Glasfaser Router\nBetrag: 65.00 CHF').category).toBe('internet');
    const r = extractContract("Helsana Versicherungen AG\nGrundversicherung KVG\nJahresprämie CHF 4'944.00");
    expect(r.category).toBe('krankenkasse_grund');
    expect(r.monthlyPrice).toBe(412);
  });

  it('returns nulls for unknown text', () => {
    const r = extractContract('Hallo Welt');
    expect(r.provider).toBeNull();
    expect(r.monthlyPrice).toBeNull();
  });
});

describe('ics', () => {
  it('builds a valid calendar with alarms', () => {
    const ics = buildCalendar([{ uid: 'u1', date: '2026-11-30', summary: 'Frist, Test', description: 'x', alarmsDaysBefore: [7] }], new Date('2026-10-26T10:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261130');
    expect(ics).toContain('SUMMARY:Frist\\, Test');
    expect(ics).toContain('TRIGGER:-P7D');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
