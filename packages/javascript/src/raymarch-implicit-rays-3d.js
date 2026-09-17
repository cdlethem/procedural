import { fdlibmHypot } from "./internal/fdlibm-hypot.js";

export class RaymarchImplicitRays3DError extends Error {
  constructor(code) {
    super(code);
    this.name = "RaymarchImplicitRays3DError";
    this.code = code;
  }
}

function fail(code) { throw new RaymarchImplicitRays3DError(code); }
function finite(value) {
  if (!Number.isFinite(value)) fail("NUMERIC_OVERFLOW");
  return value === 0 ? 0 : value;
}
function h3(x, y, z) { return finite(fdlibmHypot(finite(fdlibmHypot(x, y)), z)); }

function passiveRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail("INVALID_INPUT");
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length) fail("INVALID_INPUT");
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT");
  }
  return value;
}
function own(value, key) { return Object.getOwnPropertyDescriptor(value, key).value; }
function passiveArray(value, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail("INVALID_INPUT");
  if (length !== undefined && value.length !== length) fail("INVALID_INPUT");
  if (Reflect.ownKeys(value).length !== value.length + 1) fail("INVALID_INPUT");
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT");
  }
  return value;
}
function number(value, positive = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || (positive && value <= 0)) fail("INVALID_INPUT");
  return value === 0 ? 0 : value;
}
function integer(value, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) fail("INVALID_INPUT");
  return value;
}
function vector(value, seen = null, positive = false) {
  passiveArray(value, 3);
  if (seen) {
    if (seen.has(value)) fail("INVALID_INPUT");
    seen.add(value);
  }
  return [number(own(value, "0"), positive), number(own(value, "1"), positive), number(own(value, "2"), positive)];
}

function sceneNode(value, depth, seen, count) {
  if (depth > 64) fail("LIMIT_DEPTH");
  if (seen.has(value)) fail("INVALID_INPUT");
  seen.add(value);
  count.value++;
  if (value === null || typeof value !== "object") fail("INVALID_INPUT");
  const kindDescriptor = Object.getOwnPropertyDescriptor(value, "kind");
  if (!kindDescriptor || !("value" in kindDescriptor)) fail("INVALID_INPUT");
  const kind = kindDescriptor.value;
  if (kind === "sphere") {
    passiveRecord(value, ["kind", "center", "radius"]);
    return { kind, center: vector(own(value, "center"), seen), radius: number(own(value, "radius"), true) };
  }
  if (kind === "axisBox") {
    passiveRecord(value, ["kind", "center", "halfExtents"]);
    return { kind, center: vector(own(value, "center"), seen), halfExtents: vector(own(value, "halfExtents"), seen, true) };
  }
  if (kind === "translateUniform") {
    passiveRecord(value, ["kind", "translation", "scale", "child"]);
    const translation = vector(own(value, "translation"), seen);
    const scale = number(own(value, "scale"), true);
    return { kind, translation, scale, child: sceneNode(own(value, "child"), depth + 1, seen, count) };
  }
  if (["union", "intersection", "difference", "smoothUnion"].includes(kind)) {
    passiveRecord(value, kind === "smoothUnion" ? ["kind", "left", "right", "k"] : ["kind", "left", "right"]);
    const left = sceneNode(own(value, "left"), depth + 1, seen, count);
    const right = sceneNode(own(value, "right"), depth + 1, seen, count);
    return kind === "smoothUnion" ? { kind, left, right, k: number(own(value, "k"), true) } : { kind, left, right };
  }
  fail("INVALID_INPUT");
}
function capture(input) {
  const fields = ["scene", "rays", "maxDistance", "hitEpsilon", "normalStep", "maxSteps", "maxRays", "maxSceneNodes", "maxWork"];
  passiveRecord(input, fields);
  const count = { value: 0 };
  const scene = sceneNode(own(input, "scene"), 1, new Set(), count);
  const suppliedRays = passiveArray(own(input, "rays"));
  const rays = [];
  for (let i = 0; i < suppliedRays.length; i++) {
    const raw = passiveRecord(own(suppliedRays, String(i)), ["origin", "direction"]);
    const origin = vector(own(raw, "origin"));
    const direction = vector(own(raw, "direction"));
    if (direction[0] === 0 && direction[1] === 0 && direction[2] === 0) fail("INVALID_INPUT");
    rays.push({ origin, direction });
  }
  const maxDistance = number(own(input, "maxDistance"), true);
  const hitEpsilon = number(own(input, "hitEpsilon"), true);
  const normalStep = number(own(input, "normalStep"), true);
  const maxSteps = integer(own(input, "maxSteps"), 1);
  const maxRays = integer(own(input, "maxRays"), 0);
  const maxSceneNodes = integer(own(input, "maxSceneNodes"), 1);
  const maxWork = integer(own(input, "maxWork"), 0);
  if (rays.length > maxRays) fail("LIMIT_RAYS");
  if (count.value > maxSceneNodes) fail("LIMIT_SCENE_NODES");
  if (BigInt(rays.length) * (BigInt(maxSteps) + 6n) * BigInt(count.value) > BigInt(maxWork)) fail("WORK_LIMIT");
  return { scene, rays, maxDistance, hitEpsilon, normalStep, maxSteps };
}

