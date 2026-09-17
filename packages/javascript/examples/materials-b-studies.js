import { extrudeSimplePolygon3D } from "../src/extrude-simple-polygon-3d.js";
import { parallelTransportRibbon3D } from "../src/parallel-transport-ribbon-3d.js";
import { loopSubdivideTriangles3D } from "../src/loop-subdivide-triangles-3d.js";

// App compositions over existing portable mesh operations. Six entry points are
// three paired examples; changing a source never changes its appearance controls.
const common = { pitch: .55, faceMode: "solid-lit", weight: .8, legacy: false };
export const materialsBSettings = {
  "extruded-seals": {
    defaults: { ...common, footprint: "beveled", footprintWidth: 290, footprintDepth: 245, inset: 28, stepDepth: 36, shoulder: 85, height: 110, rotation: .55, zoom: 1.45 },
    structuralEdit: { footprint: "stepped", stepDepth: 110, height: 190 },
  },
  "stepped-blocks": {
    defaults: { ...common, footprint: "stepped", footprintWidth: 260, footprintDepth: 205, inset: 8, stepDepth: 100, shoulder: 85, height: 80, rotation: .7, zoom: 1.6 },
    structuralEdit: { footprint: "beveled", inset: 35, height: 155 },
  },
  "transported-ribbons": {
    defaults: { ...common, segments: 12, width: 54, endWidth: 54, widthPulse: .35, verticalAmplitude: 90, verticalCycles: 1, depthAmplitude: 70, depthCycles: 2, rotation: .5, zoom: 1.4, weight: 1 },
    structuralEdit: { verticalCycles: 2.5, endWidth: 18, segments: 30 },
  },
  "twisting-streamers": {
    defaults: { ...common, segments: 16, width: 38, endWidth: 38, widthPulse: .35, verticalAmplitude: 90, verticalCycles: 3, depthAmplitude: 70, depthCycles: 4, rotation: .8, zoom: 1.4, weight: 1 },
    structuralEdit: { verticalCycles: .5, endWidth: 95, widthPulse: -.5 },
  },
  "rounded-polyhedra": {
    defaults: { ...common, levels: 1, base: "tetra", axisX: 1, axisY: 1, axisZ: 1, cornerLift: 0, rotation: .6, zoom: 7 },
    structuralEdit: { base: "patch", cornerLift: 85, levels: 3 },
  },
  "subdivided-shells": {
    defaults: { ...common, levels: 1, base: "octa", axisX: 1, axisY: 1, axisZ: 1, cornerLift: 0, rotation: 1.1, zoom: 4 },
    structuralEdit: { base: "tetra", axisY: 1.7, levels: 3 },
  },
};

const value = (layer, key) => Number(layer.params[key]);
const rgb = (layer, index) => {
  const color = layer.palette[index % layer.palette.length] >>> 0;
  return [(color >>> 16) & 255, (color >>> 8) & 255, color & 255];
};
const MAX_FACES = 8192;
const MAX_WORK = 250_000;

function checkedBudget(faces, work) {
  if (!Number.isSafeInteger(faces) || faces < 1 || faces > MAX_FACES ||
      !Number.isSafeInteger(work) || work < 0 || work > MAX_WORK)
    throw Error("STUDY_MESH_BUDGET");
  return work;
}

