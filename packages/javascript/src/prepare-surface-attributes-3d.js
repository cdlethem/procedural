import { array, at, computed, finite, integer, record } from "./internal/geometry-b-utils.js";
import { ExactRational } from "./internal/exact-rational.js";
import { fdlibmHypot } from "./internal/fdlibm-hypot.js";

export class PrepareSurfaceAttributes3DError extends Error {
  constructor(code) { super(code); this.name = "PrepareSurfaceAttributes3DError"; this.code = code; }
}

const KEYS = ["positions", "triangles", "normalMode", "smoothingGroups", "cornerUVs", "maxVertices", "maxWork"];
const MAX_ARRAY = 2147483647;

function vector(E, raw, length, valid) {
  array(E, raw, length);
  return Array.from({ length }, (_, i) => valid(at(E, raw, i)));
}

function boundedArray(E, raw, length) {
  array(E, raw, length);
  if (raw.length > MAX_ARRAY) throw new E("INVALID_INPUT");
  return raw;
}

function exactCrossIsZero(a, b, c) {
  const u = b.map((x, i) => x.subtract(a[i]));
  const v = c.map((x, i) => x.subtract(a[i]));
  const cross = [
    u[1].multiply(v[2]).subtract(u[2].multiply(v[1])),
    u[2].multiply(v[0]).subtract(u[0].multiply(v[2])),
    u[0].multiply(v[1]).subtract(u[1].multiply(v[0]))
  ];
  return cross.every((component) => component.signum() === 0);
}

function unit(E, vector) {
  const length = computed(E, fdlibmHypot(computed(E, fdlibmHypot(vector[0], vector[1])), vector[2]));
  if (length === 0) throw new E("AMBIGUOUS_NORMAL");
  return vector.map((component) => computed(E, component / length));
}

/** Prepare detached triangle attributes without a renderer, weld, UV chart, or material. */
export function prepareSurfaceAttributes3D(input) {
  const E = PrepareSurfaceAttributes3DError;
  record(E, input, KEYS);
  const positionsRaw = boundedArray(E, at(E, input, "positions"));
  const positions = positionsRaw.map((raw) => vector(E, raw, 3, (x) => finite(E, x)));
  const trianglesRaw = boundedArray(E, at(E, input, "triangles"));
  const faces = trianglesRaw.map((raw) => {
    const corners = vector(E, raw, 3, (x) => finite(E, x));
    if (corners.some((x) => !Number.isSafeInteger(x) || x < 0 || x >= positions.length)
      || new Set(corners).size !== 3) throw new E("INVALID_TOPOLOGY");
    return corners;
  });
  const mode = at(E, input, "normalMode");
  if (mode !== "flat" && mode !== "smooth") throw new E("INVALID_INPUT");
  const groupsRaw = boundedArray(E, at(E, input, "smoothingGroups"), faces.length);
  const groups = groupsRaw.map((x) => integer(E, x, 0, Number.MAX_SAFE_INTEGER));
  const uvRaw = at(E, input, "cornerUVs");
  let cornerUVs = null;
  if (uvRaw !== null) {
    boundedArray(E, uvRaw, faces.length);
    cornerUVs = uvRaw.map((face) => vector(E, face, 3, (uv) => vector(E, uv, 2, (x) => {
      const n = finite(E, x);
      if (n < 0 || n > 1) throw new E("INVALID_INPUT");
      return n;
    })));
  }
  const maxVertices = integer(E, at(E, input, "maxVertices"), 0, MAX_ARRAY);
  const maxWork = integer(E, at(E, input, "maxWork"), 0, Number.MAX_SAFE_INTEGER);
  if (3n * BigInt(faces.length) > BigInt(maxVertices)) throw new E("OUTPUT_LIMIT");
  if (BigInt(positions.length) + 27n * BigInt(faces.length) > BigInt(maxWork)) throw new E("WORK_LIMIT");

  const exact = positions.map((row) => row.map((x) => ExactRational.of(x)));
  const normals = faces.map((face) => {
    const [i, j, k] = face;
    if (exactCrossIsZero(exact[i], exact[j], exact[k])) throw new E("DEGENERATE_FACE");
    const a = positions[j].map((x, axis) => computed(E, x - positions[i][axis]));
    const b = positions[k].map((x, axis) => computed(E, x - positions[i][axis]));
    const cross = [
      computed(E, computed(E, a[1] * b[2]) - computed(E, a[2] * b[1])),
      computed(E, computed(E, a[2] * b[0]) - computed(E, a[0] * b[2])),
      computed(E, computed(E, a[0] * b[1]) - computed(E, a[1] * b[0]))
    ];
    if (cross.every((x) => x === 0)) throw new E("REPRESENTATION_COLLAPSE");
    return unit(E, cross);
  });

  const output = { positions: [], triangles: [], normals: [], uvs: cornerUVs === null ? null : [], sourceVertexIndices: [] };
  if (mode === "flat") {
    faces.forEach((face, fi) => {
      const row = [];
      face.forEach((source, ci) => {
        row.push(output.positions.length);
        output.positions.push(positions[source].slice());
        output.normals.push(normals[fi].slice());
        if (output.uvs !== null) output.uvs.push(cornerUVs[fi][ci].slice());
        output.sourceVertexIndices.push(source);
      });
      output.triangles.push(row);
    });
    return output;
  }

  const groupNormals = new Map();
  faces.forEach((face, fi) => face.forEach((source) => {
    const key = `${source}/${groups[fi]}`;
    const existing = groupNormals.get(key);
    if (existing === undefined) groupNormals.set(key, normals[fi].slice());
    else for (let axis = 0; axis < 3; axis += 1) existing[axis] = computed(E, existing[axis] + normals[fi][axis]);
  }));
  for (const [key, sum] of groupNormals) {
    if (sum.every((x) => x === 0)) throw new E("AMBIGUOUS_NORMAL");
    groupNormals.set(key, unit(E, sum));
  }
  const seen = new Map();
  faces.forEach((face, fi) => {
    const row = [];
    face.forEach((source, ci) => {
      const uv = cornerUVs === null ? null : cornerUVs[fi][ci];
      const groupKey = `${source}/${groups[fi]}`;
      const key = uv === null ? `${groupKey}/null` : `${groupKey}/${uv[0]}/${uv[1]}`;
      let index = seen.get(key);
      if (index === undefined) {
        index = output.positions.length;
        seen.set(key, index);
        output.positions.push(positions[source].slice());
        output.normals.push(groupNormals.get(groupKey).slice());
        if (output.uvs !== null) output.uvs.push(uv.slice());
        output.sourceVertexIndices.push(source);
      }
      row.push(index);
    });
    output.triangles.push(row);
  });
  return output;
}
