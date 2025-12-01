'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/tree', label: 'Family Tree', icon: '🌳' },
  { href: '/people', label: 'People', icon: '👥' },
  { href: '/timeline', label: 'Timeline', icon: '📅' },
  { href: '/search', label: 'Search', icon: '🔍' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="logo">🌳</div>
        <h3 className="text-xl font-semibold">Milanese Family</h3>
        <p className="text-sm text-gray-400">Genealogy Database</p>
      </div>
      <ul className="nav-links">
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`nav-link ${pathname === item.href ? 'active' : ''}`}
            >
              <span className="mr-3">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="p-6 border-t border-white/10">
        <p className="text-xs text-gray-500 text-center">
          Data from FamilySearch
        </p>
      </div>
    </nav>
  );
}

