import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

const plex = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: "Procedurals — art with knobs",
  description: "Craft procedurally generated images with visible rules, editable code, and seeded variation.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plex.variable}>
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
