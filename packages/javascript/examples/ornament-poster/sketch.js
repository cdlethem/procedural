import { botanicalLayout, CANVAS, palette, rgb } from "../motif-compositions/compositions.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const settings = { motif: 0, alternate: false, dense: false, hierarchy: true, crop: true };
let layout;
let revision = 0;

/** Browser-only observation for the complete retained anchor/layout checks. */
export function observeOrnamentPoster() {
  return Object.freeze({ layout, settings: Object.freeze({ ...settings }), revision });
}

function colours() {
  return palette(settings.alternate ? "fern-mauve" : "sage-linen");
}

function cropBounds() {
  return settings.crop ? [112, 132, 496, 432] : [78, 78, 564, 564];
}

function scaleAt(radius, index) {
  if (!settings.hierarchy) return radius;
  return radius * (index % 7 === 0 ? 1.55 : index % 3 === 0 ? 1.18 : 0.72);
}

function anchorRecord() {
  return layout.rows;
}

function fullGeometryRecord() {
  const [x, y, width, height] = cropBounds();
  return {
    anchors: anchorRecord(),
    crop: [x, y, width, height],
    motifs: layout.rows.map(([cx, cy, radius, index]) => [cx, cy, scaleAt(radius, index), index]),
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
    layout = botanicalLayout(settings.dense);
  }

  function drawPetals(radius, index, colors) {
    for (let petal = 0; petal < 5; petal += 1) {
      p.fill(...rgb(colors[(index + petal) % colors.length]), 210);
      p.ellipse(
        Math.cos(petal * p.TWO_PI / 5) * radius * 0.34,
        Math.sin(petal * p.TWO_PI / 5) * radius * 0.34,
        radius * 0.72,
        radius * 0.44,
      );
    }
    p.fill(...rgb(colors[(index + 2) % colors.length]));
    p.circle(0, 0, Math.max(5, radius * 0.34));
  }

  function drawLeaf(radius, index, colors) {
    p.fill(...rgb(colors[(index + 1) % colors.length]), 220);
    p.ellipse(0, 0, radius * 0.76, radius * 1.8);
    p.stroke(...rgb(colors[(index + 3) % colors.length]), 160);
    p.strokeWeight(1);
    p.line(0, -radius * 0.75, 0, radius * 0.75);
  }

  /** A deliberately abstract, letter-like emblem with no source asset dependency. */
  function drawEmblem(radius, index, colors) {
    const accent = rgb(colors[(index + 2) % colors.length]);
    p.noFill();
    p.stroke(...accent, 230);
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

  function drawMotif(x, y, radius, index, colors) {
    p.push();
    p.translate(x, y);
    p.rotate(index * 0.618);
    p.noStroke();
    if (settings.motif === 0) drawPetals(radius, index, colors);
    else if (settings.motif === 1) drawLeaf(radius, index, colors);
    else drawEmblem(radius, index, colors);
    p.pop();
  }

  function paint() {
    const colors = colours();
    const [cropX, cropY, cropWidth, cropHeight] = cropBounds();
    p.background(...rgb(colors[5 % colors.length]));
    p.noStroke();
    p.fill(...rgb(colors[0]), 30);
    for (let y = 40; y < CANVAS; y += 28) p.rect(0, y, CANVAS, 1);
    p.fill(...rgb(colors[0]));
    p.rect(45, 45, CANVAS - 90, CANVAS - 90);
    p.fill(...rgb(colors[4 % colors.length]));
    p.rect(60, 60, CANVAS - 120, CANVAS - 120);

    p.drawingContext.save();
    p.drawingContext.beginPath();
    p.drawingContext.rect(cropX, cropY, cropWidth, cropHeight);
    p.drawingContext.clip();
    for (const [x, y, radius, index] of layout.rows) {
      drawMotif(x, y, scaleAt(radius, index), index, colors);
    }
    p.drawingContext.restore();

    p.noFill();
    p.stroke(...rgb(colors[0]));
    p.strokeWeight(2);
    p.rect(78, 78, CANVAS - 156, CANVAS - 156);
    p.push();
    p.noStroke();
    p.fill(...rgb(colors[0]));
    p.rect(168, 306, 384, 108);
    p.fill(247, 247, 235);
    p.textAlign(p.CENTER, p.CENTER);
    p.textStyle(p.BOLD);
    p.textSize(36);
    p.text("WILD ORNAMENT", 360, 346);
    p.textStyle(p.NORMAL);
    p.textSize(13);
    p.text("FIELD NOTES / EDITION 08", 360, 380);
    p.pop();

    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.anchors = JSON.stringify(anchorRecord());
    art.dataset.geometry = JSON.stringify(fullGeometryRecord());
    art.dataset.renderStatus = "ready";
    const motifName = ["petals", "leaves", "emblems"][settings.motif];
    status.textContent = `${layout.rows.length} anchors · ${motifName} · ${settings.hierarchy ? "tiered" : "uniform"} scale · ${settings.crop ? "cropped" : "full"} field`;
  }

  function action(name) {
    let structural = false;
    if (name === "m") settings.motif = (settings.motif + 1) % 3;
    else if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "h") settings.hierarchy = !settings.hierarchy;
    else if (name === "x") settings.crop = !settings.crop;
    else if (name === "d") { settings.dense = !settings.dense; structural = true; }
    else if (name === "0") {
      Object.assign(settings, { motif: 0, alternate: false, dense: false, hierarchy: true, crop: true });
      structural = true;
    } else if (name === "s") {
      p.saveCanvas("ornament-poster", "png");
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
