import { describe, expect, it } from 'vitest';
import { bonusEligibility, formatChf, offerCost, rankOffers } from '@/lib/benefit';
import { offerVisibility, type Offer } from '@/lib/offer-types';
import { parseCsv, parseOffer } from '@/lib/offers';
import { DEFAULT_PROFILE, profileGaps } from '@/lib/profile';
import { extractContract } from '@/lib/extract';
import { buildCalendar } from '@/lib/ics';

const BASE: Offer = {
  id: 'test-mobile', category: 'mobile', provider: 'Test Mobil', name: 'Unlimitiert', monthlyPrice: 29.9, promoPrice: null,
  promoMonths: 0, bonusChf: 0, oneTimeFeeChf: 0, newCustomerLockMonths: 0, commissionChf: 0, dataGb: null, roamingEu: true,
  speedMbps: null, includesTv: false, minTermMonths: 0, validUntil: null, sourceUrl: 'https://example.ch/tarif',
  checkedAt: '2026-10-20', status: 'geprüft', notes: '',
};
const offer = (o: Partial<Offer>): Offer => ({ ...BASE, ...o });

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

  it('puts offers that fit the profile first', () => {
    const small = offer({ id: 'small', monthlyPrice: 5, dataGb: 2, roamingEu: false });
    const fits = offer({ id: 'fits', monthlyPrice: 20 });
    const ranked = rankOffers(40, [small, fits], [], '2026-10-26', { ...DEFAULT_PROFILE, mobileUsage: 'normal' });
    expect(ranked.map((r) => r.offer.id)).toEqual(['fits', 'small']);
    expect(ranked[1].gaps).toEqual(['nur 2 GB, empfohlen ab 20 GB', 'kein EU-Roaming inklusive']);
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

describe('profileGaps', () => {
  it('checks internet speed and TV', () => {
    const net = offer({ category: 'internet', speedMbps: 100, includesTv: false });
    expect(profileGaps(net, { ...DEFAULT_PROFILE, internetNeed: 'sehr_schnell', wantsTv: true })).toEqual(['100 Mbit/s, empfohlen ab 1000', 'ohne TV']);
    expect(profileGaps(net, { ...DEFAULT_PROFILE, internetNeed: 'schnell' })).toEqual([]);
    expect(profileGaps(net, null)).toEqual([]);
  });
  it('heavy users need unlimited data', () => {
    expect(profileGaps(offer({ dataGb: 50 }), { ...DEFAULT_PROFILE, mobileUsage: 'viel' })).toEqual(['nur 50 GB, Sie brauchen unlimitiert']);
  });
});

describe('offer visibility', () => {
  it('shows only checked, current, fresh offers', () => {
    expect(offerVisibility(BASE, '2026-10-26')).toBe('sichtbar');
    expect(offerVisibility(offer({ status: 'entwurf', checkedAt: null }), '2026-10-26')).toBe('entwurf');
    expect(offerVisibility(offer({ checkedAt: '2026-09-01' }), '2026-10-26')).toBe('veraltet');
    expect(offerVisibility(offer({ validUntil: '2026-10-25' }), '2026-10-26')).toBe('abgelaufen');
    expect(offerVisibility(offer({ status: 'archiviert' }), '2026-10-26')).toBe('archiviert');
  });
});

describe('offer import', () => {
  it('parses CSV with semicolons and quotes into drafts', () => {
    const rows = parseCsv('id;category;provider;name;monthly_price;promo_price;promo_months;source_url;roaming_eu;notes\nabc-1;mobile;Anbieter;Tarif;29,90;14.90;12;https://a.ch/x;ja;"mit ; Semikolon"');
    const { offer: o, error } = parseOffer(rows[0]);
    expect(error).toBeUndefined();
    expect(o).toMatchObject({ id: 'abc-1', monthlyPrice: 29.9, promoPrice: 14.9, promoMonths: 12, roamingEu: true, status: 'entwurf', checkedAt: null, notes: 'mit ; Semikolon' });
  });
  it('rejects missing source and bad category', () => {
    expect(parseOffer({ id: 'abc-2', category: 'mobile', provider: 'A', name: 'B', monthly_price: '10' }).error).toMatch(/Quelle/);
    expect(parseOffer({ id: 'abc-3', category: 'auto', provider: 'A', name: 'B', monthly_price: '10', source_url: 'https://a.ch' }).error).toMatch(/Kategorie/);
  });
});
