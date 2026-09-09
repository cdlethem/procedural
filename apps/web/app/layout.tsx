import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Procedurals — generative art studies",
  description: "Editable generative art techniques and a layered studio.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
