import type { Metadata } from 'next';
import './globals.css';
import DevApiIndicator from '@/components/DevApiIndicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Footer from '@/components/Footer';
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';
import MainContent from '@/components/MainContent';
import { Providers } from '@/components/Providers';
import Sidebar from '@/components/Sidebar';
import { getSettings } from '@/lib/settings';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getSettings();
    return {
      title: `${settings.family_name} ${settings.site_name}`,
      description: settings.site_tagline,
      manifest: '/manifest.json',
      icons: {
        icon: '/favicon.svg',
        apple: '/icons/apple-touch-icon.png',
      },
      appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: settings.site_name,
      },
      formatDetection: {
        telephone: false,
      },
    };
  } catch {
    return {
      title: 'Family Genealogy',
      description: 'Explore the family tree and ancestry',
      manifest: '/manifest.json',
      icons: {
        icon: '/favicon.svg',
        apple: '/icons/apple-touch-icon.png',
      },
      appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Kindred',
      },
      formatDetection: {
        telephone: false,
      },
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch settings server-side (silently falls back to defaults during build)
  let settings: Awaited<ReturnType<typeof getSettings>> | undefined;
  try {
    settings = await getSettings();
  } catch {
    // Handled in getSettings - uses defaults
  }

  // Generate darker shade for gradients
  const generateDarkerColor = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const darken = (c: number) => Math.max(0, Math.floor(c * 0.7));
    return `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;
  };

  const themeColor = settings?.theme_color || '#2c5530';
  const themeDark = generateDarkerColor(themeColor);

  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content={themeColor} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <style>{`
          :root {
            --primary-color: ${themeColor};
            --primary-dark: ${themeDark};
          }
        `}</style>
      </head>
      <body>
        <Providers settings={settings}>
          <ErrorBoundary>
            <GlobalErrorHandler />
            <Sidebar />
            <MainContent>
              {children}
              <Footer />
            </MainContent>
            <DevApiIndicator />
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
