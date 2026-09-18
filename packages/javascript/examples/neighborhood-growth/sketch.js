import { relativeNeighborhoodPairs2D } from '../../src/relative-neighborhood-pairs-2d.js';
import { thresholdEdgeRelaxation2D } from '../../src/threshold-edge-relaxation-2d.js';
import { radiusPairs2D } from '../../src/radius-pairs-2d.js';

// Fixed proposal pool: a 14x14 jittered grid in a deterministic order.
const CELL = 640 / 14;
const fract = x => x - Math.floor(x);
const jitter = (row, col, salt) => fract(Math.sin(row * 127.1 + col * 311.7 + salt * 74.7) * 43758.5453);
const POOL = (() => {
  const points = [];
  const keyed = [];
  for (let row = 0; row < 14; row++) for (let col = 0; col < 14; col++) {
    const index = row * 14 + col;
    points.push([CELL * (col + 0.5) + (jitter(row, col, 1) - 0.5) * CELL * 0.7,
                 CELL * (row + 0.5) + (jitter(row, col, 2) - 0.5) * CELL * 0.7]);
    keyed.push({ index, key: jitter(row, col, 3) });
  }
  keyed.sort((a, b) => a.key - b.key || a.index - b.index);
  return { points, order: keyed.map(item => item.index) };
})();
const DENSITY_RADIUS = 70;
const POINT_CAP = 96;
const JUDGE_CAP = 48;
// Editable growth schedule: per-tick insertion count and the old-density interval.
const INSERT = 1, MIN_NEIGHBORS = 1, MAX_NEIGHBORS = 3;

const SEED_COUNT = 26;
const seed = () => Array.from({ length: SEED_COUNT }, (_, index) => [
  320 + 190 * Math.cos(index * 2.4) * (0.6 + index % 5 / 10),
  320 + 190 * Math.sin(index * 2.4) * (0.6 + index % 4 / 10),
]);
const seedState = () => ({ points: seed(), used: POOL.order.map(() => false), cursor: 0 });
let state = seedState(), tick = 0, marks = false, growth = true, suppliedPairs = null;
const query = () => relativeNeighborhoodPairs2D({ points: state.points,
  maxWork: state.points.length + state.points.length * (state.points.length - 1) / 2 * Math.max(0, state.points.length - 2) }).pairs;
const pairs = () => suppliedPairs ?? query();

function stepOnce() {
  const edges = pairs();
  const relaxed = thresholdEdgeRelaxation2D({ points: state.points, pairs: edges,
    pinned: state.points.map(() => false), minLength: 38, stepScale: 0.35,
    maxWork: state.points.length + edges.length }).points;
  const used = state.used.slice();
  let cursor = state.cursor, points = relaxed;
  if (growth && points.length < POINT_CAP) {
    const target = Math.min(POINT_CAP, state.points.length + INSERT);
    for (let judged = 0; judged < JUDGE_CAP && points.length < target; judged++) {
      const poolIndex = POOL.order[cursor];
      cursor = (cursor + 1) % POOL.order.length;
      if (used[poolIndex]) continue;
      const candidate = POOL.points[poolIndex];
      const extended = [...points, candidate];
      const count = radiusPairs2D({ points: extended, radius: DENSITY_RADIUS,
        maxWork: extended.length * extended.length }).pairs
        .filter(pair => pair[0] === points.length || pair[1] === points.length).length;
      if (count < MIN_NEIGHBORS || count > MAX_NEIGHBORS) continue;
      points.push(candidate);
      used[poolIndex] = true;
    }
  }
  state = { points, used, cursor };
  tick++;
}

new window.p5(p => {
  function render() {
    const edges = pairs();
    p.background('#101d2b'); p.stroke('#39776f'); p.strokeWeight(1);
    for (const [a, b] of edges) p.line(...state.points[a], ...state.points[b]);
    p.noStroke(); p.fill('#f09a66');
    for (let i = 0; i < SEED_COUNT; i++) p.circle(...state.points[i], marks ? 7 : 4);
    p.fill('#d9f2ec');
    for (let i = SEED_COUNT; i < state.points.length; i++) p.circle(...state.points[i], marks ? 7 : 4);
    document.querySelector('#status').textContent =
      `Tick ${tick} · ${state.points.length} points (${state.points.length - SEED_COUNT} inserted) · ` +
      `${edges.length} ${suppliedPairs ? 'supplied' : 'exact neighborhood'} pairs`;
  }
  const snapshot = () => ({ points: structuredClone(state.points), pairs: structuredClone(pairs()),
    suppliedPairs: suppliedPairs && structuredClone(suppliedPairs), growth, marks, tick,
    inserted: state.points.length - SEED_COUNT });
  p.setup = () => {
    p.createCanvas(640, 640).parent('art'); p.pixelDensity(1); p.noLoop();
    window.neighborhoodGrowth = Object.freeze({ snapshot, setPairs(value) {
      suppliedPairs = value === null ? null : structuredClone(value); render();
    } });
    render();
  };
  function action(key) {
    if (key === 's') { p.saveCanvas('neighborhood-growth', 'png'); return; }
    if (key === '.') stepOnce();
    else if (key === 'n') growth = !growth;
    else if (key === 'g') marks = !marks;
    else if (key === '0') { state = seedState(); tick = 0; marks = false; growth = true; suppliedPairs = null; }
    render();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) action(button.dataset.action);
  });
});
