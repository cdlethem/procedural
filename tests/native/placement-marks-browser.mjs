/** Consume the delivered PlacementMarks module graph in the real browser; no renderer claim here. */
import {
  ALTERNATE_PALETTE, BASE_PALETTE, createRadialPlacementMarks,
  createSeededPlacementMarks, vertexInto,
} from "/packages/javascript/examples/placement-marks/placement-marks.js";
import { observePlacementMarks } from "/packages/javascript/examples/placement-marks/sketch.js";

let liveObservation = null;
let baselineValues = null;

function check(value, message) {
  if (!value) throw new Error(message);
}

function bits(value) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false);
}

function samePoint(left, right) {
  return bits(left[0]) === bits(right[0]) && bits(left[1]) === bits(right[1]);
}

/** Exact binary64 view of one placement result, in the shared fixture shape. */
function placementValues(placements) {
  const values = placements.toValues();
  check(values.centres.length === values.radii.length && values.centres.length === values.sourceIndices.length,
    "placement arrays must have equal length");
  for (let index = 0; index < values.sourceIndices.length; index += 1) {
    check(Number.isInteger(values.sourceIndices[index]) && values.sourceIndices[index] >= 0,
      "source indices must be nonnegative integers");
    if (index > 0) check(values.sourceIndices[index] > values.sourceIndices[index - 1],
      "source indices must strictly increase");
  }
  return values;
}

function expectPrefix(values, prefix, label) {
  check(prefix.radii.length <= values.radii.length, `${label}: prefix longer than result`);
  for (let index = 0; index < prefix.radii.length; index += 1) {
    check(samePoint(values.centres[index], prefix.centres[index]), `${label}: prefix centre ${index}`);
    check(bits(values.radii[index]) === bits(prefix.radii[index]), `${label}: prefix radius ${index}`);
    check(values.sourceIndices[index] === prefix.sourceIndices[index], `${label}: prefix index ${index}`);
  }
}

/**
 * Pure public-model checks that run in the real browser module graph, before UI
 * rendering. Seeded counts come from the accepted CP3 Java evidence and the exact
 * core; the radial count is host trigonometry and is recorded, not asserted.
 */
export function runPlacementMarksModel() {
  const baseline = createSeededPlacementMarks(42, 5000, 4, 64, 1);
  const extended = createSeededPlacementMarks(42, 10000, 4, 64, 1);
  const seed43 = createSeededPlacementMarks(43, 5000, 4, 64, 1);
  const spacing = createSeededPlacementMarks(42, 5000, 4, 64, 1.2);
  const sizeMin = createSeededPlacementMarks(42, 5000, 8, 64, 1);
  const sizeMax = createSeededPlacementMarks(42, 5000, 4, 32, 1);
  const radial = createRadialPlacementMarks(1);

  check(Object.isFrozen(baseline) && Object.isFrozen(radial), "composition carriers must be frozen");
  check(baseline.placements.size === 424 && baseline.placements.attempts === 5000, "baseline count 424/5000");
  check(extended.placements.size === 517 && extended.placements.attempts === 10000, "extended count 517/10000");
  check(seed43.placements.size === 432 && seed43.placements.attempts === 5000, "seed 43 count 432/5000");
  check(spacing.placements.size === 353 && spacing.placements.attempts === 5000, "spacing count 353/5000");
  check(sizeMin.placements.size === 239 && sizeMin.placements.attempts === 5000, "minimum count 239/5000");
  check(sizeMax.placements.size === 613 && sizeMax.placements.attempts === 5000, "maximum count 613/5000");

  const baselineView = placementValues(baseline.placements);
  expectPrefix(placementValues(extended.placements), baselineView, "5000-of-10000");
  check(seed43.placements !== baseline.placements &&
    !samePoint(placementValues(seed43.placements).centres[0], baselineView.centres[0]),
    "different seed must regenerate the arrangement");

  const radialView = placementValues(radial.placements);
  check(radial.placements.attempts === 160, "radial attempts 160");
  check(radialView.radii.length > 0 && radialView.radii.length < 160, "radial accepts a proper subset");

  const ring = new Float64Array(2);
  const diamond = new Float64Array(2);
  vertexInto(baseline.placements, 0, 1, false, ring);
  vertexInto(baseline.placements, 0, 1, true, diamond);
  check(Number.isFinite(ring[0]) && Number.isFinite(ring[1]) && Number.isFinite(diamond[0]) && Number.isFinite(diamond[1]),
    "motif vertices must be finite");
  check(!(bits(ring[0]) === bits(diamond[0]) && bits(ring[1]) === bits(diamond[1])),
    "ring and diamond vertices must differ at vertex 1");
  check(Object.isFrozen(BASE_PALETTE) && Object.isFrozen(ALTERNATE_PALETTE) && BASE_PALETTE.length === 5,
    "palette carriers must be frozen");

  return {
    passed: true,
    scope: "Browser-loaded public PlacementMarks model only; no renderer or cross-host pixel identity claim.",
    counts: {
      baseline: 424, extended: 517, seed43: 432, spacing: 353, sizeMin: 239, sizeMax: 613,
      radial: radialView.radii.length, radialAttempts: 160,
    },
    prefix5000Of10000: true,
    radialHostTrigonometry: "recorded, not asserted (outside exact core semantics)",
  };
}

