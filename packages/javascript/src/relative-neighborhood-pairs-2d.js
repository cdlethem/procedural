import { array, at, integer, point, rationalPoint, record, squared, MAX_SAFE } from "./internal/graph-growth-utils.js";

export class RelativeNeighborhoodPairs2DError extends Error {
  constructor(code) { super(code); this.name = "RelativeNeighborhoodPairs2DError"; this.code = code; }
}

export function relativeNeighborhoodPairs2D(input) {
  const ErrorType = RelativeNeighborhoodPairs2DError;
  const source = record(input, ["points", "maxWork"], ErrorType);
  const raw = array(at(source, "points"), ErrorType);
  const points = [];
  for (let index = 0; index < raw.length; index++) points.push(point(at(raw, index), ErrorType));
  const maxWork = integer(at(source, "maxWork"), ErrorType);
  const n = BigInt(points.length), pairCount = n * (n - 1n) / 2n;
  const work = n + pairCount * (n > 2n ? n - 2n : 0n);
  if (work > BigInt(MAX_SAFE) || work > BigInt(maxWork)) throw new ErrorType("WORK_LIMIT");

  const exact = points.map(rationalPoint), distances = Array.from({ length: points.length }, () => []);
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) distances[i][j] = squared(exact[i], exact[j]);
  }
  const distance = (a, b) => a < b ? distances[a][b] : distances[b][a];
  const pairs = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const boundary = distance(i, j);
      let retained = true;
      for (let k = 0; k < points.length; k++) {
        if (k === i || k === j) continue;
        if (distance(i, k).compareTo(boundary) < 0 && distance(j, k).compareTo(boundary) < 0) {
          retained = false;
          break;
        }
      }
      if (retained) pairs.push([i, j]);
    }
  }
  return { pairs };
}
