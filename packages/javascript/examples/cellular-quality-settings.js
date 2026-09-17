/** Native-only control schema. Keep in parity with systems-a.ts; browser test checks every field. */
const num = (key, label, min, max, hardMin, hardMax, step = 1, integer = false) =>
  ({ key, label, type: "number", min, max, hardMin, hardMax, step, integer });
const select = (key, label, options) => ({ key, label, type: "select", options });

const sources = (chemical, stripes = false) => [
  select("source", "Initial field", stripes ? ["disc", "bands", "speckle"] : ["disc", "bands", "checker", "speckle"]),
  num("sourceX", "Source X", -.5, .5, -100, 100, .01),
  num("sourceY", "Source Y", -.5, .5, -100, 100, .01),
  num("frequency", "Source frequency", 1, 8, 1, chemical ? 12 : 10, 1, true),
  num("occupancy", "Initial fill", stripes ? 0 : .1, stripes ? .35 : .7, 0, 1, .01),
];
const sharedDefaults = { sourceX: 0, sourceY: 0, frequency: 4, occupancy: .35, legacy: false };
const chemical = (source, passes, scale, stripes = false) => ({
  defaults: { ...sharedDefaults, source, passes, scale, weight: 1, feed: .035, kill: .062,
    occupancy: stripes ? .1 : sharedDefaults.occupancy },
  controls: [
    ...sources(true, stripes),
    num("passes", "Passes", 0, 16, 0, 256, 1, true),
    num("feed", "Feed", .02, .06, .02, .06, .001),
    num("kill", "Kill", .04, .08, .04, .08, .001),
    num("scale", "Cell size", 7, 24, .01, 10000),
    num("weight", "Stroke weight", 0, 8, 0, 100, .25),
  ],
});
const cellular = (source, passes, cellSize) => ({
  defaults: { ...sharedDefaults, source, passes, cellSize, weight: 1, rule: "life", boundary: "WRAP" },
  controls: [
    ...sources(false),
    select("rule", "Rule", ["life", "highlife", "seeds", "day-night"]),
    select("boundary", "Boundary", ["WRAP", "DEAD"]),
    num("passes", "Passes", 0, 32, 0, 256, 1, true),
    num("cellSize", "Cell size", 7, 30, .01, 10000),
    num("weight", "Stroke weight", 0, 8, 0, 100, .25),
  ],
});

export const cellularQualitySettings = {
  "reaction-spots": chemical("speckle", 12, 18),
  "reaction-stripes": chemical("bands", 8, 13, true),
  "organic-cells": cellular("speckle", 8, 18),
  "geometric-generations": cellular("checker", 6, 22),
};
