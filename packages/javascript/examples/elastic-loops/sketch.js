import { elasticCurveGrowStep2D } from '../../src/elastic-curve-grow-step-2d.js';

const MAX_STEPS = 36;
const COLORS = ['#ec9c78', '#e8c274', '#84c8c5'];

function initial() {
  const nodes = [], curves = [];
  let nextEdgeId = 0;
  for (let curveIndex = 0; curveIndex < 3; curveIndex++) {
    const nodeIds = [], edgeIds = [], restLengths = [], restTurns = [];
    for (let index = 0; index < 10; index++) {
      const y = 88 + 49 * index;
      const x = 145 + 175 * curveIndex + 27 * Math.sin(index * 0.72 + curveIndex * 0.85);
      const id = nodes.length;
      nodes.push({ id, position: [x, y], velocity: [0, 0], pinned: index === 0 });
      nodeIds.push(id);
      if (index > 0) {
        edgeIds.push(nextEdgeId++);
        const a = nodes[nodeIds[index - 1]].position, b = nodes[id].position;
        restLengths.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
    }
    for (let index = 1; index < 9; index++) {
      const a = nodes[nodeIds[index - 1]].position;
      const b = nodes[nodeIds[index]].position;
      const c = nodes[nodeIds[index + 1]].position;
      const incoming = [b[0] - a[0], b[1] - a[1]];
      const outgoing = [c[0] - b[0], c[1] - b[1]];
      restTurns.push(Math.atan2(incoming[0] * outgoing[1] - incoming[1] * outgoing[0],
        incoming[0] * outgoing[0] + incoming[1] * outgoing[1]));
    }
    curves.push({ id: curveIndex, closed: false, nodeIds, edgeIds, restLengths, restTurns });
  }
  return { nodes, curves, nextNodeId: nodes.length, nextEdgeId };
}

const seed = initial();
let state = structuredClone(seed), tick = 0, reverseCurl = false, showStructure = false, wind = [0, 0];
let lastEvents = [];

new window.p5(p => {
  function drawCurve(curve, positions, color, weight) {
    p.stroke(color); p.strokeWeight(weight); p.noFill();
    for (let index = 0; index < curve.nodeIds.length - 1; index++)
      p.line(...positions.get(curve.nodeIds[index]), ...positions.get(curve.nodeIds[index + 1]));
  }
  function render() {
    p.background('#152534'); p.strokeCap(p.ROUND);
    const original = new Map(seed.nodes.map(node => [node.id, node.position]));
    const current = new Map(state.nodes.map(node => [node.id, node.position]));
    for (const curve of seed.curves) drawCurve(curve, original, '#304554', 1.2);
    for (const curve of state.curves) {
      drawCurve(curve, current, '#0c1722', 13);
      drawCurve(curve, current, COLORS[curve.id], 8);
      drawCurve(curve, current, '#f5e7d5', 1.1);
    }
    if (showStructure) {
      p.noStroke(); p.fill('#f5e7d5');
      for (const node of state.nodes) p.circle(...node.position, node.id < seed.nodes.length ? 5 : 2.7);
    }
    p.noStroke();
    for (const curve of state.curves) {
      const first = current.get(curve.nodeIds[0]), last = current.get(curve.nodeIds.at(-1));
      p.fill('#f5e7d5'); p.circle(...first, 10);
      p.fill(COLORS[curve.id]); p.circle(...last, 9);
    }
    document.querySelector('#status').textContent = `Tick ${tick}/${MAX_STEPS} · ${state.nodes.length} nodes · ${lastEvents.length} new splits · ${reverseCurl ? 'reverse' : 'forward'} curl`;
  }
  const snapshot = () => ({ state: structuredClone(state), tick, reverseCurl, showStructure,
    wind: [...wind], lastEvents: structuredClone(lastEvents) });
  p.setup = () => {
    p.createCanvas(640, 640).parent('art'); p.pixelDensity(1); p.noLoop();
    window.elasticLoops = Object.freeze({ snapshot, setWind(value) { wind = [...value]; render(); } });
    render();
  };
  function step() {
    if (tick >= MAX_STEPS) return;
    const restGrowth = state.curves.map(curve => curve.restLengths.map(length => length * 0.018));
    const turnRates = state.curves.map(curve => curve.restTurns.map((_, index) => {
      const id = curve.nodeIds[index + 1];
      if (id >= seed.nodes.length) return 0;
      const direction = curve.id === 1 ? -1 : 1;
      const profile = 0.7 + 0.3 * Math.sin(Math.PI * (id % 10) / 9);
      return (reverseCurl ? -1 : 1) * direction * 0.09 * profile;
    }));
    const externalAccelerations = state.nodes.map(() => [...wind]);
    const result = elasticCurveGrowStep2D({ state, restGrowth, turnRates, externalAccelerations,
      stretchStiffness: 0.03, bendStiffness: 80,
      contactRange: 55, contactStrength: 18, damping: 0.88, dt: 0.4,
      maxSpeed: 6, maxSegmentLength: 42,
      maxNodes: 160, maxEdges: 160, maxWork: 400000, maxBacktracks: 8 });
    state = result.state; lastEvents = result.events; tick++;
  }
  function action(key) {
    if (key === 's') { p.saveCanvas('elastic-loops', 'png'); return; }
    if (key === '.') step();
    else if (key === 'g') reverseCurl = !reverseCurl;
    else if (key === 'm') showStructure = !showStructure;
    else if (key === '0') {
      state = structuredClone(seed); tick = 0; reverseCurl = false;
      showStructure = false; wind = [0, 0]; lastEvents = [];
    }
    render();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) action(button.dataset.action);
  });
});
