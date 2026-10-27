'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** kurze Beschriftung für die mobile Tab-Leiste */
  short?: string;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard' || (pathname.startsWith('/vertraege/') && pathname !== '/vertraege/neu');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="nav-link" aria-current={isActive(pathname, i.href) ? 'page' : undefined}>
          <Icon name={i.icon} />
          {i.label}
        </Link>
      ))}
    </>
  );
}

export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(pathname, i.href) ? 'page' : undefined}>
          <Icon name={i.icon} />
          {i.short ?? i.label}
        </Link>
      ))}
    </nav>
  );
}
