import {
  array, at, fail, integer, MAX_ARRAY, MAX_SAFE, num, point,
  rationalPoint, record, R, segment, samePoint, ZERO, ONE,
} from "./internal/graph-growth-utils.js";

export class InsertSegmentBridge2DError extends Error {
  constructor(code) { super(code); this.name = "InsertSegmentBridge2DError"; this.code = code; }
}
const ErrorType = InsertSegmentBridge2DError;
const bad = code => fail(ErrorType, code);

function capture(input) {
  const source = record(input, ["graph", "candidate", "gapIndex", "maxNodes", "maxEdges", "maxWork"], ErrorType);
  const graph = record(at(source, "graph"), ["nodes", "edges", "nextNodeId", "nextEdgeId"], ErrorType);
  const nodeArray = array(at(graph, "nodes"), ErrorType);
  const nodes = [];
  for (let index = 0; index < nodeArray.length; index++) {
    const raw = record(at(nodeArray, index), ["id", "point"], ErrorType);
    nodes.push({ id: integer(at(raw, "id"), ErrorType), point: point(at(raw, "point"), ErrorType) });
  }
  const edgeArray = array(at(graph, "edges"), ErrorType);
  const edges = [];
  for (let index = 0; index < edgeArray.length; index++) {
    const raw = record(at(edgeArray, index), ["id", "a", "b"], ErrorType);
    edges.push({ id: integer(at(raw, "id"), ErrorType), a: integer(at(raw, "a"), ErrorType), b: integer(at(raw, "b"), ErrorType) });
  }
  const nextNodeId = integer(at(graph, "nextNodeId"), ErrorType);
  const nextEdgeId = integer(at(graph, "nextEdgeId"), ErrorType);
  const rawCandidate = array(at(source, "candidate"), ErrorType, 2);
  const candidate = [point(at(rawCandidate, 0), ErrorType), point(at(rawCandidate, 1), ErrorType)];
  const gapIndex = integer(at(source, "gapIndex"), ErrorType);
  const maxNodes = integer(at(source, "maxNodes"), ErrorType, 0, MAX_ARRAY);
  const maxEdges = integer(at(source, "maxEdges"), ErrorType, 0, MAX_ARRAY);
  const maxWork = integer(at(source, "maxWork"), ErrorType);
  if (candidate[0][0] === candidate[1][0] && candidate[0][1] === candidate[1][1]) bad("INVALID_INPUT");
  return { nodes, edges, nextNodeId, nextEdgeId, candidate, gapIndex, maxNodes, maxEdges, maxWork };
}

function validateTopology(state) {
  const { nodes, edges } = state;
  const byId = new Map();
  let priorId = -1;
  for (const node of nodes) {
    if (node.id <= priorId) bad("INVALID_TOPOLOGY");
    priorId = node.id;
    byId.set(node.id, node);
  }
  if (nodes.length && state.nextNodeId <= priorId) bad("INVALID_INPUT");
  priorId = -1;
  const connections = new Set();
  for (const edge of edges) {
    if (edge.id <= priorId || edge.a === edge.b || !byId.has(edge.a) || !byId.has(edge.b)) bad("INVALID_TOPOLOGY");
    priorId = edge.id;
    const pair = edge.a < edge.b ? `${edge.a},${edge.b}` : `${edge.b},${edge.a}`;
    if (connections.has(pair)) bad("INVALID_TOPOLOGY");
    connections.add(pair);
  }
  if (edges.length && state.nextEdgeId <= priorId) bad("INVALID_INPUT");
  if (state.maxNodes < nodes.length || state.maxEdges < edges.length) bad("INVALID_INPUT");
  return byId;
}

function reserveWork(state) {
  const n = BigInt(state.nodes.length), e = BigInt(state.edges.length), cap = BigInt(state.maxEdges);
  const required = n + 2n * e + e * e + cap * cap + 16n;
  if (required > BigInt(state.maxWork) || required > BigInt(MAX_SAFE)) bad("WORK_LIMIT");
}

function geometry(nodes, edges, invalidCode) {
  const coordinateIds = new Map();
  for (const node of nodes) {
    const key = `${node.point[0]},${node.point[1]}`;
    if (coordinateIds.has(key)) bad(invalidCode);
    coordinateIds.set(key, node.id);
    node.exact = rationalPoint(node.point);
  }
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (let first = 0; first < edges.length; first++) {
    const left = edges[first];
    const a = byId.get(left.a).exact, b = byId.get(left.b).exact;
    if (samePoint(a, b)) bad(invalidCode);
    for (let second = first + 1; second < edges.length; second++) {
      const right = edges[second];
      const c = byId.get(right.a).exact, d = byId.get(right.b).exact;
      const contact = segment(a, b, c, d);
      if (contact.kind === "miss") continue;
      if (contact.kind === "overlap") bad(invalidCode);
      const shared = left.a === right.a || left.a === right.b ? left.a
        : left.b === right.a || left.b === right.b ? left.b : undefined;
      if (shared === undefined || !samePoint(contact.point, byId.get(shared).exact)) bad(invalidCode);
    }
  }
  return byId;
}