function field(node, point) {
  if (node.kind === "sphere") {
    const x = finite(point[0] - node.center[0]);
    const y = finite(point[1] - node.center[1]);
    const z = finite(point[2] - node.center[2]);
    const length = h3(x, y, z);
    return { d: finite(length - node.radius), nonsmooth: length === 0 };
  }
  if (node.kind === "axisBox") {
    const x = finite(Math.abs(finite(point[0] - node.center[0])) - node.halfExtents[0]);
    const y = finite(Math.abs(finite(point[1] - node.center[1])) - node.halfExtents[1]);
    const z = finite(Math.abs(finite(point[2] - node.center[2])) - node.halfExtents[2]);
    const outside = h3(Math.max(x, 0), Math.max(y, 0), Math.max(z, 0));
    const inside = Math.min(Math.max(x, Math.max(y, z)), 0);
    let nonsmooth = false;
    if (x <= 0 && y <= 0 && z <= 0) {
      const greatest = Math.max(x, Math.max(y, z));
      const ties = Number(x === greatest) + Number(y === greatest) + Number(z === greatest);
      const axis = x === greatest ? 0 : y === greatest ? 1 : 2;
      nonsmooth = ties > 1 || point[axis] === node.center[axis];
    }
    return { d: finite(outside + inside), nonsmooth };
  }
  if (node.kind === "translateUniform") {
    const childPoint = [
      finite(finite(point[0] - node.translation[0]) / node.scale),
      finite(finite(point[1] - node.translation[1]) / node.scale),
      finite(finite(point[2] - node.translation[2]) / node.scale)
    ];
    const child = field(node.child, childPoint);
    return { d: finite(node.scale * child.d), nonsmooth: child.nonsmooth };
  }
  const left = field(node.left, point);
  const right = field(node.right, point);
  if (node.kind === "smoothUnion") {
    const delta = finite(left.d - right.d), absolute = Math.abs(delta);
    const selected = left.d <= right.d ? left : right;
    if (absolute >= node.k) return { d: selected.d, nonsmooth: selected.nonsmooth };
    const h = finite(1 - finite(absolute / node.k));
    const deduction = finite(finite(finite(node.k * h) * h) / 4);
    return { d: finite(selected.d - deduction), nonsmooth: left.nonsmooth || right.nonsmooth };
  }
  let selected;
  if (node.kind === "union") selected = left.d <= right.d ? left : right;
  else if (node.kind === "intersection") selected = left.d >= right.d ? left : right;
  else {
    const negativeRight = finite(-right.d);
    selected = left.d >= negativeRight ? left : { d: negativeRight, nonsmooth: right.nonsmooth };
    return { d: selected.d, nonsmooth: left.d === negativeRight || selected.nonsmooth };
  }
  return { d: selected.d, nonsmooth: left.d === right.d || selected.nonsmooth };
}

function normalAt(scene, position, step, base) {
  if (base.nonsmooth) return { normal: null, normalStatus: "undefined_nonsmooth", normalSamples: 0 };
  const gradient = [];
  for (let axis = 0; axis < 3; axis++) {
    const plus = position.slice(), minus = position.slice();
    plus[axis] = finite(position[axis] + step);
    minus[axis] = finite(position[axis] - step);
    const a = field(scene, plus).d;
    const b = field(scene, minus).d;
    gradient.push(finite(finite(finite(a - b) / step) / 2));
  }
  const length = h3(gradient[0], gradient[1], gradient[2]);
  if (length === 0) return { normal: null, normalStatus: "undefined_zero", normalSamples: 6 };
  return { normal: gradient.map(component => finite(component / length)), normalStatus: "estimated", normalSamples: 6 };
}

function result(kind, t, point, base, samples, scene, step, overshot = false) {
  const hit = kind === "hit_epsilon" || kind === "inside_start";
  const differential = hit ? normalAt(scene, point, step, base) :
    { normal: null, normalStatus: "not_applicable", normalSamples: 0 };
  return { kind, distance: hit ? t : null, traveled: t, position: point.slice(), fieldValue: base.d,
    normal: differential.normal, normalStatus: differential.normalStatus, overshot, samples,
    normalSamples: differential.normalSamples };
}
function trace(data, ray, unit) {
  let t = 0, point = ray.origin.slice(), samples = 0;
  while (true) {
    const base = field(data.scene, point);
    samples++;
    if (samples === 1 && base.d < 0) return result("inside_start", t, point, base, samples, data.scene, data.normalStep);
    if (base.d <= data.hitEpsilon) return result("hit_epsilon", t, point, base, samples, data.scene, data.normalStep, samples > 1 && base.d < 0);
    if (t === data.maxDistance) return result("miss_range", t, point, base, samples, data.scene, data.normalStep);
    if (samples === data.maxSteps) return result("miss_steps", t, point, base, samples, data.scene, data.normalStep);
    const remaining = finite(data.maxDistance - t);
    if (base.d > remaining) return result("miss_range", t, point, base, samples, data.scene, data.normalStep);
    const next = base.d === remaining ? data.maxDistance : finite(t + base.d);
    if (next === t) return result("miss_stalled", t, point, base, samples, data.scene, data.normalStep);
    if (next > data.maxDistance) return result("miss_range", t, point, base, samples, data.scene, data.normalStep);
    t = next;
    point = [finite(ray.origin[0] + finite(t * unit[0])), finite(ray.origin[1] + finite(t * unit[1])),
      finite(ray.origin[2] + finite(t * unit[2]))];
  }
}

export function raymarchImplicitRays3D(input) {
  const data = capture(input);
  const units = data.rays.map(ray => {
    const length = h3(ray.direction[0], ray.direction[1], ray.direction[2]);
    if (length === 0) fail("NUMERIC_OVERFLOW");
    return ray.direction.map(component => finite(component / length));
  });
  return { results: data.rays.map((ray, index) => trace(data, ray, units[index])) };
}
