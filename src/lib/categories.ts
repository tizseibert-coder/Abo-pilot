export const CATEGORIES = {
  mobile: { label: 'Handy-Abo', stage: 1 },
  internet: { label: 'Internet / TV', stage: 1 },
  streaming: { label: 'Streaming / Software', stage: 1 },
  bank: { label: 'Bankkonto / Karte', stage: 1 },
  krankenkasse_grund: { label: 'Krankenkasse Grundversicherung', stage: 0 },
  versicherung_zusatz: { label: 'Zusatzversicherung', stage: 2 },
  versicherung_sach: { label: 'Auto, Hausrat, Haftpflicht', stage: 2 },
  andere: { label: 'Andere', stage: 0 },
} as const;

export type Category = keyof typeof CATEGORIES;

export function isCategory(s: unknown): s is Category {
  return typeof s === 'string' && s in CATEGORIES;
}

export function categoryLabel(c: string): string {
  return isCategory(c) ? CATEGORIES[c].label : c;
}

/**
 * Vorschlagswerte für neue Verträge. Das sind Annahmen, keine AGB-Werte;
 * die Nutzerin oder der Nutzer muss sie mit dem eigenen Vertrag abgleichen.
 */
export const DEFAULT_TERMS: Record<Category, { minTermMonths: number; renewalMonths: number; noticeMonths: number; toMonthEnd: boolean }> = {
  mobile: { minTermMonths: 0, renewalMonths: 0, noticeMonths: 1, toMonthEnd: true },
  internet: { minTermMonths: 12, renewalMonths: 0, noticeMonths: 2, toMonthEnd: true },
  streaming: { minTermMonths: 0, renewalMonths: 0, noticeMonths: 0, toMonthEnd: true },
  bank: { minTermMonths: 0, renewalMonths: 0, noticeMonths: 0, toMonthEnd: false },
  krankenkasse_grund: { minTermMonths: 0, renewalMonths: 0, noticeMonths: 1, toMonthEnd: true },
  versicherung_zusatz: { minTermMonths: 36, renewalMonths: 12, noticeMonths: 3, toMonthEnd: true },
  versicherung_sach: { minTermMonths: 36, renewalMonths: 12, noticeMonths: 3, toMonthEnd: true },
  andere: { minTermMonths: 12, renewalMonths: 12, noticeMonths: 3, toMonthEnd: true },
};
