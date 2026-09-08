import { observeProfileMarks } from "/packages/javascript/examples/profile-marks/sketch.js";

let previous, baseline;
function geometry(composition) { return Array.from({ length: composition.size }, (_, shape) => composition.meshAt(shape).toValues()); }
export function observe(expected) {
  const current = observeProfileMarks(), values = JSON.stringify(geometry(current.composition));
  if (current.revision !== expected.revision || current.drawnFaces !== expected.faces) throw new Error("revision or drawn-face count differs");
  for (const [key, value] of Object.entries(expected.settings)) if (current.settings[key] !== value) throw new Error(`setting ${key} differs`);
  if (previous) { const retained = previous.composition === current.composition; if (retained !== expected.retained) throw new Error("composition retention differs"); if (retained && previous.values !== values) throw new Error("retained geometry changed"); }
  if (!baseline) baseline = values; if (expected.baseline && values !== baseline) throw new Error("baseline geometry differs"); previous = { composition: current.composition, values };
  return { revision: current.revision, faces: current.drawnFaces, settings: current.settings, retained: expected.retained, acknowledged: typeof current.acknowledgedImage === "string" };
}
