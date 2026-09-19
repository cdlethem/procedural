import { complexEscapeDistance2D } from '../../src/complex-escape-distance-2d.js';

// Escape-time study of the quadratic map z -> z^2 + c. Two views share one
// operation: the Mandelbrot mapping samples the constant c over the plane, the
// Julia mapping samples the start point z0 for a fixed constant. Zoom/pan moves
// the sampling window; the budget sets the escape depth; exposure and the ramp
// are presentation and never resimulate the orbits.
const GRID = 512;

// Well-known Julia constants, cycled by the constant button; the default and
// most entries are lacy (boundary-dominant) so the distance glow shows filaments.
const JULIA_CONSTANTS = [
  [0.355, 0.355],
  [-0.4, 0.6],
  [0.285, 0.01],
  [-0.70176, 0.3842],
  [-0.7269, 0.1889],
  [0.1, 0.65],
  [-0.8, 0.156],
  [0, 1],
];

// Per-mapping default sampling window (center + half-width of the square view).
const VIEWS = {
  mandelbrot: { center: [-0.5, 0], half: 1.8 },
  julia: { center: [0, 0], half: 1.5 },
};

const BUDGETS = [128, 256, 512, 1024];
const EXPOSURES = [1, 2, 4, 8];

// Warm exterior ramp; the set itself (distance 0) is a fixed deep color.
const SET_COLOR = [14, 18, 32];
const RAMP = [
  [18, 24, 52], [40, 48, 96], [96, 64, 120], [180, 96, 96],
  [232, 152, 72], [248, 216, 140], [252, 250, 240],
];

function rampColor(t) {
  const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const a = RAMP[i], b = RAMP[i + 1];
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
}

// Escape-count "bands": a seamless multi-hue ramp cycled across the budget,
// so the bands accumulate at the boundary. Interior (full budget) is black.
const BAND_RAMP = [
  [16, 12, 40], [24, 40, 110], [30, 96, 168], [44, 156, 140],
  [120, 184, 92], [224, 204, 84], [240, 144, 60], [220, 72, 92],
  [150, 44, 120], [16, 12, 40],
];
const BAND_CYCLES = 3;
function bandColor(count, budget) {
  const x = (count / budget) * BAND_CYCLES;
  const t = x - Math.floor(x);
  const pos = t * (BAND_RAMP.length - 1);
  const i = Math.min(BAND_RAMP.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = BAND_RAMP[i], b = BAND_RAMP[i + 1];
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
}

let mapping = 'mandelbrot';
let center = [...VIEWS.mandelbrot.center];
let half = VIEWS.mandelbrot.half;
let constantIndex = 0;
let budgetIndex = 2;
let exposureIndex = 1;
let coloring = 'bands';

function resetView() {
  center = [...VIEWS[mapping].center];
  half = VIEWS[mapping].half;
}

new window.p5(p => {
  function render() {
    const constant = mapping === 'julia' ? JULIA_CONSTANTS[constantIndex] : [0, 0];
    const origin = [center[0] - half, center[1] - half];
    const cellSize = (2 * half) / GRID;
    const iterations = BUDGETS[budgetIndex];
    const result = complexEscapeDistance2D({
      mapping, constant,
      grid: { width: GRID, height: GRID, origin, cell: [cellSize, cellSize] },
      iterations, maxWork: iterations * GRID * GRID,
    });
    const exposure = EXPOSURES[exposureIndex];
    const g = p.createGraphics(GRID, GRID);
    g.loadPixels();
    for (let j = 0; j < GRID; j += 1) {
      const canvasRow = GRID - 1 - j;
      for (let i = 0; i < GRID; i += 1) {
        const idx = j * GRID + i;
        const [r, gg, b] = coloring === 'bands'
          ? (result.iteration[idx] === iterations ? [0, 0, 0] : bandColor(result.iteration[idx], iterations))
          : (result.distance[idx] === 0 ? SET_COLOR : rampColor(Math.log(1 + result.distance[idx]) / exposure));
        const o = (canvasRow * GRID + i) * 4;
        g.pixels[o] = r; g.pixels[o + 1] = gg; g.pixels[o + 2] = b; g.pixels[o + 3] = 255;
      }
    }
    g.updatePixels();
    p.image(g, 0, 0, p.width, p.height);
    const cc = mapping === 'julia' ? ` c=${JULIA_CONSTANTS[constantIndex][0]},${JULIA_CONSTANTS[constantIndex][1]}` : '';
    document.querySelector('#status').textContent =
      `${mapping} · center ${center[0].toFixed(3)},${center[1].toFixed(3)} · width ${(2 * half).toFixed(3)}${cc} · ` +
      `budget ${iterations} · ${coloring} · exposure ${exposure}`;
  }
  p.setup = () => {
    p.createCanvas(640, 640).parent('art'); p.pixelDensity(1); p.noLoop();
    window.complexEscape = Object.freeze({
      snapshot: () => ({ mapping, center: [...center], half, constantIndex,
        budgetIndex, exposureIndex, coloring, constant: mapping === 'julia' ? [...JULIA_CONSTANTS[constantIndex]] : [0, 0] }),
    });
    render();
  };
  function action(key) {
    if (key === 's') { p.saveCanvas('complex-escape', 'png'); return; }
    if (key === 'm') { mapping = mapping === 'mandelbrot' ? 'julia' : 'mandelbrot'; resetView(); }
    else if (key === 'z') half *= 0.7;
    else if (key === 'x') half /= 0.7;
    else if (key === 'left') center[0] -= 0.1 * half;
    else if (key === 'right') center[0] += 0.1 * half;
    else if (key === 'up') center[1] += 0.1 * half;
    else if (key === 'down') center[1] -= 0.1 * half;
    else if (key === 'c') constantIndex = (constantIndex + 1) % JULIA_CONSTANTS.length;
    else if (key === 'b') budgetIndex = (budgetIndex + 1) % BUDGETS.length;
    else if (key === 'e') exposureIndex = (exposureIndex + 1) % EXPOSURES.length;
    else if (key === 'g') coloring = coloring === 'glow' ? 'bands' : 'glow';
    else if (key === '0') { mapping = 'mandelbrot'; resetView(); constantIndex = 0; budgetIndex = 2; exposureIndex = 1; coloring = 'bands'; }
    render();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) action(button.dataset.action);
  });
});
