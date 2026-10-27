import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { getDb } from '@/lib/db';
import { stampTestSignature } from '@/lib/dispatch/directory';
import { createDispatch, getDispatch, refreshDispatch, sendDispatch } from '@/lib/dispatch/flow';
import { pdfSafe, renderLetterPdf } from '@/lib/dispatch/pdf';
import { parseQrBill } from '@/lib/qrbill';
import * as repo from '@/lib/repo';

const QR = [
  'SPC', '0200', '1', 'CH4431999123000889012', 'S', 'Swisscom (Schweiz) AG', 'Alte Tiefenaustrasse', '6', '3050', 'Bern', 'CH',
  '', '', '', '', '', '', '', '65.00', 'CHF', 'S', 'Anna Muster', 'Bahnhofstrasse', '1', '8001', 'Zürich', 'CH',
  'QRR', '210000000003139471430009017', 'Rechnung Oktober 2026', 'EPD',
].join('\n');

describe('QR-Rechnung', () => {
  it('liest Empfänger, Adresse, Betrag und Mitteilung', () => {
    expect(parseQrBill(QR)).toEqual({
      iban: 'CH4431999123000889012',
      creditorName: 'Swisscom (Schweiz) AG',
      creditorAddress: ['Alte Tiefenaustrasse 6', '3050 Bern'],
      amount: 65,
      currency: 'CHF',
      message: 'Rechnung Oktober 2026',
    });
  });
  it('lehnt andere QR-Codes ab', () => {
    expect(parseQrBill('https://example.ch')).toBeNull();
  });
  it('Betrag offen (leer) ergibt null', () => {
    expect(parseQrBill(QR.replace('\n65.00\n', '\n\n'))?.amount).toBeNull();
  });
});

describe('Brief als PDF', () => {
  it('erzeugt ein gültiges PDF und ersetzt nicht darstellbare Zeichen', async () => {
    expect(pdfSafe('CHF −12 → ok «ä»')).toBe('CHF -12 ? ok «ä»');
    const bytes = await renderLetterPdf(
      {
        sender: ['Anna Muster', 'Bahnhofstrasse 1', '8001 Zürich'],
        recipient: ['Swisscom (Schweiz) AG', 'Kundendienst', '3050 Bern'],
        place: 'Zürich, 27.10.2026',
        subject: 'Kündigung – Kundennummer 1-ABC',
        insuredLines: [],
        paragraphs: Array.from({ length: 30 }, (_, i) => `Absatz ${i + 1}: ${'Sehr langer Text '.repeat(12)}`),
        signatureName: 'Anna Muster',
      },
      'Test',
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });
});

describe('Digitale Kündigung im Testbetrieb', () => {
  it('signieren → senden: E-Mail im Postausgang, eingeschriebener Test-Brief, Verlauf', async () => {
    const userId = repo.createUser('test@example.ch', 'x', 'Anna Muster');
    repo.updateProfile(userId, 'Anna Muster', 'Bahnhofstrasse 1', '8001 Zürich');
    const user = repo.getUser(userId)!;
    const cid = repo.createContract(userId, {
      category: 'mobile', provider: 'Swisscom', product: '', customer_number: '1-ABC', monthly_price: 65, start_date: null,
      min_term_months: 0, renewal_months: 0, notice_months: 1, to_month_end: 1, notes: '',
    });
    const contract = repo.getContract(userId, cid)!;
    const { id, signingUrl } = await createDispatch(user, contract, { name: 'Swisscom (Schweiz) AG', addressLines: ['Postfach', '3050 Bern'], email: 'kuendigung@example.ch' }, true);
    expect(signingUrl).toMatch(/^\/signatur\/test\//);

    let d = await refreshDispatch(getDispatch(userId, id)!);
    expect(d.status).toBe('zur_signatur');
    await expect(sendDispatch(user, d, contract)).rejects.toThrow(/nicht unterschrieben/);

    const reqId = d.sign_request_id!;
    const row = getDb().prepare('SELECT pdf FROM test_signatures WHERE id = ?').get(reqId) as { pdf: Uint8Array };
    getDb().prepare('UPDATE test_signatures SET signed_pdf = ? WHERE id = ?').run(await stampTestSignature(new Uint8Array(row.pdf), 'Anna'), reqId);
    d = await refreshDispatch(d);
    expect(d.status).toBe('signiert');

    await sendDispatch(user, d, contract);
    d = getDispatch(userId, id)!;
    expect(d.status).toBe('versendet');
    expect(d.email_sent_at).not.toBeNull();
    expect(d.post_letter_id).toBeTruthy();
    expect(d.log).toMatch(/E-Mail an kuendigung@example.ch/);
    const mail = getDb().prepare('SELECT to_addr, cc_addr, attachments FROM outbox ORDER BY id DESC').get() as { to_addr: string; cc_addr: string; attachments: string };
    expect(mail).toMatchObject({ to_addr: 'kuendigung@example.ch', cc_addr: 'test@example.ch' });
    expect(mail.attachments).toMatch(/Kuendigung-Swisscom\.pdf/);
  });
});
