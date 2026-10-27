'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/actions';

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

export function DirectoryForm({ action, d }: { action: Action; d?: { provider: string; category: string; postal_address: string; cancel_email: string; notes: string; source_url: string } }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className="stack">
      <div className="row">
        <label>Anbieter<input name="provider" defaultValue={d?.provider} required /></label>
        <label>
          Kategorie <span className="hint">leer = alle</span>
          <select name="category" defaultValue={d?.category ?? ''}>
            <option value="">alle</option>
            <option value="mobile">Handy</option>
            <option value="internet">Internet / TV</option>
            <option value="streaming">Streaming</option>
            <option value="bank">Bank</option>
            <option value="krankenkasse_grund">Krankenkasse</option>
            <option value="versicherung_zusatz">Zusatzversicherung</option>
            <option value="versicherung_sach">Sachversicherung</option>
          </select>
        </label>
        <label>Kündigungs-E-Mail<input name="cancel_email" type="email" defaultValue={d?.cancel_email} /></label>
      </div>
      <label>Postadresse für Kündigungen<textarea name="postal_address" defaultValue={d?.postal_address} style={{ minHeight: 80 }} /></label>
      <label>Quelle (AGB, Kontaktseite)<input name="source_url" type="url" defaultValue={d?.source_url} required /></label>
      <label>Hinweise<input name="notes" defaultValue={d?.notes} placeholder="z. B. Kündigung auch im Kundenkonto möglich" /></label>
      {state.error && <p className="error">{state.error}</p>}
      <div className="actions"><button type="submit" disabled={pending}>Speichern</button></div>
    </form>
  );
}