// This path is retained byte-for-byte in its projection, fitting, face order,
// and paint calls for legacy saved layers. The Studio migration supplies old
// keys and selects this path until an artist opts into the new controls.
function legacyProject(v, a) {
  const cy = Math.cos(a), sy = Math.sin(a), cx = Math.cos(.55), sx = Math.sin(.55);
  const x = v[0] * cy - v[2] * sy, z = v[0] * sy + v[2] * cy;
  const y = v[1] * cx - z * sx;
  return [320 + x * 1.45, 320 - y * 1.45, z * cx + v[1] * sx];
}
function legacyMesh(p, l, m, a) {
  const raw = m.positions.map(v => legacyProject(v, a));
  const xs = raw.map(v => v[0]), ys = raw.map(v => v[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const scale = Math.min(560 / (maxx - minx || 1), 560 / (maxy - miny || 1));
  const points = raw.map(v => [320 + (v[0] - (minx + maxx) / 2) * scale, 320 + (v[1] - (miny + maxy) / 2) * scale, v[2]]);
  const faces = m.indices.map((f, i) => ({ f, i, z: f.reduce((s, j) => s + points[j][2], 0) / 3 })).sort((u, v) => u.z - v.z);
  p.strokeWeight(value(l, "weight") || 1);
  for (const face of faces) {
    const c = rgb(l, face.i);
    p.fill(c[0], c[1], c[2], 210); p.stroke(25, 25, 35, 150); p.beginShape();
    for (const i of face.f) { const v = points[i]; p.vertex(v[0], v[1]); }
    p.endShape(p.CLOSE);
  }
}
function legacyExtrude(l, kind) {
  const poly = kind
    ? [[-130, -100], [130, -100], [130, 0], [45, 0], [45, 105], [-130, 105]]
    : [[-130, -95], [90, -120], [145, -10], [75, 115], [-85, 125], [-150, 20]];
  return extrudeSimplePolygon3D({ polygon: poly, height: value(l, "height"), maxWork: 2000 });
}
function legacyRibbon(l, twist) {
  const n = value(l, "segments");
  const points = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return [-180 + 360 * t, Math.sin(t * Math.PI * (twist ? 3 : 1)) * 90,
      Math.cos(t * Math.PI * (twist ? 4 : 2)) * 70];
  });
  const widths = points.map((_, i) => value(l, "width") * (.65 + .35 * Math.sin(i * .7) ** 2));
  return parallelTransportRibbon3D({ points, widths, initialNormal: [0, 1, 0], maxWork: 30 * n });
}
const tetraPositions = [[0, -120, 0], [-110, 75, -70], [110, 75, -70], [0, 75, 125]];
const tetraIndices = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]];
const octaPositions = [[0, -145, 0], [0, 145, 0], [-125, 0, 0], [0, 0, -125], [125, 0, 0], [0, 0, 125]];
const octaIndices = [[0, 3, 2], [0, 4, 3], [0, 5, 4], [0, 2, 5], [1, 2, 3], [1, 3, 4], [1, 4, 5], [1, 5, 2]];
function legacyTetra(l) {
  return loopSubdivideTriangles3D({ positions: tetraPositions, indices: tetraIndices, levels: value(l, "levels"), maxWork: 5000 });
}
function legacyOcta(l) {
  return loopSubdivideTriangles3D({ positions: octaPositions, indices: octaIndices, levels: value(l, "levels"), maxWork: 5000 });
}

