'use client';

import Image from 'next/image';
import { useSettings } from './SettingsProvider';

export default function Footer() {
  const settings = useSettings();

  return (
    <footer className="footer">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          <p>
            © {new Date().getFullYear()} {settings.family_name}{' '}
            {settings.site_name}
          </p>
          {settings.footer_text && (
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              {settings.footer_text}
            </p>
          )}
          {settings.admin_email && (
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Contact:{' '}
              <a
                href={`mailto:${settings.admin_email}`}
                className="hover:underline"
              >
                {settings.admin_email}
              </a>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <span>Powered by</span>
          <Image
            src="/kindred-logo.svg"
            alt="Kindred"
            width={16}
            height={16}
            className="opacity-60"
            unoptimized
          />
          <span className="font-medium">Kindred</span>
        </div>
      </div>
    </footer>
  );
}
