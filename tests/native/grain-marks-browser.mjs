import { observeGrainMarks } from "/packages/javascript/examples/grain-marks/sketch.js";

let previous;
let baselineGeometry;
function geometry(composition) {
  const bounds = new Float64Array(4), regions = [];
  for (let region = 0; region < composition.size; region += 1) {
    const points = composition.regionAt(region), values = [];
    for (let index = 0; index < points.size; index += 1) {
      points.pointInto(index, bounds, 0);
      values.push([bounds[0], bounds[1]]);
    }
    regions.push(values);
  }
  return JSON.stringify(regions);
}

export function observe(expected) {
  const current = observeGrainMarks();
  const values = geometry(current.composition);
  if (current.revision !== expected.revision || current.composition.size !== (expected.regions ?? (expected.settings?.cells ? 26 : 1)) ||
      current.composition.totalPoints !== expected.points ||
      current.drawnMarks !== expected.points) throw new Error("Revision/point count differs");
  for (const [key, value] of Object.entries(expected.settings ?? {})) {
    if (current.settings[key] !== value) throw new Error(`Setting ${key} differs`);
  }
  if (!previous) baselineGeometry = values;
  if (previous) {
    const same = previous.composition === current.composition;
    if (same !== expected.retained) throw new Error("Unexpected composition identity");
    if (same && previous.values !== values) throw new Error("Retained geometry changed");
    if (!same && !expected.sameGeometry && previous.values === values) throw new Error("Layout edit did not change geometry");
  }
  if (expected.sameGeometry && values !== baselineGeometry) throw new Error("Reset geometry differs from baseline");
  previous = { composition: current.composition, values };
  return { revision: current.revision, regions: current.composition.size,
    points: current.composition.totalPoints, drawnMarks: current.drawnMarks,
    settings: current.settings, retained: expected.retained ?? null,
    sameGeometryAsBaseline: values === baselineGeometry };
}
