'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Breadcrumb {
  label: string;
  href?: string;
}

const pathLabels: Record<string, string> = {
  admin: 'Admin',
  users: 'Users',
  'api-keys': 'API Keys',
  settings: 'Settings',
  branding: 'Branding',
  privacy: 'Privacy',
  display: 'Display',
  integrations: 'Integrations',
  email: 'Email',
  storage: 'Storage',
  data: 'Data Management',
  'import-export': 'Import/Export',
  database: 'Database',
  system: 'System',
  logs: 'Logs',
  errors: 'Client Errors',
};

// Paths that don't have their own pages (only serve as parent segments)
const nonLinkablePaths = new Set([
  'data',
  'integrations',
  'system',
  'settings',
]);

export function AdminBreadcrumbs() {
  const pathname = usePathname();

  const segments = pathname.split('/').filter(Boolean);

  const breadcrumbs: Breadcrumb[] = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const label = pathLabels[segment] || segment;

    // Last segment shouldn't be a link, and neither should non-linkable paths
    const isLinkable =
      index !== segments.length - 1 && !nonLinkablePaths.has(segment);

    return {
      label,
      href: isLinkable ? href : undefined,
    };
  });

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
      {breadcrumbs.map((crumb) => (
        <div key={crumb.href || crumb.label} className="flex items-center">
          {crumb.href && (
            <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
          )}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="hover:text-gray-900 transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-gray-900">{crumb.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
