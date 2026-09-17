import { CANVAS, orbitalLayout, palette, rgb } from "../motif-compositions/compositions.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const settings = { beads: false, alternate: false, more: false };
let layout;
let revision = 0;

export function observeOrbitalBrush() {
  return Object.freeze({ layout, settings: Object.freeze({ ...settings }), revision });
}

function colours() {
  return palette(settings.alternate ? "electric-citrus" : "mauve-mist");
}

function fullGeometryRecord() {
  return layout.paths.map((path) => ({
    points: path.points,
    colorIndex: path.colorIndex,
    width: path.width,
  }));
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(CANVAS, CANVAS, p.P2D).parent(art);
    p.pixelDensity(1);
    p.noLoop();
    rebuild();
    paint();
  };

  function rebuild() {
    layout = orbitalLayout(settings.more);
  }

  function drawPath(path, index, colors) {
    const color = rgb(colors[index % colors.length]);
    p.noFill();
    p.stroke(...color, settings.beads ? 115 : 180);
    p.strokeCap(p.ROUND);
    p.strokeWeight(path.width);
    if (settings.beads) {
      p.noStroke();
      p.fill(...color, 175);
      for (let i = 0; i < path.points.length; i += 5) {
        const [x, y] = path.points[i];
        p.circle(x, y, 2.5 + (index % 3));
      }
      return;
    }
    p.beginShape();
    for (const [x, y] of path.points) p.vertex(x, y);
    p.endShape(p.CLOSE);
  }

  function paint() {
    const colors = colours();
    p.background(245, 243, 238);
    p.noStroke();
    p.fill(...rgb(colors[4 % colors.length]), 28);
    p.circle(304, 340, 125);
    p.circle(422, 286, 98);
    p.circle(387, 448, 150);
    p.noFill();
    p.stroke(48, 42, 52, 24);
    p.strokeWeight(1);
    for (let i = 0; i < 12; i += 1) p.circle(360, 360, 110 + i * 33);
    for (let i = 0; i < layout.paths.length; i += 1) drawPath(layout.paths[i], i, colors);
    p.noStroke();
    p.fill(48, 42, 52, 170);
    p.circle(304, 340, 7);
    p.circle(422, 286, 6);
    p.circle(387, 448, 8);

    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.anchors = JSON.stringify(layout.paths.map((path) => path.points));
    art.dataset.geometry = JSON.stringify(fullGeometryRecord());
    art.dataset.renderStatus = "ready";
    status.textContent = `${layout.paths.length} retained resampled paths · ${settings.beads ? "beads" : "ribbon"} · ${settings.more ? "more" : "fewer"} paths`;
  }

  function action(name) {
    let structural = false;
    if (name === "m") settings.beads = !settings.beads;
    else if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "d") { settings.more = !settings.more; structural = true; }
    else if (name === "0") {
      Object.assign(settings, { beads: false, alternate: false, more: false });
      structural = true;
    } else if (name === "s") {
      p.saveCanvas("orbital-brush", "png");
      return;
    } else return;
    if (structural) rebuild();
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
