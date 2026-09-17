import { relativeNeighborhoodPairs2D } from '../../src/relative-neighborhood-pairs-2d.js';
import { thresholdEdgeRelaxation2D } from '../../src/threshold-edge-relaxation-2d.js';

const seed = () => Array.from({ length: 26 }, (_, index) => [
  320 + 190 * Math.cos(index * 2.4) * (0.6 + index % 5 / 10),
  320 + 190 * Math.sin(index * 2.4) * (0.6 + index % 4 / 10),
]);
let points = seed(), tick = 0, marks = false, suppliedPairs = null;
const query = () => relativeNeighborhoodPairs2D({ points,
  maxWork: points.length + points.length * (points.length - 1) / 2 * Math.max(0, points.length - 2) }).pairs;
const pairs = () => suppliedPairs ?? query();

new window.p5(p => {
  function render() {
    const edges = pairs();
    p.background('#101d2b'); p.stroke('#39776f'); p.strokeWeight(1);
    for (const [a, b] of edges) p.line(...points[a], ...points[b]);
    p.noStroke(); p.fill('#f09a66');
    for (const point of points) p.circle(...point, marks ? 7 : 4);
    document.querySelector('#status').textContent = `Tick ${tick} · ${edges.length} ${suppliedPairs ? 'supplied' : 'exact neighborhood'} pairs`;
  }
  const snapshot = () => ({ points: structuredClone(points), pairs: structuredClone(pairs()),
    suppliedPairs: suppliedPairs && structuredClone(suppliedPairs), tick, marks });
  p.setup = () => {
    p.createCanvas(640, 640).parent('art'); p.pixelDensity(1); p.noLoop();
    window.neighborhoodGrowth = Object.freeze({ snapshot, setPairs(value) {
      suppliedPairs = value === null ? null : structuredClone(value); render();
    } });
    render();
  };
  function action(key) {
    if (key === 's') { p.saveCanvas('neighborhood-growth', 'png'); return; }
    if (key === '.') {
      const edges = pairs();
      points = thresholdEdgeRelaxation2D({ points, pairs: edges,
        pinned: points.map(() => false), minLength: 38, stepScale: 0.35,
        maxWork: points.length + edges.length }).points;
      tick++;
    } else if (key === 'g') marks = !marks;
    else if (key === '0') { points = seed(); tick = 0; marks = false; suppliedPairs = null; }
    render();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) action(button.dataset.action);
  });
});
