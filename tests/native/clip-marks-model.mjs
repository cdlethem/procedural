#!/usr/bin/env node
/**
 * Focused pure-model checks for the ClipMarks starter: all six geometry states
 * (dense/sparse/supplied x normal/shallow floor) compared segment-by-segment
 * and source-index-by-source-index against a real SegmentClip2D Java reference
 * run (saved before this test was written), plus the H/T/0 rebuild semantics.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClipMarks } from "../../packages/javascript/examples/clip-marks/clip-marks.js";

const referencePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures/workflows/clip-marks-java.txt");

function parseReference(text) {
  const states = {};
  let current = null;
  for (const line of text.split("\n")) {
    const header = line.match(/^(dense-normal|sparse-normal|supplied-normal|dense-shallow|sparse-shallow|supplied-shallow) size=(\d+)$/);
    if (header) {
      current = header[1];
      states[current] = { size: Number(header[2]), segments: [] };
      continue;
    }
    const segment = line.match(/^  (\d+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (\d+)$/);
    if (segment && current) {
      states[current].segments.push([Number(segment[2]), Number(segment[3]), Number(segment[4]), Number(segment[5]), Number(segment[6])]);
    }
  }
  return states;
}

function dump(clipped) {
  const segments = [];
  for (let i = 0; i < clipped.size; i += 1) {
    const s = clipped.segmentAt(i);
    segments.push([s[0], s[1], s[2], s[3], clipped.sourceIndexAt(i)]);
  }
  return segments;
}

function assertStateMatches(composition, reference, state) {
  const expected = reference[state];
  const actual = dump(composition.clipped);
  assert.equal(actual.length, expected.size, `${state}: segment count`);
  for (let i = 0; i < expected.size; i += 1) {
    for (let c = 0; c < 5; c += 1) {
      assert.equal(actual[i][c], expected.segments[i][c], `${state} segment ${i} field ${c}`);
    }
  }
}

async function main() {
  const reference = parseReference(await readFile(referencePath, "utf8"));
  assert.equal(Object.keys(reference).length, 6, "reference covers six states");

  // All six geometry states, each reached from a fresh composition.
  const reach = (ops) => {
    const composition = createClipMarks();
    for (const op of ops) composition[op]();
    return composition;
  };
  assertStateMatches(reach([]), reference, "dense-normal");
  assertStateMatches(reach(["toggleShallow"]), reference, "dense-shallow");
  assertStateMatches(reach(["toggleSparse"]), reference, "sparse-normal");
  assertStateMatches(reach(["toggleSparse", "toggleShallow"]), reference, "sparse-shallow");
  assertStateMatches(reach(["toggleAlternateSource"]), reference, "supplied-normal");
  assertStateMatches(reach(["toggleAlternateSource", "toggleShallow"]), reference, "supplied-shallow");

  // H is inert while the supplied source is active (Java's !alternateSource guard).
  const supplied = reach(["toggleAlternateSource"]);
  assert.equal(supplied.clipCalls, 2);
  supplied.toggleSparse();
  assert.equal(supplied.clipCalls, 2, "H does not rebuild while supplied source is active");
  assertStateMatches(supplied, reference, "supplied-normal");

  // C/M/O are display-only toggles.
  const display = createClipMarks();
  assert.equal(display.clipCalls, 1);
  display.toggleAlternateColor();
  display.toggleEndpoints();
  display.toggleOverlay();
  assert.equal(display.clipCalls, 1, "C/M/O never rebuild the clip");

  // 0 with a geometry flag set: rebuilds back to dense-normal.
  const geometryChanged = reach(["toggleShallow"]);
  assert.equal(geometryChanged.clipCalls, 2);
  geometryChanged.reset();
  assert.equal(geometryChanged.clipCalls, 3, "reset rebuilds when geometry changed");
  assertStateMatches(geometryChanged, reference, "dense-normal");

  // 0 with only display flags set: no rebuild.
  const displayOnly = createClipMarks();
  displayOnly.toggleAlternateColor();
  displayOnly.toggleEndpoints();
  displayOnly.reset();
  assert.equal(displayOnly.clipCalls, 1, "reset skips rebuild when only display flags were on");
  assert.equal(displayOnly.endpoints, true, "reset restores endpoints to true");
  assert.equal(displayOnly.overlay, false);
  assertStateMatches(displayOnly, reference, "dense-normal");

  const totals = Object.fromEntries(Object.entries(reference).map(([k, v]) => [k, v.size]));
  return { totals };
}

const result = await main();
console.log(JSON.stringify({ status: "passed", ...result }));
