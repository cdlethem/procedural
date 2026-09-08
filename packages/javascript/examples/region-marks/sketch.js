import { createSeededRegions, createAuthoredRegions } from "./region-marks.js";

const settings = {
  seed: 42, replacements: 100, fraction: 0.5,
  grid: false, alternate: false, authored: false,
};
const palettes = [
  [0x173F5F, 0x20639B, 0x3CAEA3, 0xF6D55C, 0xED553B],
  [0x264653, 0x2A9D8F, 0xE9C46A, 0xF4A261, 0xE76F51],
];
const art = document.querySelector("#art");
const status = document.querySelector("#status");
let composition, revision = 0, drawnMarks = 0;

/** Read-only observation for the browser workflow probe. */
export function observeRegionMarks() {
  return Object.freeze({ composition, revision, drawnMarks, settings: Object.freeze({ ...settings }) });
}

function rebuild() {
  composition = settings.authored ? createAuthoredRegions()
    : createSeededRegions(settings.seed, settings.replacements, settings.fraction);
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuild();
    paint();
  };

  function paint() {
    p.background(243, 240, 232);
    p.noStroke();
    const colors = palettes[settings.alternate ? 1 : 0];
    const bounds = new Float64Array(4), point = new Float64Array(2);
    drawnMarks = 0;
    for (let i = 0; i < composition.size; i += 1) {
      composition.boundsInto(i, bounds);
      const width = bounds[2] - bounds[0], height = bounds[3] - bounds[1];
      const inset = Math.min(1, Math.min(width, height) * 0.05);
      const rgb = colors[composition.idAt(i) % colors.length];
      p.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 190);
      p.rect(bounds[0] + inset, bounds[1] + inset, width - 2 * inset, height - 2 * inset);
      p.fill(255, 245);
      if (settings.grid) {
        const diameter = Math.min(width, height) / 12;
        for (let mark = 0; mark < 9; mark += 1) {
          composition.markInto(mark, bounds, point);
          p.ellipse(point[0], point[1], diameter, diameter);
          drawnMarks += 1;
        }
      } else {
        const diameter = Math.min(width, height) * 0.28;
        p.ellipse(bounds[0] + width * 0.5, bounds[1] + height * 0.5, diameter, diameter);
        drawnMarks += 1;
      }
    }
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `${composition.size} cells · ${settings.authored ? "authored" : "seeded"} · ${drawnMarks} marks`;
  }

  function action(key) {
    if (key === "s") { p.saveCanvas("region-marks", "png"); return; }
    if (key === "m") settings.grid = !settings.grid;
    else if (key === "c") settings.alternate = !settings.alternate;
    else {
      if (key === "x") settings.authored = !settings.authored;
      else if (!settings.authored && key === "r") settings.seed = (settings.seed + 1) >>> 0;
      else if (!settings.authored && key === "n") settings.replacements = settings.replacements === 100 ? 200 : 100;
      else if (!settings.authored && key === "g") settings.fraction = settings.fraction === 0.5 ? 1 : 0.5;
      else return;
      rebuild();
    }
    paint();
  }

  document.querySelector("#controls").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
