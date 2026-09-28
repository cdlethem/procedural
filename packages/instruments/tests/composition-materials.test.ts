import assert from "node:assert/strict";
import test from "node:test";
import { createInstrument, inside, pathMaterial, referenceComposition, regionFill, strokeWith,
  type CompositionSurface, type Path, type PathMaterialSpec } from "../dist/index.js";

/** Record world-space primitive geometry, including the consumer's local frame. */
class GeometrySurface implements CompositionSurface {
  CLOSE = "close";
  ROUND = "round";
  lines: number[][] = [];
  circles: number[][] = [];
  frame = { x: 0, y: 0, angle: 0, scale: 1 };
  stack: typeof this.frame[] = [];
  push() { this.stack.push({ ...this.frame }); }
  pop() { this.frame = this.stack.pop()!; }
  translate(x: number, y: number) {
    const { angle, scale } = this.frame;
    this.frame.x += scale * (Math.cos(angle) * x - Math.sin(angle) * y);
    this.frame.y += scale * (Math.sin(angle) * x + Math.cos(angle) * y);
  }
  rotate(angle: number) { this.frame.angle += angle; }
  scale(scale: number) { this.frame.scale *= scale; }
  line(x1: number, y1: number, x2: number, y2: number) {
    const { x, y, angle, scale } = this.frame, c = Math.cos(angle), s = Math.sin(angle);
    this.lines.push([x + scale * (c * x1 - s * y1), y + scale * (s * x1 + c * y1),
      x + scale * (c * x2 - s * y2), y + scale * (s * x2 + c * y2)]);
  }
  noFill() {} noStroke() {} fill() {} stroke() {} strokeWeight() {} strokeCap() {}
  circle(cx: number, cy: number, diameter: number) {
    const { x, y, angle, scale } = this.frame, c = Math.cos(angle), s = Math.sin(angle);
    this.circles.push([x + scale * (c * cx - s * cy), y + scale * (s * cx + c * cy), diameter * scale]);
  }
  rect() {} beginShape() {} vertex() {} endShape() {}
}
const material: PathMaterialSpec = { kind: "stitch", weight: 1, spacing: 25, phase: 0, retention: 1,
  mark: { kind: "dot", size: 3, petals: 5, opening: .4, weight: 1, rotation: 0, variation: 0, retention: 1 } };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("open-path stations span the complete path and phase follows corners rather than cutting chords", () => {
  const p = new GeometrySurface();
  const straight: Path = { id: "line", seed: 1, points: [[0, 0], [100, 0]], closed: false, level: 0 };
  strokeWith(p, [straight], pathMaterial(material, [0]));
  assert.deepEqual(p.lines.map(([x1, , x2]) => (x1 + x2) / 2), [0, 25, 50, 75]);
  p.lines = [];
  const corner: Path = { id: "corner", seed: 1, points: [[0, 0], [10, 0], [10, 30]], closed: false, level: 0 };
  strokeWith(p, [corner], pathMaterial({ ...material, spacing: 20, phase: .75 }, [0]));
  assert.equal(p.lines.length, 2);
  for (const [index, [x1, y1, x2, y2]] of p.lines.entries()) {
    near((x1 + x2) / 2, 10); near((y1 + y2) / 2, 5 + index * 20);
    near(x1, x2); assert.ok(y2 > y1);
  }
});

test("closed-path phase wraps without a duplicate seam station and uses the source tangent", () => {
  const p = new GeometrySurface();
  const square: Path = { id: "square", seed: 1, points: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true, level: 0 };
  strokeWith(p, [square], pathMaterial({ ...material, spacing: 10, phase: 1 }, [0]));
  assert.equal(p.lines.length, 4);
  const expected = [[10, 0], [10, 10], [0, 10], [0, 0]];
  p.lines.forEach(([x1, y1, x2, y2], i) => {
    near((x1 + x2) / 2, expected[i][0]); near((y1 + y2) / 2, expected[i][1]);
  });
  const final = p.lines[3]; near(final[1], final[3]); assert.ok(final[2] > final[0]);
});

test("rectangular hatching is centered, uniformly spaced and confined to its inset", () => {
  const recipe = referenceComposition(createInstrument("region-quilts"));
  if (recipe.kind !== "regions") throw Error("Expected rectangular composition");
  const p = new GeometrySurface();
  const region = { id: "region:0", seed: 3113322894, bounds: [82.5, 345, 332.5, 532.5] as const };
  inside(p, [region], regionFill({ ...recipe.fill, kind: "hatch", spacing: 12, inset: 5,
    angle: -35, retention: 1, underpaint: 0 }, [0]));
  const theta = -35 * Math.PI / 180, nx = -Math.sin(theta), ny = Math.cos(theta);
  const offsets = p.lines.map(([x1, y1, x2, y2]) => {
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      assert.ok(x >= 87.5 - 1e-9 && x <= 327.5 + 1e-9);
      assert.ok(y >= 350 - 1e-9 && y <= 527.5 + 1e-9);
    }
    return (((x1 + x2) / 2) - 207.5) * nx + (((y1 + y2) / 2) - 438.75) * ny;
  }).sort((a, b) => a - b);
  assert.equal(offsets.length, 24);
  offsets.forEach((value, index) => near(value, (index - 11.5) * 12));
});

test("filled dots ignore unused stroke width at motif and nested bead boundaries", () => {
  const recipe = referenceComposition(createInstrument("region-quilts"));
  if (recipe.kind !== "regions") throw Error("Expected rectangular composition");
  const region = { id: "edge", seed: 42, bounds: [0, 0, 120, 100] as const };
  for (const kind of ["motifs", "contours"] as const) {
    const draw = (weight: number) => {
      const surface = new GeometrySurface();
      const dot = { ...recipe.fill.mark, kind: "dot" as const, size: 6, variation: 0, retention: 1, weight };
      inside(surface, [region], regionFill({ ...recipe.fill, kind, inset: 0, retention: 1,
        spacing: 13, weight, mark: dot,
        contour: { ...recipe.fill.contour, source: "waves", frequency: 1.25 },
        material: { ...recipe.fill.material, kind: "beads", spacing: 10, mark: dot },
      }, [0]));
      return surface.circles;
    };
    const light = draw(0);
    assert.ok(light.some(([x, y, diameter]) =>
      Math.min(x, y, 120 - x, 100 - y) < diameter / 2 + 10), `${kind} must exercise an edge station`);
    assert.deepEqual(draw(20), light, `${kind} filled dots must not acquire an invisible stroke margin`);
  }
});
