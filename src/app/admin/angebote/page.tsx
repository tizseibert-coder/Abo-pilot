import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CsvImportForm, OfferForm } from '@/components/OfferAdminForms';
import { requireUser } from '@/lib/auth';
import { formatChf } from '@/lib/benefit';
import { categoryLabel } from '@/lib/categories';
import { isAdmin } from '@/lib/context';
import { formatCH, today } from '@/lib/dates';
import { offerVisibility, STALE_AFTER_DAYS, type OfferVisibility } from '@/lib/offer-types';
import { getOffer, listAllOffers } from '@/lib/offers';
import { archiveOffer, markOfferChecked } from '../../actions';

export const dynamic = 'force-dynamic';

const BADGE: Record<OfferVisibility, string> = {
  sichtbar: 'gruen',
  entwurf: 'gelb',
  veraltet: 'orange',
  abgelaufen: 'rot',
  archiviert: 'frei',
};

export default async function OfferAdmin({ searchParams }: { searchParams: Promise<{ bearbeiten?: string; neu?: string }> }) {
  const user = await requireUser();
  if (!isAdmin(user)) redirect('/dashboard');
  const { bearbeiten, neu } = await searchParams;
  const todayISO = today();
  const offers = listAllOffers();
  const editing = bearbeiten ? getOffer(bearbeiten) : undefined;
  const todo = offers.filter((o) => ['entwurf', 'veraltet'].includes(offerVisibility(o, todayISO))).length;

  return (
    <>
      <h1>Angebote pflegen</h1>
      <p className="lead">
        Kunden sehen nur Angebote mit Status «sichtbar»: geprüft, nicht abgelaufen und höchstens {STALE_AFTER_DAYS} Tage alt.
        {todo > 0 && <> <strong>{todo} Angebote</strong> warten auf Prüfung.</>}
      </p>
      <p className="notice small">
        Prüfen heisst: Quelle öffnen, Preis, Aktion, Laufzeit und Gebühren mit der Anbieterseite abgleichen, korrigieren und
        dann «Heute geprüft» klicken. Keine Daten von Seiten übernehmen, deren Nutzungsbedingungen das verbieten.
      </p>

      {(editing || neu) && (
        <section className="card" style={{ margin: '16px 0' }}>
          <h2 style={{ marginTop: 0 }}>{editing ? `${editing.provider} – ${editing.name}` : 'Neues Angebot'}</h2>
          <OfferForm offer={editing} />
          <p className="small"><Link href="/admin/angebote">Abbrechen</Link></p>
        </section>
      )}

      <div className="actions" style={{ margin: '16px 0' }}>
        <Link className="button" href="/admin/angebote?neu=1">Neues Angebot</Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Angebot</th>
              <th className="num">Preis</th>
              <th>Geprüft</th>
              <th>Gültig bis</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => {
              const vis = offerVisibility(o, todayISO);
              return (
                <tr key={o.id}>
                  <td>
                    <strong>{o.provider}</strong> {o.name}
                    <div className="muted small">
                      {categoryLabel(o.category)} · <a href={o.sourceUrl} target="_blank" rel="noreferrer">Quelle</a>
                    </div>
                    {o.notes && <div className="small muted">{o.notes}</div>}
                  </td>
                  <td className="num">
                    {formatChf(o.promoPrice ?? o.monthlyPrice)}
                    {o.promoPrice !== null && (
                      <div className="muted small">
                        statt {formatChf(o.monthlyPrice)}, {o.promoMonths >= 999 ? 'dauerhaft' : `${o.promoMonths} Mt.`}
                      </div>
                    )}
                  </td>
                  <td>{formatCH(o.checkedAt)}</td>
                  <td>{o.validUntil ? formatCH(o.validUntil) : '–'}</td>
                  <td><span className={`badge ${BADGE[vis]}`}>{vis}</span></td>
                  <td>
                    <div className="actions">
                      <Link className="button secondary" href={`/admin/angebote?bearbeiten=${o.id}`}>Bearbeiten</Link>
                      {vis !== 'archiviert' && vis !== 'abgelaufen' && (
                        <form action={markOfferChecked.bind(null, o.id)} className="inline-form">
                          <button type="submit" className="secondary">Heute geprüft</button>
                        </form>
                      )}
                      {vis !== 'archiviert' && (
                        <form action={archiveOffer.bind(null, o.id)} className="inline-form">
                          <button type="submit" className="link">Archivieren</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Import (Partner-Feed oder Tabelle)</h2>
      <section className="card">
        <CsvImportForm />
      </section>
    </>
  );
}
