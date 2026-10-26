import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/ConfirmSubmit';
import { requireUser } from '@/lib/auth';
import { formatCH, today } from '@/lib/dates';
import { buildCancellationLetter } from '@/lib/letter';
import { viewContract } from '@/lib/overview';
import { getContract } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function CancellationLetter({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const contract = Number.isInteger(id) ? getContract(user.id, id) : undefined;
  if (!contract) notFound();
  const todayISO = today();
  const { deadline } = viewContract(contract, [], todayISO);
  const letter = buildCancellationLetter(user, contract, deadline, todayISO);
  const missingProfile = !user.name || !user.street || !user.zip_city;

  return (
    <>
      <div className="no-print">
        <p className="small"><Link href={`/vertraege/${contract.id}`}>← zurück</Link></p>
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
