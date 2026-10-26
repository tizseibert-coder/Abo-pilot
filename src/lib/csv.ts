/** Kleiner CSV-Parser: Trennzeichen ; , oder Tab (aus der Kopfzeile erkannt), Anführungszeichen erlaubt. */
export function parseCsvTable(text: string): { header: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, '').replace(/\r/g, '');
  const lines = clean.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { header: [], rows: [] };
  const first = lines[0];
  const sep = first.includes('\t') ? '\t' : first.split(';').length >= first.split(',').length ? ';' : ',';
  const split = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === sep && !quoted) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };
  return { header: split(first), rows: lines.slice(1).map(split) };
}

/** Spaltennamen vergleichbar machen: «Prämie» → «pramie», «Tarif-Jahr» → «tarifjahr». */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Index der ersten Spalte, deren Name einem der Kandidaten entspricht, sonst -1. */
export function findColumn(header: string[], candidates: string[]): number {
  const norm = header.map(normalizeHeader);
  for (const c of candidates) {
    const i = norm.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}
