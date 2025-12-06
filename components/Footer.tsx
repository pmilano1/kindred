'use client';

import { useSettings } from './SettingsProvider';

export default function Footer() {
  const settings = useSettings();

  return (
    <footer className="footer">
      <p>© {new Date().getFullYear()} {settings.family_name} {settings.site_name}</p>
      {settings.footer_text && (
        <p className="text-sm text-gray-500 mt-1">{settings.footer_text}</p>
      )}
      {settings.admin_email && (
        <p className="text-sm text-gray-500 mt-1">
          Contact: <a href={`mailto:${settings.admin_email}`} className="hover:underline">{settings.admin_email}</a>
        </p>
      )}
    </footer>
  );
}

