import type { Metadata } from "next";
import { IBM_Plex_Serif, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Tribal Gaming Compliance & Licensing Platform",
  description: "Regulatory system of record for EGD compliance and licensing operations — sales demo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSerif.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <div className="poc-banner">SALES DEMO — FABRICATED PRACTICE DATA — NOT FOR OPERATIONAL USE</div>
        {children}
      </body>
    </html>
  );
}
