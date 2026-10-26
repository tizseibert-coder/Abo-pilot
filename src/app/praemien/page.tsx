import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatChf } from '@/lib/benefit';
import { formatCH, today } from '@/lib/dates';
import { buildBonusComplaint } from '@/lib/letter';
import { listContracts, listSwitches } from '@/lib/repo';
import { updateSwitch } from '../actions';

export const dynamic = 'force-dynamic';

const STATUSES = ['erwartet', 'erhalten', 'reklamiert', 'verfallen'] as const;

export default async function Bonuses() {
  const user = await requireUser();
  const switches = listSwitches(user.id);
  const contracts = new Map(listContracts(user.id).map((c) => [c.id, c]));
  const todayISO = today();
  const open = switches.filter((s) => s.status === 'erwartet').reduce((sum, s) => sum + s.expected_bonus, 0);

  return (
    <>
      <h1>Prämien-Tracker</h1>
      <p className="lead">Offene Prämien: <strong>{formatChf(open)}</strong>. Prämien zahlen sich erst aus, wenn sie ankommen.</p>
      {switches.length === 0 ? (
        <div className="card">
          <p>Noch keine Wechsel vorgemerkt. Öffnen Sie einen Vertrag in der <Link href="/dashboard">Übersicht</Link> und merken Sie ein Angebot vor.</p>
        </div>
      ) : (
        <div className="grid">
          {switches.map((s) => {
            const old = s.contract_id ? contracts.get(s.contract_id) : undefined;
            const overdue = s.status === 'erwartet' && s.expected_by !== null && s.expected_by < todayISO && s.expected_bonus > 0;
            return (
              <section key={s.id} className="card">
                <div className="actions" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{s.new_provider}</strong>
                    {old && <span className="muted"> statt {old.provider}</span>}
                    <div className="small muted">
                      Prämie {formatChf(s.expected_bonus)} · erwartet bis {formatCH(s.expected_by)} · vorgemerkt am {formatCH(s.created_at.slice(0, 10))}
                    </div>
                    {s.expected_bonus === 0 && <div className="small muted">Keine Prämie: Neukunden-Sperrfrist nicht erfüllt.</div>}
                  </div>
                  <form action={updateSwitch.bind(null, s.id)} className="actions">
                    <select name="status" defaultValue={s.status} aria-label="Status">
                      {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                    <button type="submit" className="secondary">Speichern</button>
                  </form>
                </div>
                {overdue && (
                  <details style={{ marginTop: 12 }}>
                    <summary className="error">Prämie überfällig – Reklamationsvorlage</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                      {buildBonusComplaint(s.new_provider, s.expected_bonus, formatCH(s.created_at.slice(0, 10)), '', user.name)}
                    </pre>
                  </details>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
