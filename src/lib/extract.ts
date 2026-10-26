import type { Category } from './categories';
import { parseCH, type ISODate } from './dates';

export interface ExtractedContract {
  provider: string | null;
  category: Category | null;
  monthlyPrice: number | null;
  customerNumber: string | null;
  startDate: ISODate | null;
  /** welche Felder sicher erkannt wurden – der Nutzer muss den Rest prüfen */
  hints: string[];
}

// Nur zur Erkennung in Rechnungstexten; keine Aussage über Angebote dieser Firmen.
const PROVIDERS: { name: string; pattern: RegExp; category: Category }[] = [
  { name: 'Swisscom', pattern: /\bswisscom\b/i, category: 'mobile' },
  { name: 'Sunrise', pattern: /\bsunrise\b/i, category: 'mobile' },
  { name: 'Salt', pattern: /\bsalt\b(?!\s*(?:and|&))/i, category: 'mobile' },
  { name: 'Yallo', pattern: /\byallo\b/i, category: 'mobile' },
  { name: 'Wingo', pattern: /\bwingo\b/i, category: 'mobile' },
  { name: 'M-Budget Mobile', pattern: /\bm-budget\b/i, category: 'mobile' },
  { name: 'Quickline', pattern: /\bquickline\b/i, category: 'internet' },
  { name: 'Init7', pattern: /\binit7\b/i, category: 'internet' },
  { name: 'iWay', pattern: /\biway\b/i, category: 'internet' },
  { name: 'Netflix', pattern: /\bnetflix\b/i, category: 'streaming' },
  { name: 'Spotify', pattern: /\bspotify\b/i, category: 'streaming' },
  { name: 'Disney+', pattern: /\bdisney\s*\+|\bdisney plus\b/i, category: 'streaming' },
  { name: 'Microsoft 365', pattern: /\bmicrosoft 365\b/i, category: 'streaming' },
  { name: 'CSS', pattern: /\bcss\b.*versicherung|\bcss kranken/i, category: 'krankenkasse_grund' },
  { name: 'Helsana', pattern: /\bhelsana\b/i, category: 'krankenkasse_grund' },
  { name: 'SWICA', pattern: /\bswica\b/i, category: 'krankenkasse_grund' },
  { name: 'Sanitas', pattern: /\bsanitas\b/i, category: 'krankenkasse_grund' },
  { name: 'Concordia', pattern: /\bconcordia\b/i, category: 'krankenkasse_grund' },
  { name: 'Visana', pattern: /\bvisana\b/i, category: 'krankenkasse_grund' },
  { name: 'Groupe Mutuel', pattern: /\bgroupe mutuel\b/i, category: 'krankenkasse_grund' },
  { name: 'Assura', pattern: /\bassura\b/i, category: 'krankenkasse_grund' },
  { name: 'KPT', pattern: /\bkpt\b/i, category: 'krankenkasse_grund' },
  { name: 'Atupri', pattern: /\batupri\b/i, category: 'krankenkasse_grund' },
  { name: 'ÖKK', pattern: /\bökk\b/i, category: 'krankenkasse_grund' },
  { name: 'Die Mobiliar', pattern: /\bmobiliar\b/i, category: 'versicherung_sach' },
  { name: 'AXA', pattern: /\baxa\b/i, category: 'versicherung_sach' },
  { name: 'Zurich', pattern: /\bzurich versicherung|\bzurich insurance/i, category: 'versicherung_sach' },
  { name: 'Allianz', pattern: /\ballianz\b/i, category: 'versicherung_sach' },
  { name: 'Generali', pattern: /\bgenerali\b/i, category: 'versicherung_sach' },
  { name: 'Helvetia', pattern: /\bhelvetia\b/i, category: 'versicherung_sach' },
  { name: 'Baloise', pattern: /\bbaloise\b|\bbâloise\b/i, category: 'versicherung_sach' },
  { name: 'Smile', pattern: /\bsmile\.direct\b/i, category: 'versicherung_sach' },
  { name: 'PostFinance', pattern: /\bpostfinance\b/i, category: 'bank' },
  { name: 'UBS', pattern: /\bubs\b/i, category: 'bank' },
  { name: 'Raiffeisen', pattern: /\braiffeisen\b/i, category: 'bank' },
  { name: 'Zürcher Kantonalbank', pattern: /\bzürcher kantonalbank\b|\bzkb\b/i, category: 'bank' },
  { name: 'neon', pattern: /\bneon\b.*(?:konto|bank|karte)/i, category: 'bank' },
  { name: 'Yuh', pattern: /\byuh\b/i, category: 'bank' },
];

