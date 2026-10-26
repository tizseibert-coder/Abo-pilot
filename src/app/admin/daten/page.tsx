import { redirect } from 'next/navigation';
import { DataImportForm } from '@/components/DataImportForm';
import { requireUser } from '@/lib/auth';
import { isAdmin } from '@/lib/context';
import { formatCH } from '@/lib/dates';
import { lastImports, premiumYears } from '@/lib/kk/repo';

export const dynamic = 'force-dynamic';

export default async function DataAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) redirect('/dashboard');
  const years = premiumYears();
  const imports = lastImports();
  return (
    <>
      <h1>Offizielle Daten</h1>
      <p className="lead">
        Krankenkassenprämien stammen vollständig aus den offenen Daten des Bundesamts für Gesundheit (BAG). Das BAG
        publiziert die Prämien des Folgejahrs jeweils Ende September.
      </p>
      <p className="notice small">
        Bezugsquelle: Datensatz «Krankenversicherungsprämien» des BAG auf opendata.swiss bzw. der Prämienrechner
        priminfo.admin.ch (Datendownload). Benötigt werden die Prämientabelle (CSV) und die Liste der Prämienregionen
        (PLZ → Kanton → Region). Die Spaltennamen werden automatisch erkannt; nach dem Import Stichproben mit priminfo
        vergleichen.
      </p>
      <p>Vorhandene Prämienjahre: <strong>{years.length ? years.join(', ') : 'keine'}</strong></p>

      <div className="grid cols-2">
        <section className="card">
          <DataImportForm kind="praemien" title="Prämientabelle" hint="Ersetzt alle Prämien der Jahre, die in der Datei vorkommen." />
        </section>
        <section className="card">
          <DataImportForm kind="regionen" title="Prämienregionen (PLZ)" hint="Ersetzt die ganze Zuordnung PLZ → Kanton → Region." />
        </section>
      </div>

      <h2>Letzte Importe</h2>
      {imports.length === 0 ? (
        <p className="muted">Noch keine.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Datum</th><th>Art</th><th className="num">Zeilen</th><th>Quelle</th><th>Notiz</th></tr></thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.imported_at + i.kind}>
                  <td>{formatCH(i.imported_at.slice(0, 10))}</td>
                  <td>{i.kind}</td>
                  <td className="num">{i.rows.toLocaleString('de-CH')}</td>
                  <td className="small">{i.source}</td>
                  <td className="small">{i.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
