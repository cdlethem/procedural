import { denseArray, finite, integer, plainRecord, pointArray, zero } from "./internal/region-utils.js";

export class SvgPlotPlan01Error extends Error {
  constructor(code) { super(code); this.name = "SvgPlotPlan01Error"; this.code = code; }
}
function number(n) { return zero(n).toString(); }

/** Emit a deliberately small SVG path document whose coordinates are already millimetres. */
export function svgPlotPlan01(configuration) {
  const input = plainRecord(configuration, ["widthMm", "heightMm", "paths", "strokeWidthMm", "maxOutputBytes"], SvgPlotPlan01Error);
  const width = finite(input.widthMm, SvgPlotPlan01Error), height = finite(input.heightMm, SvgPlotPlan01Error), stroke = finite(input.strokeWidthMm, SvgPlotPlan01Error);
  if (!(width > 0) || !(height > 0) || !(stroke > 0)) throw new SvgPlotPlan01Error("INVALID_INPUT");
  const max = integer(input.maxOutputBytes, SvgPlotPlan01Error); denseArray(input.paths, SvgPlotPlan01Error);
  const paths = input.paths.map((path) => {
    denseArray(path, SvgPlotPlan01Error); const result = path.map((p) => pointArray(p, SvgPlotPlan01Error));
    for (let i = 0; i < result.length; i += 1) {
      const [x, y] = result[i]; if (x < 0 || x > width || y < 0 || y > height) throw new SvgPlotPlan01Error("INVALID_INPUT");
      if (i && x === result[i - 1][0] && y === result[i - 1][1]) throw new SvgPlotPlan01Error("INVALID_INPUT");
    }
    return result;
  });
  const w = number(width), h = number(height), s = number(stroke);
  const prefix = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><g fill="none" stroke="black" stroke-width="${s}">`, suffix = "</g></svg>";
  // Number::toString and the fixed XML syntax are ASCII. Count the exact final
  // UTF-8 bytes from tokens before constructing any path element or final SVG.
  const formatted = paths.map((path) => path.map(([x, y]) => [number(x), number(y)]));
  let bytes = BigInt(prefix.length + suffix.length);
  for (const path of formatted) {
    if (!path.length) continue;
    bytes += BigInt('<path d="'.length + '"/>'.length);
    for (let i = 0; i < path.length; i += 1) bytes += BigInt((i ? ' L ' : 'M ').length + path[i][0].length + 1 + path[i][1].length);
  }
  if (bytes > BigInt(max)) throw new SvgPlotPlan01Error("OUTPUT_LIMIT");
  const pathTokens = formatted.filter((path) => path.length > 0).map((path) => `<path d="${path.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ")}"/>`);
  const svg = prefix + pathTokens.join("") + suffix;
  return { svg };
}