const AMOUNT = String.raw`(\d{1,3}(?:['’ ]\d{3})*|\d+)(?:[.,](\d{2}|–|-))?`;
const AMOUNT_RE = new RegExp(String.raw`(?:CHF|SFr\.?|Fr\.)\s*${AMOUNT}|${AMOUNT}\s*(?:CHF|Fr\.)`, 'gi');

function toNumber(intPart: string, decPart: string | undefined): number {
  const int = Number(intPart.replace(/['’ ]/g, ''));
  const dec = decPart && /^\d{2}$/.test(decPart) ? Number(decPart) / 100 : 0;
  return int + dec;
}

function amountsIn(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(AMOUNT_RE)) {
    const n = m[1] !== undefined ? toNumber(m[1], m[2]) : toNumber(m[3], m[4]);
    if (Number.isFinite(n) && n > 0 && n < 100_000) out.push(n);
  }
  return out;
}

const TOTAL_LINE = /total|gesamt|rechnungsbetrag|zu bezahlen|zahlbar|betrag|monatsprämie|prämie|grundgebühr|abo-?preis|monatlich/i;
const YEARLY = /pro jahr|jährlich|jahresprämie|jahresgebühr|p\.\s?a\./i;
const QUARTERLY = /pro quartal|quartalsprämie|vierteljährlich/i;

export function extractContract(raw: string): ExtractedContract {
  const text = raw.replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const hints: string[] = [];

  const provider = PROVIDERS.find((p) => p.pattern.test(text)) ?? null;
  let category: Category | null = provider?.category ?? null;
  if (provider && (category === 'mobile') && /internet|glasfaser|router|\btv\b|festnetz/i.test(text) && !/mobile|handy|natel|sim/i.test(text)) {
    category = 'internet';
  }
  if (category === 'krankenkasse_grund' && /zusatzversicherung|\bvvg\b|spital halbprivat|spital privat/i.test(text) && !/\bkvg\b|grundversicherung/i.test(text)) {
    category = 'versicherung_zusatz';
  }
  if (provider) hints.push(`Anbieter erkannt: ${provider.name}`);

  let monthlyPrice: number | null = null;
  const priorityLine = lines.find((l) => TOTAL_LINE.test(l) && amountsIn(l).length > 0);
  const anyLine = lines.find((l) => amountsIn(l).length > 0);
  const chosen = priorityLine ?? anyLine;
  if (chosen) {
    let amount = Math.max(...amountsIn(chosen));
    if (YEARLY.test(chosen) || (!priorityLine && YEARLY.test(text))) {
      amount = amount / 12;
      hints.push('Jahresbetrag erkannt und auf Monat umgerechnet');
    } else if (QUARTERLY.test(chosen)) {
      amount = amount / 3;
      hints.push('Quartalsbetrag erkannt und auf Monat umgerechnet');
    }
    monthlyPrice = Math.round(amount * 100) / 100;
    hints.push(`Betrag aus Zeile: «${chosen.slice(0, 80)}»`);
  }

  const cust = text.match(/(?:kunden(?:nummer|-?nr\.?)|vertrags(?:nummer|-?nr\.?)|polic[ey]n?-?(?:nummer|nr\.?)|versicherten(?:nummer|-?nr\.?))\s*:?\s*([A-Z0-9][A-Z0-9.\-/]{3,24})/i);
  const customerNumber = cust ? cust[1].replace(/[.\-/]+$/, '') : null;
  if (customerNumber) hints.push('Kunden- oder Vertragsnummer erkannt');

  let startDate: ISODate | null = null;
  const start = text.match(/(?:vertragsbeginn|beginn|gültig ab|vertragsstart|seit|aktiviert am)\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/i);
  if (start) {
    startDate = parseCH(start[1]);
    if (startDate) hints.push('Vertragsbeginn erkannt');
  }

  return { provider: provider?.name ?? null, category, monthlyPrice, customerNumber, startDate, hints };
}
