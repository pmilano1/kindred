'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useSettings } from './SettingsProvider';
import {
  LayoutDashboard,
  TreeDeciduous,
  Users,
  ClipboardList,
  Calendar,
  Shield,
  Search,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tree', label: 'Family Tree', icon: TreeDeciduous },
  { href: '/people', label: 'People', icon: Users },
  { href: '/research', label: 'Research Queue', icon: ClipboardList },
  { href: '/timeline', label: 'Timeline', icon: Calendar },
  { href: '/coats-of-arms', label: 'Coats of Arms', icon: Shield },
  { href: '/search', label: 'Search', icon: Search },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const settings = useSettings();
  const isAdmin = session?.user?.role === 'admin';

  // Don't show sidebar on login page or when not authenticated
  if (pathname === '/login' || status === 'unauthenticated') {
    return null;
  }

  // Always render consistent structure - just show loading state for user info
  const isLoading = status === 'loading';

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          {settings.logo_url ? (
            <Image src={settings.logo_url} alt="Logo" width={32} height={32} className="w-8 h-8 object-contain" unoptimized />
          ) : (
            <TreeDeciduous className="w-8 h-8 text-green-400" />
          )}
        </div>
        <h3 className="text-xl font-semibold">{settings.family_name}</h3>
        <p className="text-sm text-gray-400">{settings.site_tagline}</p>
      </div>
      <ul className="nav-links">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`nav-link ${pathname === item.href ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
        {(isAdmin || isLoading) && (
          <li>
            <Link
              href="/admin"
              className={`nav-link ${pathname === '/admin' ? 'active' : ''} ${isLoading ? 'opacity-50' : ''}`}
            >
              <Settings className="w-5 h-5 mr-3 flex-shrink-0" />
              Admin
            </Link>
          </li>
        )}
      </ul>
      <div className="p-6 border-t border-white/10">
        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-32"></div>
          </div>
        ) : session?.user && (
          <div>
            <p className="text-sm text-gray-300 truncate">{session.user.name}</p>
            <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
            <p className="text-xs text-gray-600 capitalize mt-1">{session.user.role}</p>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-2 text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

