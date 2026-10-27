import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/ConfirmSubmit';
import { requireUser } from '@/lib/auth';
import { addDays, formatCH, parseISO, toISO, today } from '@/lib/dates';
import { getHealthSettings } from '@/lib/kk/repo';
import { getOffer } from '@/lib/offers';
import { Icon } from '@/components/Icon';
import { buildCancellationLetter } from '@/lib/letter';
import { viewContract } from '@/lib/overview';
import { getContract } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function CancellationLetter({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ wechsel?: string; neu?: string; praemie?: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const contract = Number.isInteger(id) ? getContract(user.id, id) : undefined;
  if (!contract) notFound();
  const todayISO = today();
  const { deadline } = viewContract(contract, [], todayISO);
  const sp = await searchParams;
  const letter = buildCancellationLetter(user, contract, deadline, todayISO, getHealthSettings(user.id).persons.map((p) => p.birthYear));
  const offer = sp.wechsel && sp.wechsel !== 'kk' ? getOffer(sp.wechsel) : undefined;
  const isKk = sp.wechsel === 'kk';
  const startNew = toISO(addDays(parseISO(deadline.endDate), 1));
  const missingProfile = !user.name || !user.street || !user.zip_city;

  return (
    <>
      <div className="no-print">
        <Link href={`/vertraege/${contract.id}`} className="back"><Icon name="arrowLeft" /> {contract.provider}</Link>
        {(offer || isKk) && (
          <section className="card" style={{ marginBottom: 20 }}>
            <p className="notice good" style={{ marginTop: 0 }}>
              <strong>Wechsel gestartet.</strong> {contract.provider} ist als gekündigt per {formatCH(deadline.endDate)} vermerkt
              {offer ? ', die Prämie wird im Tracker überwacht.' : '.'}
            </p>
            <ul className="checks">
              <li className="warn">
                <span className="mark"><Icon name="mail" /></span>
                <div>
                  <strong>1. Kündigung unterschreiben und senden</strong>
                  <span className="txt">
                    Muss bis {formatCH(deadline.deadline)} bei {contract.provider} eintreffen.{' '}
                    <Link href={`/vertraege/${contract.id}/versand`}>Digital unterschreiben und senden lassen</Link> oder den Brief unten drucken.
                  </span>
                </div>
              </li>
              {offer && (
                <li className="info">
                  <span className="mark"><Icon name="arrowRight" /></span>
                  <div>
                    <strong>2. Neues Abo bei {offer.provider} abschliessen</strong>
                    <span className="txt">
                      Startdatum {formatCH(startNew)} angeben. <a href={offer.sourceUrl} target="_blank" rel="noreferrer">Zum Angebot</a>
                    </span>
                  </div>
                </li>
              )}
              {isKk && (
                <li className="info">
                  <span className="mark"><Icon name="heart" /></span>
                  <div>
                    <strong>2. Bei {sp.neu} die Grundversicherung ab {formatCH(startNew)} beantragen</strong>
                    <span className="txt">
                      Die Aufnahme ist gesetzlich garantiert (Art. 4 KVG){sp.praemie ? `, Prämie CHF ${sp.praemie} pro Monat` : ''}. Die neue Kasse meldet der
                      alten Kasse die Aufnahme – erst dann endet die alte Versicherung.
                    </span>
                  </div>
                </li>
              )}
              <li className="ok">
                <span className="mark"><Icon name="check" /></span>
                <div>
                  <strong>3. Fertig – den Rest überwachen wir</strong>
                  <span className="txt"><Link href="/praemien">Wechsel und Prämien ansehen</Link></span>
                </div>
              </li>
            </ul>
          </section>
        )}
        <h1>Kündigungsbrief</h1>
        <p className="lead">
          Eingang beim Anbieter spätestens am <strong>{formatCH(deadline.deadline)}</strong>. Unterschreiben Sie den Brief
          von Hand und senden Sie ihn eingeschrieben, oder signieren Sie ihn qualifiziert elektronisch (z. B. mit Skribble).
        </p>
        {missingProfile && (
          <p className="notice small">
            Absender unvollständig. Ergänzen Sie Name und Adresse unter <Link href="/konto">Konto</Link>.
          </p>
        )}
        <p className="notice small">
          Bitte die Empfängeradresse aus Vertrag oder Rechnung übernehmen. Manche Anbieter akzeptieren Kündigungen auch
          über das Kundenkonto oder ein Online-Formular; prüfen Sie die AGB.
        </p>
        <div className="actions" style={{ margin: '16px 0' }}>
          <PrintButton />
        </div>
      </div>
      <article className="letter">
        <div className="addr">{letter.sender.join('\n')}</div>
        <div className="addr">{letter.recipient.join('\n')}</div>
        <div>{letter.place}</div>
        <div className="subject">{letter.subject}</div>
        {letter.insuredLines.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p>Versicherte Personen:</p>
            {letter.insuredLines.map((l, i) => <p key={i} style={{ margin: '4px 0', fontSize: '0.92em' }}>{l}</p>)}
          </div>
        )}
        {letter.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <div className="sign">
          <div>______________________________</div>
          <div>{letter.signatureName}</div>
        </div>
      </article>
    </>
  );
}
