import { insertSegmentBridge2D } from '../../src/insert-segment-bridge-2d.js';

const STRANDS = 7;
const LEVELS = [54, 162, 268, 374, 480, 586];
const MAX_INSERTS = 42;

function initial() {
  const nodes = [], edges = [];
  let edgeId = 0;
  for (let strand = 0; strand < STRANDS; strand++) {
    let previous;
    for (const y of LEVELS) {
      const x = 78 + strand * 80 + 25 * Math.sin(y * 0.015 + strand * 1.1)
        + 13 * Math.cos(y * 0.029 + strand * 0.65);
      const id = nodes.length;
      nodes.push({ id, point: [x, y] });
      if (previous !== undefined) edges.push({ id: edgeId++, a: previous, b: id });
      previous = id;
    }
  }
  return { nodes, edges, nextNodeId: nodes.length, nextEdgeId: edgeId };
}

let graph = initial(), tick = 0, weave = false;
let edgeKinds = new Map(graph.edges.map(edge => [edge.id, 'strand']));
let lastEvents = [];
function candidate() {
  const baseY = 110 + tick * 9.8;
  const slant = (weave ? -1 : 1) * (31 + 23 * Math.sin(tick * 0.53));
  return [[24, baseY - slant], [616, baseY + slant]];
}
function gapIndex() {
  return weave ? (tick * 5 + 2 + Math.floor(tick / 5)) % (STRANDS - 1)
    : (tick * 5 + Math.floor(tick / 7)) % (STRANDS - 1);
}
function takeStep() {
  if (tick >= MAX_INSERTS) return;
  const result = insertSegmentBridge2D({ graph, candidate: candidate(), gapIndex: gapIndex(),
    maxNodes: 160, maxEdges: 200, maxWork: 90000 });
  for (const event of result.events) {
    if (event.type === 'split') {
      const kind = edgeKinds.get(event.parentEdgeId) ?? 'strand';
      edgeKinds.delete(event.parentEdgeId);
      for (const id of event.childEdgeIds) edgeKinds.set(id, kind);
    } else edgeKinds.set(event.edgeId, 'bridge');
  }
  graph = result.graph;
  lastEvents = result.events;
  tick++;
}

new window.p5(p => {
  function render() {
    p.background('#f4efe6');
    const byId = new Map(graph.nodes.map(node => [node.id, node.point]));
    // A faint warp-like underdrawing keeps the accumulated graph easy to read.
    p.noFill(); p.stroke('#d4c7b3'); p.strokeWeight(1);
    for (const edge of graph.edges) if (edgeKinds.get(edge.id) === 'strand')
      p.line(...byId.get(edge.a), ...byId.get(edge.b));
    p.stroke('#315d61'); p.strokeWeight(2.2);
    for (const edge of graph.edges) if (edgeKinds.get(edge.id) === 'strand')
      p.line(...byId.get(edge.a), ...byId.get(edge.b));
    p.stroke('#b34d3f'); p.strokeWeight(3.4);
    for (const edge of graph.edges) if (edgeKinds.get(edge.id) === 'bridge')
      p.line(...byId.get(edge.a), ...byId.get(edge.b));
    if (tick < MAX_INSERTS) {
      p.stroke('#d89b7c'); p.strokeWeight(1);
      p.drawingContext.setLineDash([5, 7]);
      p.line(...candidate()[0], ...candidate()[1]);
      p.drawingContext.setLineDash([]);
    }
    p.noStroke(); p.fill('#29484b');
    for (const node of graph.nodes) p.circle(...node.point, 3.7);
    p.fill('#b34d3f');
    for (const event of lastEvents) if (event.type === 'link')
      for (const id of event.nodeIds) p.circle(...byId.get(id), 7);
    document.querySelector('#status').textContent = `${tick}/${MAX_INSERTS} bridges · ${graph.nodes.length} nodes · ${graph.edges.length} edges · ${weave ? 'cross route' : 'rising route'}`;
  }
  const snapshot = () => ({ graph: structuredClone(graph), tick, weave, candidate: candidate(),
    gapIndex: gapIndex(), edgeKinds: [...edgeKinds].sort((a, b) => a[0] - b[0]), lastEvents: structuredClone(lastEvents) });
  p.setup = () => {
    p.createCanvas(640, 640).parent('art'); p.pixelDensity(1); p.noLoop();
    window.bridgeWeb = Object.freeze({ snapshot, setGraph(value) {
      graph = structuredClone(value);
      edgeKinds = new Map(graph.edges.map(edge => [edge.id, 'strand']));
      lastEvents = [];
      render();
    } });
    render();
  };
  function action(key) {
    if (key === 's') { p.saveCanvas('bridge-web', 'png'); return; }
    if (key === '.') takeStep();
    else if (key === 'r') weave = !weave;
    else if (key === '0') {
      graph = initial(); tick = 0; weave = false; lastEvents = [];
      edgeKinds = new Map(graph.edges.map(edge => [edge.id, 'strand']));
    }
    render();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) action(button.dataset.action);
  });
});
