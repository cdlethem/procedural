import { CANVAS, panelLayout, palette, rgb } from "../motif-compositions/compositions.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const settings = { bars: false, alternate: false, tight: false };
let layout;
let revision = 0;

export function observeGeometricPanel() {
  return Object.freeze({ layout, settings: Object.freeze({ ...settings }), revision });
}

function colours() {
  return palette(settings.alternate ? "cobalt-chalk" : "ochre-plum");
}

function fullGeometryRecord() {
  return {
    columns: layout.columns,
    rows: layout.rowsCount,
    marks: layout.rows,
    cropOffsets: layout.rows.map(([, y]) => y > 420 ? 36 : 0),
  };
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
    layout = panelLayout(settings.tight);
  }

  function drawMark(x, y, scale, kind, colors) {
    p.push();
    p.translate(x, y);
    p.rotate((kind - 1.5) * 0.22);
    p.noStroke();
    if (settings.bars) {
      p.fill(...rgb(colors[kind % colors.length]));
      p.rect(-78 * scale, -9 * scale, 156 * scale, 18 * scale);
      p.fill(...rgb(colors[(kind + 2) % colors.length]), 220);
      p.rect(-9 * scale, -54 * scale, 18 * scale, 108 * scale);
    } else {
      p.fill(...rgb(colors[kind % colors.length]));
      p.triangle(-72 * scale, 48 * scale, 72 * scale, 26 * scale, -10 * scale, -66 * scale);
      p.fill(...rgb(colors[(kind + 2) % colors.length]), 210);
      p.quad(-42 * scale, 39 * scale, 19 * scale, 29 * scale, -4 * scale, -30 * scale, -55 * scale, -18 * scale);
    }
    p.pop();
  }

  function paint() {
    const colors = colours();
    p.background(...rgb(colors[4 % colors.length]));
    p.noStroke();
    p.fill(...rgb(colors[0]));
    p.rect(45, 45, 630, 630);
    p.fill(...rgb(colors[3 % colors.length]), 100);
    p.rect(80, 102, 198, 525);
    p.fill(...rgb(colors[1]), 140);
    p.rect(476, 72, 150, 575);
    for (const [x, y, scale, kind] of layout.rows) {
      drawMark(x + (y > 420 ? 36 : 0), y, scale, kind, colors);
    }
    p.noFill();
    p.stroke(...rgb(colors[4 % colors.length]), 170);
    p.strokeWeight(2);
    p.rect(63, 63, 594, 594);
    p.strokeWeight(1);
    for (let i = 0; i < 8; i += 1) p.line(88, 115 + i * 70, 632, 115 + i * 70);

    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.anchors = JSON.stringify(layout.rows);
    art.dataset.geometry = JSON.stringify(fullGeometryRecord());
    art.dataset.renderStatus = "ready";
    status.textContent = `${layout.columns} × ${layout.rowsCount} retained grid · ${settings.bars ? "bars" : "wedges"} · ${settings.tight ? "tight" : "open"} layout`;
  }

  function action(name) {
    let structural = false;
    if (name === "m") settings.bars = !settings.bars;
    else if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "d") { settings.tight = !settings.tight; structural = true; }
    else if (name === "0") {
      Object.assign(settings, { bars: false, alternate: false, tight: false });
      structural = true;
    } else if (name === "s") {
      p.saveCanvas("geometric-panel", "png");
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
