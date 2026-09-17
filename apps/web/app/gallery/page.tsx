import type { Metadata } from "next";
import { Gallery } from "@/components/Gallery";
import gallery from "@/lib/generated-gallery.json";

export const metadata: Metadata = {
  title: "Gallery — Procedurals",
};

export default function GalleryPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <section className="hero" aria-labelledby="gallery-title">
        <h1 id="gallery-title">The gallery</h1>
        <div className="hero-note">
          <p>Pick a procedure. Change a rule. Make it yours.</p>
        </div>
      </section>
      <Gallery techniques={gallery.techniques} />
    </main>
  );
}