function enumerate(state, byId) {
  const start = rationalPoint(state.candidate[0]), end = rationalPoint(state.candidate[1]);
  const hits = [];
  for (const edge of state.edges) {
    const contact = segment(start, end, byId.get(edge.a).exact, byId.get(edge.b).exact);
    if (contact.kind === "overlap") bad("AMBIGUOUS_OVERLAP");
    if (contact.kind === "miss") continue;
    const nodeId = contact.u.equals(ZERO) ? edge.a : contact.u.equals(ONE) ? edge.b : undefined;
    hits.push({ ...contact, edge, nodeId });
  }
  hits.sort((a, b) => a.t.compareTo(b.t));
  const distinct = [];
  for (const hit of hits) {
    const previous = distinct.at(-1);
    if (!previous || !previous.t.equals(hit.t)) distinct.push(hit);
    else if (previous.nodeId === undefined && hit.nodeId !== undefined) previous.nodeId = hit.nodeId;
  }
  return distinct;
}

function detachedGraph(nodes, edges, nextNodeId, nextEdgeId) {
  return {
    nodes: nodes.map(node => ({ id: node.id, point: [...node.point] })),
    edges: edges.map(edge => ({ id: edge.id, a: edge.a, b: edge.b })),
    nextNodeId, nextEdgeId,
  };
}

export function insertSegmentBridge2D(input) {
  const state = capture(input);
  const byId = validateTopology(state);
  reserveWork(state);
  geometry(state.nodes, state.edges, "INVALID_GEOMETRY");
  const hits = enumerate(state, byId);
  if (hits.length < 2) return {
    graph: detachedGraph(state.nodes, state.edges, state.nextNodeId, state.nextEdgeId),
    events: [], inserted: false, reason: "INSUFFICIENT_HITS",
  };
  if (state.gapIndex >= hits.length - 1) bad("INVALID_INPUT");
  const selected = [hits[state.gapIndex], hits[state.gapIndex + 1]];
  const splits = selected.filter(hit => hit.nodeId === undefined).sort((a, b) => a.edge.id - b.edge.id);
  if (state.nodes.length + splits.length > state.maxNodes ||
      state.edges.length + splits.length + 1 > state.maxEdges) bad("OUTPUT_LIMIT");
  if (state.nextNodeId > MAX_SAFE - splits.length ||
      state.nextEdgeId > MAX_SAFE - (2 * splits.length + 1)) bad("ID_EXHAUSTED");

  const nodes = state.nodes.map(node => ({ id: node.id, point: [...node.point] }));
  let nextNodeId = state.nextNodeId, nextEdgeId = state.nextEdgeId;
  for (const hit of selected) {
    if (hit.nodeId !== undefined) continue;
    hit.nodeId = nextNodeId++;
    const rounded = hit.point.map(coordinate => coordinate.value());
    if (rounded.some(coordinate => !Number.isFinite(coordinate))) bad("REPRESENTATION_COLLAPSE");
    nodes.push({ id: hit.nodeId, point: rounded });
  }

  const events = [], removed = new Set(), addedEdges = [];
  for (const hit of splits) {
    const edge = hit.edge;
    const parent = segment(byId.get(edge.a).exact, byId.get(edge.b).exact,
      rationalPoint(state.candidate[0]), rationalPoint(state.candidate[1]));
    const parentT = parent.t.value();
    if (parent.t.equals(ZERO) || parent.t.equals(ONE) || parentT === 0 || parentT === 1) bad("REPRESENTATION_COLLAPSE");
    const firstId = nextEdgeId++, secondId = nextEdgeId++;
    removed.add(edge.id);
    addedEdges.push({ id: firstId, a: edge.a, b: hit.nodeId }, { id: secondId, a: hit.nodeId, b: edge.b });
    events.push({ type: "split", parentEdgeId: edge.id, nodeId: hit.nodeId,
      childEdgeIds: [firstId, secondId], parentT });
  }
  const connectorId = nextEdgeId++;
  addedEdges.push({ id: connectorId, a: selected[0].nodeId, b: selected[1].nodeId });
  events.push({ type: "link", edgeId: connectorId, nodeIds: [selected[0].nodeId, selected[1].nodeId] });
  const edges = [...state.edges.filter(edge => !removed.has(edge.id)), ...addedEdges];
  nodes.sort((a, b) => a.id - b.id);
  edges.sort((a, b) => a.id - b.id);
  geometry(nodes, edges, "REPRESENTATION_COLLAPSE");
  return { graph: detachedGraph(nodes, edges, nextNodeId, nextEdgeId), events, inserted: true, reason: null };
}
