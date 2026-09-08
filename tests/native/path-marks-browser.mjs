import { ALTERNATE_PALETTE, BASE_PALETTE, commandCount, createPathMarks, pathMarkCommands } from "/packages/javascript/examples/path-marks/path-marks.js";
import { observePathMarks } from "/packages/javascript/examples/path-marks/sketch.js";

let liveObservation = null;

function check(value, message) {
  if (!value) throw new Error(message);
}

function bits(value) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false);
}

function close(actual, expected, tolerance, label) {
  check(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, label);
}

function fnv64(values) {
  const view = new DataView(new ArrayBuffer(8));
  let hash = 0xcbf29ce484222325n;
  const byte = (value) => { hash ^= BigInt(value); hash = BigInt.asUintN(64, hash * 0x100000001b3n); };
  for (const value of values) {
    view.setFloat64(0, value, false);
    for (let offset = 0; offset < 8; offset += 1) byte(view.getUint8(offset));
  }
  return hash.toString(16).padStart(16, "0");
}

function summary(movement, trace, length, colors) {
  const geometry = [];
  const colour = [];
  let count = 0;
  let firstMark = null;
  for (const command of pathMarkCommands(movement, trace, length, colors)) {
    geometry.push(command.from[0], command.from[1], command.to[0], command.to[1]);
    colour.push(command.rgb);
    if (firstMark === null) firstMark = command;
    count += 1;
  }
  return { count, geometry: fnv64(geometry), colours: fnv64(colour), firstMark };
}

function movementHash(movement) {
  const values = [];
  for (const path of movement.paths) {
    values.push(path.steps);
    for (let index = 0; index <= path.steps; index += 1) values.push(...path.pointAt(index));
    for (let index = 0; index < path.steps; index += 1) values.push(path.headingAt(index));
  }
  return fnv64(values);
}

/** Pure public-model checks that run in the real browser module graph, before UI rendering. */
export function runPathMarksModel(firstPathFixture) {
  const base = createPathMarks(42, 2000, 0.4);
  const retainedPaths = base.paths;
  const extended = createPathMarks(42, 2001, 0.4);
  const changedDistance = createPathMarks(42, 2000, 0.8);
  check(base.paths.length === 24 && Object.isFrozen(base) && Object.isFrozen(base.paths), "retained path count/ownership");
  const before = movementHash(base);

  let changedLaterHeading = false;
  for (let pathIndex = 0; pathIndex < base.paths.length; pathIndex += 1) {
    const shortPath = base.paths[pathIndex];
    const longPath = extended.paths[pathIndex];
    const distancePath = changedDistance.paths[pathIndex];
    for (let index = 0; index <= shortPath.steps; index += 1) {
      const a = shortPath.pointAt(index), b = longPath.pointAt(index);
      check(bits(a[0]) === bits(b[0]) && bits(a[1]) === bits(b[1]), `prefix point ${pathIndex}/${index}`);
    }
    for (let index = 0; index < shortPath.steps; index += 1) {
      check(bits(shortPath.headingAt(index)) === bits(longPath.headingAt(index)), `prefix heading ${pathIndex}/${index}`);
    }
    check(bits(shortPath.headingAt(0)) === bits(distancePath.headingAt(0)), `distance first heading ${pathIndex}`);
    if (bits(shortPath.headingAt(1)) !== bits(distancePath.headingAt(1))) changedLaterHeading = true;
  }
  check(changedLaterHeading, "distance must alter a later heading");

  const expected = firstPathFixture.output;
  const tolerance = firstPathFixture.comparison;
  for (let index = 0; index < expected.positions.length; index += 1) {
    const actual = base.paths[0].pointAt(index);
    close(actual[0], expected.positions[index][0], tolerance.positions_abs, `fixture point x ${index}`);
    close(actual[1], expected.positions[index][1], tolerance.positions_abs, `fixture point y ${index}`);
  }
  for (let index = 0; index < expected.headings.length; index += 1) {
    close(base.paths[0].headingAt(index), expected.headings[index], tolerance.headings_abs, `fixture heading ${index}`);
  }

  const trace = summary(base, true, 12, BASE_PALETTE);
  const marks = summary(base, false, 12, BASE_PALETTE);
  const longMarks = summary(base, false, 24, BASE_PALETTE);
  const recolour = summary(base, false, 12, ALTERNATE_PALETTE);
  check(trace.count === 48000 && marks.count === 12000 && longMarks.count === 12000 && recolour.count === 12000, "command counts");
  check(marks.geometry === recolour.geometry && marks.colours !== recolour.colours, "palette must preserve mark geometry");
  check(marks.geometry !== longMarks.geometry && marks.colours === longMarks.colours, "length must change mark geometry only");
  check(commandCount(base, true) === trace.count && commandCount(base, false) === marks.count, "declared command count");
  check(base.paths === retainedPaths && movementHash(base) === before, "style streams must retain exact movement identity");
  let commandIndex = 0;
  for (const command of pathMarkCommands(base, true, 12, BASE_PALETTE)) {
    if (commandIndex % base.steps === 0) {
      const pathIndex = commandIndex / base.steps;
      check(command.rgb === BASE_PALETTE[pathIndex % 5], `literal palette entry ${pathIndex}`);
    }
    commandIndex += 1;
  }
  const endpoint = base.paths[0].pointAt(1);
  check(Math.abs((marks.firstMark.from[0] + marks.firstMark.to[0]) * 0.5 - endpoint[0]) < 1e-12 &&
    Math.abs((marks.firstMark.from[1] + marks.firstMark.to[1]) * 0.5 - endpoint[1]) < 1e-12,
  "mark must attach to point i+1");
  return {
    passed: true, scope: "Browser-loaded public PathMarks model only; no renderer or cross-host pixel identity claim.",
    pathCount: base.paths.length, movementHash: before, prefix2000Of2001: true, distanceFeedback: true,
    retainedIdentityForStyleEdits: true, firstPathFixtureTolerance: tolerance,
    commands: { trace, marks: { ...marks, firstMark: undefined }, longMarks: { ...longMarks, firstMark: undefined }, recolour: { ...recolour, firstMark: undefined } },
  };
}

