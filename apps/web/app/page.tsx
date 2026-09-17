import Link from "next/link";
import { Gallery } from "@/components/Gallery";
import gallery from "@/lib/generated-gallery.json";
export default function Home() {
  return (
    <main id="main-content" tabIndex={-1}>
      <section className="hero" aria-labelledby="gallery-title">
        <h1 id="gallery-title">Art with <span>knobs</span></h1>
        <div className="hero-note">
          <p>Craft procedurally generated images with visible rules, editable code, and seeded variation.</p>
          <div className="hero-links">
            <Link className="text-link" href="/studio">Open the studio <span aria-hidden="true">↗</span></Link>
            <Link className="text-link" href="/about">Why procedural? <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
      <Gallery techniques={gallery.techniques} />
    </main>
  );
}
