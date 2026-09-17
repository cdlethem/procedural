"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProceduralMark } from "@/components/ProceduralMark";

const destinations = [
  { href: "/", label: "Gallery" },
  { href: "/studio", label: "Studio" },
  { href: "/palettes", label: "Palettes" },
  { href: "/explorations", label: "Explorations" },
  { href: "/api-reference", label: "API reference" },
  { href: "/about", label: "About" },
];

export function SiteNav() {
  const pathname = usePathname();
  const current = pathname.startsWith("/techniques/") || pathname.startsWith("/layers/")
    ? "/"
    : pathname === "/harness" ? "/studio" : pathname;
  return (
    <header className="site-nav">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Link className="wordmark" href="/" aria-label="Procedurals home">
        <ProceduralMark />
        Procedurals
      </Link>
      <nav aria-label="Main navigation">
        {destinations.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={(href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`)) ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
