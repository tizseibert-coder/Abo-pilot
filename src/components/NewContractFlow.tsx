'use client';

import { useActionState } from 'react';
import { importInvoice, type FormState, type ImportState } from '@/app/actions';
import { ContractForm, EMPTY_CONTRACT, termsFor, type ContractDefaults } from './ContractForm';

type SaveAction = (state: FormState, fd: FormData) => Promise<FormState>;

export function NewContractFlow({ save }: { save: SaveAction }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importInvoice, {});
  const ex = state.extracted;
  const defaults: ContractDefaults = ex
    ? {
        ...EMPTY_CONTRACT,
        ...(ex.category ? { category: ex.category, ...termsFor(ex.category) } : {}),
        provider: ex.provider ?? '',
        monthly_price: ex.monthlyPrice?.toFixed(2) ?? '',
        customer_number: ex.customerNumber ?? '',
        start_date: ex.startDate ?? '',
      }
    : EMPTY_CONTRACT;

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Rechnung einlesen: Foto, PDF oder Text</h2>
        <form action={action} className="stack">
          <label>
            Rechnungstext oder E-Mail einfügen
            <textarea name="text" placeholder="z. B. Text aus der Rechnungs-E-Mail kopieren und hier einfügen" />
          </label>
          <label>
            oder Foto bzw. PDF der Rechnung
            <span className="hint">max. 5 MB, wird nicht gespeichert. Fotos werden zur Erkennung an unseren KI-Dienstleister (Anthropic, USA) übermittelt.</span>
            <input name="file" type="file"accept="application/pdf,.pdf,image/jpeg,image/png,image/webp" />
          </label>
          {state.error && <p className="error">{state.error}</p>}
          <div className="actions">
            <button type="submit" className="secondary" disabled={pending}>{pending ? 'Lese …' : 'Felder erkennen'}</button>
          </div>
        </form>
        {ex && (
          <div className="small" style={{ marginTop: 12 }}>
            <strong>Erkannt – bitte prüfen:</strong>
            <ul>
              {ex.hints.length ? ex.hints.map((h) => <li key={h}>{h}</li>) : <li>Nichts sicher erkannt; bitte Felder von Hand ausfüllen.</li>}
            </ul>
          </div>
        )}
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Vertragsdaten</h2>
        <ContractForm key={state.seq ?? 0} action={save} defaults={defaults} submitLabel="Vertrag speichern" />
      </section>
    </div>
  );
}
