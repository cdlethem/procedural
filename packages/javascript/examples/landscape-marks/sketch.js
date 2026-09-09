import { cyclicPalette } from "../../src/cyclic-palette.js";
import { createLandscapeComposition } from "./landscape-marks.js";

const SIZE = 960;
const COLORS = [0x152425, 0x1D3740, 0x06263E, 0x074B7D, 0x094D88, 0x1D6C9E, 0xff2000, 0x1D6C9E, 0xff2010];

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
const palette = cyclicPalette({ colors: COLORS });
let seed = 42;
let uniform = false;
let colorShift = 0;
let displayedFrame = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeLandscapeMarks() {
  return Object.freeze({ composition, revision });
}

const point = new Float64Array(2), a = new Float64Array(2), b = new Float64Array(2), c = new Float64Array(2);
const face = new Int32Array(3);

function loadFace(index) {
  composition.mesh.triangleInto(index, face, 0);
  composition.mesh.pointInto(face[0], a, 0);
  composition.mesh.pointInto(face[1], b, 0);
  composition.mesh.pointInto(face[2], c, 0);
}

function swatch(i) {
  const index = ((i + colorShift) % COLORS.length + COLORS.length) % COLORS.length;
  return 0xff000000 | COLORS[index];
}

function eased(index) {
  const q = Math.abs(index) % COLORS.length;
  const whole = Math.floor(q);
  const phase = (whole + Math.pow(q - whole, 10.8) + colorShift) / COLORS.length;
  return 0xff000000 | palette.sample(phase);
}

