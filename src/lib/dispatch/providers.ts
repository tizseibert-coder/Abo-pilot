// Austauschbare Dienste für Signatur, E-Mail und Post. In Entwicklung und Tests laufen
// Test-Varianten ohne Aussenwirkung; produktiv werden Skribble (QES), SMTP und Pingen genutzt.
// Die Endpunkte von Skribble und Pingen entsprechen deren API v2, wie sie zum Zeitpunkt der
// Entwicklung bekannt war – vor dem Livegang mit der aktuellen Doku und im Staging prüfen.

import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { getDb, nowISO } from '../db';

export type SignStatus = 'offen' | 'signiert' | 'abgelehnt';

export interface SignatureProvider {
  name: string;
  create(input: { pdf: Uint8Array; title: string; signerEmail: string; returnUrl: string }): Promise<{ requestId: string; signingUrl: string }>;
  status(requestId: string): Promise<SignStatus>;
  download(requestId: string): Promise<Uint8Array>;
}

export interface Mail {
  to: string;
  cc?: string;
  replyTo?: string;
  subject: string;
  text: string;
  attachments: { filename: string; content: Uint8Array }[];
}

export interface Mailer {
  name: string;
  send(mail: Mail): Promise<void>;
}

export interface LetterService {
  name: string;
  send(input: { pdf: Uint8Array; filename: string; registered: boolean }): Promise<{ letterId: string }>;
  status(letterId: string): Promise<string>;
}

// ---------- Test-Varianten (Standard ohne Konfiguration) ----------

