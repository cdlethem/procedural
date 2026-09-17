import Link from "next/link";
import { LandingStudy } from "@/components/LandingStudy";
import styles from "./LandingPage.module.css";


export function LandingPage() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.landing}>
      <div className={styles.opening}>
        <header className={styles.intro}>
          <h1><span>art with</span> <span className={styles.heroAccent}>knobs</span></h1>
          <div className={styles.introNote}>
            <p>Craft procedurally generated images with visible rules, editable code, and seeded variation.</p>
            <div className={styles.introLinks}>
              <Link href="/studio">Studio <span aria-hidden="true">↗</span></Link>
              <Link href="/gallery">Gallery <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </header>
        <LandingStudy />
      </div>

      <section id="how-it-works" tabIndex={-1} className={styles.process} aria-labelledby="process-title">
        <div className={styles.processInner}>
          <header className={styles.processIntro}>
            <h2 id="process-title">How it works</h2>
            <p>Each study exposes a small set of controls alongside the image it generates.</p>
          </header>
          <ol className={styles.steps}>
            <li><span className={styles.stepNumber}>01</span><div><h3>Adjust the controls</h3><p>Change values and palettes to see the procedure respond.</p></div></li>
            <li><span className={styles.stepNumber}>02</span><div><h3>Open a study</h3><p>Use the study page to examine its method in more detail.</p></div></li>
            <li><span className={styles.stepNumber}>03</span><div><h3>Save in Studio</h3><p>Keep work you make in Studio as a project with its code, settings, and seed.</p></div></li>
          </ol>
        </div>
      </section>

      <footer className={styles.footer}>
        <nav aria-label="Footer">
          <Link href="/studio">Studio</Link>
          <Link href="/gallery">Gallery</Link>
          <Link href="/api-reference">API reference</Link>
        </nav>
      </footer>
    </main>
  );
}
