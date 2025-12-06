import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Milanese Family Genealogy",
  description: "Explore the Milanese family tree and ancestry",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
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