function sameSettings(actual, expected) {
  return actual.seed === expected.seed && actual.attempts === expected.attempts &&
    actual.minimum === expected.minimum && actual.maximum === expected.maximum &&
    actual.separation === expected.separation && actual.radial === expected.radial &&
    actual.diamonds === expected.diamonds && actual.alternate === expected.alternate;
}

/** Start cached-module observation after the actual starter has produced revision one. */
export function beginLivePlacementMarksObservation() {
  const snapshot = observePlacementMarks();
  check(snapshot.source === "seeded" && snapshot.revision === 1, "initial actual starter observation");
  check(snapshot.placements !== null && snapshot.placements.size === 424 && snapshot.placements.attempts === 5000,
    "initial retained baseline result");
  check(snapshot.drawnCircles === snapshot.placements.size &&
    snapshot.drawnVertices === snapshot.placements.size * 64, "initial drawn circle/motif counts");
  liveObservation = snapshot;
  baselineValues = placementValues(snapshot.placements);
  return {
    revision: snapshot.revision, settings: snapshot.settings,
    accepted: snapshot.placements.size, attempts: snapshot.placements.attempts, source: snapshot.source,
  };
}

/**
 * Verify actual UI state in this module's retained object identity domain.
 * expected: { settings, revisionDelta, rebuilt, accepted?, source }
 */
export function observeLivePlacementMarksAction(action, expected) {
  check(liveObservation !== null, "live observation has not started");
  const next = observePlacementMarks();
  check(next.revision === liveObservation.revision + expected.revisionDelta,
    `revision after ${action}: expected ${liveObservation.revision + expected.revisionDelta}, got ${next.revision}`);
  check(sameSettings(next.settings, expected.settings), `settings after ${action}`);
  check(next.source === expected.source, `source after ${action}`);
  if (expected.rebuilt) {
    check(next.placements !== liveObservation.placements, `result replacement after ${action}`);
  } else {
    check(next.placements === liveObservation.placements, `retained identity after ${action}`);
  }
  check(next.drawnCircles === next.placements.size &&
    next.drawnVertices === next.placements.size * (next.settings.diamonds ? 4 : 64),
    `drawn circle/motif counts after ${action}`);
  if (expected.accepted !== undefined) {
    check(next.placements.size === expected.accepted,
      `accepted count after ${action}: expected ${expected.accepted}, got ${next.placements.size}`);
  }
  if (action === "n" && expected.rebuilt) {
    expectPrefix(placementValues(next.placements), baselineValues, "extended accepted prefix");
  }
  liveObservation = next;
  return {
    action, revision: next.revision, settings: next.settings, source: next.source,
    accepted: next.placements.size, attempts: next.placements.attempts,
    drawnCircles: next.drawnCircles, drawnVertices: next.drawnVertices,
    retainedIdentity: !expected.rebuilt,
  };
}

/** Confirm Save did not redraw, replace the result, or mutate settings during quiet observation. */
export function observeLivePlacementMarksQuiet() {
  check(liveObservation !== null, "live observation has not started");
  const next = observePlacementMarks();
  check(next.revision === liveObservation.revision && sameSettings(next.settings, liveObservation.settings),
    "save changed revision/settings");
  check(next.placements === liveObservation.placements, "save replaced retained placements");
  return { revision: next.revision, settings: next.settings, quiet: true };
}
