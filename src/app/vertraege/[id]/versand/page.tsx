import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DispatchForm } from '@/components/DispatchForm';
import { Icon } from '@/components/Icon';
import { requireUser } from '@/lib/auth';
import { formatCH, today } from '@/lib/dates';
import { findDirectory } from '@/lib/dispatch/directory';
import { getDispatch, listDispatches, refreshDispatch, STATUS_LABEL, type Dispatch } from '@/lib/dispatch/flow';
import { isTestMode } from '@/lib/dispatch/providers';
import { viewContract } from '@/lib/overview';
import { getContract } from '@/lib/repo';
import { sendDispatchNow, startDispatch } from '../../../actions';

export const dynamic = 'force-dynamic';

function Steps({ d }: { d: Dispatch | undefined }) {
  const step = !d ? 1 : d.status === 'zur_signatur' ? 2 : d.status === 'signiert' ? 3 : d.status === 'versendet' ? 4 : 2;
  const items = ['Empfänger prüfen', 'Unterschreiben (QES)', 'Senden', 'Erledigt'];
  return (
    <ol className="progress">
      {items.map((t, i) => (
        <li key={t} className={i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''}>
          <span>{i + 1 < step ? <Icon name="check" /> : i + 1}</span>
          {t}
        </li>
      ))}
    </ol>
  );
}

export default async function DigitalCancellation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string; gesendet?: string; fehler?: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  const sp = await searchParams;
  const contract = Number.isInteger(id) ? getContract(user.id, id) : undefined;
  if (!contract) notFound();

  let current = sp.d ? getDispatch(user.id, Number(sp.d)) : undefined;
  if (current?.contract_id !== contract.id) current = undefined;
  if (current) current = await refreshDispatch(current).catch(() => current);
  const history = listDispatches(user.id, contract.id).filter((d) => d.id !== current?.id);
  const { deadline } = viewContract(contract, [], today());
  const dir = findDirectory(contract.provider, contract.category);
  const missingProfile = !user.name || !user.street || !user.zip_city;

  return (
    <>
      <Link href={`/vertraege/${contract.id}`} className="back"><Icon name="arrowLeft" /> {contract.provider}</Link>
      <div className="page-head">
        <div>
          <h1>Digital kündigen</h1>
          <p>Unterschreiben am Handy, wir übermitteln. Muss bis {formatCH(deadline.deadline)} bei {contract.provider} eintreffen.</p>
        </div>
      </div>
      <Steps d={current} />

      {sp.gesendet && current?.status === 'versendet' && (
        <p className="notice good">
          <strong>Versendet.</strong> {current.recipient_email && `Original per E-Mail an ${current.recipient_email}, Kopie an Sie. `}
          {current.with_post ? 'Eingeschriebene Kopie ist unterwegs. ' : ''}Bitte achten Sie auf die Bestätigung von {contract.provider}.
        </p>
      )}
      {sp.fehler && <p className="notice error">Der Versand ist fehlgeschlagen. Details im Verlauf unten – bitte erneut versuchen oder den Brief selbst senden.</p>}

      {!current || current.status === 'abgelehnt' || current.status === 'fehler' ? (
        <section className="card">
          {missingProfile && (
            <p className="notice small" style={{ marginTop: 0 }}>
              Zuerst Ihren Namen und Ihre Adresse unter <Link href="/konto">Konto</Link> ergänzen – sie gehören in die Kündigung.
            </p>
          )}
          <DispatchForm
            action={startDispatch.bind(null, contract.id)}
            provider={contract.provider}
            testMode={isTestMode()}
            defaults={{ name: contract.provider, address: dir?.postal_address ?? '', email: dir?.cancel_email ?? '' }}
          />
          {dir ? (
            <p className="hint" style={{ marginBottom: 0 }}>
              Adresse aus unserem Verzeichnis, geprüft am {formatCH(dir.checked_at)} (<a href={dir.source_url} target="_blank" rel="noreferrer">Quelle</a>). Bitte mit Ihrer Rechnung abgleichen.
            </p>
          ) : (
            <p className="hint" style={{ marginBottom: 0 }}>Die Kündigungsadresse steht meist auf der Rechnung, in den AGB oder im Kundenkonto.</p>
          )}
        </section>
      ) : current.status === 'zur_signatur' ? (
        <section className="card">
          <h3>Unterschrift ausstehend</h3>
          <p className="muted">Öffnen Sie den Signatur-Link und unterschreiben Sie. Danach kommen Sie hierher zurück.</p>
          <div className="actions">
            {current.signing_url && <a className="button lg" href={current.signing_url}><Icon name="lock" /> Jetzt unterschreiben</a>}
            <Link className="button secondary" href={`/vertraege/${contract.id}/versand?d=${current.id}`}>Status aktualisieren</Link>
          </div>
        </section>
      ) : current.status === 'signiert' ? (
        <section className="card">
          <h3>Unterschrieben – bereit zum Senden</h3>
          <ul className="checks" style={{ margin: '12px 0 16px' }}>
            {current.recipient_email && (
              <li className="ok"><span className="mark"><Icon name="mail" /></span><div><strong>Original per E-Mail</strong><span className="txt">an {current.recipient_email}, Kopie an {user.email}</span></div></li>
            )}
            {current.with_post === 1 && (
              <li className="ok"><span className="mark"><Icon name="mail" /></span><div><strong>Eingeschriebene Kopie per Post</strong><span className="txt">{current.recipient_address.replace(/\n/g, ', ')}</span></div></li>
            )}
          </ul>
          <div className="actions">
            <form action={sendDispatchNow.bind(null, current.id)} className="inline-form">
              <button type="submit" className="good lg"><Icon name="arrowRight" /> Jetzt senden</button>
            </form>
            <a className="button secondary" href={`/api/dispatch/${current.id}?signiert=1`}>Signiertes PDF ansehen</a>
          </div>
        </section>
      ) : (
        <section className="card">
          <h3>Erledigt</h3>
          <p className="muted">Vertrag als gekündigt per {formatCH(deadline.endDate)} vermerkt. Bewahren Sie die Bestätigung des Anbieters auf.</p>
          <div className="actions">
            <a className="button secondary" href={`/api/dispatch/${current.id}?signiert=1`}>Signiertes PDF</a>
            <Link className="button" href="/dashboard">Zur Übersicht</Link>
          </div>
        </section>
      )}

      {current && (
        <details style={{ marginTop: 16 }} open={Boolean(sp.fehler)}>
          <summary className="muted small">Verlauf · {STATUS_LABEL[current.status]}</summary>
          <pre className="small" style={{ whiteSpace: 'pre-wrap' }}>{current.log}</pre>
        </details>
      )}

      {history.length > 0 && (
        <>
          <h2>Frühere Versuche</h2>
          <div className="list">
            {history.map((d) => (
              <Link key={d.id} href={`/vertraege/${contract.id}/versand?d=${d.id}`} className="list-row">
                <Icon name="mail" />
                <div>
                  <div className="title">{formatCH(d.created_at.slice(0, 10))}</div>
                  <div className="meta">{STATUS_LABEL[d.status]}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="free-note" style={{ marginTop: 24 }}>
        <Icon name="shield" />
        <span>
          Rechtlich: Die qualifizierte elektronische Signatur ist der eigenhändigen Unterschrift gleichgestellt (Art. 14 Abs. 2bis OR).
          Gültig ist das per E-Mail zugestellte PDF-Original; die Post-Kopie dient als Zustellnachweis. Wir übermitteln nur, was Sie
          unterschrieben und freigegeben haben.
        </span>
      </p>
    </>
  );
}