function channelsOf(argb) {
  return [(argb >>> 16) & 0xff, (argb >>> 8) & 0xff, argb & 0xff];
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(SIZE, SIZE, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuild();
    paint();
  };

  function rebuild() {
    composition = createLandscapeComposition(seed);
  }

  function drawHorizon() {
    const base = SIZE * composition.horizon;
    for (let layer = 0; layer < 3; layer += 1) {
      p.fill(...channelsOf(swatch(composition.horizonColor(layer))));
      p.beginShape();
      for (let x = 0; x < SIZE; x += 1) {
        const n = composition.noise.sample(x * composition.horizonFrequency(layer), 0);
        const rise = Math.pow(Math.max(0, Math.min(1, n * 4 - 2)), 1.4) * SIZE * 0.012;
        p.vertex(x, base - rise);
      }
      p.vertex(SIZE, base);
      p.vertex(0, base);
      p.endShape(p.CLOSE);
    }
  }

  function drawStripes(sky) {
    const h = composition.horizon;
    const power = uniform ? 1 : 4.2;
    const left = composition.stripeStart(sky, 0), right = composition.stripeStart(sky, 1);
    const dl = composition.stripeDrift(sky, 0), dr = composition.stripeDrift(sky, 1);
    for (let i = 0; i < 1000; i += 1) {
      const t1 = Math.pow(i / 1000.0, power), t2 = Math.pow((i + 1) / 1000.0, power);
      const y1 = SIZE * (sky ? (1 - t1) * h : h + t1 * (1 - h));
      const y2 = SIZE * (sky ? (1 - t2) * h : h + t2 * (1 - h));
      p.beginShape();
      p.fill(...channelsOf(eased(left + dl * (i + 1))), 180);
      p.vertex(0, y2);
      p.fill(...channelsOf(eased(left + dl * i)), 180);
      p.vertex(0, y1);
      p.fill(...channelsOf(eased(right + dr * i)), 180);
      p.vertex(SIZE, y1);
      p.fill(...channelsOf(eased(right + dr * (i + 1))), 180);
      p.vertex(SIZE, y2);
      p.endShape(p.CLOSE);
    }
  }

  function ring(x, y, w1, h1, w2, h2, rgb, alpha1, alpha2, shadow) {
    const largest = Math.max(Math.max(w1, w2), Math.max(h1, h2));
    const count = Math.max(2, Math.floor(shadow ? Math.PI * Math.pow(largest * 0.25, 2) : Math.PI * 2 * Math.pow(largest * 0.5 * 0.06, 2)));
    const [r, g, b2] = channelsOf(rgb);
    for (let i = 0; i < count; i += 1) {
      const t1 = p.TWO_PI * i / count, t2 = p.TWO_PI * (i + 1) / count;
      p.beginShape();
      p.fill(r, g, b2, alpha1);
      p.vertex(x + Math.cos(t1) * w1 * 0.5, y + Math.sin(t1) * h1 * 0.5);
      p.vertex(x + Math.cos(t2) * w1 * 0.5, y + Math.sin(t2) * h1 * 0.5);
      p.fill(r, g, b2, alpha2);
      p.vertex(x + Math.cos(t2) * w2 * 0.5, y + Math.sin(t2) * h2 * 0.5);
      p.vertex(x + Math.cos(t1) * w2 * 0.5, y + Math.sin(t1) * h2 * 0.5);
      p.endShape(p.CLOSE);
    }
  }

  function drawDisk(i) {
    composition.placements.pointInto(i, point, 0);
    const x = point[0], y = point[1], s = 2 * composition.placements.radiusAt(i);
    ring(x, y + s * 0.5, 0, 0, s * 1.4, s * 1.4 * 0.2, 0xff000000, 60, 0, true);
    ring(x, y + s * 0.5, 0, 0, s * 0.8, s * 0.8 * 0.2, 0xff000000, 90, 0, true);
    p.fill(...channelsOf(swatch(composition.diskColor(i))));
    p.ellipse(x, y, s, s);
    ring(x, y, s, s, s * 8, s * 8, swatch(composition.haloColor(i)), 30, 0, false);
    ring(x, y, s, s, s * 2, s * 2, 0xffffffff, 8, 0, false);
    ring(x, y, s, s, s * 0.6, s * 0.6, swatch(composition.innerColor(i)), 14, 0, false);
  }

  function drawSpeck(f) {
    loadFace(f);
    const x = (a[0] + b[0] + c[0]) / 3, y = (a[1] + b[1] + c[1]) / 3;
    const s = composition.speckSize(f), r = s * 0.5, t = composition.speckAngle(f), stretch = composition.speckStretch(f);
    p.fill(...channelsOf(swatch(composition.speckColor(f))));
    p.beginShape(p.TRIANGLES);
    p.vertex(x + Math.cos(t - p.HALF_PI) * r, y + Math.sin(t - p.HALF_PI) * r);
    p.vertex(x + Math.cos(t + p.HALF_PI) * r, y + Math.sin(t + p.HALF_PI) * r);
    p.vertex(x + Math.cos(t) * r * stretch, y + Math.sin(t) * r * stretch);
    p.endShape();
    p.fill(255, 240);
    p.ellipse(x, y, s, s);
  }

  function paint() {
    p.background(0, 2, 4);
    p.noStroke();
    drawHorizon();
    drawStripes(false);
    drawStripes(true);
    p.stroke(255, 10);
    p.noFill();
    p.beginShape(p.TRIANGLES);
    for (let f = 0; f < composition.mesh.faceCount; f += 1) {
      loadFace(f);
      p.vertex(a[0], a[1]);
      p.vertex(b[0], b[1]);
      p.vertex(c[0], c[1]);
    }
    p.endShape(p.CLOSE);
    p.noStroke();
    for (let i = 0; i < composition.placements.size; i += 1) drawDisk(i);
    for (let f = 0; f < composition.mesh.faceCount; f += 1) drawSpeck(f);

    displayedFrame = p.get();
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `seed ${seed} · ${uniform ? "uniform" : "eased"} stripes · color shift ${colorShift} · ${composition.placements.size} discs · ${composition.mesh.faceCount} facets`;
  }

  function action(name) {
    if (name === "c") colorShift = (colorShift + 1) % COLORS.length;
    else if (name === "p") uniform = !uniform;
    else if (name === "r") { seed = (seed + 1) >>> 0; rebuild(); }
    else if (name === "0") { seed = 42; uniform = false; colorShift = 0; rebuild(); }
    else if (name === "s") {
      if (displayedFrame) displayedFrame.save("landscape-marks.png");
      return;
    } else return;
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
