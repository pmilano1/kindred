'use client';

import { ChevronRight, Monitor, Palette, Shield } from 'lucide-react';
import Link from 'next/link';

interface SettingSection {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const settingSections: SettingSection[] = [
  {
    title: 'Branding',
    description: 'Customize site name, logo, theme colors, and footer',
    href: '/admin/settings/branding',
    icon: Palette,
  },
  {
    title: 'Privacy & Access',
    description: 'Configure login requirements and privacy settings',
    href: '/admin/settings/privacy',
    icon: Shield,
  },
  {
    title: 'Display',
    description: 'Set date formats, tree defaults, and display options',
    href: '/admin/settings/display',
    icon: Monitor,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-2">Site Settings</h2>
        <p className="text-gray-600 mb-6">
          Configure your site's appearance, privacy, and display options.
        </p>

        <div className="grid gap-4">
          {settingSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <Icon className="w-6 h-6 text-gray-600 group-hover:text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 group-hover:text-blue-700">
                      {section.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {section.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
