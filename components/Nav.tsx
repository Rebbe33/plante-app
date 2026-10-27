'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: "Aujourd'hui", icon: '🌿' },
  { href: '/plantes', label: 'Plantes', icon: '🪴' },
  { href: '/souhaits', label: 'Souhaits', icon: '💚' },
  { href: '/bilan', label: 'Bilan', icon: '📊' },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((i) => {
        const active = i.href === '/' ? path === '/' : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={active ? 'active' : ''}>
            <span>{i.icon}</span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