const cameraTargets = {
  "extruded-seals": [0, 0, 55], "stepped-blocks": [0, 0, 40],
  "transported-ribbons": [0, 55, 0], "twisting-streamers": [0, 15, 0],
  "rounded-polyhedra": [0, 30, 0], "subdivided-shells": [0, 0, 0],
};
function project(v, target, yaw, pitch, zoom) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const vx = v[0] - target[0], vy = v[1] - target[1], vz = v[2] - target[2];
  const x = vx * cy - vz * sy, z = vx * sy + vz * cy;
  const y = vy * cp - z * sp;
  return [320 + x * zoom, 320 - y * zoom, z * cp + vy * sp];
}
function faceNormal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const length = Math.hypot(...n);
  return length ? n.map(x => x / length) : [0, 0, 0];
}
function featureEdges(mesh, projected, normals) {
  const edges = new Map();
  mesh.indices.forEach((face, faceIndex) => {
    for (let corner = 0; corner < 3; corner++) {
      const a = face[corner], b = face[(corner + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const edge = edges.get(key);
      if (edge) edge.faces.push(faceIndex);
      else edges.set(key, { a, b, faces: [faceIndex] });
    }
  });
  const byFace = mesh.indices.map(() => []);
  for (const edge of edges.values()) {
    const [first, second] = edge.faces;
    let visible = edge.faces.length !== 2;
    if (!visible) {
      const a = normals[first], b = normals[second];
      const angle = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const facing = index => {
        const [u, v, w] = mesh.indices[index].map(i => projected[i]);
        return Math.sign((v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]));
      };
      // A triangulation seam is coplanar and has the same projected facing.
      // Preserve deliberate folds and silhouettes, including shallow grazing edges.
      visible = angle < Math.cos(Math.PI / 18) || facing(first) !== facing(second);
    }
    if (!visible) continue;
    const owner = edge.faces.reduce((nearest, index) =>
      nearest === undefined || projectedFaceDepth(mesh.indices[index], projected) > projectedFaceDepth(mesh.indices[nearest], projected)
        ? index : nearest, undefined);
    byFace[owner].push(edge);
  }
  return byFace;
}
function projectedFaceDepth(face, projected) {
  return (projected[face[0]][2] + projected[face[1]][2] + projected[face[2]][2]) / 3;
}
function drawMesh(p, l, m, id) {
  if (m.indices.length > MAX_FACES) throw Error("STUDY_MESH_BUDGET");
  const yaw = value(l, "rotation"), pitch = value(l, "pitch"), zoom = value(l, "zoom"), weight = value(l, "weight");
  if (![yaw, pitch, zoom, weight].every(Number.isFinite) || zoom <= 0 || weight < 0)
    throw Error("INVALID_STUDY_CAMERA");
  if (!["solid-lit", "bands", "facets"].includes(l.params.faceMode)) throw Error("INVALID_FACE_MODE");
  const target = cameraTargets[id];
  if (!target) throw Error("UNKNOWN_MESH_STUDY");
  const points = m.positions.map(v => project(v, target, yaw, pitch, zoom));
  const normals = m.indices.map(f => faceNormal(...f.map(i => m.positions[i])));
  const solidEdges = l.params.faceMode === "solid-lit" && weight > 0 ? featureEdges(m, points, normals) : null;
  let minY = Infinity, maxY = -Infinity;
  for (const v of m.positions) { minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]); }
  const faces = m.indices.map((f, i) => ({
    f, i, z: (points[f[0]][2] + points[f[1]][2] + points[f[2]][2]) / 3,
    sourceY: (m.positions[f[0]][1] + m.positions[f[1]][1] + m.positions[f[2]][1]) / 3,
  })).sort((a, b) => a.z - b.z || a.i - b.i);
  p.push();
  if (l.params.faceMode === "solid-lit") p.strokeJoin(p.ROUND);
  if (weight === 0 || solidEdges) p.noStroke();
  else { p.stroke(25, 25, 35, 170); p.strokeWeight(weight); }
  for (const face of faces) {
    let c;
    if (l.params.faceMode === "facets") c = rgb(l, face.i);
    else if (l.params.faceMode === "bands") {
      const t = maxY === minY ? .5 : (face.sourceY - minY) / (maxY - minY);
      c = rgb(l, Math.min(l.palette.length - 1, Math.floor(t * l.palette.length)));
    } else if (l.params.faceMode === "solid-lit") {
      const normal = normals[face.i];
      const lighting = .48 + .52 * Math.max(0, normal[0] * .38 + normal[1] * -.69 + normal[2] * .62);
      c = rgb(l, 0).map(channel => Math.round(channel * lighting));
    }
    if (l.params.faceMode === "solid-lit") {
      // Canvas antialiasing can expose paper-colored seams between adjacent
      // triangles even when neither triangle has a visible outline.
      p.stroke(c[0], c[1], c[2], 255); p.strokeWeight(1.25);
    }
    p.fill(c[0], c[1], c[2], 255);
    p.beginShape();
    for (const id of face.f) p.vertex(points[id][0], points[id][1]);
    p.endShape(p.CLOSE);
    if (solidEdges) {
      p.stroke(25, 25, 35, 170); p.strokeWeight(weight);
      for (const edge of solidEdges[face.i]) {
        const a = points[edge.a], b = points[edge.b];
        p.line(a[0], a[1], b[0], b[1]);
      }
      p.noStroke();
    }
  }
  p.pop();
}

