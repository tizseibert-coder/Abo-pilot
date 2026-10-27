// Digitale Kündigung: PDF erzeugen → QES-Signatur durch die Nutzerin/den Nutzer → auf deren ausdrückliche
// Anweisung per E-Mail an den Anbieter (Original) und optional eingeschrieben per Post (Zustellnachweis).
// Abo-Pilot bleibt Botin: Inhalt und Unterschrift stammen von der Nutzerin oder dem Nutzer (OR Art. 14 Abs. 2bis).

import { today } from '../dates';
import { getDb, nowISO } from '../db';
import { getHealthSettings } from '../kk/repo';
import { buildCancellationLetter } from '../letter';
import { viewContract } from '../overview';
import type { Contract, User } from '../repo';
import { renderLetterPdf } from './pdf';
import { letterService, mailer, signatureProvider } from './providers';

export type DispatchStatus = 'zur_signatur' | 'signiert' | 'versendet' | 'abgelehnt' | 'fehler';

export interface Dispatch {
  id: number;
  user_id: number;
  contract_id: number | null;
  status: DispatchStatus;
  recipient_name: string;
  recipient_address: string;
  recipient_email: string;
  with_post: number;
  sign_provider: string;
  sign_request_id: string | null;
  signing_url: string | null;
  email_sent_at: string | null;
  post_provider: string | null;
  post_letter_id: string | null;
  post_status: string | null;
  consent_at: string | null;
  log: string;
  created_at: string;
  updated_at: string;
}

const COLS = `id, user_id, contract_id, status, recipient_name, recipient_address, recipient_email, with_post, sign_provider,
  sign_request_id, signing_url, email_sent_at, post_provider, post_letter_id, post_status, consent_at, log, created_at, updated_at`;

export const STATUS_LABEL: Record<DispatchStatus, string> = {
  zur_signatur: 'Wartet auf Ihre Unterschrift',
  signiert: 'Unterschrieben – bereit zum Senden',
  versendet: 'Versendet',
  abgelehnt: 'Signatur abgelehnt',
  fehler: 'Fehler',
};

export function listDispatches(userId: number, contractId: number): Dispatch[] {
  return getDb().prepare(`SELECT ${COLS} FROM dispatches WHERE user_id = ? AND contract_id = ? ORDER BY id DESC`).all(userId, contractId) as unknown as Dispatch[];
}

export function getDispatch(userId: number, id: number): Dispatch | undefined {
  return getDb().prepare(`SELECT ${COLS} FROM dispatches WHERE user_id = ? AND id = ?`).get(userId, id) as Dispatch | undefined;
}

export function dispatchPdf(userId: number, id: number, signed: boolean): Uint8Array | null {
  const r = getDb().prepare(`SELECT ${signed ? 'signed_pdf' : 'pdf'} AS f FROM dispatches WHERE user_id = ? AND id = ?`).get(userId, id) as { f: Uint8Array | null } | undefined;
  return r?.f ? new Uint8Array(r.f) : null;
}

