import { fdlibmAtan2 } from "./fdlibm-trig.js";
import { array, at, calc, integer, MAX_ARRAY, MAX_SAFE, num, point, rationalPoint, R, record, z } from "./internal/graph-growth-utils.js";
import { closestSegments, edgesOf, embedded, midpoint, norm, principal } from "./internal/elastic-growth-utils.js";

export class ElasticCurveGrowStep2DError extends Error {
  constructor(code) { super(code); this.name = "ElasticCurveGrowStep2DError"; this.code = code; }
}
const ErrorType = ElasticCurveGrowStep2DError;
const bad = code => { throw new ErrorType(code); };
const checked = value => calc(value, ErrorType);
function numbers(value, length, positive = false) {
  const raw = array(value, ErrorType);
  const result = [];
  for (let i = 0; i < raw.length; i++) {
    const number = num(at(raw, i), ErrorType);
    if (positive && number <= 0) bad("INVALID_INPUT");
    result.push(number);
  }
  if (length !== undefined && result.length !== length) bad("INVALID_INPUT");
  return result;
}
function integers(value) {
  const raw = array(value, ErrorType), result = [];
  for (let i = 0; i < raw.length; i++) result.push(integer(at(raw, i), ErrorType));
  return result;
}
function pairs(value) {
  const raw = array(value, ErrorType), result = [];
  for (let i = 0; i < raw.length; i++) result.push(point(at(raw, i), ErrorType));
  return result;
}
function matrix(value) {
  const raw = array(value, ErrorType), result = [];
  for (let i = 0; i < raw.length; i++) result.push(numbers(at(raw, i)));
  return result;
}
function capture(input) {
  const raw = record(input, ["state", "restGrowth", "turnRates", "externalAccelerations",
    "stretchStiffness", "bendStiffness", "contactRange", "contactStrength", "damping", "dt",
    "maxSpeed", "maxSegmentLength", "maxNodes", "maxEdges", "maxWork", "maxBacktracks"], ErrorType);
  const state = record(at(raw, "state"), ["nodes", "curves", "nextNodeId", "nextEdgeId"], ErrorType);
  const rawNodes = array(at(state, "nodes"), ErrorType), nodes = [];
  for (let i = 0; i < rawNodes.length; i++) {
    const node = record(at(rawNodes, i), ["id", "position", "velocity", "pinned"], ErrorType);
    const id = integer(at(node, "id"), ErrorType);
    const position = point(at(node, "position"), ErrorType);
    const velocity = point(at(node, "velocity"), ErrorType);
    const pinned = at(node, "pinned");
    if (typeof pinned !== "boolean") bad("INVALID_INPUT");
    nodes.push({ id, position, velocity, pinned });
  }
  const rawCurves = array(at(state, "curves"), ErrorType), curves = [];
  for (let i = 0; i < rawCurves.length; i++) {
    const curve = record(at(rawCurves, i), ["id", "closed", "nodeIds", "edgeIds", "restLengths", "restTurns"], ErrorType);
    const id = integer(at(curve, "id"), ErrorType);
    const closed = at(curve, "closed");
    if (typeof closed !== "boolean") bad("INVALID_INPUT");
    const nodeIds = integers(at(curve, "nodeIds"));
    const edgeIds = integers(at(curve, "edgeIds"));
    const restLengths = numbers(at(curve, "restLengths"), undefined, true);
    const restTurns = numbers(at(curve, "restTurns"));
    if (restTurns.some(value => value <= -Math.PI || value > Math.PI)) bad("INVALID_INPUT");
    curves.push({ id, closed, nodeIds, edgeIds, restLengths, restTurns });
  }
  const nextNodeId = integer(at(state, "nextNodeId"), ErrorType);
  const nextEdgeId = integer(at(state, "nextEdgeId"), ErrorType);
  const restGrowth = matrix(at(raw, "restGrowth"));
  const turnRates = matrix(at(raw, "turnRates"));
  const externalAccelerations = pairs(at(raw, "externalAccelerations"));
  const scalarNames = ["stretchStiffness", "bendStiffness", "contactRange", "contactStrength", "damping", "dt", "maxSpeed", "maxSegmentLength"];
  const scalar = Object.fromEntries(scalarNames.map(name => [name, num(at(raw, name), ErrorType)]));
  if (scalar.stretchStiffness < 0 || scalar.bendStiffness < 0 || scalar.contactRange < 0 ||
      scalar.contactStrength < 0 || scalar.damping < 0 || scalar.damping > 1 || scalar.dt <= 0 ||
      scalar.maxSpeed < 0 || scalar.maxSegmentLength <= 0) bad("INVALID_INPUT");
  const maxNodes = integer(at(raw, "maxNodes"), ErrorType, 0, MAX_ARRAY);
  const maxEdges = integer(at(raw, "maxEdges"), ErrorType, 0, MAX_ARRAY);
  const maxWork = integer(at(raw, "maxWork"), ErrorType);
  const maxBacktracks = integer(at(raw, "maxBacktracks"), ErrorType);
  return { state: { nodes, curves, nextNodeId, nextEdgeId }, restGrowth, turnRates,
    externalAccelerations, ...scalar, maxNodes, maxEdges, maxWork, maxBacktracks };
}
function validate(data) {
  const { nodes, curves, nextNodeId, nextEdgeId } = data.state;
  let last = -1;
  const nodeIds = new Set();
  for (const node of nodes) {
    if (node.id <= last) bad("INVALID_TOPOLOGY");
    last = node.id; nodeIds.add(node.id);
  }
  if (nodes.length && nextNodeId <= last) bad("INVALID_INPUT");
  last = -1;
  const owners = new Set(), edgeIds = new Set();
  for (const curve of curves) {
    if (curve.id <= last) bad("INVALID_TOPOLOGY");
    last = curve.id;
    const count = curve.nodeIds.length;
    const edges = curve.closed ? count : count - 1;
    const turns = curve.closed ? count : count - 2;
    if (count < (curve.closed ? 3 : 2) || curve.edgeIds.length !== edges ||
        curve.restLengths.length !== edges || curve.restTurns.length !== turns) bad("INVALID_TOPOLOGY");
    for (const id of curve.nodeIds) {
      if (!nodeIds.has(id) || owners.has(id)) bad("INVALID_TOPOLOGY");
      owners.add(id);
    }
    for (const id of curve.edgeIds) {
      if (edgeIds.has(id)) bad("INVALID_TOPOLOGY");
      edgeIds.add(id);
    }
  }
  if (owners.size !== nodes.length) bad("INVALID_TOPOLOGY");
  let highestEdgeId = -1;
  for (const id of edgeIds) if (id > highestEdgeId) highestEdgeId = id;
  if (nextEdgeId <= highestEdgeId) bad("INVALID_INPUT");
  if (data.maxNodes < nodes.length || data.maxEdges < edgeIds.size) bad("INVALID_INPUT");
  if (data.restGrowth.length !== curves.length || data.turnRates.length !== curves.length ||
      data.externalAccelerations.length !== nodes.length) bad("INVALID_INPUT");
  for (let i = 0; i < curves.length; i++) {
    if (data.restGrowth[i].length !== curves[i].edgeIds.length ||
        data.turnRates[i].length !== curves[i].restTurns.length) bad("INVALID_INPUT");
  }
  const n = BigInt(nodes.length), e = curves.reduce((sum, curve) => sum + BigInt(curve.edgeIds.length), 0n);
  const b = curves.reduce((sum, curve) => sum + BigInt(curve.restTurns.length), 0n);
  const s = BigInt(Math.min(data.maxNodes - nodes.length, data.maxEdges - edgeIds.size));
  const cap = BigInt(data.maxEdges);
  const work = 8n*n + 8n*e + 4n*b + (BigInt(data.maxBacktracks)+3n)*e*e + cap*cap + 8n*s;
  if (work > BigInt(MAX_SAFE) || work > BigInt(data.maxWork)) bad("WORK_LIMIT");
}
function grow(data, edges) {
  const lengths = new Map(), turns = new Map();
  const curveIndexById = new Map(data.state.curves.map((curve, index) => [curve.id, index]));
  for (const edge of edges) {
    const rate = data.restGrowth[curveIndexById.get(edge.curve.id)][edge.index];
    const grown = checked(edge.curve.restLengths[edge.index] + checked(data.dt * rate));
    if (grown <= 0) bad("INVALID_GROWTH");
    lengths.set(edge.id, grown);
  }
  for (let curveIndex = 0; curveIndex < data.state.curves.length; curveIndex++) {
    const curve = data.state.curves[curveIndex], values = [];
    for (let index = 0; index < curve.restTurns.length; index++) {
      const value = checked(curve.restTurns[index] + checked(data.dt * data.turnRates[curveIndex][index]));
      values.push(principal(value, checked));
    }
    turns.set(curve.id, values);
  }
  return { lengths, turns };
}
function add(force, id, x, y) {
  const value = force.get(id);
  value[0] = checked(value[0] + x);
  value[1] = checked(value[1] + y);
}
function forces(data, edges, targets) {
  const nodes = data.state.nodes, byId = new Map(nodes.map(node => [node.id, node]));
  const force = new Map(nodes.map((node, index) => [node.id, [...data.externalAccelerations[index]]]));
  for (const edge of edges) {
    const a = byId.get(edge.a).position, b = byId.get(edge.b).position;
    const dx = checked(b[0] - a[0]), dy = checked(b[1] - a[1]);
    const length = norm(dx, dy, checked), ux = checked(dx / length), uy = checked(dy / length);
    const extension = checked(length - targets.lengths.get(edge.id));
    const magnitude = checked(data.stretchStiffness * extension);
    const fx = checked(magnitude * ux), fy = checked(magnitude * uy);
    add(force, edge.a, fx, fy); add(force, edge.b, checked(-fx), checked(-fy));
  }
  for (const curve of data.state.curves) {
    const count = curve.nodeIds.length, turns = targets.turns.get(curve.id);
    for (let index = 0; index < turns.length; index++) {
      const center = curve.closed ? index : index + 1;
      const aId = curve.nodeIds[(center - 1 + count) % count], bId = curve.nodeIds[center], cId = curve.nodeIds[(center + 1) % count];
      const a = byId.get(aId).position, b = byId.get(bId).position, c = byId.get(cId).position;
      const ax = checked(b[0] - a[0]), ay = checked(b[1] - a[1]);
      const cx = checked(c[0] - b[0]), cy = checked(c[1] - b[1]);
      const la = norm(ax, ay, checked), lc = norm(cx, cy, checked);
      const ux = checked(ax / la), uy = checked(ay / la), vx = checked(cx / lc), vy = checked(cy / lc);
      const cross = checked(checked(ux * vy) - checked(uy * vx));
      const dot = checked(checked(ux * vx) + checked(uy * vy));
      const theta = checked(fdlibmAtan2(cross, dot));
      const delta = principal(checked(theta - turns[index]), checked);
      const q = checked(data.bendStiffness * delta), qa = checked(q / la), qc = checked(q / lc);
      const faX = checked(qa * uy), faY = checked(-checked(qa * ux));
      const fcX = checked(qc * vy), fcY = checked(-checked(qc * vx));
      const fbX = checked(-checked(faX + fcX)), fbY = checked(-checked(faY + fcY));
      add(force, aId, faX, faY); add(force, bId, fbX, fbY); add(force, cId, fcX, fcY);
    }
  }
  if (data.contactRange === 0) return force;
  const exact = new Map(nodes.map(node => [node.id, rationalPoint(node.position)]));
  const range2 = R(data.contactRange).multiply(R(data.contactRange));
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const first = edges[i], second = edges[j];
    if (first.a === second.a || first.a === second.b || first.b === second.a || first.b === second.b) continue;
    const near = closestSegments(exact.get(first.a), exact.get(first.b), exact.get(second.a), exact.get(second.b));
    if (near.distance2.compareTo(range2) >= 0) continue;
    const dx = checked(near.displacement[0].value()), dy = checked(near.displacement[1].value());
    const t = checked(near.t.value()), s = checked(near.s.value());
    const distance = norm(dx, dy, checked);
    if (distance === 0) bad("REPRESENTATION_COLLAPSE");
    const ratio = checked(distance / data.contactRange);
    const raw = checked(1 - ratio), falloff = Math.max(0, raw);
    const strength = checked(data.contactStrength * falloff);
    const ux = checked(dx / distance), uy = checked(dy / distance);
    const fx = checked(strength * ux), fy = checked(strength * uy);
    const wa = checked(1 - t), wb = t, wc = checked(1 - s), wd = s;
    for (const [id, weight, sign] of [[first.a, wa, 1], [first.b, wb, 1], [second.a, wc, -1], [second.b, wd, -1]]) {
      const slot = force.get(id);
      const x = checked(weight * fx);
      slot[0] = checked(slot[0] + (sign === 1 ? x : checked(-x)));
      const y = checked(weight * fy);
      slot[1] = checked(slot[1] + (sign === 1 ? y : checked(-y)));
    }
  }
  return force;
}
function integrate(data, force) {
  const proposed = new Map();
  for (const node of data.state.nodes) {
    const acceleration = force.get(node.id);
    let vx = checked(checked(node.velocity[0] + checked(data.dt * acceleration[0])) * data.damping);
    let vy = checked(checked(node.velocity[1] + checked(data.dt * acceleration[1])) * data.damping);
    const speed = norm(vx, vy, checked);
    if (speed > data.maxSpeed) {
      const scale = checked(data.maxSpeed / speed);
      vx = checked(vx * scale); vy = checked(vy * scale);
    }
    proposed.set(node.id, node.pinned ? [0, 0] : [vx, vy]);
  }
  return proposed;
}
function barrier(data, edges, proposed) {
  let alpha = 1;
  const intended = data.state.nodes.some(node => !node.pinned && proposed.get(node.id).some(value => checked(data.dt * value) !== 0));
  for (let attempt = 0; attempt <= data.maxBacktracks; attempt++) {
    if (alpha === 0) bad("STEP_STALLED");
    const nodes = [];
    let moved = false;
    for (const node of data.state.nodes) {
      const velocity = node.pinned ? [0, 0] : proposed.get(node.id).map(value => checked(alpha * value));
      const position = node.pinned ? [...node.position] : velocity.map((value, axis) =>
        checked(node.position[axis] + checked(data.dt * value)));
      if (position[0] !== node.position[0] || position[1] !== node.position[1]) moved = true;
      nodes.push({ id: node.id, position, velocity, pinned: node.pinned });
    }
    if (intended && !moved) bad("STEP_STALLED");
    if (embedded(nodes, edges)) return { nodes, alpha };
    alpha = checked(alpha * 0.5);
  }
  bad("STEP_BLOCKED");
}
function refine(data, moved, edges, targets) {
  const nodes = moved.nodes, byId = new Map(nodes.map(node => [node.id, node]));
  const refined = new Map(), events = [];
  let nextNodeId = data.state.nextNodeId, nextEdgeId = data.state.nextEdgeId;
  let liveEdges = edges.length;
  function split(aId, bId, edgeId, rest, output) {
    const a = byId.get(aId), b = byId.get(bId);
    const dx = checked(b.position[0] - a.position[0]), dy = checked(b.position[1] - a.position[1]);
    const length = norm(dx, dy, checked);
    if (length <= data.maxSegmentLength && rest <= data.maxSegmentLength) {
      output.edgeIds.push(edgeId); output.restLengths.push(rest); output.nodeIds.push(bId); return;
    }
    if (nodes.length + 1 > data.maxNodes || liveEdges + 1 > data.maxEdges) bad("OUTPUT_LIMIT");
    if (nextNodeId >= MAX_SAFE || nextEdgeId > MAX_SAFE - 2) bad("ID_EXHAUSTED");
    const half = R(rest).divide(R(2)).value();
    if (!(half > 0) || !R(half).multiply(R(2)).equals(R(rest))) bad("REPRESENTATION_COLLAPSE");
    const position = [midpoint(a.position[0], b.position[0]), midpoint(a.position[1], b.position[1])];
    const velocity = [midpoint(a.velocity[0], b.velocity[0]), midpoint(a.velocity[1], b.velocity[1])];
    if ((position[0] === a.position[0] && position[1] === a.position[1]) ||
        (position[0] === b.position[0] && position[1] === b.position[1])) bad("REPRESENTATION_COLLAPSE");
    const nodeId = nextNodeId++, firstId = nextEdgeId++, secondId = nextEdgeId++;
    const node = { id: nodeId, position, velocity, pinned: false };
    nodes.push(node); byId.set(nodeId, node); liveEdges++;
    events.push({ parentEdgeId: edgeId, nodeId, childEdgeIds: [firstId, secondId], parentT: 0.5 });
    split(aId, nodeId, firstId, half, output);
    split(nodeId, bId, secondId, half, output);
  }
  for (const edge of edges) {
    const output = { nodeIds: [edge.a], edgeIds: [], restLengths: [] };
    split(edge.a, edge.b, edge.id, targets.lengths.get(edge.id), output);
    refined.set(edge.id, output);
  }
  const curves = [];
  for (const curve of data.state.curves) {
    const oldTurns = targets.turns.get(curve.id);
    const turnByNode = new Map();
    for (let i = 0; i < oldTurns.length; i++) turnByNode.set(curve.nodeIds[curve.closed ? i : i+1], oldTurns[i]);
    const nodeIds = [], edgeIds = [], restLengths = [];
    for (const id of curve.edgeIds) {
      const result = refined.get(id);
      nodeIds.push(...result.nodeIds.slice(0, -1));
      edgeIds.push(...result.edgeIds); restLengths.push(...result.restLengths);
    }
    if (!curve.closed) nodeIds.push(curve.nodeIds.at(-1));
    const restTurns = (curve.closed ? nodeIds : nodeIds.slice(1, -1)).map(id => turnByNode.get(id) ?? 0);
    curves.push({ id: curve.id, closed: curve.closed, nodeIds, edgeIds, restLengths, restTurns });
  }
  nodes.sort((a, b) => a.id - b.id);
  if (!embedded(nodes, edgesOf(curves))) bad("REPRESENTATION_COLLAPSE");
  return { state: { nodes, curves, nextNodeId, nextEdgeId }, events, acceptedMotionScale: moved.alpha };
}
export function elasticCurveGrowStep2D(input) {
  const data = capture(input);
  validate(data);
  const edges = edgesOf(data.state.curves);
  if (!embedded(data.state.nodes, edges)) bad("INVALID_GEOMETRY");
  const targets = grow(data, edges);
  const force = forces(data, edges, targets);
  const proposed = integrate(data, force);
  const moved = barrier(data, edges, proposed);
  return refine(data, moved, edges, targets);
}
