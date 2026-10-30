import type { Metadata } from "next";
import "@fontsource/ibm-plex-serif/latin-500.css";
import "@fontsource/ibm-plex-serif/latin-600.css";
import "@fontsource/ibm-plex-serif/latin-700.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tribal Gaming Compliance & Licensing Platform",
  description: "Regulatory system of record for EGD compliance and licensing operations — sales demo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="poc-banner">SALES DEMO — FABRICATED PRACTICE DATA — NOT FOR OPERATIONAL USE</div>
        {children}
      </body>
    </html>
  );
}
