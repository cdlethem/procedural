import { createGlyphComposition, glyphPalette } from "./glyph-marks.js";

const SIZE = 640;
const FONT_FAMILY = "ProceduralsGlyphMarks";
const FONT_URL = new URL("./assets/GlyphMarks.ttf", import.meta.url);
const FONT_SHA256 = "b4c632e3cdf9acc7f28758fb5a323c8524d7fc6660d46904d9b6cbe2809c419c";
const REQUIRED_GLYPHS = "0123456789ABCDEFGHIJ";
const DIGITS = "0123456789";
const ALPHABET = "ABCDEFGHIJ";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let seed = 42;
let short = false;
let sparse = false;
let letters = false;
let dots = false;
let coloured = false;
let faster = false;
let finer = false;
let displayedFrame = null;
let revision = 0;
let fontReady = false;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeGlyphMarks() {
  return Object.freeze({ composition, revision, fontReady });
}

const anchor = new Float64Array(2);

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function loadExplicitFont() {
  const response = await fetch(FONT_URL);
  if (!response.ok) throw new Error(`FONT_UNAVAILABLE: ${response.status}`);
  const data = await response.arrayBuffer();
  if (hex(await crypto.subtle.digest("SHA-256", data)) !== FONT_SHA256) throw new Error("FONT_INVALID: unexpected GlyphMarks.ttf hash");
  const face = new FontFace(FONT_FAMILY, data);
  await face.load();
  document.fonts.add(face);
  // This hash is the accepted DejaVu Sans asset whose exact ASCII coverage was
  // checked natively. Do not add a fallback family: an unavailable explicit
  // font must fail rather than silently substitute a system face.
  if (!document.fonts.check(`48px ${FONT_FAMILY}`, REQUIRED_GLYPHS)) throw new Error("FONT_GLYPH_UNAVAILABLE");
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(SIZE, SIZE, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    status.textContent = "Loading explicit DejaVu Sans glyph asset…";
    loadExplicitFont().then(() => {
      fontReady = true;
      rebuild();
      paint();
    }).catch((error) => {
      art.dataset.error = String(error.message || error);
      status.textContent = `GlyphMarks cannot draw: ${art.dataset.error}`;
      p.background(230);
      p.fill(120, 20, 20);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      p.text("Explicit GlyphMarks font unavailable", SIZE / 2, SIZE / 2);
    });
  };

  function rebuild() {
    composition = createGlyphComposition(seed, faster ? 2 : 0.75, finer ? 0.03 : 0.006);
  }

  function visibleSteps() { return short ? 80 : 160; }
  function stride() { return sparse ? 4 : 1; }
  function stampCount() { return composition.pathCount * Math.ceil(visibleSteps() / stride()); }

  function paint() {
    if (!fontReady || composition === null) return;
    p.background(230);
    p.noStroke();
    p.textFont(FONT_FAMILY);
    p.textAlign(p.CENTER, p.CENTER);
    p.ellipseMode(p.CENTER);
    const steps = visibleSteps();
    const stepStride = stride();
    const symbols = letters ? ALPHABET : DIGITS;
    for (let pathIndex = 0; pathIndex < composition.pathCount; pathIndex += 1) {
      const path = composition.pathAt(pathIndex);
      const markSize = composition.sizeAt(pathIndex);
      p.textSize(markSize);
      const symbol = symbols[composition.symbolIndexAt(pathIndex)];
      for (let step = 0; step < steps; step += stepStride) {
        // The first stamp uses point 0 before any integration; point 160 is not stamped.
        path.pointInto(step, anchor, 0);
        const phase = step / steps;
        if (coloured) {
          const rgb = glyphPalette.sample(phase);
          p.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 50);
        } else p.fill(230 - 200 * phase, 50);
        if (dots) p.ellipse(anchor[0], anchor[1], markSize / 5, markSize / 5);
        else p.text(symbol, anchor[0], anchor[1]);
      }
    }
    displayedFrame = p.get();
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `seed ${seed} · ${stampCount()} ${dots ? "dots" : letters ? "letters" : "digits"} · ${short ? "short" : "full"} · stride ${stepStride} · ${coloured ? "color" : "gray"}`;
  }

  function action(name) {
    if (!fontReady) return;
    let rebuildPaths = false;
    if (name === "n") short = !short;
    else if (name === "d") sparse = !sparse;
    else if (name === "g") letters = !letters;
    else if (name === "m") dots = !dots;
    else if (name === "c") coloured = !coloured;
    else if (name === "v") { faster = !faster; rebuildPaths = true; }
    else if (name === "f") { finer = !finer; rebuildPaths = true; }
    else if (name === "r") { seed = (seed + 1) >>> 0; rebuildPaths = true; }
    else if (name === "0") {
      seed = 42; short = false; sparse = false; letters = false; dots = false;
      coloured = false; faster = false; finer = false; rebuildPaths = true;
    } else if (name === "s") {
      if (displayedFrame) displayedFrame.save("glyph-marks.png");
      return;
    } else return;
    if (rebuildPaths) rebuild();
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => {
    action(String(p.key).toLowerCase());
    if (p.key === " ") return false;
  };
}, art);