function update(id: number, fields: Record<string, string | number | Uint8Array | null>, logLine: string): void {
  const keys = Object.keys(fields);
  const sets = [...keys.map((k) => `${k} = ?`), 'updated_at = ?', "log = log || ?"].join(', ');
  getDb()
    .prepare(`UPDATE dispatches SET ${sets} WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), nowISO(), `${new Date().toISOString().slice(0, 16).replace('T', ' ')}  ${logLine}\n`, id);
}

export interface Recipient {
  name: string;
  addressLines: string[];
  email: string;
}

export async function createDispatch(user: User, contract: Contract, recipient: Recipient, withPost: boolean): Promise<{ id: number; signingUrl: string }> {
  const todayISO = today();
  const { deadline } = viewContract(contract, [], todayISO);
  const letter = buildCancellationLetter(
    user,
    contract,
    deadline,
    todayISO,
    getHealthSettings(user.id).persons.map((p) => p.birthYear),
    [recipient.name, ...recipient.addressLines],
  );
  const title = `Kündigung ${contract.provider} – ${user.name}`;
  const pdf = await renderLetterPdf(letter, title);
  const provider = signatureProvider();
  const now = nowISO();
  const r = getDb()
    .prepare(
      `INSERT INTO dispatches (user_id, contract_id, status, recipient_name, recipient_address, recipient_email, with_post, pdf, sign_provider, log, created_at, updated_at)
       VALUES (?, ?, 'zur_signatur', ?, ?, ?, ?, ?, ?, '', ?, ?)`,
    )
    .run(user.id, contract.id, recipient.name, recipient.addressLines.join('\n'), recipient.email, withPost ? 1 : 0, pdf, provider.name, now, now);
  const id = Number(r.lastInsertRowid);
  try {
    const { requestId, signingUrl } = await provider.create({ pdf, title, signerEmail: user.email, returnUrl: `/vertraege/${contract.id}/versand?d=${id}` });
    update(id, { sign_request_id: requestId, signing_url: signingUrl }, `PDF erstellt, Signatur angefordert (${provider.name})`);
    return { id, signingUrl };
  } catch (e) {
    update(id, { status: 'fehler' }, `Signatur konnte nicht angefordert werden: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

/** Status beim Signaturdienst nachfragen; signiertes PDF abholen, sobald fertig. */
export async function refreshDispatch(d: Dispatch): Promise<Dispatch> {
  if (d.status !== 'zur_signatur' || !d.sign_request_id) return d;
  const provider = signatureProvider();
  if (provider.name !== d.sign_provider) return d;
  const status = await provider.status(d.sign_request_id);
  if (status === 'signiert') {
    const signed = await provider.download(d.sign_request_id);
    update(d.id, { status: 'signiert', signed_pdf: signed }, 'Qualifiziert elektronisch unterschrieben');
  } else if (status === 'abgelehnt') {
    update(d.id, { status: 'abgelehnt' }, 'Signatur abgelehnt oder zurückgezogen');
  }
  return getDispatch(d.user_id, d.id) ?? d;
}

/** Versand auf ausdrückliche Anweisung: Original per E-Mail, optional eingeschriebene Kopie per Post. */
export async function sendDispatch(user: User, d: Dispatch, contract: Contract): Promise<void> {
  if (d.status !== 'signiert') throw new Error('Das Schreiben ist noch nicht unterschrieben.');
  const signed = dispatchPdf(user.id, d.id, true);
  if (!signed) throw new Error('Signiertes PDF fehlt.');
  update(d.id, { consent_at: nowISO() }, 'Versand durch Nutzer/in ausgelöst');
  const filename = `Kuendigung-${contract.provider.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
  const { deadline } = viewContract(contract, [], today());

  if (d.recipient_email) {
    await mailer().send({
      to: d.recipient_email,
      cc: user.email,
      replyTo: user.email,
      subject: `Kündigung ${contract.customer_number ? `Kundennummer ${contract.customer_number} – ` : ''}${user.name}`,
      text: [
        'Sehr geehrte Damen und Herren',
        '',
        `Im Anhang erhalten Sie die Kündigung von ${user.name}, qualifiziert elektronisch signiert (ZertES, Art. 14 Abs. 2bis OR).`,
        `Gewünschtes Vertragsende: ${deadline.endDate.split('-').reverse().join('.')}, eventualiter auf den nächstmöglichen Termin.`,
        'Bitte bestätigen Sie den Eingang und das Vertragsende direkt an die Absenderin bzw. den Absender (Antwort an diese E-Mail).',
        '',
        'Diese Nachricht wurde im Auftrag der Kundin bzw. des Kunden über Abo-Pilot übermittelt.',
      ].join('\n'),
      attachments: [{ filename, content: signed }],
    });
    update(d.id, { email_sent_at: nowISO() }, `E-Mail an ${d.recipient_email} (Kopie an ${user.email}) via ${mailer().name}`);
  }
  if (d.with_post) {
    const service = letterService();
    const { letterId } = await service.send({ pdf: signed, filename, registered: true });
    update(d.id, { post_provider: service.name, post_letter_id: letterId, post_status: 'übergeben' }, `Eingeschriebener Brief übergeben (${service.name}, ${letterId})`);
  }
  update(d.id, { status: 'versendet' }, 'Abgeschlossen');
}
