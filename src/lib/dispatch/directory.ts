import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getDb } from '../db';

/** Kündigungsadressen der Anbieter – vom Team gepflegt und mit Quelle belegt, nie geraten. */
export interface DirectoryEntry {
  id: number;
  provider: string;
  category: string;
  postal_address: string;
  cancel_email: string;
  notes: string;
  source_url: string;
  checked_at: string | null;
}

export function listDirectory(): DirectoryEntry[] {
  return getDb().prepare('SELECT * FROM provider_directory ORDER BY provider, category').all() as unknown as DirectoryEntry[];
}

export function findDirectory(provider: string, category: string): DirectoryEntry | undefined {
  const rows = getDb().prepare('SELECT * FROM provider_directory WHERE lower(provider) = lower(?)').all(provider.trim()) as unknown as DirectoryEntry[];
  return rows.find((r) => r.category === category) ?? rows.find((r) => r.category === '');
}

export function saveDirectory(e: Omit<DirectoryEntry, 'id'>, id?: number): void {
  if (id) {
    getDb()
      .prepare('UPDATE provider_directory SET provider = ?, category = ?, postal_address = ?, cancel_email = ?, notes = ?, source_url = ?, checked_at = ? WHERE id = ?')
      .run(e.provider, e.category, e.postal_address, e.cancel_email, e.notes, e.source_url, e.checked_at, id);
  } else {
    getDb()
      .prepare('INSERT INTO provider_directory (provider, category, postal_address, cancel_email, notes, source_url, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(e.provider, e.category, e.postal_address, e.cancel_email, e.notes, e.source_url, e.checked_at);
  }
}

export function deleteDirectory(id: number): void {
  getDb().prepare('DELETE FROM provider_directory WHERE id = ?').run(id);
}

/** Nur Testbetrieb: «signiert» ein PDF mit einem gut sichtbaren, rechtlich ungültigen Vermerk. */
export async function stampTestSignature(pdf: Uint8Array, signer: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const last = doc.getPages().at(-1)!;
  last.drawRectangle({ x: 60, y: 60, width: 300, height: 46, borderColor: rgb(0.75, 0.1, 0.1), borderWidth: 1.5 });
  last.drawText('TEST-SIGNATUR - rechtlich ungueltig', { x: 70, y: 88, size: 11, font, color: rgb(0.75, 0.1, 0.1) });
  last.drawText(`${signer} - ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, { x: 70, y: 70, size: 9, font, color: rgb(0.75, 0.1, 0.1) });
  return doc.save();
}
