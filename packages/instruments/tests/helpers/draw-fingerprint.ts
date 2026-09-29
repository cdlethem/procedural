import { createHash } from "node:crypto";
import { drawInstrument, type DrawingContext, type InstrumentInput } from "../../dist/index.js";

const sha = (value: Uint8Array | Uint8ClampedArray) => createHash("sha256").update(value).digest("hex");

type Style = { fill: string | null; stroke: string | null; weight: number; cap: string };
/** Ops that paint with the fill, and ops that paint with the stroke. */
const filled = new Set(["circle", "ellipse", "rect", "triangle", "quad", "arc", "endShape", "text"]);
const stroked = new Set(["circle", "ellipse", "rect", "triangle", "quad", "arc", "endShape", "line", "point", "bezier", "curve"]);

/**
 * Draw an instrument into a recording stand-in for a p5 canvas and return a hash of what it
 * *visibly* drew. Style calls are not hashed on their own; each painting call is hashed with the
 * fill and stroke in effect, and only the parts that call uses. So a stroke weight set while the
 * stroke is off, or a fill set before a line, cannot register as an effect, while geometry,
 * transforms, colors that are actually painted, and every unrecognized call still do.
 */
export function drawFingerprint(input: InstrumentInput): string {
  const hash = createHash("sha256");
  let style: Style = { fill: "default", stroke: "default", weight: 1, cap: "default" };
  const stack: Style[] = [];
  const raw = (name: string, args: unknown[]) => {
    for (const value of args) if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`${name} received a non-finite number`);
    hash.update(JSON.stringify([name, ...args]));
  };
  const record = (name: string, args: unknown[]) => {
    switch (name) {
      case "fill": style = { ...style, fill: JSON.stringify(args) }; return;
      case "noFill": style = { ...style, fill: null }; return;
      case "stroke": style = { ...style, stroke: JSON.stringify(args) }; return;
      case "noStroke": style = { ...style, stroke: null }; return;
      case "strokeWeight": style = { ...style, weight: Number(args[0]) }; return;
      case "strokeCap": style = { ...style, cap: JSON.stringify(args) }; return;
      case "push": stack.push(style); raw(name, args); return;
      case "pop": style = stack.pop() ?? style; raw(name, args); return;
      default: {
        const paint: unknown[] = [];
        if (filled.has(name) && style.fill !== null) paint.push(["fill", style.fill]);
        if (stroked.has(name) && style.stroke !== null) paint.push(["stroke", style.stroke, style.weight, style.cap]);
        raw(name, filled.has(name) || stroked.has(name) ? [...args, paint] : args);
      }
    }
  };
  const context = new Proxy({ setLineDash: (value: number[]) => raw("setLineDash", value) } as Record<string, unknown>, {
    get(target, key: string) { return key in target ? target[key] : (...args: unknown[]) => raw(`context.${key}`, args); },
  });
  const p = new Proxy({
    CLOSE: "close", ROUND: "round", drawingContext: context, width: 640, height: 640,
    background: (...args: unknown[]) => raw("background", args),
    createImage: (width: number, height: number) => ({ width, height, pixels: new Uint8ClampedArray(width * height * 4), loadPixels() {}, updatePixels() {} }),
    image: (image: { width: number; height: number; pixels: Uint8ClampedArray }, ...args: number[]) => {
      raw("imageGeometry", [image.width, image.height, ...args]);
      raw("imagePixels", [sha(image.pixels)]);
    },
  } as Record<string, unknown>, {
    get(target, key: string) { return key in target ? target[key] : (...args: unknown[]) => record(key, args); },
  });
  drawInstrument(p as unknown as DrawingContext, input);
  return hash.digest("hex");
}
