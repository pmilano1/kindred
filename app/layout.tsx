import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
