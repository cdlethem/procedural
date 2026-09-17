import { fdlibmHypot } from "./internal/fdlibm-hypot.js";
import { array, at, calc, integer, num, point, record, z } from "./internal/graph-growth-utils.js";

export class ThresholdEdgeRelaxation2DError extends Error {
  constructor(code) { super(code); this.name = "ThresholdEdgeRelaxation2DError"; this.code = code; }
}

export function thresholdEdgeRelaxation2D(input) {
  const ErrorType = ThresholdEdgeRelaxation2DError;
  const source = record(input, ["points", "pairs", "pinned", "minLength", "stepScale", "maxWork"], ErrorType);
  const rawPoints = array(at(source, "points"), ErrorType);
  const points = [];
  for (let index = 0; index < rawPoints.length; index++) points.push(point(at(rawPoints, index), ErrorType));
  const rawPairs = array(at(source, "pairs"), ErrorType);
  const pairs = [];
  for (let index = 0; index < rawPairs.length; index++) {
    const raw = array(at(rawPairs, index), ErrorType, 2);
    pairs.push([integer(at(raw, 0), ErrorType), integer(at(raw, 1), ErrorType)]);
  }
  const rawPinned = array(at(source, "pinned"), ErrorType);
  const pinned = [];
  for (let index = 0; index < rawPinned.length; index++) {
    const value = at(rawPinned, index);
    if (typeof value !== "boolean") throw new ErrorType("INVALID_INPUT");
    pinned.push(value);
  }
  const minLength = num(at(source, "minLength"), ErrorType);
  const stepScale = num(at(source, "stepScale"), ErrorType);
  const maxWork = integer(at(source, "maxWork"), ErrorType);
  if (minLength < 0 || stepScale < 0 || pinned.length !== points.length) throw new ErrorType("INVALID_INPUT");
  let lastI = -1, lastJ = -1;
  for (const [i, j] of pairs) {
    if (i >= j || j >= points.length || i < lastI || (i === lastI && j <= lastJ)) throw new ErrorType("INVALID_INPUT");
    lastI = i; lastJ = j;
  }
  if (BigInt(points.length) + BigInt(pairs.length) > BigInt(maxWork)) throw new ErrorType("WORK_LIMIT");

  const sumsX = new Array(points.length).fill(0), sumsY = new Array(points.length).fill(0);
  for (const [i, j] of pairs) {
    const dx = calc(points[j][0] - points[i][0], ErrorType);
    const dy = calc(points[j][1] - points[i][1], ErrorType);
    const length = calc(fdlibmHypot(dx, dy), ErrorType);
    if (length <= minLength) continue;
    const ux = calc(dx / length, ErrorType), uy = calc(dy / length, ErrorType);
    sumsX[i] = calc(sumsX[i] + ux, ErrorType);
    sumsY[i] = calc(sumsY[i] + uy, ErrorType);
    sumsX[j] = calc(sumsX[j] - ux, ErrorType);
    sumsY[j] = calc(sumsY[j] - uy, ErrorType);
  }
  const output = [], displacements = [];
  for (let index = 0; index < points.length; index++) {
    let dx = calc(stepScale * sumsX[index], ErrorType);
    let dy = calc(stepScale * sumsY[index], ErrorType);
    if (pinned[index]) { dx = 0; dy = 0; }
    displacements.push([z(dx), z(dy)]);
    output.push([z(calc(points[index][0] + dx, ErrorType)), z(calc(points[index][1] + dy, ErrorType))]);
  }
  return { points: output, displacements };
}
