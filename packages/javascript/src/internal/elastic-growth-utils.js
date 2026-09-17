import { fdlibmHypot } from "./fdlibm-hypot.js";
import { R, ONE, ZERO, rationalPoint, samePoint, segment } from "./graph-growth-utils.js";

export const PI = 3.141592653589793;
export const TAU = 2 * PI;
export function principal(value, checked) {
  let result = checked(value % TAU);
  if (result <= -PI) result = checked(result + TAU);
  if (result > PI) result = checked(result - TAU);
  return result === 0 ? 0 : result;
}
export function edgesOf(curves) {
  const edges = [];
  for (const curve of curves) {
    const count = curve.edgeIds.length;
    for (let index = 0; index < count; index++) edges.push({
      id: curve.edgeIds[index], a: curve.nodeIds[index],
      b: curve.nodeIds[(index + 1) % curve.nodeIds.length], curve, index,
    });
  }
  return edges.sort((a, b) => a.id - b.id);
}
export function embedded(nodes, edges) {
  const exact = new Map(nodes.map(node => [node.id, rationalPoint(node.position)]));
  for (let i = 0; i < edges.length; i++) {
    const a = exact.get(edges[i].a), b = exact.get(edges[i].b);
    if (samePoint(a, b)) return false;
    for (let j = i + 1; j < edges.length; j++) {
      const first = edges[i], second = edges[j];
      const contact = segment(a, b, exact.get(second.a), exact.get(second.b));
      if (contact.kind === "miss") continue;
      if (contact.kind === "overlap") return false;
      const shared = first.a === second.a || first.a === second.b ? first.a
        : first.b === second.a || first.b === second.b ? first.b : undefined;
      if (shared === undefined || !samePoint(contact.point, exact.get(shared))) return false;
    }
  }
  return true;
}
const clamp = value => value.compareTo(ZERO) < 0 ? ZERO : value.compareTo(ONE) > 0 ? ONE : value;
const dot = (a, b) => a[0].multiply(b[0]).add(a[1].multiply(b[1]));
const minus = (a, b) => [a[0].subtract(b[0]), a[1].subtract(b[1])];
const plus = (a, b) => [a[0].add(b[0]), a[1].add(b[1])];
const times = (a, t) => [a[0].multiply(t), a[1].multiply(t)];

export function closestSegments(a, b, c, d) {
  const ab = minus(b, a), cd = minus(d, c), candidates = [];
  function offer(t, s) {
    const displacement = minus(plus(a, times(ab, t)), plus(c, times(cd, s)));
    const distance2 = dot(displacement, displacement);
    candidates.push({ t, s, displacement, distance2 });
  }
  const intersection = segment(a, b, c, d);
  if (intersection.kind === "hit") offer(intersection.t, intersection.u);
  function project(point, origin, direction) {
    return clamp(dot(minus(point, origin), direction).divide(dot(direction, direction)));
  }
  offer(ZERO, project(a, c, cd));
  offer(ONE, project(b, c, cd));
  offer(project(c, a, ab), ZERO);
  offer(project(d, a, ab), ONE);
  candidates.sort((left, right) => left.distance2.compareTo(right.distance2) ||
    left.t.compareTo(right.t) || left.s.compareTo(right.s));
  return candidates[0];
}
export function midpoint(a, b) {
  return R(a).add(R(b)).divide(R(2)).value();
}
export function norm(x, y, checked) { return checked(fdlibmHypot(x, y)); }
