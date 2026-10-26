import type { Offer } from './offer-types';

export const MOBILE_USAGE = {
  wenig: { label: 'Wenig', hint: 'Mails, WhatsApp, ab und zu surfen', minGb: 5 },
  normal: { label: 'Normal', hint: 'Social Media, Musik, Navigation', minGb: 20 },
  viel: { label: 'Viel', hint: 'Videos, Hotspot für den Laptop', minGb: null },
} as const;

export const ROAMING = {
  nie: { label: 'Selten oder nie', hint: 'Ferien ohne Handy-Daten sind ok' },
  europa: { label: 'In Europa', hint: 'Ferien oder Arbeit in der EU' },
  weltweit: { label: 'Auch ausserhalb Europas', hint: 'USA, Asien usw. – meist separat lösen' },
} as const;

export const INTERNET_NEED = {
  keins: { label: 'Kein Internet zu Hause', hint: '', minMbps: 0 },
  basis: { label: 'Basis', hint: 'Surfen, Mails, eine Person streamt', minMbps: 20 },
  schnell: { label: 'Schnell', hint: 'Mehrere streamen, Homeoffice, Videocalls', minMbps: 100 },
  sehr_schnell: { label: 'Sehr schnell', hint: 'Grosse Downloads, Gaming, viele Geräte', minMbps: 1000 },
} as const;

export type MobileUsage = keyof typeof MOBILE_USAGE;
export type Roaming = keyof typeof ROAMING;
export type InternetNeed = keyof typeof INTERNET_NEED;

export interface Profile {
  householdSize: number;
  plz: string;
  mobileLines: number;
  mobileUsage: MobileUsage;
  roaming: Roaming;
  internetNeed: InternetNeed;
  wantsTv: boolean;
}

export const DEFAULT_PROFILE: Profile = {
  householdSize: 1,
  plz: '',
  mobileLines: 1,
  mobileUsage: 'normal',
  roaming: 'europa',
  internetNeed: 'schnell',
  wantsTv: false,
};

export const isMobileUsage = (s: unknown): s is MobileUsage => typeof s === 'string' && s in MOBILE_USAGE;
export const isRoaming = (s: unknown): s is Roaming => typeof s === 'string' && s in ROAMING;
export const isInternetNeed = (s: unknown): s is InternetNeed => typeof s === 'string' && s in INTERNET_NEED;

/**
 * Passt ein Angebot zum Profil? Gibt die Gründe zurück, wenn nicht, damit die Kundin
 * sieht, warum ein günstiges Angebot weiter unten steht.
 */
export function profileGaps(offer: Offer, profile: Profile | null): string[] {
  if (!profile) return [];
  const gaps: string[] = [];
  if (offer.category === 'mobile') {
    const minGb = MOBILE_USAGE[profile.mobileUsage].minGb;
    if (minGb === null && offer.dataGb !== null) gaps.push(`nur ${offer.dataGb} GB, Sie brauchen unlimitiert`);
    else if (minGb !== null && offer.dataGb !== null && offer.dataGb < minGb) gaps.push(`nur ${offer.dataGb} GB, empfohlen ab ${minGb} GB`);
    if (profile.roaming !== 'nie' && !offer.roamingEu) gaps.push('kein EU-Roaming inklusive');
  }
  if (offer.category === 'internet') {
    const minMbps = INTERNET_NEED[profile.internetNeed].minMbps;
    if (offer.speedMbps !== null && offer.speedMbps < minMbps) gaps.push(`${offer.speedMbps} Mbit/s, empfohlen ab ${minMbps}`);
    if (profile.wantsTv && !offer.includesTv) gaps.push('ohne TV');
  }
  return gaps;
}
