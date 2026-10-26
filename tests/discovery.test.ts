import { beforeEach, describe, expect, it } from 'vitest';
import { applyCandidates, differences, offerIdFor } from '@/lib/crawler/run';
import { extractJsonLd, type Candidate } from '@/lib/crawler/extract';
import { htmlToText, robotsAllows } from '@/lib/crawler/page';
import { getDb } from '@/lib/db';
import { ageClass, normalizeFranchise, parseBagPremiums, parseRegions, quoteHousehold } from '@/lib/kk/premiums';
import { getOffer, setOfferStatus } from '@/lib/offers';

// Annahme über das BAG-Format (Spaltennamen wie in der deutschsprachigen Prämientabelle).
const BAG_CSV = [
  'Versicherer;Versicherername;Kanton;Region;Altersklasse;Altersuntergruppe;Unfalleinschluss;Tarifjahr;Franchisestufe;Franchise;Prämie;Tariftyp;Tarifbezeichnung',
  '0008;Kasse A;ZH;PR-REG CH1;AKL-ERW;;OHNE-UNF;2027;FRAST6;FRA-2500;310,50;TAR-BASE;Standard',
  '0008;Kasse A;ZH;PR-REG CH1;AKL-ERW;;OHNE-UNF;2027;FRAST6;FRA-2500;270,00;TAR-HAM;Hausarzt Plus',
  '0008;Kasse A;ZH;PR-REG CH1;AKL-KIN;K1;MIT-UNF;2027;FRAST1;FRA-0;120,00;TAR-BASE;Standard',
  '0008;Kasse A;ZH;PR-REG CH1;AKL-KIN;K2;MIT-UNF;2027;FRAST1;FRA-0;90,00;TAR-BASE;Standard',
  '0032;Kasse B;ZH;PR-REG CH1;AKL-ERW;;OHNE-UNF;2027;FRAST6;FRA-2500;290,00;TAR-BASE;Basis',
  '0032;Kasse B;ZH;PR-REG CH1;AKL-KIN;K1;MIT-UNF;2027;FRAST1;FRA-0;130,00;TAR-BASE;Basis',
  '0057;Kasse C;ZH;PR-REG CH1;AKL-ERW;;OHNE-UNF;2027;FRAST6;FRA-2500;250,00;TAR-HMO;HMO',
].join('\n');

describe('BAG-Prämien', () => {
  const { rows, errors } = parseBagPremiums(BAG_CSV);

  it('liest die Tabelle und lässt weitere Kinder weg', () => {
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ insurerId: '0008', canton: 'ZH', region: 1, ageClass: 'ERW', accident: false, franchise: 2500, model: 'BASE', premium: 310.5, year: 2027 });
    expect(rows[2]).toMatchObject({ ageClass: 'KIN', accident: true, franchise: 0 });
  });

  it('rechnet den Haushalt pro Kasse und sortiert nach Preis', () => {
    const persons = [
      { birthYear: 1980, franchise: 2500, accident: false },
      { birthYear: 2018, franchise: 0, accident: true },
    ];
    const all = quoteHousehold(rows, persons, 2027, ['BASE', 'HAM', 'HMO', 'DIV']);
    // Kasse C hat kein Kinderangebot → fällt weg; Kasse A mit Hausarzt 270 + 120 = 390; B: 290 + 130 = 420
    expect(all.map((q) => [q.insurerName, q.monthlyTotal])).toEqual([['Kasse A', 390], ['Kasse B', 420]]);
    const standardOnly = quoteHousehold(rows, persons, 2027, ['BASE']);
    expect(standardOnly.map((q) => q.monthlyTotal)).toEqual([420, 430.5]);
  });

  it('meldet fehlende Spalten', () => {
    expect(parseBagPremiums('a;b;c\n1;2;3').errors[0]).toMatch(/Spalten nicht gefunden/);
  });

  it('Altersklassen und Franchisen', () => {
    expect(ageClass(2009, 2027)).toBe('KIN');
    expect(ageClass(2008, 2027)).toBe('JUG');
    expect(ageClass(2001, 2027)).toBe('ERW');
    expect(normalizeFranchise('ERW', 0)).toBe(300);
    expect(normalizeFranchise('KIN', 2500)).toBe(600);
  });

  it('liest Prämienregionen', () => {
    const r = parseRegions('PLZ;Ort;Kanton;Region\n8004;Zürich;ZH;PR-REG CH1\n8400;Winterthur;ZH;2');
    expect(r.rows).toEqual([
      { plz: '8004', canton: 'ZH', region: 1, place: 'Zürich' },
      { plz: '8400', canton: 'ZH', region: 2, place: 'Winterthur' },
    ]);
  });
});

