import Link from "next/link";
export function SiteNav() {
  return (
    <header className="site-nav">
      <Link className="wordmark" href="/">
        Procedurals<span>✦</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/">Gallery</Link>
        <Link href="/studio">Studio</Link>
        <Link href="/api-reference">API Reference</Link>
      </nav>
    </header>
  );
}
