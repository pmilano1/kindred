import type { Metadata } from 'next';
import './globals.css';
import DevApiIndicator from '@/components/DevApiIndicator';
import Footer from '@/components/Footer';
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
      icons: {
        icon: '/favicon.svg',
        apple: '/kindred-logo.svg',
      },
    };
  } catch {
    return {
      title: 'Family Genealogy',
      description: 'Explore the family tree and ancestry',
      icons: {
        icon: '/favicon.svg',
        apple: '/kindred-logo.svg',
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
        <style>{`
          :root {
            --primary-color: ${themeColor};
            --primary-dark: ${themeDark};
          }
        `}</style>
      </head>
      <body>
        <Providers settings={settings}>
          <Sidebar />
          <MainContent>
            {children}
            <Footer />
          </MainContent>
          <DevApiIndicator />
        </Providers>
      </body>
    </html>
  );
}
