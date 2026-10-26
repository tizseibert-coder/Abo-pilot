'use client';

import { useActionState } from 'react';
import { importKkData, saveSourceAction, type DataImportState, type FormState } from '@/app/actions';

export function DataImportForm({ kind, title, hint }: { kind: 'praemien' | 'regionen'; title: string; hint: string }) {
  const [state, action, pending] = useActionState<DataImportState, FormData>(importKkData, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="kind" value={kind} />
      <strong>{title}</strong>
      <p className="hint" style={{ margin: 0 }}>{hint}</p>
      <label>CSV-Datei<input name="file" type="file" accept=".csv,text/csv" /></label>
      <label>oder Download-URL (https)<input name="url" type="url" placeholder="https://…" /></label>
      {state.error && <p className="error">{state.error}</p>}
      {state.message && <p>{state.message}</p>}
      {state.errors && state.errors.length > 0 && (
        <details>
          <summary className="small">{state.errors.length} Hinweise</summary>
          <ul className="small">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </details>
      )}
      <div className="actions"><button type="submit" disabled={pending}>{pending ? 'Importiere …' : 'Importieren'}</button></div>
    </form>
  );
}

type SaveSource = (state: FormState, fd: FormData) => Promise<FormState>;

export function SourceForm({ action, defaults }: { action: SaveSource; defaults?: { category: string; provider: string; url: string; method: string; active: boolean } }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const d = defaults ?? { category: 'mobile', provider: '', url: '', method: 'auto', active: false };
  return (
    <form action={formAction} className="stack">
      <div className="row">
        <label>
          Kategorie
          <select name="category" defaultValue={d.category}>
            <option value="mobile">Handy-Abo</option>
            <option value="internet">Internet / TV</option>
            <option value="streaming">Streaming</option>
            <option value="bank">Bankkonto</option>
          </select>
        </label>
        <label>Anbieter<input name="provider" defaultValue={d.provider} required /></label>
        <label>
          Methode
          <select name="method" defaultValue={d.method}>
            <option value="auto">Automatisch (JSON-LD, sonst KI)</option>
            <option value="jsonld">Nur strukturierte Daten (JSON-LD)</option>
            <option value="ki">Nur KI-Extraktion</option>
          </select>
        </label>
      </div>
      <label>Tarifseite des Anbieters (https)<input name="url" type="url" defaultValue={d.url} required /></label>
      <label className="check">
        <input name="active" type="checkbox" defaultChecked={d.active} />
        <span>Aktiv – Nutzungsbedingungen der Seite geprüft, automatischer Abruf erlaubt</span>
      </label>
      {state.error && <p className="error">{state.error}</p>}
      <div className="actions"><button type="submit" disabled={pending}>Speichern</button></div>
    </form>
  );
}
