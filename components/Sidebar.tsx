'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useSettings } from './SettingsProvider';
import { useSidebar } from './SidebarContext';
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
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group?: 'main' | 'research';
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { href: '/tree', label: 'Family Tree', icon: TreeDeciduous, group: 'main' },
  { href: '/people', label: 'People', icon: Users, group: 'main' },
  { href: '/timeline', label: 'Timeline', icon: Calendar, group: 'main' },
  { href: '/research', label: 'Research Queue', icon: ClipboardList, group: 'research' },
  { href: '/coats-of-arms', label: 'Coats of Arms', icon: Shield, group: 'research' },
  { href: '/search', label: 'Search', icon: Search, group: 'research' },
];

interface TooltipProps {
  children: React.ReactNode;
  label: string;
  show: boolean;
}

function Tooltip({ children, label, show }: TooltipProps) {
  if (!show) return <>{children}</>;

  return (
    <div className="relative group">
      {children}
      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded
                      opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap
                      transition-opacity duration-200 z-50 top-1/2 -translate-y-1/2">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const settings = useSettings();
  const { isCollapsed, toggleCollapse } = useSidebar();
  const isAdmin = session?.user?.role === 'admin';

  // Don't show sidebar on login page or when not authenticated
  if (pathname === '/login' || status === 'unauthenticated') {
    return null;
  }

  const isLoading = status === 'loading';
  const mainItems = navItems.filter(item => item.group === 'main');
  const researchItems = navItems.filter(item => item.group === 'research');

  return (
    <nav className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Header */}
      <div className={`sidebar-header ${isCollapsed ? 'px-4' : ''}`}>
        <div className={`logo ${isCollapsed ? 'w-10 h-10' : ''}`}>
          {settings.logo_url ? (
            <Image src={settings.logo_url} alt="Logo" width={32} height={32} className="w-8 h-8 object-contain" unoptimized />
          ) : (
            <TreeDeciduous className={`text-green-400 ${isCollapsed ? 'w-6 h-6' : 'w-8 h-8'}`} />
          )}
        </div>
        {!isCollapsed && (
          <>
            <h3 className="text-xl font-semibold mt-3">{settings.family_name}</h3>
            <p className="text-sm text-gray-400">{settings.site_tagline}</p>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className={`flex-1 py-4 ${isCollapsed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {/* Main section */}
        {!isCollapsed && (
          <div className="px-4 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Main</span>
          </div>
        )}
        <ul className="nav-links">
          {mainItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Tooltip label={item.label} show={isCollapsed}>
                  <Link
                    href={item.href}
                    className={`nav-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                </Tooltip>
              </li>
            );
          })}
        </ul>

        {/* Research section */}
        {!isCollapsed && (
          <div className="px-4 mt-6 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Research</span>
          </div>
        )}
        {isCollapsed && <div className="my-4 mx-4 border-t border-white/10" />}
        <ul className="nav-links">
          {researchItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Tooltip label={item.label} show={isCollapsed}>
                  <Link
                    href={item.href}
                    className={`nav-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                </Tooltip>
              </li>
            );
          })}
          {(isAdmin || isLoading) && (
            <li>
              <Tooltip label="Admin" show={isCollapsed}>
                <Link
                  href="/admin"
                  className={`nav-link ${pathname === '/admin' ? 'active' : ''} ${isLoading ? 'opacity-50' : ''} ${isCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Settings className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                  {!isCollapsed && <span>Admin</span>}
                </Link>
              </Tooltip>
            </li>
          )}
        </ul>
      </div>

      {/* Collapse toggle */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded-full text-white shadow-md z-10"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </Button>

      {/* User section */}
      <div className={`border-t border-white/10 ${isCollapsed ? 'p-3' : 'p-6'}`}>
        {isLoading ? (
          <div className="animate-pulse">
            <div className={`h-4 bg-gray-700 rounded ${isCollapsed ? 'w-8' : 'w-24'} mb-2`}></div>
            {!isCollapsed && <div className="h-3 bg-gray-700 rounded w-32"></div>}
          </div>
        ) : session?.user && (
          <div className={isCollapsed ? 'flex flex-col items-center' : ''}>
            {/* User avatar */}
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} mb-2`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600
                            flex items-center justify-center text-white text-sm font-semibold">
                {session.user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">{session.user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <p className="text-xs text-gray-600 capitalize mb-2">{session.user.role}</p>
            )}
            <Tooltip label="Sign Out" show={isCollapsed}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className={`text-xs text-red-400 hover:text-red-300 ${isCollapsed ? 'p-2' : ''}`}
                icon={<LogOut className="w-3.5 h-3.5" />}
              >
                {!isCollapsed && 'Sign Out'}
              </Button>
            </Tooltip>
          </div>
        )}
      </div>
    </nav>
  );
}

