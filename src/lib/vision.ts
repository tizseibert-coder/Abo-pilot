// Foto einer Rechnung oder Police lesen (Claude, strukturierte Ausgabe).
// Die Werte füllen nur das Formular vor – die Nutzerin oder der Nutzer prüft und speichert selbst.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { CATEGORIES, type Category } from './categories';
import { isISODate } from './dates';
import type { ExtractedContract } from './extract';

const CATEGORY_KEYS = Object.keys(CATEGORIES) as [Category, ...Category[]];

const InvoiceFields = z.object({
  is_invoice_or_contract: z.boolean(),
  provider: z.string().nullable(),
  category: z.enum(CATEGORY_KEYS).nullable(),
  amount_chf: z.number().nullable(),
  amount_period_months: z.number().int().nullable(),
  customer_number: z.string().nullable(),
  contract_start: z.string().nullable(),
  notice_text: z.string().nullable(),
});

const SYSTEM = `Du liest das Foto einer Schweizer Rechnung, Police oder Vertragsbestätigung und füllst Felder aus.
- Nur was auf dem Bild lesbar ist; sonst null. Nichts schätzen.
- provider: Firmenname des Anbieters (nicht der Kunde).
- category: mobile, internet, streaming, bank, krankenkasse_grund (KVG/Grundversicherung), versicherung_zusatz (VVG-Zusatz), versicherung_sach (Auto, Hausrat, Haftpflicht) oder andere.
- amount_chf: wiederkehrender Betrag des Abos bzw. der Prämie, nicht einmalige Gebühren. amount_period_months: für wie viele Monate dieser Betrag gilt (1, 3, 6 oder 12).
- contract_start als JJJJ-MM-TT, falls ein Vertragsbeginn steht.
- notice_text: wörtlicher Hinweis zu Kündigungsfrist oder Laufzeit, falls auf dem Bild.`;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export async function extractFromImage(bytes: Uint8Array, mediaType: ImageType): Promise<ExtractedContract> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: Buffer.from(bytes).toString('base64') } },
          { type: 'text', text: 'Bitte die Felder aus diesem Dokument lesen.' },
        ],
      },
    ],
    output_config: { format: betaZodOutputFormat(InvoiceFields) },
  });
  if (response.stop_reason === 'refusal') throw new Error('Das Bild konnte nicht ausgewertet werden.');
  const f = response.parsed_output;
  if (!f) throw new Error('Antwort konnte nicht gelesen werden.');
  if (!f.is_invoice_or_contract) throw new Error('Auf dem Bild ist keine Rechnung oder Police erkennbar.');

  const months = f.amount_period_months && f.amount_period_months > 0 ? f.amount_period_months : 1;
  const hints = ['Aus Foto gelesen (KI) – bitte jedes Feld prüfen'];
  if (months > 1) hints.push(`Betrag für ${months} Monate erkannt und auf Monat umgerechnet`);
  if (f.notice_text) hints.push(`Hinweis auf dem Dokument: «${f.notice_text.slice(0, 160)}»`);
  return {
    provider: f.provider,
    category: f.category,
    monthlyPrice: f.amount_chf !== null ? Math.round((f.amount_chf / months) * 100) / 100 : null,
    customerNumber: f.customer_number,
    startDate: f.contract_start && isISODate(f.contract_start) ? f.contract_start : null,
    hints,
  };
}
