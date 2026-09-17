"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProceduralMark } from "@/components/ProceduralMark";

const destinations = [
  { href: "/gallery", label: "Gallery" },
  { href: "/studio", label: "Studio" },
  { href: "/palettes", label: "Palettes" },
  { href: "/explorations", label: "Explorations" },
  { href: "/api-reference", label: "API reference" },
  { href: "/about", label: "About" },
];
const landingDestinations = [
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/studio", label: "Open studio" },
];

export function SiteNav() {
  const pathname = usePathname();
  const current = pathname.startsWith("/techniques/") || pathname.startsWith("/layers/")
    ? "/gallery"
    : pathname === "/harness" ? "/studio" : pathname;
  const navigation = pathname === "/" ? landingDestinations : destinations;
  return (
    <header className={pathname === "/" ? "site-nav site-nav-landing" : "site-nav"}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Link className="wordmark" href="/" aria-label="Procedurals home" aria-current={pathname === "/" ? "page" : undefined}>
        <ProceduralMark />
        Procedurals
      </Link>
      <nav aria-label="Main navigation">
        {pathname === "/" && <a href="#how-it-works">How it works</a>}
        {navigation.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={current === href || current.startsWith(`${href}/`) ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
