import { observeRegionMarks } from "/packages/javascript/examples/region-marks/sketch.js";

let previous;
function geometry(composition) {
  const bounds = new Float64Array(4), rows = [];
  for (let i = 0; i < composition.size; i += 1) {
    composition.boundsInto(i, bounds);
    rows.push([composition.idAt(i), ...bounds]);
  }
  return JSON.stringify(rows);
}
export function observe(expected) {
  const current = observeRegionMarks();
  const values = geometry(current.composition);
  if (current.revision !== expected.revision || current.composition.size !== expected.cells ||
      current.drawnMarks !== expected.marks) throw new Error("Revision/cell/mark count differs");
  for (const [key, value] of Object.entries(expected.settings ?? {})) {
    if (current.settings[key] !== value) throw new Error(`Setting ${key} differs`);
  }
  if (previous) {
    const same = previous.composition === current.composition;
    if (same !== expected.retained) throw new Error("Unexpected composition identity");
    if (same && previous.values !== values) throw new Error("Retained geometry changed");
    if (!same && previous.values === values) throw new Error("Layout edit did not change geometry");
  }
  previous = { composition: current.composition, values };
  return { revision: current.revision, cells: current.composition.size, marks: current.drawnMarks,
    settings: current.settings, retained: expected.retained ?? null };
}
