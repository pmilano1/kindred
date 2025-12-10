'use client';

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Database, Mail, Package, Users } from 'lucide-react';
import Link from 'next/link';
import { GET_USERS } from '@/lib/graphql/queries';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  last_accessed: string | null;
}

interface Setting {
  key: string;
  value: string;
}

const GET_ADMIN_SETTINGS = gql`
  query GetAdminSettings {
    settings {
      key
      value
    }
    migrationStatus {
      migrationNeeded
    }
  }
`;

export default function AdminDashboard() {
  const { data: usersData } = useQuery<{ users: User[] }>(GET_USERS);
  const { data: settingsData } = useQuery<{
    settings: Setting[];
    migrationStatus: { migrationNeeded: boolean };
  }>(GET_ADMIN_SETTINGS);

  const users = usersData?.users || [];
  const settings = settingsData?.settings || [];
  const migrationNeeded =
    settingsData?.migrationStatus?.migrationNeeded ?? false;

  // Get email provider setting
  const emailProvider =
    settings.find((s) => s.key === 'email_provider')?.value || 'none';
  const emailStatus =
    emailProvider === 'none'
      ? 'Not Set'
      : emailProvider === 'ses'
        ? 'AWS SES'
        : 'SMTP';

  // Get storage provider setting
  const storageProvider =
    settings.find((s) => s.key === 'storage_provider')?.value || 'local';
  const storageStatus =
    storageProvider === 'local'
      ? 'Local'
      : storageProvider === 's3'
        ? 'AWS S3'
        : 'Local';

  // Database status
  const dbStatus = migrationNeeded ? 'Needs Migration' : 'Up to Date';

  const stats = [
    {
      label: 'Total Users',
      value: users.length,
      icon: Users,
      href: '/admin/users',
      color: 'blue',
    },
    {
      label: 'Email Config',
      value: emailStatus,
      icon: Mail,
      href: '/admin/integrations/email',
      color: emailProvider === 'none' ? 'yellow' : 'green',
    },
    {
      label: 'Storage',
      value: storageStatus,
      icon: Package,
      href: '/admin/integrations/storage',
      color: 'green',
    },
    {
      label: 'Database',
      value: dbStatus,
      icon: Database,
      href: '/admin/data/database',
      color: migrationNeeded ? 'yellow' : 'purple',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage your genealogy site settings and users
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className={`p-6 rounded-xl border-2 transition-all hover:shadow-lg ${colorClasses[stat.color as keyof typeof colorClasses]}`}
            >
              <div className="flex items-center justify-between mb-4">
                <Icon className="w-8 h-8" />
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm font-medium">{stat.label}</div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/admin/users"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium mb-1">Manage Users</h3>
            <p className="text-sm text-gray-600">
              Add, remove, or modify user accounts and permissions
            </p>
          </Link>
          <Link
            href="/admin/settings/branding"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium mb-1">Site Branding</h3>
            <p className="text-sm text-gray-600">
              Customize your site name, logo, and theme colors
            </p>
          </Link>
          <Link
            href="/admin/data/import-export"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium mb-1">Import/Export Data</h3>
            <p className="text-sm text-gray-600">
              Backup or restore your genealogy data in GEDCOM format
            </p>
          </Link>
          <Link
            href="/admin/integrations/email"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium mb-1">Email Setup</h3>
            <p className="text-sm text-gray-600">
              Configure email provider for invitations and notifications
            </p>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Recent User Activity</h2>
        {users.length === 0 ? (
          <p className="text-gray-500">No users yet</p>
        ) : (
          <div className="space-y-3">
            {users
              .filter((u) => u.last_accessed)
              .sort(
                (a, b) =>
                  new Date(b.last_accessed || 0).getTime() -
                  new Date(a.last_accessed || 0).getTime(),
              )
              .slice(0, 5)
              .map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <div className="font-medium">{user.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {user.last_accessed
                      ? new Date(user.last_accessed).toLocaleString()
                      : 'Never'}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
