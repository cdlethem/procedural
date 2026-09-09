import { BACKGROUND_RGB, CELL_PIXEL_STEP, ENDPOINT_RGB, GRID_CELLS, GRID_RGB, cellPixel, createLatticeMarks, pathColour } from "./lattice-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { seed: 42, many: false, longPaths: false, dots: false, wide: false, alternate: false };
let model = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeLatticeMarks() {
  return Object.freeze({ model, revision, settings: Object.freeze({ ...settings }) });
}

function rebuild() {
  model = createLatticeMarks(settings.seed, settings.many, settings.longPaths);
}

function channels(rgb) {
  return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff];
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuild();
    paint();
  };

  function drawGrid() {
    p.stroke(205, 200, 190);
    p.strokeWeight(1);
    for (let i = 0; i <= GRID_CELLS; i += 1) {
      p.line(32, 32 + CELL_PIXEL_STEP * i, 608, 32 + CELL_PIXEL_STEP * i);
      p.line(32 + CELL_PIXEL_STEP * i, 32, 32 + CELL_PIXEL_STEP * i, 608);
    }
  }

  function cellDot(pathIndex, cellIndex, diameter) {
    const [cx, cy] = model.paths.cellAt(pathIndex, cellIndex);
    p.ellipse(cellPixel(cx), cellPixel(cy), diameter, diameter);
  }

  function drawVertices(pathIndex, length, rgb) {
    p.noStroke();
    const [r, g, b] = channels(rgb);
    p.fill(r, g, b);
    for (let index = 0; index < length; index += 1) cellDot(pathIndex, index, 6);
  }

  function drawSegments(pathIndex, length, offset) {
    for (let index = 1; index < length; index += 1) {
      const [ax, ay] = model.paths.cellAt(pathIndex, index - 1);
      const [bx, by] = model.paths.cellAt(pathIndex, index);
      p.line(cellPixel(ax) + offset, cellPixel(ay) + offset, cellPixel(bx) + offset, cellPixel(by) + offset);
    }
  }

  function drawPath(pathIndex, length, rgb) {
    p.strokeWeight((settings.wide ? 0.65 : 0.35) * CELL_PIXEL_STEP);
    p.stroke(30, 30, 30, 70);
    drawSegments(pathIndex, length, 3);
    const [r, g, b] = channels(rgb);
    p.stroke(r, g, b);
    drawSegments(pathIndex, length, 0);
    // Pale endpoints contrast with the coloured stroke; isolated cells stay visible.
    p.stroke(r, g, b);
    p.strokeWeight(2);
    const [er, eg, eb] = channels(ENDPOINT_RGB);
    p.fill(er, eg, eb);
    cellDot(pathIndex, 0, 8);
    if (length > 1) cellDot(pathIndex, length - 1, 8);
  }

  function paint() {
    p.background(243, 240, 232);
    drawGrid();
    p.strokeCap(p.ROUND);
    p.strokeJoin(p.ROUND);
    let drawnPaths = 0, drawnCells = 0;
    for (let path = 0; path < model.paths.pathCount; path += 1) {
      const length = model.paths.pathLengthAt(path);
      if (length === 0) continue;
      const rgb = pathColour(settings.alternate ? 1 : 0, path);
      if (settings.dots) drawVertices(path, length, rgb);
      else drawPath(path, length, rgb);
      drawnPaths += 1;
      drawnCells += length;
    }
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.drawnPaths = String(drawnPaths);
    art.dataset.drawnCells = String(drawnCells);
    status.textContent = `${drawnPaths} paths (${drawnCells} cells) · seed ${settings.seed} · ${settings.many ? "many" : "few"} starts · ${settings.longPaths ? "long" : "short"} limit`;
  }

  function action(name) {
    if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "m") settings.dots = !settings.dots;
    else if (name === "w") settings.wide = !settings.wide;
    else if (name === "l") { settings.longPaths = !settings.longPaths; rebuild(); }
    else if (name === "n") { settings.many = !settings.many; rebuild(); }
    else if (name === "r") { settings.seed = (settings.seed + 1) >>> 0; rebuild(); }
    else if (name === "0") {
      settings.seed = 42; settings.many = false; settings.longPaths = false;
      settings.dots = false; settings.wide = false; settings.alternate = false;
      rebuild();
    } else if (name === "s") { p.saveCanvas("lattice-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