function sameSettings(actual, expected) {
  return actual.seed === expected.seed && actual.steps === expected.steps && actual.distance === expected.distance &&
    actual.markLength === expected.markLength && actual.trace === expected.trace && actual.alternate === expected.alternate;
}

/** Start cached-module observation after the actual starter has produced revision one. */
export function beginLivePathMarksObservation() {
  const snapshot = observePathMarks();
  check(snapshot.movement !== null && snapshot.revision === 1 && snapshot.movement.paths.length === 24, "initial actual starter observation");
  liveObservation = snapshot;
  return { revision: snapshot.revision, settings: snapshot.settings, pathCount: snapshot.movement.paths.length };
}

/** Verify actual UI state in this module's retained object identity domain. */
export function observeLivePathMarksAction(action, expectedSettings) {
  check(liveObservation !== null, "live observation has not started");
  const next = observePathMarks();
  check(next.revision === liveObservation.revision + 1, `revision after ${action}`);
  check(sameSettings(next.settings, expectedSettings), `settings after ${action}`);
  const rebuilt = action === "n" || action === "d";
  if (rebuilt) {
    check(next.movement !== liveObservation.movement, `movement replacement after ${action}`);
    check(next.movement.paths.length === liveObservation.movement.paths.length &&
      next.movement.paths.every((path, index) => path !== liveObservation.movement.paths[index]), `path replacement after ${action}`);
  } else {
    check(next.movement === liveObservation.movement, `movement identity after ${action}`);
    check(next.movement.paths === liveObservation.movement.paths &&
      next.movement.paths.every((path, index) => path === liveObservation.movement.paths[index]), `path identity after ${action}`);
  }
  liveObservation = next;
  return { action, revision: next.revision, settings: next.settings, rebuilt };
}

/** Confirm Save did not redraw, replace paths, or mutate settings during a quiet observation. */
export function observeLivePathMarksQuiet() {
  check(liveObservation !== null, "live observation has not started");
  const next = observePathMarks();
  check(next.revision === liveObservation.revision && sameSettings(next.settings, liveObservation.settings), "save changed revision/settings");
  check(next.movement === liveObservation.movement && next.movement.paths === liveObservation.movement.paths &&
    next.movement.paths.every((path, index) => path === liveObservation.movement.paths[index]), "save replaced retained movement");
  return { revision: next.revision, settings: next.settings, quiet: true };
}
