'use client';

import {
  Database,
  FileText,
  Home,
  Key,
  Mail,
  Package,
  Settings,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: Home }],
  },
  {
    title: 'Users & Access',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/users/api-keys', label: 'API Keys', icon: Key },
    ],
  },
  {
    title: 'Site Settings',
    items: [
      { href: '/admin/settings/branding', label: 'Branding', icon: Settings },
      { href: '/admin/settings/privacy', label: 'Privacy', icon: Settings },
      { href: '/admin/settings/display', label: 'Display', icon: Settings },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { href: '/admin/integrations/email', label: 'Email', icon: Mail },
      { href: '/admin/integrations/storage', label: 'Storage', icon: Package },
    ],
  },
  {
    title: 'Data Management',
    items: [
      {
        href: '/admin/data/import-export',
        label: 'Import/Export',
        icon: Upload,
      },
      { href: '/admin/data/database', label: 'Database', icon: Database },
    ],
  },
  {
    title: 'System',
    items: [{ href: '/admin/system/logs', label: 'Logs', icon: FileText }],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your site</p>
      </div>

      <nav className="px-3 pb-6">
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        active
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 mr-3 ${active ? 'text-blue-700' : 'text-gray-400'}`}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
