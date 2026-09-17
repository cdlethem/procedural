import { ExactRational } from "./internal/exact-rational.js";
import { captureRegion, cross as exactCross, denseArray, exactPoint, finite, firstRegionIssue, integer, normalizeHole, normalizeRing, plainRecord, pointArray, ringIssuePoints, sub as exactSub, witness, zero } from "./internal/region-utils.js";

export class TaperedStrokeStrip2DError extends Error {
  constructor(code) { super(code); this.name = "TaperedStrokeStrip2DError"; this.code = code; }
}
const none = () => witness();
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const append = (to, p) => { if (!to.length || !same(to[to.length - 1], p)) to.push(p); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
function exactLineIntersection(a, b, c, d) {
  const ap = exactPoint(a), bp = exactPoint(b), cp = exactPoint(c), dp = exactPoint(d);
  const ab = { x: bp.x.subtract(ap.x), y: bp.y.subtract(ap.y) }, cd = { x: dp.x.subtract(cp.x), y: dp.y.subtract(cp.y) };
  const den = ab.x.multiply(cd.y).subtract(ab.y.multiply(cd.x)); if (den.signum() === 0) return null;
  const ca = { x: cp.x.subtract(ap.x), y: cp.y.subtract(ap.y) };
  const t = ca.x.multiply(cd.y).subtract(ca.y.multiply(cd.x)).divide(den);
  return { x: ap.x.add(ab.x.multiply(t)), y: ap.y.add(ab.y.multiply(t)), t, u: ca.x.multiply(ab.y).subtract(ca.y.multiply(ab.x)).divide(den) };
}
function finitePoint(point) { return Number.isFinite(point[0]) && Number.isFinite(point[1]); }
function roundExact(point) { const x = zero(point.x.value()), y = zero(point.y.value()); return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null; }
function sideSample(point, normal, width, sign) { const half = width / 2; return [point[0] + sign * normal[0] * half, point[1] + sign * normal[1] * half]; }
function twiceArea(points) {
  let sum = ExactRational.ZERO;
  for (let i = 0; i < points.length; i += 1) {
    const a = exactPoint(points[i]), b = exactPoint(points[(i + 1) % points.length]);
    sum = sum.add(a.x.multiply(b.y).subtract(a.y.multiply(b.x)));
  }
  return sum.signum() < 0 ? ExactRational.ZERO.subtract(sum) : sum;
}
export function captureStripInput(configuration, ErrorType = TaperedStrokeStrip2DError, checkWork = true) {
  const input = plainRecord(configuration, ["points", "widths", "closed", "cap", "join", "miterLimit", "maxWork"], ErrorType);
  denseArray(input.points, ErrorType); denseArray(input.widths, ErrorType);
  if (typeof input.closed !== "boolean" || (input.cap !== "BUTT" && input.cap !== "SQUARE") || (input.join !== "BEVEL" && input.join !== "MITER")) throw new ErrorType("INVALID_INPUT");
  const points = input.points.map((point) => pointArray(point, ErrorType)), widths = input.widths.map((n) => finite(n, ErrorType));
  if (points.length !== widths.length || points.length < (input.closed ? 3 : 2) || widths.some((n) => !(n > 0))) throw new ErrorType("INVALID_INPUT");
  const limit = finite(input.miterLimit, ErrorType); if (limit < 1) throw new ErrorType("INVALID_INPUT");
  const maxWork = integer(input.maxWork, ErrorType), n = points.length;
  for (let i = 0; i < n - 1 + Number(input.closed); i += 1) {
    const d = sub(points[(i + 1) % n], points[i]); if (d[0] === 0 && d[1] === 0) throw new ErrorType("INVALID_INPUT");
    const vertex = (i + 1) % n, previous = (vertex - 1 + n) % n, following = (vertex + 1) % n;
    if (input.closed || vertex < n - 1) { const before = exactSub(exactPoint(points[vertex]), exactPoint(points[previous])), after = exactSub(exactPoint(points[following]), exactPoint(points[vertex])); if (exactCross(before, after).signum() === 0 && (before.x.multiply(after.x).add(before.y.multiply(after.y))).signum() < 0) throw new ErrorType("INVALID_INPUT"); }
  }
  const e = BigInt(4 * n + 4), q = 2n, work = 32n * BigInt(n) + e * e + 8n * e * q + 4n * q * q;
  if (checkWork && work > BigInt(maxWork)) throw new ErrorType("WORK_LIMIT");
  return { input, points, widths, limit, n };
}
function rejected(issue = null) { return { status: "REJECTED", reason: "INVALID_STRIP_TOPOLOGY", witness: issue ? witness("INVALID_RING", issue.ring, issue.edge, -1, -1, issue.vertex) : witness("INVALID_RING") }; }

/** Construct a strict visible Region2D from a variable-width centerline. */
export function taperedStrokeStrip2D(configuration) {
  const { input, points, widths, limit, n } = captureStripInput(configuration);
  const edgeCount = input.closed ? n : n - 1, tangents = new Array(edgeCount), normals = new Array(edgeCount);
  for (let i = 0; i < edgeCount; i += 1) {
    const d = sub(points[(i + 1) % n], points[i]), length = Math.hypot(d[0], d[1]);
    if (!Number.isFinite(length) || length === 0) throw new TaperedStrokeStrip2DError("NUMERIC_OVERFLOW");
    tangents[i] = [d[0] / length, d[1] / length]; normals[i] = [-tangents[i][1], tangents[i][0]];
  }
  const left = [], right = [], joins = [];
  const startL = sideSample(points[0], normals[0], widths[0], 1), startR = sideSample(points[0], normals[0], widths[0], -1);
  if (!finitePoint(startL) || !finitePoint(startR)) throw new TaperedStrokeStrip2DError("NUMERIC_OVERFLOW");
  if (!input.closed) {
    if (input.cap === "SQUARE") {
      const half = widths[0] / 2, capL = [startL[0] - tangents[0][0] * half, startL[1] - tangents[0][1] * half], capR = [startR[0] - tangents[0][0] * half, startR[1] - tangents[0][1] * half];
      if (!finitePoint(capL) || !finitePoint(capR)) throw new TaperedStrokeStrip2DError("NUMERIC_OVERFLOW");
      append(left, capL); append(right, capR);
    }
    else { append(left, startL); append(right, startR); }
  }
  function joinAt(i) {
    const prev = (i - 1 + edgeCount) % edgeCount, next = i % edgeCount;
    const previousPoint = exactPoint(points[(i - 1 + n) % n]), currentPoint = exactPoint(points[i]), followingPoint = exactPoint(points[(i + 1) % n]);
    const turn = exactCross(exactSub(currentPoint, previousPoint), exactSub(followingPoint, currentPoint)).signum();
    const inL = sideSample(points[i], normals[prev], widths[i], 1), outL = sideSample(points[i], normals[next], widths[i], 1), inR = sideSample(points[i], normals[prev], widths[i], -1), outR = sideSample(points[i], normals[next], widths[i], -1);
    if (![inL, outL, inR, outR].every(finitePoint)) throw new TaperedStrokeStrip2DError("NUMERIC_OVERFLOW");
    if (turn === 0) { append(left, inL); append(right, inR); joins.push({ left: "CONTINUOUS", right: "CONTINUOUS" }); return true; }
    const leftInner = turn > 0;
    // Supporting lines use the previous side section and next side section, whose other
    // endpoints are the neighbouring vertex samples.  This keeps taper intersections exact.
    const prevPoint = (i - 1 + n) % n, nextPoint = (i + 1) % n;
    function resolve(target, sign, inner) {
      const prevStart = sideSample(points[prevPoint], normals[prev], widths[prevPoint], sign);
      const nextEnd = sideSample(points[nextPoint], normals[next], widths[nextPoint], sign);
      const incoming = sideSample(points[i], normals[prev], widths[i], sign), outgoing = sideSample(points[i], normals[next], widths[i], sign);
      if (![prevStart, nextEnd, incoming, outgoing].every(finitePoint)) throw new TaperedStrokeStrip2DError("NUMERIC_OVERFLOW");
      if (inner) {
        const hit = exactLineIntersection(prevStart, incoming, outgoing, nextEnd);
        if (!hit && !same(incoming, outgoing)) return false;
        if (hit && (hit.t.compareTo(ExactRational.ZERO) < 0 || hit.t.compareTo(ExactRational.ONE) > 0 || hit.u.compareTo(ExactRational.ZERO) < 0 || hit.u.compareTo(ExactRational.ONE) > 0)) return false;
        const rounded = hit ? roundExact(hit) : incoming;
        if (!rounded || same(rounded, prevStart) || same(rounded, nextEnd)) return false;
        append(target, rounded); return "INNER";
      }
      if (input.join === "MITER") {
        const hit = exactLineIntersection(prevStart, incoming, outgoing, nextEnd);
        if (hit) {
          const p = roundExact(hit), center = exactPoint(points[i]);
          const dx = hit.x.subtract(center.x), dy = hit.y.subtract(center.y), d2 = dx.multiply(dx).add(dy.multiply(dy));
          const h = ExactRational.of(widths[i]).divide(ExactRational.TWO).multiply(ExactRational.of(limit)), allowed = h.multiply(h);
          if (p && !same(p, incoming) && !same(p, outgoing) && d2.compareTo(allowed) <= 0) { append(target, p); return "MITER"; }
        }
      }
      append(target, incoming); append(target, outgoing); return "BEVEL";
    }
    const l = resolve(left, 1, leftInner), r = resolve(right, -1, !leftInner); if (!l || !r) return false;
    joins.push({ left: l, right: r }); return true;
  }
  const firstJoin = input.closed ? 0 : 1, lastJoin = input.closed ? n : n - 1;
  for (let i = firstJoin; i < lastJoin; i += 1) if (!joinAt(i % n)) return rejected();
  if (!input.closed) {
    const end = n - 1, l = sideSample(points[end], normals[edgeCount - 1], widths[end], 1), r = sideSample(points[end], normals[edgeCount - 1], widths[end], -1);
    if (!finitePoint(l) || !finitePoint(r)) throw new TaperedStrokeStrip2DError("NUMERIC_OVERFLOW");
    if (input.cap === "SQUARE") {
      const half = widths[end] / 2, capL = [l[0] + tangents[edgeCount - 1][0] * half, l[1] + tangents[edgeCount - 1][1] * half], capR = [r[0] + tangents[edgeCount - 1][0] * half, r[1] + tangents[edgeCount - 1][1] * half];
      if (!finitePoint(capL) || !finitePoint(capR)) throw new TaperedStrokeStrip2DError("NUMERIC_OVERFLOW");
      append(left, capL); append(right, capR);
    }
    else { append(left, l); append(right, r); }
    const ring = right.concat([...left].reverse()), issue = ringIssuePoints(ring);
    if (issue) return rejected({ ring: 0, ...issue });
    return { status: "ACCEPTED", visible: { outer: normalizeRing(ring), holes: [] }, centerline: points.map(([x, y]) => [x, y]), leftBoundary: left, rightBoundary: right, resolvedJoins: joins, witness: none() };
  }
  const leftOuter = twiceArea(left).compareTo(twiceArea(right)) > 0 ? left : right, hole = leftOuter === left ? right : left;
  const outerIssue = ringIssuePoints(leftOuter), holeIssue = ringIssuePoints(hole);
  if (outerIssue) return rejected({ ring: 0, ...outerIssue });
  if (holeIssue) return rejected({ ring: 1, ...holeIssue });
  const visible = { outer: normalizeRing(leftOuter), holes: [normalizeHole(hole)] };
  const relationIssue = firstRegionIssue(captureRegion(visible, TaperedStrokeStrip2DError));
  if (relationIssue) return rejected(relationIssue);
  return { status: "ACCEPTED", visible, centerline: points.map(([x, y]) => [x, y]), leftBoundary: left, rightBoundary: right, resolvedJoins: joins, witness: none() };
}
