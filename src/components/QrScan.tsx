'use client';

import jsQR from 'jsqr';
import { useRef, useState } from 'react';
import { parseQrBill, type QrBill } from '@/lib/qrbill';
import { Icon } from './Icon';

async function decode(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  // Mehrere Grössen probieren: kleine QR-Codes auf grossen Fotos werden so zuverlässiger gefunden.
  for (const max of [1600, 1000, 2400]) {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
    if (code?.data) return code.data;
  }
  return null;
}

/** QR-Rechnung fotografieren oder Bild wählen – Auswertung nur im Browser, nichts wird hochgeladen. */
export function QrScan({ onBill }: { onBill: (bill: QrBill) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'none' | 'ok'>('idle');
  return (
    <div className="qr-scan">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setState('busy');
          try {
            const data = await decode(file);
            const bill = data ? parseQrBill(data) : null;
            if (bill) {
              onBill(bill);
              setState('ok');
            } else setState('none');
          } catch {
            setState('none');
          }
          e.target.value = '';
        }}
      />
      <button type="button" className="secondary" onClick={() => input.current?.click()} disabled={state === 'busy'}>
        <Icon name="search" /> {state === 'busy' ? 'Lese QR-Code …' : 'QR-Rechnung scannen'}
      </button>
      {state === 'ok' && <span className="hint">Gelesen – bitte prüfen.</span>}
      {state === 'none' && <span className="hint">Kein QR-Code erkannt. Näher fotografieren oder Angaben eintippen.</span>}
    </div>
  );
}