const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const testSignature: SignatureProvider = {
  name: 'test',
  async create({ pdf, title, signerEmail, returnUrl }) {
    const id = randomUUID();
    getDb()
      .prepare('INSERT INTO test_signatures (id, pdf, signer_email, title, return_url, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, pdf, signerEmail, title, returnUrl, nowISO());
    return { requestId: id, signingUrl: `/signatur/test/${id}` };
  },
  async status(id) {
    const r = getDb().prepare('SELECT signed_pdf FROM test_signatures WHERE id = ?').get(id) as { signed_pdf: Uint8Array | null } | undefined;
    return r?.signed_pdf ? 'signiert' : 'offen';
  },
  async download(id) {
    const r = getDb().prepare('SELECT signed_pdf FROM test_signatures WHERE id = ?').get(id) as { signed_pdf: Uint8Array | null } | undefined;
    if (!r?.signed_pdf) throw new Error('Noch nicht signiert.');
    return new Uint8Array(r.signed_pdf);
  },
};

/** Schreibt Mails in den Postausgang (Admin-Ansicht), statt sie zu versenden. */
export const outboxMailer: Mailer = {
  name: 'postausgang',
  async send(mail) {
    getDb()
      .prepare('INSERT INTO outbox (to_addr, cc_addr, subject, body, attachments, transport, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(mail.to, mail.cc ?? '', mail.subject, mail.text, mail.attachments.map((a) => `${a.filename} (${a.content.byteLength} B)`).join(', '), 'postausgang', nowISO());
  },
};

export const testLetters: LetterService = {
  name: 'test',
  async send({ pdf, registered }) {
    const id = randomUUID();
    getDb().prepare('INSERT INTO test_letters (id, registered, bytes, created_at) VALUES (?, ?, ?, ?)').run(id, registered ? 1 : 0, pdf.byteLength, nowISO());
    return { letterId: id };
  },
  async status() {
    return 'versendet (Test)';
  },
};

// ---------- Skribble (QES nach ZertES) ----------

function skribble(): SignatureProvider {
  const base = process.env.SKRIBBLE_API_URL ?? 'https://api.skribble.com/v2';
  const username = process.env.SKRIBBLE_USERNAME ?? '';
  const apiKey = process.env.SKRIBBLE_API_KEY ?? '';
  async function token(): Promise<string> {
    const res = await fetch(`${base}/access/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, 'api-key': apiKey }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Skribble-Login fehlgeschlagen (HTTP ${res.status})`);
    return (await res.text()).replace(/^"|"$/g, '');
  }
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Skribble ${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }
  interface SignatureRequest {
    id: string;
    document_id: string;
    status_overall: string;
    signing_url?: string;
    signatures?: { signing_url?: string }[];
  }
  return {
    name: 'skribble',
    async create({ pdf, title, signerEmail, returnUrl }) {
      const sr = await call<SignatureRequest>('/signature-requests', {
        method: 'POST',
        body: JSON.stringify({
          title,
          message: 'Bitte Kündigung qualifiziert elektronisch unterschreiben.',
          content: Buffer.from(pdf).toString('base64'),
          quality: 'QES',
          legislation: 'ZERTES',
          signatures: [{ account_email: signerEmail }],
          callback_success_url: `${appUrl()}${returnUrl}`,
        }),
      });
      const url = sr.signing_url ?? sr.signatures?.[0]?.signing_url;
      if (!url) throw new Error('Skribble hat keinen Signatur-Link geliefert.');
      return { requestId: sr.id, signingUrl: url };
    },
    async status(id) {
      const sr = await call<SignatureRequest>(`/signature-requests/${id}`);
      if (sr.status_overall === 'SIGNED') return 'signiert';
      if (sr.status_overall === 'DECLINED' || sr.status_overall === 'WITHDRAWN') return 'abgelehnt';
      return 'offen';
    },
    async download(id) {
      const sr = await call<SignatureRequest>(`/signature-requests/${id}`);
      const res = await fetch(`${base}/documents/${sr.document_id}/content`, { headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`Skribble-Dokument: HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

// ---------- SMTP (z. B. Infomaniak, Swisscom) ----------

function smtp(): Mailer {
  const transport = nodemailer.createTransport(process.env.SMTP_URL ?? '');
  const from = process.env.MAIL_FROM ?? 'Abo-Pilot <kuendigung@abo-pilot.ch>';
  return {
    name: 'smtp',
    async send(mail) {
      await transport.sendMail({
        from,
        to: mail.to,
        cc: mail.cc,
        replyTo: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
        attachments: mail.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: 'application/pdf' })),
      });
      getDb()
        .prepare('INSERT INTO outbox (to_addr, cc_addr, subject, body, attachments, transport, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(mail.to, mail.cc ?? '', mail.subject, mail.text, mail.attachments.map((a) => a.filename).join(', '), 'smtp', nowISO());
    },
  };
}

// ---------- Pingen (Briefversand Schweiz) ----------

function pingen(): LetterService {
  const api = process.env.PINGEN_API_URL ?? 'https://api.pingen.com';
  const identity = process.env.PINGEN_IDENTITY_URL ?? 'https://identity.pingen.com';
  const org = process.env.PINGEN_ORGANISATION_ID ?? '';
  async function token(): Promise<string> {
    const res = await fetch(`${identity}/auth/access-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.PINGEN_CLIENT_ID ?? '',
        client_secret: process.env.PINGEN_CLIENT_SECRET ?? '',
        scope: 'letter',
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Pingen-Login fehlgeschlagen (HTTP ${res.status})`);
    return ((await res.json()) as { access_token: string }).access_token;
  }
  return {
    name: 'pingen',
    async send({ pdf, filename, registered }) {
      const auth = { Authorization: `Bearer ${await token()}` };
      const up = await fetch(`${api}/file-upload`, { headers: auth, signal: AbortSignal.timeout(20_000) });
      if (!up.ok) throw new Error(`Pingen-Upload: HTTP ${up.status}`);
      const { data } = (await up.json()) as { data: { attributes: { url: string; url_signature: string } } };
      const put = await fetch(data.attributes.url, { method: 'PUT', body: Buffer.from(pdf), signal: AbortSignal.timeout(60_000) });
      if (!put.ok) throw new Error(`Pingen-Datei: HTTP ${put.status}`);
      const res = await fetch(`${api}/organisations/${org}/letters`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/vnd.api+json' },
        body: JSON.stringify({
          data: {
            type: 'letters',
            attributes: {
              file_original_name: filename,
              file_url: data.attributes.url,
              file_url_signature: data.attributes.url_signature,
              address_position: 'right',
              auto_send: true,
              delivery_product: registered ? (process.env.PINGEN_REGISTERED_PRODUCT ?? 'registered') : 'fast',
              print_mode: 'simplex',
              print_spectrum: 'grayscale',
            },
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Pingen-Brief: HTTP ${res.status}`);
      return { letterId: ((await res.json()) as { data: { id: string } }).data.id };
    },
    async status(id) {
      const res = await fetch(`${api}/organisations/${org}/letters/${id}`, { headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return `unbekannt (HTTP ${res.status})`;
      return ((await res.json()) as { data: { attributes: { status: string } } }).data.attributes.status;
    },
  };
}

// ---------- Auswahl über Umgebungsvariablen ----------

export function signatureProvider(): SignatureProvider {
  return process.env.SIGN_PROVIDER === 'skribble' ? skribble() : testSignature;
}
export function mailer(): Mailer {
  return process.env.MAIL_PROVIDER === 'smtp' ? smtp() : outboxMailer;
}
export function letterService(): LetterService {
  return process.env.POST_PROVIDER === 'pingen' ? pingen() : testLetters;
}
export function isTestMode(): boolean {
  return signatureProvider().name === 'test';
}
