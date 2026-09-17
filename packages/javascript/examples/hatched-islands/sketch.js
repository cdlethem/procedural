import { hatchRegionLines2D } from "../../src/hatch-region-lines-2d.js";
import { svgPlotPlan01 } from "../../src/svg-plot-plan-01.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const defaults = { angle: false, dense: false, dark: false, transfer: false };
const settings = { ...defaults };
const regions = [
  {
    outer: [[130, 120], [200, 75], [330, 90], [430, 65], [560, 125], [635, 210], [605, 340], [550, 440], [445, 480], [335, 455], [230, 495], [120, 445], [85, 350], [105, 230]],
    holes: [
      [[225, 220], [270, 180], [328, 205], [345, 268], [300, 300], [245, 282], [218, 250]],
      [[415, 275], [450, 225], [515, 230], [550, 280], [530, 345], [470, 365], [420, 335]],
    ],
  },
  {
    outer: [[240, 75], [340, 95], [390, 160], [525, 160], [590, 225], [560, 310], [610, 390], [530, 475], [390, 455], [320, 500], [205, 455], [125, 350], [170, 280], [125, 170]],
    holes: [
      [[265, 235], [310, 195], [380, 220], [385, 300], [330, 325], [275, 292]],
      [[440, 355], [480, 320], [535, 365], [510, 420], [455, 420]],
    ],
  },
];
let model, region, revision = 0;
new window.p5((p) => {
  p.setup = () => { p.createCanvas(720, 560).parent(art); p.pixelDensity(1); p.noLoop(); paint(); };
  function paint() {
    const supplied = regions[Number(settings.transfer)];
    region = { outer: supplied.outer.map((point) => [...point]), holes: supplied.holes.map((ring) => ring.map((point) => [...point])) };
    const direction = settings.angle ? [[0.35, 1], [1, -0.25]] : [[1, 0.28], [-0.72, 1]];
    const spacing = settings.dense ? [14, 27] : [24, 40];
    const layers = direction.map((axis, i) => hatchRegionLines2D({ region, origin: [0, 0], direction: axis, spacing: spacing[i], phase: i ? 13 : 7, maxWork: 1000000, maxOutputPaths: 1000 }));
    model = { layers, paths: layers.flatMap((layer) => layer.paths) };
    const paper = settings.dark ? "#20272c" : "#f6f2ea";
    p.background(paper);
    p.noStroke(); p.fill(settings.dark ? "#dedbd0" : "#33464d"); p.textSize(15); p.textStyle(p.BOLD);
    p.text("ISLAND CONTOURS / TWO HATCH FIELDS", 50, 35); p.textStyle(p.NORMAL);
    p.noStroke(); p.fill(settings.dark ? "#74644f" : "#dfb779");
    p.beginShape(); for (const point of region.outer) p.vertex(...point); p.endShape(p.CLOSE);
    p.fill(paper); for (const hole of region.holes) { p.beginShape(); for (const point of hole) p.vertex(...point); p.endShape(p.CLOSE); }
    p.noFill(); p.stroke(settings.dark ? "#e5c394" : "#715b44"); p.strokeWeight(2);
    p.beginShape(); for (const point of region.outer) p.vertex(...point); p.endShape(p.CLOSE);
    for (const hole of region.holes) { p.beginShape(); for (const point of hole) p.vertex(...point); p.endShape(p.CLOSE); }
    for (const [i, layer] of layers.entries()) {
      p.stroke(settings.dark ? (i ? "#81b3b8" : "#f3dcc4") : (i ? "#708f8f" : "#263d47"));
      p.strokeWeight(i ? 0.9 : 1.45);
      for (const path of layer.paths) p.line(...path[0], ...path[1]);
    }
    p.noStroke(); p.fill(settings.dark ? "#dedbd0" : "#33464d"); p.textSize(11);
    p.text("two angles  ·  every fragment trimmed to the filled island", 50, 540);
    revision += 1;
    art.dataset.renderStatus = "ready"; art.dataset.revision = String(revision);
    art.dataset.model = JSON.stringify(model); art.dataset.style = settings.dark ? "dark" : "fine";
    status.textContent = `${model.paths.length} clipped fragments in two directions · ${settings.angle ? "rotated" : "base"} axes · ${spacing.join("/")}px spacing`;
    window.hatchedIslandsStudy = { snapshot: () => structuredClone({ settings, region, direction, spacing, model }) };
  }
  function action(key) {
    if (key === "a") settings.angle = !settings.angle;
    else if (key === "d") settings.dense = !settings.dense;
    else if (key === "c") settings.dark = !settings.dark;
    else if (key === "t") settings.transfer = !settings.transfer;
    else if (key === "0") Object.assign(settings, defaults);
    else if (key === "s") { p.saveCanvas("hatched-islands", "png"); return; }
    else if (key === "v") {
      const svg = svgPlotPlan01({ widthMm: 72, heightMm: 56, paths: model.paths.map((path) => path.map(([x, y]) => [x / 10, y / 10])), strokeWidthMm: 0.15, maxOutputBytes: 100000 }).svg;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      link.download = "hatched-islands.svg"; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      return;
    } else return;
    paint();
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(p.key.toLowerCase());
}, art);
