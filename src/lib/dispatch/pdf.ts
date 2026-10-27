import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import type { Letter } from '../letter';

// A4 in Punkt; 1 mm = 2.8346 pt. Adressfeld für Couverts C5/C4 mit Fenster rechts (Schweizer Norm SN 010130).
const MM = 2.8346;
const A4 = { w: 595.28, h: 841.89 };
const ADDRESS = { x: 118 * MM, top: 55 * MM, width: 80 * MM };
const MARGIN = { left: 22 * MM, right: 18 * MM, top: 20 * MM, bottom: 20 * MM };

/** Standardschrift kennt nur WinAnsi – andere Zeichen ersetzen statt abzustürzen. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[−‐‑]/g, '-')
    .replace(/ | /g, ' ')
    .replace(/[^\x20-\x7E -ÿ–—‘’‚“”„•…€«»]/g, '?');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of pdfSafe(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** Kündigungsschreiben als druck- und signierfähiges PDF (eine oder mehrere Seiten). */
export async function renderLetterPdf(letter: Letter, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(title));
  doc.setCreator('Abo-Pilot');
  doc.setProducer('Abo-Pilot');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([A4.w, A4.h]);
  const textWidth = A4.w - MARGIN.left - MARGIN.right;

  let y = A4.h - MARGIN.top;
  for (const l of letter.sender) {
    page.drawText(pdfSafe(l), { x: MARGIN.left, y, size: 10, font });
    y -= 13;
  }

  // Rücksendeangabe und Empfänger im Fenster
  let ay = A4.h - ADDRESS.top;
  page.drawText(pdfSafe(letter.sender.join(', ')).slice(0, 90), { x: ADDRESS.x, y: ay + 14, size: 6.5, font });
  for (const l of letter.recipient) {
    for (const w of wrap(l, font, 11, ADDRESS.width)) {
      page.drawText(w, { x: ADDRESS.x, y: ay, size: 11, font });
      ay -= 14;
    }
  }

  y = A4.h - 105 * MM;
  page.drawText(pdfSafe(letter.place), { x: MARGIN.left, y, size: 11, font });
  y -= 30;
  for (const w of wrap(letter.subject, bold, 12, textWidth)) {
    page.drawText(w, { x: MARGIN.left, y, size: 12, font: bold });
    y -= 16;
  }
  y -= 10;

  const write = (text: string, size = 11, gapAfter = 8) => {
    for (const w of wrap(text, font, size, textWidth)) {
      if (y < MARGIN.bottom + 40) {
        page = doc.addPage([A4.w, A4.h]);
        y = A4.h - MARGIN.top;
      }
      page.drawText(w, { x: MARGIN.left, y, size, font });
      y -= size + 4;
    }
    y -= gapAfter;
  };

  if (letter.insuredLines.length) {
    write('Versicherte Personen:', 11, 2);
    for (const l of letter.insuredLines) write(l, 9.5, 2);
    y -= 8;
  }
  for (const p of letter.paragraphs) write(p);
  y -= 36;
  if (y < MARGIN.bottom + 20) {
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - MARGIN.top - 40;
  }
  page.drawText(pdfSafe(letter.signatureName), { x: MARGIN.left, y, size: 11, font });
  return doc.save();
}
