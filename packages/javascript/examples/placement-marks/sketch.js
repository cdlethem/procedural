import {
  ALTERNATE_PALETTE, BASE_PALETTE, createRadialPlacementMarks,
  createSeededPlacementMarks, vertexInto,
} from "./placement-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = {
  seed: 42, attempts: 5000, minimum: 4, maximum: 64, separation: 1,
  radial: false, diamonds: false, alternate: false,
};
let composition = null;
let revision = 0;
let drawnCircles = 0;
let drawnVertices = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observePlacementMarks() {
  return Object.freeze({
    composition,
    placement: composition?.placements ?? null,
    placements: composition?.placements ?? null,
    source: composition?.source ?? null,
    revision,
    drawnCircles,
    drawnVertices,
    settings: Object.freeze({ ...settings }),
  });
}

function rebuildPlacement() {
  composition = settings.radial
    ? createRadialPlacementMarks(settings.separation)
    : createSeededPlacementMarks(
      settings.seed, settings.attempts, settings.minimum, settings.maximum, settings.separation,
    );
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuildPlacement();
    paint();
  };

  function paint() {
    try {
      status.textContent = "Drawing…";
      p.background(236, 231, 218);
      p.noFill();
      p.strokeWeight(1);
      p.strokeCap(p.ROUND);
      p.strokeJoin(p.ROUND);
      const placements = composition.placements;
      const colors = settings.alternate ? ALTERNATE_PALETTE : BASE_PALETTE;
      const point = new Float64Array(2);
      const vertices = settings.diamonds ? 4 : 64;
      let circleCount = 0;
      let vertexCount = 0;
      for (let circle = 0; circle < placements.size; circle += 1) {
        const rgb = colors[placements.sourceIndexAt(circle) % colors.length];
        p.stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
        p.beginShape();
        for (let vertex = 0; vertex < vertices; vertex += 1) {
          vertexInto(placements, circle, vertex, settings.diamonds, point);
          p.vertex(point[0], point[1]);
          vertexCount += 1;
        }
        p.endShape(p.CLOSE);
        circleCount += 1;
      }
      drawnCircles = circleCount;
      drawnVertices = vertexCount;
      revision += 1;
      art.dataset.revision = String(revision);
      art.dataset.accepted = String(placements.size);
      art.dataset.attempts = String(placements.attempts);
      status.textContent = `${placements.size.toLocaleString()} accepted of ${placements.attempts.toLocaleString()} proposals · ${composition.source}`;
    } catch (error) {
      status.textContent = `Could not draw: ${error.code ?? error.message}`;
      throw error;
    }
  }

  function action(name) {
    let rebuild = false;
    if (name === "m") settings.diamonds = !settings.diamonds;
    else if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "s") { p.saveCanvas("placement-marks", "png"); return; }
    else if (name === "x") { settings.radial = !settings.radial; rebuild = true; }
    else if (name === "g") { settings.separation = settings.separation === 1 ? 1.2 : 1; rebuild = true; }
    else if (!settings.radial && name === "r") { settings.seed = (settings.seed + 1) >>> 0; rebuild = true; }
    else if (!settings.radial && name === "n") { settings.attempts = settings.attempts === 5000 ? 10000 : 5000; rebuild = true; }
    else if (!settings.radial && name === "i") { settings.minimum = settings.minimum === 4 ? 8 : 4; rebuild = true; }
    else if (!settings.radial && name === "o") { settings.maximum = settings.maximum === 64 ? 32 : 64; rebuild = true; }
    else return;
    if (rebuild) rebuildPlacement();
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
