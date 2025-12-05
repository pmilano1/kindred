'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/tree', label: 'Family Tree', icon: '🌳' },
  { href: '/people', label: 'People', icon: '👥' },
  { href: '/research', label: 'Research Queue', icon: '📋' },
  { href: '/timeline', label: 'Timeline', icon: '📅' },
  { href: '/search', label: 'Search', icon: '🔍' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

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
        {isAdmin && (
          <li>
            <Link
              href="/admin"
              className={`nav-link ${pathname === '/admin' ? 'active' : ''}`}
            >
              <span className="mr-3">⚙️</span>
              Admin
            </Link>
          </li>
        )}
      </ul>
      <div className="p-6 border-t border-white/10">
        {session?.user && (
          <div>
            <p className="text-sm text-gray-300 truncate">{session.user.name}</p>
            <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
            <p className="text-xs text-gray-600 capitalize mt-1">{session.user.role}</p>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-2 text-xs text-red-400 hover:text-red-300"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