function sourcePolygon(l) {
  const w = value(l, "footprintWidth"), d = value(l, "footprintDepth"), inset = value(l, "inset");
  const step = value(l, "stepDepth"), shoulder = value(l, "shoulder");
  if (![w, d, inset, step, shoulder].every(Number.isFinite) || w <= 0 || d <= 0 ||
      inset < 0 || inset > Math.min(w, d) / 4 || step < 0 || step > .75 * d ||
      shoulder < 0 || shoulder > .75 * w) throw Error("INVALID_FOOTPRINT");
  let source;
  if (l.params.footprint === "beveled") source = [
    [-w / 2 + inset, -d / 2], [w / 2 - inset, -d / 2], [w / 2, -d / 2 + inset],
    [w / 2, d / 2 - step], [w / 2 - shoulder, d / 2], [-w / 2, d / 2 - inset],
  ];
  else if (l.params.footprint === "stepped") {
    if (step === 0 || shoulder === 0) throw Error("STEP_NEEDS_DEPTH_AND_SHOULDER");
    source = [
      [-w / 2 + inset, -d / 2], [w / 2, -d / 2],
      [w / 2, -d / 2 + step], [w / 2 - shoulder, -d / 2 + step],
      [w / 2 - shoulder, d / 2], [-w / 2 + inset, d / 2], [-w / 2, d / 2 - inset],
    ];
  } else throw Error("INVALID_FOOTPRINT");
  return source.filter((point, i) => i === 0 || point[0] !== source[i - 1][0] || point[1] !== source[i - 1][1]);
}
function extruded(l) {
  const polygon = sourcePolygon(l), n = polygon.length;
  const height = value(l, "height");
  if (!Number.isFinite(height) || height <= 0) throw Error("INVALID_EXTRUSION_HEIGHT");
  const work = checkedBudget(4 * n - 4, n ** 3 + n ** 2 + 14 * n - 12);
  return extrudeSimplePolygon3D({ polygon, height, maxWork: work });
}
function ribbon(l) {
  const n = value(l, "segments"), start = value(l, "width"), end = value(l, "endWidth");
  const pulse = value(l, "widthPulse"), ay = value(l, "verticalAmplitude"), fy = value(l, "verticalCycles");
  const az = value(l, "depthAmplitude"), fz = value(l, "depthCycles");
  if (!Number.isInteger(n) || n < 2 || n > 512 ||
      ![start, end, pulse, ay, fy, az, fz].every(Number.isFinite) ||
      start < 0 || end < 0 || pulse < -1) throw Error("INVALID_RIBBON_SOURCE");
  const points = [], widths = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    points.push([-180 + 360 * t, ay * Math.sin(Math.PI * fy * t), az * Math.cos(Math.PI * fz * t)]);
    widths.push(((1 - t) * start + t * end) * (1 + pulse * Math.sin(Math.PI * t) ** 2));
  }
  const work = checkedBudget(2 * (n - 1), 30 * n - 6);
  return parallelTransportRibbon3D({ points, widths, initialNormal: [0, 1, 0], maxWork: work });
}
const patchPositions = [[-125, 0, -125], [125, 0, -125], [125, 0, 125], [-125, 0, 125]];
const patchIndices = [[0, 1, 2], [0, 2, 3]];
function subdivision(l) {
  let positions, indices;
  if (l.params.base === "tetra") { positions = tetraPositions; indices = tetraIndices; }
  else if (l.params.base === "octa") { positions = octaPositions; indices = octaIndices; }
  else if (l.params.base === "patch") { positions = patchPositions; indices = patchIndices; }
  else throw Error("INVALID_BASE_MESH");
  const levels = value(l, "levels"), sx = value(l, "axisX"), sy = value(l, "axisY"), sz = value(l, "axisZ"), lift = value(l, "cornerLift");
  if (!Number.isInteger(levels) || levels < 0 || levels > 30 ||
      ![sx, sy, sz, lift].every(Number.isFinite))
    throw Error("INVALID_SUBDIVISION_SOURCE");
  const source = positions.map((v, i) => [v[0] * sx, v[1] * sy + (i === (l.params.base === "patch" ? 2 : 0) ? lift : 0), v[2] * sz]);
  let vertices = source.length, faces = indices.length, work = 0;
  for (let level = 0; level < levels; level++) {
    work += 2 * vertices + 10 * faces;
    vertices += 3 * faces; faces *= 4;
    if (faces > MAX_FACES || !Number.isSafeInteger(work)) throw Error("STUDY_MESH_BUDGET");
  }
  work += vertices + 3 * faces;
  checkedBudget(faces, work);
  return loopSubdivideTriangles3D({ positions: source, indices, levels, maxWork: work });
}

export function drawExtrudedSeals(p, l) { if (l.params.legacy) legacyMesh(p, l, legacyExtrude(l, 0), value(l, "rotation")); else drawMesh(p, l, extruded(l), "extruded-seals"); }
export function drawSteppedBlocks(p, l) { if (l.params.legacy) legacyMesh(p, l, legacyExtrude(l, 1), value(l, "rotation")); else drawMesh(p, l, extruded(l), "stepped-blocks"); }
export function drawTransportedRibbons(p, l) { if (l.params.legacy) legacyMesh(p, l, legacyRibbon(l, 0), value(l, "rotation")); else drawMesh(p, l, ribbon(l), "transported-ribbons"); }
export function drawTwistingStreamers(p, l) { if (l.params.legacy) legacyMesh(p, l, legacyRibbon(l, 1), value(l, "rotation")); else drawMesh(p, l, ribbon(l), "twisting-streamers"); }
export function drawRoundedPolyhedra(p, l) { if (l.params.legacy) legacyMesh(p, l, legacyTetra(l), value(l, "rotation")); else drawMesh(p, l, subdivision(l), "rounded-polyhedra"); }
export function drawSubdividedShells(p, l) { if (l.params.legacy) legacyMesh(p, l, legacyOcta(l), value(l, "rotation")); else drawMesh(p, l, subdivision(l), "subdivided-shells"); }
