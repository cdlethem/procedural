/**
 * Thread geometry shared by every woven drawing: where a lower strand is interrupted by an upper
 * one, and how the surviving parts of a path are cut out of it. Woven Strands (a fixed grid
 * weave) and Crossing Lace (paths crossing anywhere) both call these three functions, so the two
 * instruments cannot disagree about what a gap is.
 *
 * All lengths are canvas units measured along the path (travel distance), not vertex index.
 */
type XY = readonly [number, number];
export type Segment = [number, number, number, number];

/** Travel distance at every vertex of an open polyline; entry 0 is 0. */
export function cumulativeLengths(path: readonly XY[]): number[] {
  const distances = [0];
  for (let i = 1; i < path.length; i++)
    distances.push(distances[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return distances;
}

/**
 * Half the length of lower-strand travel that one crossing removes. Projects both the upper stroke
 * and the lower path's round cap onto the lower path and adds explicit clearance along travel; the
 * division by the sine of the crossing angle keeps it safe at shallow angles. Widths are the
 * strands' full stroke widths, `sine` is |sin| of the angle between their tangents.
 */
export function crossingHalfGap(upperWidth: number, lowerWidth: number, sine: number, clearance: number): number {
  return (upperWidth + lowerWidth) / (2 * sine) + clearance;
}

const lerp = (a: XY, b: XY, fraction: number): XY => [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];

/**
 * Delete intervals of travel distance, then reconstruct the retained polyline fragments as
 * segments. `gaps` are [low, high] intervals of `distance`; they may be given in any order and may
 * overlap. Every source segment yields its own retained pieces, in path order. When `starts` is
 * given, the travel distance at which each returned segment begins is appended to it.
 */
export function retainedSegments(path: readonly XY[], distance: readonly number[], gaps: readonly (readonly [number, number])[], starts?: number[]): Segment[] {
  if (path.length < 2) return [];
  const ordered = gaps.length > 1 ? [...gaps].sort((a, b) => a[0] - b[0]) : gaps;
  const result: Segment[] = [];
  for (let i = 1; i < path.length; i++) {
    const start = distance[i - 1], end = distance[i], segmentLength = end - start;
    let cursor = start;
    for (const [low, high] of ordered) {
      if (low >= end) break;
      if (high <= cursor) continue;
      const stop = Math.min(end, low);
      if (stop > cursor) {
        const a = lerp(path[i - 1], path[i], (cursor - start) / segmentLength);
        const b = lerp(path[i - 1], path[i], (stop - start) / segmentLength);
        result.push([a[0], a[1], b[0], b[1]]);
        starts?.push(cursor);
      }
      cursor = Math.max(cursor, high);
      if (cursor >= end) break;
    }
    if (cursor < end) {
      const a = lerp(path[i - 1], path[i], (cursor - start) / segmentLength);
      result.push([a[0], a[1], path[i][0], path[i][1]]);
      starts?.push(cursor);
    }
  }
  return result;
}

/** One surviving part of a cut path: consecutive points, and the travel distance it starts at. */
export interface CutPiece { readonly points: XY[]; readonly start: number }

/**
 * The parts of a path that survive deleting `gaps` (intervals of travel distance, any order,
 * overlaps allowed). A closed path is cut along its closing edge too: an interval reaching past
 * either end wraps, and the parts on both sides of the seam join into one. A closed path with no
 * gap comes back as a single piece that keeps its first vertex first. Pieces have at least two
 * points; zero-length remnants are dropped.
 */
export function cutPath(path: readonly XY[], closed: boolean, gaps: readonly (readonly [number, number])[]): { pieces: CutPiece[]; length: number } {
  const points = closed ? [...path, path[0]] : path;
  const distance = cumulativeLengths(points), length = distance[distance.length - 1];
  const wrapped: [number, number][] = [];
  for (const [low, high] of gaps) {
    if (closed && high - low >= length) return { pieces: [], length };
    if (closed && low < 0) { wrapped.push([low + length, length + 1], [-1, high]); continue; }
    if (closed && high > length) { wrapped.push([low, length + 1], [-1, high - length]); continue; }
    wrapped.push([low, high]);
  }
  if (closed && wrapped.length === 0) return { pieces: [{ points: [...path], start: 0 }], length };
  const pieces: CutPiece[] = [];
  let current: XY[] | null = null, currentStart = 0;
  const flush = () => { if (current && current.length > 1) pieces.push({ points: current, start: currentStart }); current = null; };
  const starts: number[] = [];
  const parts = retainedSegments(points, distance, wrapped, starts);
  for (let index = 0; index < parts.length; index++) {
    const [x1, y1, x2, y2] = parts[index];
    const last: XY | undefined = current ? current[current.length - 1] : undefined;
    if (last && last[0] === x1 && last[1] === y1) current!.push([x2, y2]);
    else { flush(); current = [[x1, y1], [x2, y2]]; currentStart = starts[index]; }
  }
  flush();
  if (closed && pieces.length > 1) {
    const first = pieces[0], last = pieces[pieces.length - 1];
    const a = first.points[0], b = last.points[last.points.length - 1];
    if (first.start === 0 && a[0] === points[0][0] && a[1] === points[0][1] && b[0] === points[0][0] && b[1] === points[0][1]) {
      pieces.pop();
      pieces[0] = { points: [...last.points, ...first.points.slice(1)], start: last.start };
    }
  }
  return { pieces, length };
}
