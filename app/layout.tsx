import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getSettings();
    return {
      title: `${settings.family_name} ${settings.site_name}`,
      description: settings.site_tagline,
    };
  } catch {
    return {
      title: "Family Genealogy",
      description: "Explore the family tree and ancestry",
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch settings server-side
  let settings;
  try {
    settings = await getSettings();
  } catch (error) {
    console.error('Failed to load settings for layout:', error);
  }

  return (
    <html lang="en">
      <head>
        {settings?.theme_color && (
          <style>{`:root { --theme-color: ${settings.theme_color}; }`}</style>
        )}
      </head>
      <body>
        <Providers settings={settings}>
          <Sidebar />
          <main className="main-content">
            {children}
            <Footer />
          </main>
        </Providers>
      </body>
    </html>
  );
}
