import type { DeadlineInfo } from './deadlines';
import { formatCH, type ISODate } from './dates';
import type { Contract, User } from './repo';

export interface Letter {
  sender: string[];
  recipient: string[];
  place: string;
  subject: string;
  paragraphs: string[];
  signatureName: string;
}

/**
 * Kündigungsschreiben als Vorlage. Abo-Pilot handelt als Botin, nicht als Stellvertreterin:
 * Unterschrift und Versand löst die Nutzerin oder der Nutzer aus (OR Art. 13 ff.).
 */
export function buildCancellationLetter(user: User, contract: Contract, info: DeadlineInfo, todayISO: ISODate): Letter {
  const ref = [contract.product, contract.customer_number && `Kunden-/Vertragsnummer ${contract.customer_number}`].filter(Boolean).join(', ');
  const zipCity = user.zip_city || '[PLZ Ort]';
  const paragraphs = [
    'Sehr geehrte Damen und Herren',
    `Hiermit kündige ich den oben genannten Vertrag fristgerecht per ${formatCH(info.endDate)}, eventualiter auf den nächstmöglichen Termin.`,
  ];
  if (info.kind === 'krankenkasse') {
    paragraphs.push(
      'Die Kündigung betrifft die obligatorische Krankenpflegeversicherung nach KVG. Die Bestätigung meines neuen Versicherers über die lückenlose Weiterversicherung reiche ich nach bzw. wird Ihnen durch den neuen Versicherer zugestellt (Art. 7 Abs. 5 KVG).',
    );
  }
  if (contract.category === 'mobile') {
    paragraphs.push('Falls ich meine Rufnummer zu einem neuen Anbieter portiere, gilt die Kündigung mit dem Portierungsdatum.');
  }
  paragraphs.push(
    'Bitte bestätigen Sie mir den Eingang dieser Kündigung sowie das Vertragsende schriftlich. Allfällige Lastschrift- oder Daueraufträge stelle ich auf diesen Termin ein.',
    'Freundliche Grüsse',
  );
  return {
    sender: [user.name || '[Vorname Name]', user.street || '[Strasse Nr.]', zipCity],
    recipient: [contract.provider, 'Kundendienst / Kündigungen', '[Adresse gemäss Vertrag oder Rechnung]'],
    place: `${zipCity.replace(/^\d{4}\s*/, '') || '[Ort]'}, ${formatCH(todayISO)}`,
    subject: `Kündigung${ref ? ` – ${ref}` : ''}`,
    paragraphs,
    signatureName: user.name || '[Vorname Name]',
  };
}

export function buildBonusComplaint(provider: string, bonusChf: number, switchedOn: string, customerNumber: string, name: string): string {
  return [
    `Betreff: Ausstehende Willkommensprämie von CHF ${bonusChf.toFixed(2)}${customerNumber ? ` – Kundennummer ${customerNumber}` : ''}`,
    '',
    'Sehr geehrte Damen und Herren',
    '',
    `Am ${switchedOn} habe ich bei Ihnen einen Vertrag abgeschlossen. Gemäss Ihrem Angebot steht mir eine Prämie von CHF ${bonusChf.toFixed(2)} zu, die bisher nicht gutgeschrieben wurde.`,
    '',
    'Ich bitte Sie, die Gutschrift innert 14 Tagen vorzunehmen oder mir schriftlich mitzuteilen, weshalb sie nicht erfolgt.',
    '',
    'Freundliche Grüsse',
    name || '[Vorname Name]',
  ].join('\n');
}
