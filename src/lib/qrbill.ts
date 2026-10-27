// Schweizer QR-Rechnung (Swiss Payment Standards, Version 2.x): der QR-Code enthält Zeilen mit
// Zahlungsempfänger, Betrag und Mitteilung. Daraus lassen sich Anbieter und Betrag ohne Abtippen lesen.

export interface QrBill {
  iban: string;
  creditorName: string;
  creditorAddress: string[];
  amount: number | null;
  currency: string;
  message: string;
}

export function parseQrBill(payload: string): QrBill | null {
  const lines = payload.replace(/\r/g, '').split('\n');
  if (lines[0]?.trim() !== 'SPC' || !/^02\d\d$/.test(lines[1]?.trim() ?? '')) return null;
  const at = (i: number) => (lines[i] ?? '').trim();
  const type = at(4);
  // S = strukturiert (Strasse, Hausnummer, PLZ, Ort), K = kombiniert (zwei Adresszeilen)
  const address =
    type === 'K' ? [at(6), at(7)] : [[at(6), at(7)].filter(Boolean).join(' '), [at(8), at(9)].filter(Boolean).join(' ')];
  const amount = at(18) ? Number(at(18)) : null;
  return {
    iban: at(3),
    creditorName: at(5),
    creditorAddress: address.filter(Boolean),
    amount: amount !== null && Number.isFinite(amount) ? amount : null,
    currency: at(19) || 'CHF',
    message: at(29),
  };
}
