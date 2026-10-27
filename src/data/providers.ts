import type { Category } from '@/lib/categories';

/** Vorschläge für die Schnellerfassung (nur Namen, keine Aussage über Tarife). */
export const PROVIDER_SUGGESTIONS: Record<Category, string[]> = {
  mobile: ['Swisscom', 'Sunrise', 'Salt', 'Wingo', 'Yallo', 'M-Budget Mobile', 'Lycamobile', 'ALDI mobile', 'Lidl Connect', 'TalkTalk', 'Coop Mobile', 'Galaxus Mobile'],
  internet: ['Swisscom', 'Sunrise', 'Salt', 'Init7', 'iWay', 'Quickline', 'Wingo', 'Yallo', 'Green'],
  streaming: ['Netflix', 'Spotify', 'Disney+', 'Apple TV+', 'YouTube Premium', 'Amazon Prime', 'blue TV', 'Microsoft 365'],
  bank: ['PostFinance', 'UBS', 'Raiffeisen', 'Zürcher Kantonalbank', 'neon', 'Yuh', 'Revolut', 'Migros Bank'],
  krankenkasse_grund: ['CSS', 'Helsana', 'SWICA', 'Sanitas', 'Concordia', 'Visana', 'Groupe Mutuel', 'Assura', 'KPT', 'Atupri', 'ÖKK', 'Sympany', 'EGK'],
  versicherung_zusatz: ['CSS', 'Helsana', 'SWICA', 'Sanitas', 'Concordia', 'Visana', 'Groupe Mutuel'],
  versicherung_sach: ['Die Mobiliar', 'AXA', 'Zurich', 'Allianz', 'Generali', 'Helvetia', 'Baloise', 'Smile'],
  andere: [],
};
