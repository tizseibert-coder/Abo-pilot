import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatChf } from '@/lib/benefit';
import { today } from '@/lib/dates';
import { AGE_CLASS_LABEL, ageClass, FRANCHISES, MODEL_LABEL, normalizeFranchise, quoteHousehold, type KkModel } from '@/lib/kk/premiums';
import { getHealthSettings, modelsOf, premiumYears, premiumsFor, regionsForPlz } from '@/lib/kk/repo';
import { getProfile, listContracts } from '@/lib/repo';
import { saveHealth } from '../actions';

export const dynamic = 'force-dynamic';

export default async function HealthInsurance({ searchParams }: { searchParams: Promise<{ region?: string; personen?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const profile = getProfile(user.id);
  const settings = getHealthSettings(user.id);
  const todayISO = today();
  const thisYear = Number(todayISO.slice(0, 4));

  // Ab Oktober gelten die neuen Prämien fürs nächste Jahr (Publikation Ende September).
  const years = premiumYears();
  const year = years.find((y) => y <= thisYear + 1) ?? null;
  const plz = profile?.plz ?? '';
  const regions = plz ? regionsForPlz(plz) : [];
  const region = regions.find((r) => `${r.canton}-${r.region}` === sp.region) ?? regions[0] ?? null;

  const rowsWanted = Math.min(12, Math.max(Number(sp.personen) || 0, settings.persons.length, profile?.householdSize ?? 1, 1));
  const persons = Array.from({ length: rowsWanted }, (_, i) => settings.persons[i] ?? null);
  const models = modelsOf(settings);

  const quotes = year && region && settings.persons.length > 0 ? quoteHousehold(premiumsFor(year, region.canton, region.region), settings.persons, year, models) : [];
  const current = listContracts(user.id).filter((c) => c.status === 'aktiv' && c.category === 'krankenkasse_grund');
  const currentMonthly = current.reduce((s, c) => s + c.monthly_price, 0);
  const cheapest = quotes[0];

  return (
    <>
      <h1>Krankenkasse vergleichen</h1>
      <p className="lead">
        Grundversicherung: Die Leistungen sind bei allen Kassen gesetzlich gleich, es zählt nur die Prämie. Wir rechnen mit
        den offiziellen Prämien des Bundesamts für Gesundheit und erhalten von Krankenkassen keine Provision.
      </p>

      {!year && (
        <p className="notice">Die offiziellen Prämiendaten sind noch nicht eingelesen. Bitte später erneut versuchen.</p>
      )}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Ihr Haushalt</h2>
        <form action={saveHealth} className="stack">
          <div className="row">
            <label>
              Postleitzahl
              <input name="plz" inputMode="numeric" maxLength={4} defaultValue={plz} placeholder="8000" required />
            </label>
            {regions.length > 1 && (
              <label>
                Gemeinde / Prämienregion
                <select name="region" defaultValue={region ? `${region.canton}-${region.region}` : ''}>
                  {regions.map((r) => (
                    <option key={`${r.canton}-${r.region}`} value={`${r.canton}-${r.region}`}>
                      {r.places || 'Region'} ({r.canton}, Region {r.region})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Jahrgang</th>
                  <th>Franchise CHF</th>
                  <th>Unfall über Kasse</th>
                </tr>
              </thead>
              <tbody>
                {persons.map((p, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><input name="birth_year" inputMode="numeric" maxLength={4} defaultValue={p?.birthYear ?? ''} placeholder="1985" aria-label={`Jahrgang Person ${i + 1}`} /></td>
                    <td>
                      <select name="franchise" defaultValue={p?.franchise ?? 300} aria-label={`Franchise Person ${i + 1}`}>
                        <optgroup label="Erwachsene">
                          {FRANCHISES.ADULT.map((f) => <option key={`a${f}`} value={f}>{f}</option>)}
                        </optgroup>
                        <optgroup label="Kinder">
                          {FRANCHISES.KIN.filter((f) => !FRANCHISES.ADULT.includes(f)).map((f) => <option key={`k${f}`} value={f}>{f}</option>)}
                        </optgroup>
                      </select>
                    </td>
                    <td>
                      <label className="check">
                        <input type="checkbox" name="accident" value={String(i)} defaultChecked={p ? p.accident : false} />
                        <span className="small">nötig, wenn nicht angestellt (≥ 8 Std./Woche)</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small"><Link href={`/krankenkasse?personen=${rowsWanted + 1}`}>+ Person hinzufügen</Link> · Leere Zeilen werden ignoriert.</p>
          <div>
            <p className="label-title">Versicherungsmodelle vergleichen</p>
            <div className="actions">
              {(Object.keys(MODEL_LABEL) as KkModel[]).map((m) => (
                <label key={m} className="check">
                  <input type="checkbox" name="model" value={m} defaultChecked={models.includes(m)} />
                  <span>{MODEL_LABEL[m]}</span>
                </label>
              ))}
            </div>
            <p className="hint">Hausarzt-, HMO- und Telmed-Modelle sind günstiger, schränken aber die freie Arztwahl ein.</p>
          </div>
          <div className="actions"><button type="submit">Vergleichen</button></div>
        </form>
      </section>

      {plz && regions.length === 0 && year && <p className="notice">Für die PLZ {plz} kennen wir keine Prämienregion. Bitte PLZ prüfen.</p>}

      {quotes.length > 0 && year && region && (
        <>
          <h2>Günstigste Kassen {year} für {region.places || `PLZ ${plz}`}</h2>
          {currentMonthly > 0 && cheapest && (
            <p className="notice">
              Heute zahlen Sie {formatChf(currentMonthly)} pro Monat. Mit {cheapest.insurerName} wären es {formatChf(cheapest.monthlyTotal)}:
              {' '}
              <strong>{formatChf((currentMonthly - cheapest.monthlyTotal) * 12)} pro Jahr</strong>
              {currentMonthly - cheapest.monthlyTotal > 0 ? ' weniger.' : '.'}
              {' '}Kündigung bis 30. November (Eingang beim Versicherer).
            </p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Krankenkasse</th>
                  <th>Tarif je Person</th>
                  <th className="num">CHF / Monat</th>
                  <th className="num">CHF / Jahr</th>
                  {currentMonthly > 0 && <th className="num">Ersparnis / Jahr</th>}
                </tr>
              </thead>
              <tbody>
                {quotes.slice(0, 15).map((q, i) => (
                  <tr key={q.insurerId}>
                    <td>{i + 1}</td>
                    <td><strong>{q.insurerName}</strong></td>
                    <td className="small">
                      {q.perPerson.map((pp, j) => (
                        <div key={j}>
                          {settings.persons[j] && AGE_CLASS_LABEL[ageClass(settings.persons[j].birthYear, year)]}: {pp.tariffName || MODEL_LABEL[pp.model]} ({formatChf(pp.premium)})
                        </div>
                      ))}
                    </td>
                    <td className="num">{q.monthlyTotal.toFixed(2)}</td>
                    <td className="num">{(q.monthlyTotal * 12).toFixed(2)}</td>
                    {currentMonthly > 0 && (
                      <td className="num">
                        <span className={currentMonthly > q.monthlyTotal ? 'pos' : 'neg'}>{formatChf((currentMonthly - q.monthlyTotal) * 12)}</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Quelle: offizielle Prämien {year} des BAG. Franchisen werden an die Altersklasse angepasst
            {settings.persons.some((p) => normalizeFranchise(ageClass(p.birthYear, year), p.franchise) !== p.franchise) && ' (bei mindestens einer Person geändert)'}.
            Prüfen Sie das Resultat vor dem Wechsel auf <a href="https://www.priminfo.admin.ch" target="_blank" rel="noreferrer">priminfo.admin.ch</a>.
            {current.length === 0 && <> Erfassen Sie Ihre heutige Kasse unter <Link href="/vertraege/neu">Vertrag erfassen</Link>, um die Ersparnis zu sehen.</>}
          </p>
        </>
      )}
    </>
  );
}
