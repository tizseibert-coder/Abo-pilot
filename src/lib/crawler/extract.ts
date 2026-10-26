// Angebots-Kandidaten aus einer Tarifseite gewinnen.
// 1. JSON-LD (schema.org), wenn der Anbieter strukturierte Daten liefert – deterministisch.
// 2. Claude, wenn keine strukturierten Daten da sind – jedes Ergebnis muss wörtlich auf der Seite belegt sein.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { isISODate } from '../dates';

export interface Candidate {
  name: string;
  monthlyPrice: number;
  promoPrice: number | null;
  promoMonths: number;
  oneTimeFeeChf: number;
  dataGb: number | null;
  roamingEu: boolean;
  speedMbps: number | null;
  includesTv: boolean;
  minTermMonths: number;
  validUntil: string | null;
  evidence: string;
}

// ---------- JSON-LD ----------

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function* walk(node: Json): Generator<Record<string, Json>> {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
  } else if (node && typeof node === 'object') {
    yield node;
    for (const v of Object.values(node)) yield* walk(v);
  }
}

const typeOf = (o: Record<string, Json>) => [o['@type']].flat().map(String);
const str = (v: Json | undefined) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const MONTHLY = /\b(MON|month|monat|mois|mese)/i;

export function extractJsonLd(html: string): Candidate[] {
  const out: Candidate[] = [];
  const done = new Set<object>();
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: Json;
    try {
      data = JSON.parse(m[1].trim()) as Json;
    } catch {
      continue;
    }
    for (const o of walk(data)) {
      if (!typeOf(o).some((t) => /Product|Service|Offer/.test(t))) continue;
      const name = str(o.name);
      const offers = [o.offers ?? (typeOf(o).includes('Offer') ? o : null)].flat().filter(Boolean) as Record<string, Json>[];
      for (const offer of offers) {
        if (!offer || typeof offer !== 'object' || done.has(offer)) continue;
        done.add(offer);
        const spec = (offer.priceSpecification ?? {}) as Record<string, Json>;
        const currency = str(offer.priceCurrency) || str(spec.priceCurrency);
        const price = Number(str(offer.price) || str(spec.price) || str(offer.lowPrice));
        const unitHint = [str(spec.unitCode), str(spec.unitText), str(spec.referenceQuantity as Json), name, str(o.description)].join(' ');
        // Nur Monatspreise in CHF; Gerätepreise o. Ä. würden den Vergleich verfälschen.
        if (currency !== 'CHF' || !Number.isFinite(price) || price <= 0 || price > 300 || !MONTHLY.test(unitHint)) continue;
        const validThrough = str(offer.priceValidUntil) || str(offer.validThrough);
        out.push({
          name: name || str(offer.name) || 'Tarif',
          monthlyPrice: price,
          promoPrice: null,
          promoMonths: 0,
          oneTimeFeeChf: 0,
          dataGb: 0, // unbekannt; im Entwurf von Hand ergänzen
          roamingEu: false,
          speedMbps: null,
          includesTv: false,
          minTermMonths: 0,
          validUntil: isISODate(validThrough.slice(0, 10)) ? validThrough.slice(0, 10) : null,
          evidence: `JSON-LD: ${name} ${price} CHF`,
        });
      }
    }
  }
  return out;
}

// ---------- Claude ----------

const ExtractedOffers = z.object({
  offers: z.array(
    z.object({
      name: z.string(),
      monthly_price_chf: z.number(),
      promo_price_chf: z.number().nullable(),
      promo_months: z.number().int().nullable(),
      one_time_fee_chf: z.number().nullable(),
      unlimited_data: z.boolean(),
      data_gb: z.number().nullable(),
      roaming_eu_included: z.boolean(),
      speed_mbps: z.number().nullable(),
      includes_tv: z.boolean(),
      min_term_months: z.number().int().nullable(),
      offer_valid_until: z.string().nullable(),
      evidence: z.string(),
    }),
  ),
});

