import { cross, fail, passiveRecord, readPoints, safeWork, checkedProduct, checkedSum, valueAt, point } from "./internal/geometry-a-utils.js";
const KEYS = ["points", "maxWork"];
/** Return the counter-clockwise hull after exact-coordinate deduplication. */
export function convexHull2D(input) {
  passiveRecord(input, KEYS); const source = readPoints(valueAt(input, "points"), 0); const maxWork = safeWork(valueAt(input, "maxWork"));
  if (checkedSum(checkedProduct(source.length, source.length), source.length) > maxWork) fail("WORK_LIMIT");
  const sites = [];
  for (let i = 0; i < source.length; i += 1) {
    let duplicate = false; for (let j = 0; j < sites.length; j += 1) if (sites[j].x === source[i][0] && sites[j].y === source[i][1]) { duplicate = true; break; }
    if (!duplicate) sites.push({ x: source[i][0], y: source[i][1], index: i });
  }
  sites.sort((a, b) => a.x < b.x ? -1 : a.x > b.x ? 1 : a.y < b.y ? -1 : a.y > b.y ? 1 : 0);
  if (sites.length <= 1) return { points: sites.map((s) => point(s.x, s.y)), sourceIndices: sites.map((s) => s.index) };
  const build = (items) => { const chain = []; for (const site of items) { const p = [site.x, site.y]; while (chain.length >= 2 && cross([chain[chain.length - 2].x, chain[chain.length - 2].y], [chain[chain.length - 1].x, chain[chain.length - 1].y], p) <= 0) chain.pop(); chain.push(site); } return chain; };
  const lower = build(sites), upper = build([...sites].reverse()); const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  return { points: hull.map((s) => point(s.x, s.y)), sourceIndices: hull.map((s) => s.index) };
}
