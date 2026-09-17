import { selectTaperedStrokeStrips2D } from "../../src/select-tapered-stroke-strips-2d.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const defaults = { wide: false, clear: false, transfer: false, dark: false };
const settings = { ...defaults };
// Widths describe the ribbon shape, not a single drawing stroke. The fourth
// path crosses an earlier ribbon; nearby echoes reveal the clearance rule.
const source = [
  { id: "estuary", points: [[66, 105], [185, 120], [310, 93], [455, 115], [650, 87]], widths: [20, 34, 15, 31, 18] },
  { id: "echo", points: [[70, 153], [195, 161], [325, 145], [468, 164], [652, 140]], widths: [12, 19, 26, 17, 11] },
  { id: "swell", points: [[70, 232], [190, 213], [310, 244], [445, 220], [650, 246]], widths: [12, 23, 38, 27, 15] },
  { id: "crossing", points: [[125, 198], [225, 238], [355, 265], [490, 240], [625, 198]], widths: [11, 18, 24, 20, 12] },
  { id: "current", points: [[64, 335], [190, 309], [313, 327], [440, 297], [650, 326]], widths: [15, 26, 13, 30, 17] },
  { id: "undertow", points: [[70, 377], [194, 368], [325, 390], [480, 370], [650, 392]], widths: [10, 15, 22, 15, 11] },
  { id: "lowtide", points: [[73, 463], [203, 435], [330, 452], [473, 430], [650, 458]], widths: [14, 27, 19, 33, 17] },
  { id: "return", points: [[80, 510], [225, 490], [350, 506], [500, 486], [645, 506]], widths: [9, 17, 13, 20, 9] },
];
const transferSlope = [19, -12, 16, -18, 19, -14, 16, -12];
let model, revision = 0;
function candidates() {
  return source.map(({ id, points, widths }, i) => ({
    id,
    points: points.map(([x, y], j) => [x, settings.transfer ? y + (j - 2) * transferSlope[i] : y]),
    widths: widths.map((width) => width * (settings.wide ? 1.3 : 1)),
    closed: false, cap: "SQUARE", join: "MITER", miterLimit: 2,
  }));
}
new window.p5((p) => {
  p.setup = () => { p.createCanvas(720, 560).parent(art); p.pixelDensity(1); p.noLoop(); paint(); };
  function paint() {
    const supplied = candidates();
    model = selectTaperedStrokeStrips2D({ candidates: supplied, clearance: settings.clear ? 32 : 10, exclusions: [], maxAccepted: 8, maxWork: 1000000 });
    p.background(settings.dark ? "#15282d" : "#f5f0e7");
    p.stroke(settings.dark ? "#335056" : "#ddd2c3"); p.strokeWeight(1);
    for (let y = 67; y <= 530; y += 56) p.line(56, y, 665, y);
    p.noStroke(); p.fill(settings.dark ? "#d8ded8" : "#30424a"); p.textSize(15); p.textStyle(p.BOLD);
    p.text("TIDAL ROUTES / ORDERED CLEARANCE", 56, 37); p.textStyle(p.NORMAL);
    const palette = settings.dark ? ["#e6aa84", "#b8c88e", "#79a9aa", "#b994b1"] : ["#bf6d52", "#a2a363", "#548d91", "#8b7397"];
    for (const [i, strip] of model.accepted.entries()) {
      p.stroke(settings.dark ? "#e5e4d7" : "#364148"); p.strokeWeight(1.2);
      p.fill(palette[i % palette.length]); p.beginShape();
      for (const point of strip.visible.outer) p.vertex(...point);
      p.endShape(p.CLOSE);
      p.noFill(); p.stroke(settings.dark ? "#1b3336" : "#f2eee5"); p.strokeWeight(1.2);
      for (let j = 1; j < strip.centerline.length; j += 1) p.line(...strip.centerline[j - 1], ...strip.centerline[j]);
    }
    const rejected = new Set(model.rejected.map((item) => item.id));
    p.noFill(); p.stroke(settings.dark ? "#e2a9a0" : "#ad867e"); p.strokeWeight(1.5); p.drawingContext.setLineDash([4, 6]);
    for (const candidate of supplied) if (rejected.has(candidate.id)) {
      for (let j = 1; j < candidate.points.length; j += 1) p.line(...candidate.points[j - 1], ...candidate.points[j]);
    }
    p.drawingContext.setLineDash([]);
    p.noStroke(); p.fill(settings.dark ? "#d8ded8" : "#30424a"); p.textSize(11);
    p.text("solid: retained ribbon    ·    dashed: rejected centerline", 56, 545);
    revision += 1;
    art.dataset.renderStatus = "ready"; art.dataset.revision = String(revision);
    art.dataset.model = JSON.stringify(model); art.dataset.style = settings.dark ? "dark" : "light";
    const gaps = model.rejected.filter((item) => item.reason === "CLEARANCE").length;
    const intersections = model.rejected.filter((item) => item.reason === "INTERSECTS").length;
    status.textContent = `${model.accepted.length} retained · ${gaps} too close · ${intersections} intersect · ${settings.clear ? 32 : 10}px required gap`;
    window.guardedBandsStudy = { snapshot: () => structuredClone({ settings, candidates: supplied, model }) };
  }
  function action(key) {
    if (key === "w") settings.wide = !settings.wide;
    else if (key === "g") settings.clear = !settings.clear;
    else if (key === "t") settings.transfer = !settings.transfer;
    else if (key === "c") settings.dark = !settings.dark;
    else if (key === "0") Object.assign(settings, defaults);
    else if (key === "s") { p.saveCanvas("guarded-bands", "png"); return; }
    else return;
    paint();
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(p.key.toLowerCase());
}, art);
