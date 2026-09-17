import { CANVAS, palette, rgb } from "../motif-compositions/compositions.js";
import { ornamentFieldRecords } from "../motif-compositions/field-records.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const defaults = Object.freeze({
  seed: 42, layout: "packed", petalWeight: 5, leafWeight: 3, emblemWeight: 0,
  density: 72, scale: 1.4, angle: 0, angleStride: 13, offsetX: 0, offsetY: 0,
  guides: false, paletteId: "sage-linen",
});
let settings = { ...defaults };
let marks = [];
let revision = 0;

export function observeOrnamentPoster() {
  return Object.freeze({ marks: structuredClone(marks), settings: Object.freeze({ ...settings }), revision });
}

function checked(next) {
  const weights = [next.petalWeight, next.leafWeight, next.emblemWeight];
  if (weights.some((weight) => !Number.isInteger(weight) || weight < 0 || weight > 10) ||
    weights.every((weight) => weight === 0)) throw new Error("Give at least one mark family a positive weight.");
  if (!Number.isInteger(next.seed) || next.seed < 0 || next.seed > 0xffff_ffff)
    throw new Error("Seed must be a nonnegative 32-bit integer.");
  if (!Number.isInteger(next.density) || next.density < 0 || next.density > 100)
    throw new Error("Density must be between 0 and 100 percent.");
  for (const key of ["scale", "angle", "angleStride", "offsetX", "offsetY"])
    if (!Number.isFinite(next[key])) throw new Error(`${key} must be finite.`);
  if (next.scale < 0 || next.scale > 32 || Math.abs(next.angle) > 36000 ||
    Math.abs(next.angleStride) > 36000 || Math.abs(next.offsetX) > 10000 ||
    Math.abs(next.offsetY) > 10000) throw new Error("A drawing value is outside its safety domain.");
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
  return marks.map(({ sourceIndex, x, y }) => [sourceIndex, x, y]);
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(CANVAS, CANVAS, p.P2D).parent(art);
    p.pixelDensity(1);
    p.noLoop();
    syncControls();
    paint();
  };

  function drawMotif(mark, colors) {
    const { sourceIndex: index, x, y, radius, kind, angle } = mark;
    p.push();
    p.translate(x, y);
    p.rotate(angle);
    p.noStroke();
    if (kind === "petals") {
      for (let petal = 0; petal < 5; petal += 1) {
        p.fill(...rgb(colors[(index + petal) % colors.length]), 210);
        p.ellipse(Math.cos(petal * p.TWO_PI / 5) * radius * 0.34,
          Math.sin(petal * p.TWO_PI / 5) * radius * 0.34, radius * 0.72, radius * 0.44);
      }
      p.fill(...rgb(colors[(index + 2) % colors.length]));
      p.circle(0, 0, Math.max(5, radius * 0.34));
    } else if (kind === "leaves") {
      p.fill(...rgb(colors[(index + 1) % colors.length]), 220);
      p.ellipse(0, 0, radius * 0.76, radius * 1.8);
      p.stroke(...rgb(colors[(index + 3) % colors.length]), 160);
      p.strokeWeight(1);
      p.line(0, -radius * 0.75, 0, radius * 0.75);
    } else {
      p.noFill();
      p.stroke(...rgb(colors[(index + 2) % colors.length]), 230);
      p.strokeWeight(Math.max(2, radius * 0.13));
      p.strokeCap(p.SQUARE);
      p.line(-radius * 0.42, -radius * 0.54, -radius * 0.42, radius * 0.52);
      p.line(-radius * 0.42, -radius * 0.54, radius * 0.42, -radius * 0.54);
      if (index % 2 === 0) {
        p.line(-radius * 0.1, 0, radius * 0.42, 0);
        p.line(-radius * 0.1, 0, radius * 0.42, radius * 0.52);
      } else {
        p.arc(-radius * 0.08, 0, radius * 0.72, radius * 0.86, -p.HALF_PI, p.HALF_PI);
        p.line(-radius * 0.08, radius * 0.43, radius * 0.38, radius * 0.52);
      }
      p.noStroke();
      p.fill(...rgb(colors[(index + 4) % colors.length]), 210);
      p.circle(radius * 0.44, -radius * 0.54, Math.max(4, radius * 0.16));
    }
    p.pop();
  }

  function paint() {
    const started = performance.now();
    marks = ornamentFieldRecords({ seed: settings.seed, params: settings });
    const colors = palette(settings.paletteId);
    p.clear();
    for (const mark of marks) drawMotif(mark, colors);
    if (settings.guides) {
      p.noFill();
      p.stroke(...rgb(colors[0]), 110);
      p.strokeWeight(1);
      p.rect(72, 72, 576, 576);
    }
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.anchors = JSON.stringify(anchors());
    art.dataset.geometry = JSON.stringify(marks);
    art.dataset.renderStatus = "ready";
    art.dataset.drawMs = String(performance.now() - started);
    status.textContent = `${marks.length} marks · ${settings.layout} anchors · transparent layer`;
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
    } else if (action === "save") p.saveCanvas("ornament-field", "png");
  });
  p.keyPressed = () => {
    const key = String(p.key).toLowerCase();
    if (key === "0") {
      settings = { ...defaults };
      syncControls();
      paint();
    } else if (key === "s") p.saveCanvas("ornament-field", "png");
  };
}, art);
