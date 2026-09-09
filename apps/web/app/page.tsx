import { Gallery } from "@/components/Gallery";
import gallery from "@/lib/generated-gallery.json";
export default function Home() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">A working collection</p>
        <h1>
          Procedural studies
          <br />
          <i>made editable.</i>
        </h1>
        <p>
          Explore generative techniques, then bring selected workflows into a
          layered browser studio.
        </p>
      </section>
      <Gallery techniques={gallery.techniques} />
    </main>
  );
}
