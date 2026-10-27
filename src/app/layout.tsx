import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SideNav, TabBar, type NavItem } from '@/components/Nav';
import { currentUser } from '@/lib/auth';
import { isAdmin } from '@/lib/context';
import { logout } from './actions';
import './globals.css';

export const metadata: Metadata = {
  title: 'Abo-Pilot',
  description: 'Verträge im Griff, Fristen nie verpassen, neutral wechseln.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f4' },
    { media: '(prefers-color-scheme: dark)', color: '#111113' },
  ],
};

const MAIN: NavItem[] = [
  { href: '/dashboard', label: 'Übersicht', icon: 'home' },
  { href: '/vertraege/neu', label: 'Vertrag prüfen', short: 'Prüfen', icon: 'plus' },
  { href: '/krankenkasse', label: 'Krankenkasse', short: 'Kasse', icon: 'heart' },
  { href: '/praemien', label: 'Prämien', icon: 'gift' },
];
const ACCOUNT: NavItem[] = [
  { href: '/start', label: 'Profil', icon: 'sliders' },
  { href: '/konto', label: 'Konto & Daten', short: 'Konto', icon: 'user' },
];
const TEAM: NavItem[] = [
  { href: '/admin/angebote', label: 'Angebote prüfen', icon: 'tag' },
  { href: '/admin/quellen', label: 'Quellen', icon: 'search' },
  { href: '/admin/daten', label: 'Offizielle Daten', icon: 'database' },
  { href: '/admin/adressen', label: 'Kündigungsadressen', icon: 'mail' },
  { href: '/admin/postausgang', label: 'Postausgang', icon: 'sliders' },
];

function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="brand">
      <span className="brand-mark" aria-hidden="true" />
      Abo-Pilot
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="de-CH">
      <body>
        {user ? (
          <div className="shell">
            <aside className="sidebar">
              <Brand href="/dashboard" />
              <SideNav items={MAIN} />
              <div className="nav-section">Ich</div>
              <SideNav items={ACCOUNT} />
              {isAdmin(user) && (
                <>
                  <div className="nav-section">Team</div>
                  <SideNav items={TEAM} />
                </>
              )}
              <div className="spacer" />
              <form action={logout}>
                <button type="submit" className="nav-link">
                  <Icon name="logout" />
                  Abmelden
                </button>
              </form>
              <div className="trust">
                <Icon name="shield" />
                Daten in der Schweiz
              </div>
            </aside>
            <div className="content">
              <header className="topbar">
                <Brand href="/dashboard" />
                <Link href="/start" className="button secondary" aria-label="Profil">
                  <Icon name="sliders" />
                </Link>
              </header>
              <main>{children}</main>
              <TabBar items={[...MAIN, ACCOUNT[1]]} />
            </div>
          </div>
        ) : (
          <>
            <header className="public-top">
              <Brand href="/" />
              <Link href="/datenschutz">Datenschutz</Link>
              <Link href="/agb">Nutzungsbedingungen</Link>
            </header>
            <main>{children}</main>
          </>
        )}
      </body>
    </html>
  );
}
