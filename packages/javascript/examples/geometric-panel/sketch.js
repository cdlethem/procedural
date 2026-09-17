import { CANVAS, palette, rgb } from "../motif-compositions/compositions.js";
import { shapeMatrixRecords } from "../motif-compositions/field-records.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const defaults = Object.freeze({
  columns: 6, rows: 8, wedgeWeight: 5, barWeight: 3, discWeight: 0, arcWeight: 0,
  density: 78, scale: 1, offsetX: 0, offsetY: 0, rowShift: 0.25, columnShift: 0,
  angle: -12, angleStep: 18, guides: false, paletteId: "ochre-plum",
});
let settings = { ...defaults };
let marks = [];
let revision = 0;

export function observeGeometricPanel() {
  return Object.freeze({ marks: structuredClone(marks), settings: Object.freeze({ ...settings }), revision });
}

function checked(next) {
  if (!Number.isSafeInteger(next.columns) || !Number.isSafeInteger(next.rows) ||
    next.columns < 1 || next.rows < 1 || next.columns * next.rows > 2048)
    throw new Error("Rows × columns must be between 1 and 2,048 cells.");
  const weights = [next.wedgeWeight, next.barWeight, next.discWeight, next.arcWeight];
  if (weights.some((weight) => !Number.isInteger(weight) || weight < 0 || weight > 10) ||
    weights.every((weight) => weight === 0)) throw new Error("Give at least one shape family a positive weight.");
  if (!Number.isInteger(next.density) || next.density < 0 || next.density > 100)
    throw new Error("Density must be between 0 and 100 percent.");
  for (const key of ["scale", "offsetX", "offsetY", "rowShift", "columnShift", "angle", "angleStep"])
    if (!Number.isFinite(next[key])) throw new Error(`${key} must be finite.`);
  if (next.scale < 0 || next.scale > 32 || Math.abs(next.offsetX) > 10000 ||
    Math.abs(next.offsetY) > 10000 || Math.abs(next.rowShift) > 100 ||
    Math.abs(next.columnShift) > 100 || Math.abs(next.angle) > 36000 ||
    Math.abs(next.angleStep) > 36000) throw new Error("A drawing value is outside its safety domain.");
  return next;
}

function syncControls() {
  for (const input of controls.querySelectorAll("[data-key]")) {
    const value = settings[input.dataset.key];
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = String(value);
  }
}

function anchors() {
  return marks.map(({ sourceIndex, row, column, x, y }) => [sourceIndex, row, column, x, y]);
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(CANVAS, CANVAS, p.P2D).parent(art);
    p.pixelDensity(1);
    p.noLoop();
    syncControls();
    paint();
  };

  function drawMark(mark, colors) {
    const { x, y, scale, kind, angle, sourceIndex: index } = mark;
    p.push();
    p.translate(x, y);
    p.rotate(angle);
    p.noStroke();
    if (kind === "discs") {
      p.fill(...rgb(colors[index % colors.length]), 220);
      p.circle(0, 0, 100 * scale);
      p.fill(...rgb(colors[(index + 2) % colors.length]), 190);
      p.circle(20 * scale, -16 * scale, 34 * scale);
    } else if (kind === "arcs") {
      p.noFill();
      p.stroke(...rgb(colors[index % colors.length]), 230);
      p.strokeWeight(Math.max(1, 10 * scale));
      p.arc(0, 0, 110 * scale, 110 * scale, -p.HALF_PI, p.PI);
      p.stroke(...rgb(colors[(index + 2) % colors.length]), 190);
      p.arc(0, 0, 67 * scale, 67 * scale, 0, p.PI + p.HALF_PI);
    } else if (kind === "bars") {
      p.fill(...rgb(colors[index % colors.length]));
      p.rect(-78 * scale, -9 * scale, 156 * scale, 18 * scale);
      p.fill(...rgb(colors[(index + 2) % colors.length]), 220);
      p.rect(-9 * scale, -54 * scale, 18 * scale, 108 * scale);
    } else {
      p.fill(...rgb(colors[index % colors.length]));
      p.triangle(-72 * scale, 48 * scale, 72 * scale, 26 * scale, -10 * scale, -66 * scale);
      p.fill(...rgb(colors[(index + 2) % colors.length]), 210);
      p.quad(-42 * scale, 39 * scale, 19 * scale, 29 * scale, -4 * scale, -30 * scale, -55 * scale, -18 * scale);
    }
    p.pop();
  }

  function paint() {
    const started = performance.now();
    marks = shapeMatrixRecords({ params: settings });
    const colors = palette(settings.paletteId);
    p.clear();
    if (settings.guides) {
      p.noFill();
      p.stroke(...rgb(colors[0]), 80);
      p.strokeWeight(1);
      p.rect(72, 72, 576, 576);
      for (let column = 0; column < settings.columns; column += 1) {
        const x = settings.columns === 1 ? 360 : 72 + column * 576 / (settings.columns - 1);
        p.line(x, 72, x, 648);
      }
      for (let row = 0; row < settings.rows; row += 1) {
        const y = settings.rows === 1 ? 360 : 72 + row * 576 / (settings.rows - 1);
        p.line(72, y, 648, y);
      }
    }
    for (const mark of marks) drawMark(mark, colors);
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.anchors = JSON.stringify(anchors());
    art.dataset.geometry = JSON.stringify(marks);
    art.dataset.renderStatus = "ready";
    art.dataset.drawMs = String(performance.now() - started);
    status.textContent = `${marks.length} marks in ${settings.columns} × ${settings.rows} cells · transparent layer`;
  }

  controls.addEventListener("change", (event) => {
    const input = event.target.closest("[data-key]");
    if (!input) return;
    const key = input.dataset.key;
    const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
    try {
      if (input.type === "number" && input.value.trim() === "") throw new Error(`${key} needs a value.`);
      settings = checked({ ...settings, [key]: value });
      status.textContent = "";
      paint();
    } catch (error) {
      status.textContent = error.message;
      syncControls();
    }
  });
  controls.addEventListener("click", (event) => {
    const action = event.target.closest("button[data-action]")?.dataset.action;
    if (action === "reset") {
      settings = { ...defaults };
      syncControls();
      paint();
    } else if (action === "save") p.saveCanvas("shape-matrix", "png");
  });
  p.keyPressed = () => {
    const key = String(p.key).toLowerCase();
    if (key === "0") {
      settings = { ...defaults };
      syncControls();
      paint();
    } else if (key === "s") p.saveCanvas("shape-matrix", "png");
  };
}, art);
