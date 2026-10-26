import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { isAdmin } from '@/lib/context';
import { logout } from './actions';
import './globals.css';

export const metadata: Metadata = {
  title: 'Abo-Pilot',
  description: 'Verträge im Griff, Fristen nie verpassen, neutral wechseln.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="de-CH">
      <body>
        <header className="top">
          <nav>
            <Link href={user ? '/dashboard' : '/'} className="brand">
              Abo<span>-</span>Pilot
            </Link>
            {user ? (
              <>
                <Link href="/dashboard">Übersicht</Link>
                <Link href="/vertraege/neu">Vertrag erfassen</Link>
                <Link href="/praemien">Prämien</Link>
                <Link href="/start">Profil</Link>
                {isAdmin(user) && <Link href="/admin/angebote">Angebote</Link>}
                <Link href="/konto">Konto</Link>
                <form action={logout} className="inline-form">
                  <button className="link" type="submit">Abmelden</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/datenschutz">Datenschutz</Link>
                <Link href="/agb">Nutzungsbedingungen</Link>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