describe('robots.txt', () => {
  const robots = 'User-agent: *\nDisallow: /privat/\nAllow: /privat/tarife\n\nUser-agent: AboPilotBot\nDisallow: /intern';
  it('nimmt die eigene Gruppe vor *', () => {
    expect(robotsAllows(robots, '/intern/x')).toBe(false);
    expect(robotsAllows(robots, '/privat/x')).toBe(true);
  });
  it('längste Regel gewinnt', () => {
    const r = 'User-agent: *\nDisallow: /privat/\nAllow: /privat/tarife';
    expect(robotsAllows(r, '/privat/tarife/mobile')).toBe(true);
    expect(robotsAllows(r, '/privat/konto')).toBe(false);
    expect(robotsAllows('', '/x')).toBe(true);
  });
});

describe('Seiten lesen', () => {
  it('extrahiert Monatspreise aus JSON-LD und ignoriert Gerätepreise', () => {
    const html = `<script type="application/ld+json">${JSON.stringify([
      { '@type': 'Product', name: 'Swiss Unlimited', offers: { '@type': 'Offer', price: '39.90', priceCurrency: 'CHF', priceSpecification: { unitCode: 'MON' } } },
      { '@type': 'Product', name: 'Smartphone X', offers: { '@type': 'Offer', price: '899', priceCurrency: 'CHF' } },
    ])}</script>`;
    const c = extractJsonLd(html);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ name: 'Swiss Unlimited', monthlyPrice: 39.9 });
  });
  it('macht aus HTML lesbaren Text', () => {
    expect(htmlToText('<style>x{}</style><h2>Abo&nbsp;M</h2><p>CHF 29.&ndash; /Mt.</p><script>evil()</script>')).toBe('Abo M\nCHF 29.– /Mt.');
  });
});

describe('Abgleich mit dem Bestand', () => {
  const source = { category: 'mobile', provider: 'Test Telco', url: 'https://telco.example/tarife' };
  const cand = (o: Partial<Candidate> = {}): Candidate => ({
    name: 'Swiss M', monthlyPrice: 29.9, promoPrice: null, promoMonths: 0, oneTimeFeeChf: 0, dataGb: null, roamingEu: true,
    speedMbps: null, includesTv: false, minTermMonths: 0, validUntil: null, evidence: 'Swiss M CHF 29.90', ...o,
  });
  beforeEach(() => getDb().exec('DELETE FROM offers'));

  it('neu → Entwurf, unverändert+geprüft → bestätigt, geändert → zurück auf Entwurf', () => {
    expect(applyCandidates(source, [cand()], 'test', '2026-10-26')).toMatchObject({ created: 1 });
    const id = offerIdFor('Test Telco', 'Swiss M');
    expect(getOffer(id)).toMatchObject({ status: 'entwurf', sourceUrl: source.url });

    setOfferStatus(id, 'geprüft', '2026-10-01');
    expect(applyCandidates(source, [cand()], 'test', '2026-10-26')).toMatchObject({ confirmed: 1 });
    expect(getOffer(id)?.checkedAt).toBe('2026-10-26');

    expect(applyCandidates(source, [cand({ monthlyPrice: 24.9 })], 'test', '2026-10-27')).toMatchObject({ changed: 1 });
    const changed = getOffer(id);
    expect(changed).toMatchObject({ status: 'entwurf', monthlyPrice: 24.9, checkedAt: null });
    expect(changed?.notes).toMatch(/Preis: 29.9 → 24.9/);
  });

  it('beschreibt Unterschiede', () => {
    applyCandidates(source, [cand()], 'test', '2026-10-26');
    const o = getOffer(offerIdFor('Test Telco', 'Swiss M'))!;
    expect(differences(o, cand({ dataGb: 20, roamingEu: false }))).toEqual(['Daten: – → 20', 'EU-Roaming: true → false']);
  });
});