const SYSTEM = `Du liest den Text einer Tarifseite eines Schweizer Anbieters und extrahierst Abo-Angebote für Privatkunden.

Regeln:
- Nur Angebote der verlangten Kategorie, die auf der Seite tatsächlich stehen. Nichts ergänzen oder schätzen.
- Preise in CHF pro Monat. monthly_price_chf ist der reguläre Preis; ein befristeter oder rabattierter Preis kommt in promo_price_chf.
- promo_months: Dauer des Aktionspreises in Monaten; 999, wenn die Seite «dauerhaft», «lebenslang» o. Ä. sagt; null, wenn nicht genannt.
- unlimited_data nur, wenn die Seite unlimitierte Daten in der Schweiz nennt; sonst data_gb, falls genannt.
- offer_valid_until als JJJJ-MM-TT, nur wenn ein Enddatum der Aktion genannt ist.
- evidence: ein kurzes, wörtliches Zitat von der Seite, das Tarifname und Preis belegt. Exakt so kopieren, wie es im Text steht.
- Gibt es keine passenden Angebote, liefere eine leere Liste.`;

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[’']/g, "'").trim();

/** Preis muss in einer üblichen Schreibweise im Text vorkommen (29.90, 29.–, 29,90, 29). */
function priceOnPage(price: number, text: string): boolean {
  const whole = Math.trunc(price);
  const cents = Math.round((price - whole) * 100);
  const forms = cents === 0 ? [`${whole}.–`, `${whole}.-`, `${whole}.00`, `${whole},00`, `${whole}`] : [`${whole}.${String(cents).padStart(2, '0')}`, `${whole},${String(cents).padStart(2, '0')}`];
  return forms.some((f) => text.includes(f));
}

export const MAX_TEXT_CHARS = 400_000;

export async function extractWithClaude(pageText: string, provider: string, categoryLabel: string, url: string): Promise<Candidate[]> {
  if (pageText.length > MAX_TEXT_CHARS) {
    throw new Error(`Seitentext zu lang (${pageText.length} Zeichen) – bitte eine spezifischere Unterseite als Quelle eintragen.`);
  }
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
        content: `Anbieter: ${provider}\nKategorie: ${categoryLabel}\nURL: ${url}\n\n<seite>\n${pageText}\n</seite>`,
      },
    ],
    output_config: { format: betaZodOutputFormat(ExtractedOffers) },
  });
  if (response.stop_reason === 'refusal') throw new Error('Das Modell hat die Extraktion abgelehnt.');
  if (response.stop_reason === 'max_tokens') throw new Error('Antwort abgeschnitten (max_tokens) – Seite in Unterseiten aufteilen.');
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Antwort konnte nicht gelesen werden.');

  // Schutz gegen erfundene Werte: Zitat und Preis müssen auf der Seite stehen.
  const haystack = normalize(pageText);
  return parsed.offers
    .filter((o) => o.evidence && haystack.includes(normalize(o.evidence)) && priceOnPage(o.promo_price_chf ?? o.monthly_price_chf, pageText))
    .map((o) => ({
      name: o.name.trim().slice(0, 120),
      monthlyPrice: o.monthly_price_chf,
      promoPrice: o.promo_price_chf,
      promoMonths: o.promo_price_chf === null ? 0 : (o.promo_months ?? 0),
      oneTimeFeeChf: o.one_time_fee_chf ?? 0,
      dataGb: o.unlimited_data ? null : (o.data_gb ?? 0),
      roamingEu: o.roaming_eu_included,
      speedMbps: o.speed_mbps,
      includesTv: o.includes_tv,
      minTermMonths: o.min_term_months ?? 0,
      validUntil: o.offer_valid_until && isISODate(o.offer_valid_until) ? o.offer_valid_until : null,
      evidence: o.evidence.slice(0, 300),
    }));
}
