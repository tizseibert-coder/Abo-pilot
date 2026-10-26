'use client';

import { useActionState } from 'react';
import { importOffersCsv, saveOffer, type CsvImportState, type FormState } from '@/app/actions';
import { CATEGORIES } from '@/lib/categories';
import { CSV_COLUMNS, type Offer } from '@/lib/offer-types';

export function OfferForm({ offer }: { offer?: Offer }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveOffer, {});
  const o = offer;
  return (
    <form action={action} className="stack">
      <div className="row">
        <label>ID <span className="hint">z. B. anbieter-tarif</span><input name="id" defaultValue={o?.id} readOnly={!!o} required /></label>
        <label>
          Kategorie
          <select name="category" defaultValue={o?.category ?? 'mobile'}>
            {Object.entries(CATEGORIES).filter(([, c]) => c.stage === 1).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
        </label>
        <label>Anbieter<input name="provider" defaultValue={o?.provider} required /></label>
        <label>Tarifname<input name="name" defaultValue={o?.name} required /></label>
      </div>
      <div className="row">
        <label>Preis/Monat regulär<input name="monthly_price" inputMode="decimal" defaultValue={o?.monthlyPrice} required /></label>
        <label>Aktionspreis<input name="promo_price" inputMode="decimal" defaultValue={o?.promoPrice ?? ''} /></label>
        <label>Aktion Monate <span className="hint">999 = dauerhaft</span><input name="promo_months" inputMode="numeric" defaultValue={o?.promoMonths ?? 0} /></label>
        <label>Gültig bis<input name="valid_until" type="date" defaultValue={o?.validUntil ?? ''} /></label>
      </div>
      <div className="row">
        <label>Prämie CHF<input name="bonus_chf" inputMode="decimal" defaultValue={o?.bonusChf ?? 0} /></label>
        <label>Einmalkosten CHF<input name="one_time_fee_chf" inputMode="decimal" defaultValue={o?.oneTimeFeeChf ?? 0} /></label>
        <label>Neukunden-Sperre Monate<input name="new_customer_lock_months" inputMode="numeric" defaultValue={o?.newCustomerLockMonths ?? 0} /></label>
        <label>Mindestlaufzeit Monate<input name="min_term_months" inputMode="numeric" defaultValue={o?.minTermMonths ?? 0} /></label>
      </div>
      <div className="row">
        <label>Daten GB <span className="hint">leer = unlimitiert</span><input name="data_gb" inputMode="decimal" defaultValue={o?.dataGb ?? ''} /></label>
        <label>Speed Mbit/s<input name="speed_mbps" inputMode="numeric" defaultValue={o?.speedMbps ?? ''} /></label>
        <label>Provision CHF<input name="commission_chf" inputMode="decimal" defaultValue={o?.commissionChf ?? 0} /></label>
      </div>
      <div className="actions">
        <label className="check"><input name="roaming_eu" type="checkbox" defaultChecked={o?.roamingEu} /><span>EU-Roaming inklusive</span></label>
        <label className="check"><input name="includes_tv" type="checkbox" defaultChecked={o?.includesTv} /><span>TV inklusive</span></label>
      </div>
      <label>Quelle (https-Link zur Anbieterseite)<input name="source_url" type="url" defaultValue={o?.sourceUrl} required /></label>
      <label>Notizen<textarea name="notes" defaultValue={o?.notes} style={{ minHeight: 60 }} /></label>
      {state.error && <p className="error">{state.error}</p>}
      <p className="hint">Nach dem Speichern ist das Angebot ein Entwurf und erst nach «Heute geprüft» für Kunden sichtbar.</p>
      <div className="actions"><button type="submit" disabled={pending}>Speichern</button></div>
    </form>
  );
}

export function CsvImportForm() {
  const [state, action, pending] = useActionState<CsvImportState, FormData>(importOffersCsv, {});
  return (
    <form action={action} className="stack">
      <label>
        CSV einfügen <span className="hint">Spalten: {CSV_COLUMNS.join(', ')}</span>
        <textarea name="csv" placeholder={`${CSV_COLUMNS.join(';')}`} />
      </label>
      {state.error && <p className="error">{state.error}</p>}
      {state.imported !== undefined && <p>{state.imported} Angebote als Entwurf importiert.</p>}
      {state.errors && state.errors.length > 0 && (
        <ul className="error small">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <div className="actions"><button type="submit" className="secondary" disabled={pending}>Importieren</button></div>
    </form>
  );
}
