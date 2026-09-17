import type { Metadata } from "next";
import Link from "next/link";
import { ProceduralMark } from "@/components/ProceduralMark";

export const metadata: Metadata = {
  title: "Why procedural? — Procedurals",
  description: "Art should come with a method, not a mystery. Why Procedurals puts visible rules, deliberate edits, and reproducible processes before black-box image generation.",
};

export default function AboutPage() {
  return (
    <main id="main-content" tabIndex={-1} className="detail about-page">
      <div className="about-intro">
        <header className="detail-head">
          <p className="eyebrow">About / Why procedural?</p>
          <h1>Not a black box.</h1>
          <p>Procedurals is an alternative to black-box AI image generation. The work is defined by code and parameters, not just an image a model has returned.</p>
        </header>
        <figure className="about-mark">
          <ProceduralMark />
          <figcaption>
            <span className="eyebrow">A rule, made visible</span>
            One corner. Shift it by a fixed distance. Repeat. Our mark carries its own construction, just as the work should.
          </figcaption>
        </figure>
      </div>

      <article className="about-principles" aria-label="The procedural approach">
        <section>
          <h2>See what makes the image.</h2>
          <p>A text-to-image prompt does not give you an editable account of how each mark was made. Here, the drawing procedure is part of the work. Inspect its source, change its parameters, and compose it with other procedures.</p>
        </section>
        <section>
          <h2>Chance, with a way back.</h2>
          <div>
            <p>Randomness isn’t the problem. Losing your way back is. A seed lets a procedure revisit the same choices; changing it makes a deliberate variation. Keep the code, settings, and seed together so you can return to a composition rather than chase it.</p>
            <p className="about-note">Reproduction also depends on the renderer, its version, and—for moving work—the frame or time. A seed alone is not a promise of identical pixels in every environment.</p>
          </div>
        </section>
        <section>
          <h2>Edit the cause, not just the pixels.</h2>
          <p>Make a field denser. Change a curve’s tension. Move a layer. You can work on a specific decision without asking for a whole new interpretation of the image. The result can still surprise you; the process doesn’t have to be a mystery.</p>
        </section>
        <section>
          <h2>AI can help write the rules.</h2>
          <p>The optional prompt tools can propose or revise procedural code. That proposal still needs to be checked. Inspect it, edit it, and keep the version you want. AI assistance does not have to mean giving up the method.</p>
        </section>
      </article>

      <footer className="about-next">
        <p>The image is a result.<br />The procedure is something you can keep working with.</p>
        <Link className="text-link" href="/">Find a starting point <span aria-hidden="true">→</span></Link>
      </footer>
    </main>
  );
}
