import { fractalFlameAccumulate2D } from '../../src/fractal-flame-accumulate-2d.js';

// Authored flame: a mild-scale body map keeps the attractor connected while
// five branch maps add the fractal wisps. The shape is fixed by these maps;
// edit them, the seeds, the budget or the density window here.
const rot = (s, th) => [s * Math.cos(th), s * Math.sin(th), -s * Math.sin(th), s * Math.cos(th)];
const BASE_TRANSFORMS = [
  { a: rot(0.55, 0.0), t: [0.0, 1.6], power: 'linear', weight: 3 },
  { a: rot(0.55, 0.8), t: [1.0, 0.4], power: 'sin', weight: 2 },
  { a: rot(0.55, -0.8), t: [-1.0, 0.4], power: 'linear', weight: 2 },
  { a: rot(0.48, 1.5), t: [0.4, -1.2], power: 'abs', weight: 2 },
  { a: rot(0.48, -1.5), t: [-0.4, -1.2], power: 'linear', weight: 2 },
  { a: rot(0.50, 0.0), t: [0.0, 2.6], power: 'sin', weight: 1 },
];
const SEEDS = [[0, 0], [0.3, -0.2]];
const ITERATIONS = 400000;
const GRID = 256;                 // density resolution
const WORLD = 10;                 // world spans [-WORLD/2, WORLD/2] on both axes
const CELL = WORLD / GRID;
// Origin is the bottom-left world corner; positive cell, then the render flips y.
const DENSITY = { width: GRID, height: GRID, origin: [-WORLD / 2, -WORLD / 2], cell: [CELL, CELL] };

// Deterministic transform perturbation: decompose each map into scale + angle,
// then nudge scale, angle and offset by a small seeded amount. Variation 0 is
// the authored base; larger seeds explore neighboring flames.
function perturb(base, seed) {
  let s = seed >>> 0 || 1;
  const rnd = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
  return base.map(tr => {
    const [a00, , a10,] = tr.a;
    const scale = Math.hypot(a00, a10) * (1 + (rnd() - 0.5) * 0.3);
    const angle = Math.atan2(a10, a00) + (rnd() - 0.5) * 0.5;
    const c = Math.cos(angle), sn = Math.sin(angle);
    return { a: [scale * c, scale * sn, -scale * sn, scale * c],
      t: [tr.t[0] + (rnd() - 0.5) * 1.5, tr.t[1] + (rnd() - 0.5) * 1.5],
      power: tr.power, weight: tr.weight };
  });
}

// Presentation: logarithmic exposure and a small color ramp, editable without
// resimulating the point process.
const EXPOSURES = [2.0, 4.0, 8.0, 16.0];
const RAMP = [
  [8, 12, 24], [18, 42, 66], [24, 92, 104], [120, 170, 120],
  [236, 210, 140], [250, 244, 224],
];

let variation = 0, exposureIndex = 2, paletteFlip = false;
const activeTransforms = () => variation === 0 ? BASE_TRANSFORMS : perturb(BASE_TRANSFORMS, variation * 2654435761 + 1013904223);

function rampColor(t) {
  const stops = paletteFlip ? RAMP.slice().reverse() : RAMP;
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i], b = stops[i + 1];
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
}

new window.p5(p => {
  function render() {
    const transforms = activeTransforms();
    const result = fractalFlameAccumulate2D({
      transforms, seeds: SEEDS, iterations: ITERATIONS,
      density: DENSITY, rngState: 42 + variation, maxWork: ITERATIONS,
    });
    const exposure = EXPOSURES[exposureIndex];
    const g = p.createGraphics(GRID, GRID);
    g.loadPixels();
    const values = result.density.values;
    for (let j = 0; j < GRID; j += 1) {
      const canvasRow = GRID - 1 - j;
      for (let ix = 0; ix < GRID; ix += 1) {
        const t = Math.min(1, Math.log(1 + values[j * GRID + ix]) / exposure);
        const [r, gg, b] = rampColor(t);
        const o = (canvasRow * GRID + ix) * 4;
        g.pixels[o] = r; g.pixels[o + 1] = gg; g.pixels[o + 2] = b; g.pixels[o + 3] = 255;
      }
    }
    g.updatePixels();
    p.image(g, 0, 0, p.width, p.height);
    document.querySelector('#status').textContent =
      `variation ${variation} · ${ITERATIONS.toLocaleString()} iterates · ` +
      `${result.plotted.toLocaleString()} plotted, ${result.dropped.toLocaleString()} dropped · ` +
      `exposure ${exposure} · ${paletteFlip ? 'inverted' : 'base'} ramp`;
  }
  p.setup = () => {
    p.createCanvas(640, 640).parent('art'); p.pixelDensity(1); p.noLoop();
    window.fractalFlame = Object.freeze({
      snapshot: () => ({ variation, exposureIndex, paletteFlip,
        transforms: structuredClone(activeTransforms()), seeds: structuredClone(SEEDS) }),
    });
    render();
  };
  function action(key) {
    if (key === 's') { p.saveCanvas('fractal-flame', 'png'); return; }
    if (key === 'v') variation += 1;
    else if (key === 'e') exposureIndex = (exposureIndex + 1) % EXPOSURES.length;
    else if (key === 'p') paletteFlip = !paletteFlip;
    else if (key === '0') { variation = 0; exposureIndex = 2; paletteFlip = false; }
    render();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) action(button.dataset.action);
  });
});
