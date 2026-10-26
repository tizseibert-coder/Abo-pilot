/**
 * Start-Liste offizieller Tarifseiten. Nur Seiten der Anbieter selbst, keine Vergleichsportale
 * (deren Datenbanken sind als Arbeitsergebnis geschützt, UWG Art. 5 lit. c).
 * Die URLs stammen aus einer Websuche und sind beim Anlegen INAKTIV: im Team prüfen,
 * Nutzungsbedingungen der Seite lesen, dann aktivieren.
 */
export const SEED_SOURCES: { category: 'mobile' | 'internet'; provider: string; url: string; method: 'auto' | 'jsonld' | 'ki' }[] = [
  { category: 'mobile', provider: 'Swisscom', url: 'https://www.swisscom.ch/en/residential/mobile-subscription.html', method: 'auto' },
  { category: 'mobile', provider: 'TalkTalk', url: 'https://www.talktalk.ch/de/mobile/handy-abos.html', method: 'auto' },
  { category: 'internet', provider: 'iWay', url: 'https://www.iway.ch/internet/glasfaser/', method: 'auto' },
  { category: 'internet', provider: 'Wingo', url: 'https://www.wingo.ch/de/internet', method: 'auto' },
];
