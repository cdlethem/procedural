import assert from "node:assert/strict";
import test from "node:test";
import {
  applyNeckCuts, canPrepareInstrument, channelCurvature, checkRiver, checkSimulation, clearRiverCache, createInstrument, definitions,
  dischargeWidths, drawRiverRibbons, easeAtWalls, END_ROOM, findNeckCuts, firstSelfCrossing, inspectorItems, isRiverCached, LOOP_FACTOR,
  migrationOffsets, oxbowPaths, prepareInstrument, prepareRiverRibbons, resampleChannel, ribbonHalfWidths, riverAgeField, riverBanks,
  riverConstruction, riverFields, riverRibbons, riverRibbonsComposition, riverSimulation, riverSnapshots, riverTraces, riverValley, SETTLE_TOLERANCE,
  smoothChannelCurvature, stateAt, usesSeed, validateInstrument, validateParameters, visibleParameters,
  type CompositionSurface, type Parameter, type Path, type RiverOptions, type RiverScene,
} from "../dist/index.js";
import { channelArcLengths } from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);

/** The authored default river with overrides; `steps` is what the tests vary most. */
const river = (over: Partial<RiverOptions> = {}, seed = 42): RiverOptions => {
  const input = createInstrument("river-ribbons");
  return { ...riverRibbonsComposition({ ...input, seed }).source, ...over };
};
const construction = (over: Partial<RiverOptions> = {}, seed = 42) => {
  const options = river(over, seed);
  return { options, params: riverConstruction(options), seed: options.planform === "wandering" || options.heterogeneity > 0 ? seed : 0 };
};

/** Nodes on a circle of radius R around the origin, `count` of them over `sweep` radians, counter-clockwise (the centre is on the left). */
function arc(radius: number, count: number, sweep: number, direction = 1): Float64Array {
  const xy = new Float64Array(2 * count);
  for (let i = 0; i < count; i++) {
    const angle = direction * sweep * i / (count - 1);
    xy[2 * i] = radius * Math.cos(angle); xy[2 * i + 1] = radius * Math.sin(angle);
  }
  return xy;
}

/* --------------------------------------------------------------------------- geometry ---- */

test("curvature is exactly 1/R for nodes on a circle at any spacing, and its sign follows the turn", () => {
  for (const [radius, count, sweep] of [[50, 64, 2 * Math.PI * 0.9], [50, 9, 2 * Math.PI * 0.4], [7.5, 30, 3]] as const) {
    const left = channelCurvature(arc(radius, count, sweep, 1)), right = channelCurvature(arc(radius, count, sweep, -1));
    for (let i = 1; i < count - 1; i++) { near(left[i], 1 / radius, 1e-12, `left ${radius}/${count}`); near(right[i], -1 / radius, 1e-12, `right ${radius}/${count}`); }
    assert.equal(left[0], 0); assert.equal(left[count - 1], 0);
  }
  const straight = channelCurvature(Float64Array.from([0, 0, 3, 0, 6, 0, 9, 0]));
  assert.deepEqual([...straight], [0, 0, 0, 0]);
});

test("smoothing is the stated one-sided or symmetric exponential kernel, renormalised at the ends", () => {
  const n = 41, h = 1, scale = 3, taps = Math.ceil(4 * scale / h);
  const spike = new Float64Array(n); spike[20] = 1;
  for (const skew of [0, 0.5, 1]) {
    const out = smoothChannelCurvature(spike, h, scale, skew);
    for (const at of [12, 17, 20, 23, 28]) {
      // Independent evaluation of sum(weight * curvature) / sum(weight) over the interior nodes.
      let numerator = 0, denominator = 0;
      for (let j = Math.max(1, at - taps); j <= Math.min(n - 2, at + taps); j++) {
        const m = Math.abs(j - at), weight = m === 0 ? 1 : (1 + (j < at ? skew : -skew)) * Math.exp(-m * h / scale);
        numerator += weight * spike[j]; denominator += weight;
      }
      near(out[at], numerator / denominator, 1e-15, `skew ${skew} at ${at}`);
    }
  }
  const upstreamOnly = smoothChannelCurvature(spike, h, scale, 1);
  for (let i = 1; i < 20; i++) assert.equal(upstreamOnly[i], 0, "with skew 1 a bend is not felt upstream of itself");
  assert.ok(upstreamOnly[24] > 0);
  const flat = smoothChannelCurvature(Float64Array.from({ length: 30 }, (_, i) => (i === 0 || i === 29 ? 0 : 0.04)), 2, 9, 0.7);
  for (let i = 1; i < 29; i++) near(flat[i], 0.04, 1e-15, "a constant curvature stays constant, ends included");
  assert.deepEqual([...smoothChannelCurvature(spike, h, 0, 0.3)], [...spike]);
});

test("bank migration moves a circular bend outward by mobility * w^2 / R per step, whatever the node spacing", () => {
  const radius = 60, width = 8, mobility = 0.05;
  for (const count of [40, 80]) {
    const xy = arc(radius, count, 2), n = count;
    const arcs = channelArcLengths(xy), smooth = smoothChannelCurvature(channelCurvature(xy), arcs[n - 1] / (n - 1), 10, 0.5);
    const { offsets, maxMove } = migrationOffsets(xy, arcs, smooth, new Float64Array(n).fill(width), mobility, 1e-9, () => 1);
    const expected = mobility * width * width / radius;
    for (const i of [5, n >> 1, n - 6]) {
      const outward = [xy[2 * i] / radius, xy[2 * i + 1] / radius];
      near(offsets[2 * i], expected * outward[0], 1e-12, `spacing ${count}`); near(offsets[2 * i + 1], expected * outward[1], 1e-12);
    }
    near(maxMove, expected, 1e-12);
    assert.deepEqual([offsets[0], offsets[1], offsets[2 * n - 2], offsets[2 * n - 1]], [0, 0, 0, 0], "pinned ends never move");
  }
  // The rate of the same bend traced clockwise is the same outward displacement (outside is away from the centre either way).
  const cw = arc(radius, 40, 2, -1), arcs = channelArcLengths(cw);
  const smooth = smoothChannelCurvature(channelCurvature(cw), arcs[39] / 39, 10, 0.5);
  const { offsets } = migrationOffsets(cw, arcs, smooth, new Float64Array(40).fill(width), mobility, 1e-9, () => 1);
  near(Math.hypot(offsets[40], offsets[41]), mobility * width * width / radius, 1e-12);
  assert.ok(offsets[40] * cw[40] + offsets[41] * cw[41] > 0, "outward");
});

test("the pinned ends are anchored by a smoothstep ramp over the stated arc length", () => {
  const xy = arc(60, 41, 2), arcs = channelArcLengths(xy), n = 41;
  const smooth = smoothChannelCurvature(channelCurvature(xy), arcs[n - 1] / (n - 1), 0, 0);
  const anchor = arcs[n - 1] / 4;
  const { offsets } = migrationOffsets(xy, arcs, smooth, new Float64Array(n).fill(8), 0.05, anchor, () => 1);
  const full = 0.05 * 64 / 60;
  for (const i of [1, 3, 6, 10, 20, 30, 35, 39]) {
    const x = Math.min(arcs[i], arcs[n - 1] - arcs[i]) / anchor, t = Math.min(1, x), held = t * t * (3 - 2 * t);
    near(Math.hypot(offsets[2 * i], offsets[2 * i + 1]), full * held, 1e-12, `node ${i}`);
  }
});

test("width follows the discharge, sqrt(1 + (ratio - 1) f), as a function of the fraction along the channel only", () => {
  const nodes = Float64Array.from([0, 1, 2.5, 6, 10]);
  const width = dischargeWidths(nodes, 6, 4);
  nodes.forEach((s, i) => near(width[i], 6 * Math.sqrt(1 + 3 * s / 10), 1e-12));
  // The same curve resampled at different spacings has the same width at the same fraction.
  const scene = riverRibbons(river({ steps: 0, discharge: 3, spacing: 0.5 })), other = riverRibbons(river({ steps: 0, discharge: 3, spacing: 0.8 }));
  for (const s of [scene, other]) {
    const total = s.channel.arc[s.channel.arc.length - 1];
    s.channel.arc.forEach((at, i) => near(s.channel.width[i], 8 * Math.sqrt(1 + 2 * at / total), 1e-9));
  }
  assert.notEqual(scene.channel.ids.length, other.channel.ids.length);
});

test("resampling puts equal arc-length steps on the polyline, keeps both ends and gives ids by nearest slot", () => {
  const corner = Float64Array.from([0, 0, 10, 0, 10, 10]);
  const cornered = resampleChannel(corner, Int32Array.from([1, 2, 3]), 50, 4);
  assert.deepEqual([...cornered.xy], [0, 0, 4, 0, 8, 0, 10, 2, 10, 6, 10, 10]);
  assert.equal(cornered.ids.length, 6);
  // Hand-worked ids: slots at 0, 5, 10, 15, 20; old arcs 0, 3, 7, 12, 20 claim slots 0, 1, (1: loses the tie), 2, 4; slot 3 is born.
  const line = resampleChannel(Float64Array.from([0, 0, 3, 0, 7, 0, 12, 0, 20, 0]), Int32Array.from([10, 11, 12, 13, 14]), 100, 5);
  assert.deepEqual([...line.xy], [0, 0, 5, 0, 10, 0, 15, 0, 20, 0]);
  assert.deepEqual([...line.ids], [10, 11, 13, 100, 14]);
  assert.equal(line.nextId, 101);
  // An already uniform channel of the right length is unchanged and keeps every id.
  const uniform = resampleChannel(line.xy, line.ids, line.nextId, 5);
  assert.deepEqual([...uniform.xy], [...line.xy]); assert.deepEqual([...uniform.ids], [...line.ids]); assert.equal(uniform.nextId, 101);
  // Fewer nodes retire their ids; more nodes get new ascending ones.
  const finer = resampleChannel(line.xy, line.ids, 200, 2.5);
  assert.equal(finer.ids.length, 9);
  assert.deepEqual([...finer.ids].filter((id) => id >= 200), [200, 201, 202, 203]);
});

/** The gooseneck fixture: limb A along y = 0 (x = 0..100), a straight return at x = 100, limb B back along y = 4 + 0.01 (x - 60)^2 (or `flat` where given). */
function gooseneck(yOffset = 0, flat: readonly number[] = []): number[] {
  const points: number[] = [];
  for (let x = 0; x <= 100; x += 2) points.push(x, yOffset);
  for (let y = 2; y <= 18; y += 2) points.push(100, yOffset + y);
  for (let x = 100; x >= 0; x -= 2) points.push(x, yOffset + (flat.includes(x) ? 4 : 4 + 0.01 * (x - 60) ** 2));
  return points;
}
const widthOnes = (xy: ArrayLike<number>) => new Float64Array(xy.length / 2).fill(1);

test("a neck cutoff takes the closest qualifying pair, and its interval goes to the oxbow with its node ids", () => {
  const xy = Float64Array.from(gooseneck());
  const arcs = channelArcLengths(xy), width = widthOnes(xy);
  // A(60) is node 30, B(60) is node 60 + (100 - 60) / 2 = 80 and the limbs are 4 apart there.
  const cuts = findNeckCuts(xy, width, arcs, 25);
  assert.deepEqual(cuts, [{ i: 30, j: 80, distance: 4 }]);
  assert.ok(arcs[80] - arcs[30] >= LOOP_FACTOR * 25, "the loop is at least a half circle whose diameter is the cutoff distance");
  const ids = Int32Array.from({ length: width.length }, (_, k) => k + 1000);
  const cut = applyNeckCuts(xy, ids, width, cuts);
  assert.equal(cut.ids.length, width.length - 49);
  assert.deepEqual([...cut.ids.slice(29, 33)], [1029, 1030, 1080, 1081], "node 30 joins node 80 directly");
  assert.equal(cut.loops.length, 1);
  assert.deepEqual([cut.loops[0].ids[0], cut.loops[0].ids.at(-1), cut.loops[0].ids.length], [1030, 1080, 51]);
  assert.deepEqual(cut.loops[0].xy.slice(0, 2), [60, 0]); assert.deepEqual(cut.loops[0].xy.slice(-2), [60, 4]);
  // Nodes that are close along the channel are never a neck, however near they are: on a straight run every pair within the limit is closer along the channel than half a circle of that diameter.
  const line = Float64Array.from({ length: 40 }, (_, k) => (k % 2 === 0 ? k / 2 : 0));
  assert.deepEqual(findNeckCuts(line, widthOnes(line), channelArcLengths(line), 3), []);
});

test("cutoff ties go to the lowest upstream node, overlapping candidates wait, disjoint necks all cut in ascending order", () => {
  // Three exactly equal candidate pairs, at x = 58, 60, 62: the lowest i (x = 58: node 29, partner 60 + 21 = 81) wins; the rest overlap it.
  const tied = Float64Array.from(gooseneck(0, [58, 60, 62]));
  assert.deepEqual(findNeckCuts(tied, widthOnes(tied), channelArcLengths(tied), 25), [{ i: 29, j: 81, distance: 4 }]);
  // Two identical necks 256 apart (exact in floating point): both cut, ascending by i, whatever order they were found in.
  const first = gooseneck(0), connector: number[] = [];
  for (let y = 42; y <= 254; y += 2) connector.push(0, y);
  const both = Float64Array.from([...first, ...connector, ...gooseneck(256)]);
  const cuts = findNeckCuts(both, widthOnes(both), channelArcLengths(both), 25);
  const second = first.length / 2 + connector.length / 2;
  assert.deepEqual(cuts, [{ i: 30, j: 80, distance: 4 }, { i: second + 30, j: second + 80, distance: 4 }]);
  // The limit is cutoff times the wider of the two nodes' widths, and it is inclusive: the pair 4 apart cuts at exactly 4 and not at 3.99.
  const widthAt = (wide: number, ...nodes: number[]) => Float64Array.from(widthOnes(both), (_, k) => (nodes.includes(k) ? wide : 1));
  const necks = (wide: number) => findNeckCuts(both, widthAt(wide, 30, 80, second + 30, second + 80), channelArcLengths(both), 1).map((cut) => cut.i);
  assert.deepEqual(necks(4), [30, second + 30]);
  assert.deepEqual(necks(3.99), []);
});

test("a crossing is an explicit cutoff: the channel passes through the intersection and the closed loop leaves as an oxbow", () => {
  //   P0 (0,0) P1 (10,0) P2 (20,0) P3 (20,10) P4 (12,10) P5 (12,-5) P6 (30,-5): segment P1-P2 crosses segment P4-P5 at (12, 0).
  const xy = Float64Array.from([0, 0, 10, 0, 20, 0, 20, 10, 12, 10, 12, -5, 30, -5]), ids = Int32Array.from([10, 11, 12, 13, 14, 15, 16]);
  const cuts = findNeckCuts(xy, widthOnes(xy), channelArcLengths(xy), 10);
  assert.deepEqual(cuts, [{ i: 1, j: 5, distance: 0, crossing: [12, 0] }], "the crossing outranks the neck pair it overlaps");
  const cut = applyNeckCuts(xy, ids, Float64Array.from([1, 2, 3, 4, 5, 6, 7]), cuts, 100);
  assert.deepEqual([...cut.xy], [0, 0, 10, 0, 12, 0, 12, -5, 30, -5]);
  assert.deepEqual([...cut.ids], [10, 11, 100, 15, 16]);
  assert.equal(cut.nextId, 101);
  assert.deepEqual(cut.loops, [{ i: 1, j: 5, distance: 0, closed: true, ids: [100, 12, 13, 14], xy: [12, 0, 20, 0, 20, 10, 12, 10], width: [4, 3, 4, 5] }]);
  assert.equal(firstSelfCrossing(xy)![0], 1);
  assert.equal(firstSelfCrossing(cut.xy), null);});

test("valley walls slow the part of a displacement that carries a bank toward them, by a smoothstep of the room left", () => {
  const valley = riverValley(0, 0, 400, 0), walls = { valley, half: 100 };
  // Nodes at v = 80 (room 100 - 5 - 80 = 15 of soft 30: smoothstep(0.5) = 0.5), 95 (room 0) and 20 (room 75: unaffected).
  const xy = Float64Array.from([0, 0, 0, 80, 0, 95, 0, 20, 0, 0]), width = new Float64Array(5).fill(10);
  const offsets = Float64Array.from([0, 0, 3, 4, 3, 4, 3, 4, 0, 0]);
  easeAtWalls(offsets, xy, width, walls, 30);
  assert.deepEqual([offsets[2], offsets[3]], [3, 2]);
  assert.deepEqual([offsets[4], offsets[5]], [3, 0]);
  assert.deepEqual([offsets[6], offsets[7]], [3, 4]);
  // Away from the wall is never slowed, and the end wall is eased along u the same way.
  const away = Float64Array.from([0, 0, 3, -4, 0, 0]);
  easeAtWalls(away, Float64Array.from([0, 0, 0, 95, 0, 0]), new Float64Array(3).fill(10), walls, 30);
  assert.deepEqual([...away], [0, 0, 3, -4, 0, 0]);
  const end = Float64Array.from([0, 0, 5, 0, 0, 0]);
  easeAtWalls(end, Float64Array.from([0, 0, 185, 0, 0, 0]), new Float64Array(3).fill(10), walls, 30);
  near(end[2], 5 * 7 / 27, 1e-12, "room 200 - 5 - 185 = 10 of 30 is smoothstep(1/3) = 7/27");
});

/* ------------------------------------------------------------------------------ runs ---- */

const frameSegments = (xy: ArrayLike<number>) => xy.length / 2 - 1;

test("every step's channel is a simple curve inside the valley, and every topology change is an explicit oxbow", () => {
  for (const [seed, over] of [[42, {}], [7, { cutoff: 2.5, mobility: 0.25 }], [1234567, { planform: "sine-generated", waves: 2, turn: 70, confinement: 110 }]] as const) {
    const scene = riverRibbons(river({ steps: 220, ...over }, seed));
    const o = scene.options, valley = scene.valley;
    scene.frames.forEach((frame) => {
      assert.equal(firstSelfCrossing(frame.xy), null, `seed ${seed} step ${frame.step} crosses itself`);
      const fields = riverFields(frame.xy, o);
      for (let i = 1; i < fields.width.length - 1; i++) {
        const dx = frame.xy[2 * i] - valley.cx, dy = frame.xy[2 * i + 1] - valley.cy;
        const u = dx * valley.ax + dy * valley.ay, v = -dx * valley.ay + dy * valley.ax;
        assert.ok(Math.abs(v) <= o.confinement - fields.width[i] / 2 + 1e-6, `seed ${seed} step ${frame.step} node ${i} leaves the valley (v ${v})`);
        assert.ok(Math.abs(u) <= o.length / 2 - fields.width[i] / 2 + 1e-6, `step ${frame.step} node ${i} passes an end wall`);
      }
      // Pinned ends are the same points at every step.
      assert.deepEqual([frame.xy[0], frame.xy[1]], [scene.frames[0].xy[0], scene.frames[0].xy[1]]);
    });
    assert.ok(scene.oxbows.length >= 1, `seed ${seed} should cut off at least once`);
    let previousBorn = 0;
    for (const oxbow of scene.oxbows) {
      assert.ok(oxbow.born >= previousBorn && oxbow.born >= 1 && oxbow.born <= scene.steps);
      previousBorn = oxbow.born;
      const before = new Set(scene.frames[oxbow.born - 1].ids), after = new Set(scene.frames[oxbow.born].ids);
      // The loop's interior left the channel at this step and never comes back; its neck nodes were channel nodes just before.
      const interior = oxbow.closed ? oxbow.ids.slice(1) : oxbow.ids.slice(1, -1);
      const oldest = Math.max(...before);
      assert.ok(interior.length >= 1 && interior.every((id) => before.has(id) || id > oldest), "the loop was part of the channel (or born by this step's resampling)");
      assert.ok(interior.every((id) => !after.has(id) && !scene.frames.slice(oxbow.born).some((frame) => frame.ids.includes(id))), "its interior nodes retired for good");
      if (!oxbow.closed) assert.ok(before.has(oxbow.ids[0]) && before.has(oxbow.ids.at(-1)!));
      assert.ok(oxbow.closed ? oxbow.distance === 0 : oxbow.distance > 0 && oxbow.distance <= o.cutoff * scene.channel.width[scene.channel.width.length - 1] + 1e-9);
      assert.equal(oxbow.width.length, oxbow.points.length);
    }
    assert.deepEqual(scene.oxbows.map((oxbow) => oxbow.id), scene.oxbows.map((_, k) => `oxbow:${k}`));
  }
});

test("node ids are born ascending and never revive: each id's frames are one unbroken run", () => {
  const scene = riverRibbons(river({ steps: 200 }));
  const first = new Map<number, number>(), last = new Map<number, number>();
  scene.frames.forEach((frame) => new Set(frame.ids).forEach((id) => {
    if (!first.has(id)) first.set(id, frame.step);
    assert.ok(last.get(id) === undefined || last.get(id) === frame.step - 1, `id ${id} reappears at step ${frame.step}`);
    last.set(id, frame.step);
    assert.equal(new Set(frame.ids).size, frame.ids.length, "ids in one channel are distinct");
  }));
  const born = [...first.entries()].sort((a, b) => a[0] - b[0]);
  for (let k = 1; k < born.length; k++) assert.ok(born[k][1] >= born[k - 1][1], "a higher id is never older");
  assert.equal(Math.max(...first.keys()) + 1, scene.nodesBorn);
  assert.deepEqual([...scene.frames[0].ids], Array.from(scene.frames[0].ids, (_, i) => i));
});

test("the run is deterministic, prefix-consistent, checkpoint-replayable and independent of retention, for several constructions", () => {
  for (const [over, seed, steps] of [[{}, 42, 45], [{ planform: "sine-generated", turn: 65 }, 3, 40], [{ cutoff: 2.2, mobility: 0.3, heterogeneity: 0 }, 9, 60]] as const) {
    const { params, seed: used } = construction(over as Partial<RiverOptions>, seed);
    checkSimulation(riverSimulation, params, used, steps);
  }
});

test("more steps only append: a shorter run's frames, ids and oxbows are a prefix of a longer run's", () => {
  clearRiverCache();
  const short = riverRibbons(river({ steps: 90 }));
  clearRiverCache();
  const long = riverRibbons(river({ steps: 180 }));
  assert.notEqual(short, long);
  short.frames.forEach((frame, k) => {
    assert.deepEqual([...long.frames[k].xy], [...frame.xy]);
    assert.deepEqual([...long.frames[k].ids], [...frame.ids]);
  });
  assert.ok(short.oxbows.every((oxbow, k) => JSON.stringify(oxbow) === JSON.stringify(long.oxbows[k])));
  // Dragging steps up extends the cached run (same frames), dragging down replays from a checkpoint; both equal a cold run.
  clearRiverCache();
  riverRibbons(river({ steps: 90 }));
  const extended = riverRibbons(river({ steps: 180 }));
  assert.deepEqual([...extended.channel.xy], [...long.channel.xy]);
  const shrunk = riverRibbons(river({ steps: 130 }));
  clearRiverCache();
  const cold = riverRibbons(river({ steps: 130 }));
  assert.deepEqual([...shrunk.channel.xy], [...cold.channel.xy]);
  assert.deepEqual(shrunk.oxbows, cold.oxbows);
  // stateAt replays from the nearest checkpoint at most 40 steps back and equals the frame retained there.
  const snaps = riverSnapshots(river({ steps: 130 }));
  for (const k of [0, 37, 40, 41, 99, 130]) assert.deepEqual([...stateAt(snaps, k).xy], [...cold.frames[k].xy], `step ${k}`);
});

test("a cancelled run publishes and caches nothing, and a retry equals a clean run", async () => {
  clearRiverCache();
  const options = river({ steps: 120 });
  let polls = 0;
  assert.equal(await prepareRiverRibbons(options, () => ++polls > 30), null);
  assert.equal(isRiverCached(options), false, "no partial entry");
  assert.throws(() => riverRibbons(options, { cancelled: () => true }), /cancelled/);
  assert.equal(isRiverCached(options), false);
  const retry = await prepareRiverRibbons(options, () => false);
  assert.ok(retry && isRiverCached(options));
  clearRiverCache();
  assert.deepEqual([...riverRibbons(options).channel.xy], [...retry!.channel.xy]);
});

test("palette, drawing and hidden-planform edits repaint the SAME scene; construction and seed edits recompute", () => {
  clearRiverCache();
  const input = createInstrument("river-ribbons"), base = riverRibbons(riverRibbonsComposition(input).source);
  const repainted = riverRibbons(riverRibbonsComposition({ ...input, palette: [0x111111, 0x222222, 0x333333, 0x444444] }).source);
  assert.equal(repainted, base, "a new palette touches nothing");
  const appearance = { showChannel: false, channelOpacity: 0.3, widening: 1, banks: false, scars: "bands", scarEvery: 9, scarOpacity: 0.2, oxbows: "beads", oxbowWeight: 3, fade: 50, deposition: 1, floodplain: true, plainCell: 9, plainOpacity: 0.7 };
  assert.equal(riverRibbons(riverRibbonsComposition({ ...input, params: { ...input.params, ...appearance } }).source), base);
  // The sine-generated controls are hidden while the start is wandering: changing them is not a recompute.
  assert.equal(riverRibbons(riverRibbonsComposition({ ...input, params: { ...input.params, waves: 5, turn: 20 } }).source), base);
  // The seed does not matter to a straight, uniform river: the same scene for every seed.
  const straight = { ...input.params, amplitude: 0.1, heterogeneity: 0 }, straightScene = riverRibbons(riverRibbonsComposition({ ...input, params: { ...straight, planform: "sine-generated" } }).source);
  assert.equal(riverRibbons(riverRibbonsComposition({ ...input, seed: 7, params: { ...straight, planform: "sine-generated" } }).source), straightScene);
  for (const change of [{ mobility: 0.15 }, { confinement: 160 }, { length: 540 }, { centerX: 300 }, { width: 7 }, { cutoff: 2.5 }, { amplitude: 0.5 }, { heterogeneity: 0.2 }, { angle: 5 }, { skew: 0.2 }]) {
    const other = riverRibbons(riverRibbonsComposition({ ...input, params: { ...input.params, ...change } }).source);
    assert.notEqual(other, base, JSON.stringify(change));
    assert.notDeepEqual([...other.channel.xy], [...base.channel.xy], `${JSON.stringify(change)} moves the channel`);
  }
  for (const seed of [7, 8]) {
    const other = riverRibbons(riverRibbonsComposition({ ...input, seed }).source);
    assert.notEqual(other, base); assert.notDeepEqual([...other.frames[0].xy], [...base.frames[0].xy], "a seed changes the starting channel");
  }
  assert.notDeepEqual([...riverRibbons(river({ steps: 0, heterogeneity: 0.4 }, 42)).channel.xy], [...riverRibbons(river({ steps: 250, heterogeneity: 0.4 }, 42)).channel.xy]);
  // The erodibility field alone is seeded: same start, different migration.
  const still = { planform: "sine-generated" as const, steps: 120, heterogeneity: 0.8 };
  assert.notDeepEqual([...riverRibbons(river(still, 1)).channel.xy], [...riverRibbons(river(still, 2)).channel.xy]);
  assert.deepEqual([...riverRibbons(river({ ...still, steps: 0 }, 1)).channel.xy], [...riverRibbons(river({ ...still, steps: 0 }, 2)).channel.xy]);
});

test("a channel with no bend, or no mobility, terminates explicitly at its first no-op step at almost no cost", () => {
  for (const over of [{ amplitude: 0 }, { mobility: 0 }] as const) {
    const scene = riverRibbons(river({ steps: 300, cutoff: 3, ...over }));
    assert.equal(scene.settledAt, 1, JSON.stringify(over));
    scene.frames.slice(1).forEach((frame) => assert.deepEqual([...frame.xy], [...scene.frames[1].xy]));
    assert.equal(scene.oxbows.length, 0);
    const short = riverSnapshots(river({ steps: 1, cutoff: 3, ...over })), long = riverSnapshots(river({ steps: 300, cutoff: 3, ...over }));
    assert.equal(long.work - short.work, 299, "each settled step charges one unit");
  }
  assert.equal(riverRibbons(river({ steps: 30 })).settledAt, null);
  assert.equal(riverRibbons(river({ steps: 0 })).settledAt, null);
  assert.ok(SETTLE_TOLERANCE > 0 && SETTLE_TOLERANCE < 1e-6);
  const straight = riverRibbons(river({ steps: 5, amplitude: 0 }));
  const v = riverValley(straight.valley.cx, straight.valley.cy, straight.valley.length, 0);
  for (let i = 0; i < straight.channel.ids.length; i++) near(straight.channel.xy[2 * i + 1], v.cy, 1e-9, "a zero-amplitude channel runs along the axis");
  near(straight.channel.length, straight.options.length * (1 - 2 * END_ROOM), 1e-6);
});

test("bank migration is a rate per step: the same river at another node spacing has moved the same distance", () => {
  const move = (spacing: number) => {
    const scene = riverRibbons(river({ steps: 25, planform: "sine-generated", turn: 40, spacing, heterogeneity: 0, cutoff: 4 }));
    const start = scene.frames[0], end = scene.channel;
    // Mean distance from the final centerline's nodes to the start curve, by nearest node of a very fine resampling of the start.
    let sum = 0;
    for (let i = 0; i < end.ids.length; i++) {
      let best = Infinity;
      for (let k = 0; k < start.ids.length - 1; k++) {
        const ax = start.xy[2 * k], ay = start.xy[2 * k + 1], bx = start.xy[2 * k + 2] - ax, by = start.xy[2 * k + 3] - ay;
        const t = Math.min(1, Math.max(0, ((end.xy[2 * i] - ax) * bx + (end.xy[2 * i + 1] - ay) * by) / (bx * bx + by * by)));
        best = Math.min(best, Math.hypot(end.xy[2 * i] - ax - t * bx, end.xy[2 * i + 1] - ay - t * by));
      }
      sum += best;
    }
    return sum / end.ids.length;
  };
  const coarse = move(0.8), fine = move(0.4);
  assert.ok(coarse > 0.5 && fine > 0.5, "the bends have visibly moved");
  near(coarse / fine, 1, 0.1, "elapsed time does not depend on the node spacing");
});

test("a bend moves toward its outside and a downstream lag carries bends downstream", () => {
  // One left-hand bend (an arc of the start) migrates away from its centre of curvature; skew shifts the apex downstream.
  const apex = (skew: number) => {
    const scene = riverRibbons(river({ steps: 40, planform: "sine-generated", waves: 1, turn: 55, heterogeneity: 0, skew, cutoff: 5, smoothing: 4 }));
    const fields = riverFields(scene.frames[0].xy, scene.options), end = riverFields(scene.channel.xy, scene.options);
    const peak = (xy: Readonly<Float64Array>, curvature: Float64Array, sign: number) => {
      let best = 0, at = 0;
      for (let i = 0; i < curvature.length; i++) if (sign * curvature[i] > best) { best = sign * curvature[i]; at = i; }
      return xy[2 * at] - scene.valley.cx;
    };
    return { start: peak(scene.frames[0].xy, fields.curvature, 1), end: peak(scene.channel.xy, end.curvature, 1) };
  };
  const symmetric = apex(0), lagged = apex(1);
  assert.ok(lagged.end - lagged.start > symmetric.end - symmetric.start + 1, `bends drift downstream more with the lag (${lagged.end - lagged.start} vs ${symmetric.end - symmetric.start})`);
  const scene = riverRibbons(river({ steps: 1, planform: "sine-generated", waves: 1, turn: 55, heterogeneity: 0, skew: 0, cutoff: 5 }));
  // First bend of a sine-generated start turns one way; after a step its apex has moved to that bend's outside.
  const before = scene.frames[0], after = scene.frames[1];
  const curvature = riverFields(before.xy, scene.options).curvature;
  let strongest = 1;
  for (let i = 1; i < curvature.length - 1; i++) if (Math.abs(curvature[i]) > Math.abs(curvature[strongest])) strongest = i;
  const tx = before.xy[2 * strongest + 2] - before.xy[2 * strongest - 2], ty = before.xy[2 * strongest + 3] - before.xy[2 * strongest - 1], length = Math.hypot(tx, ty);
  const leftNormal = [-ty / length, tx / length];
  const dx = after.xy[2 * strongest] - before.xy[2 * strongest], dy = after.xy[2 * strongest + 1] - before.xy[2 * strongest + 1];
  assert.ok((dx * leftNormal[0] + dy * leftNormal[1]) * curvature[strongest] < 0, "displacement is away from the centre of curvature");
});

/* ---------------------------------------------------------------------------- bounds ---- */

test("every hard bound is checked before running and names the control to change", () => {
  const fails = (over: Partial<RiverOptions>, pattern: RegExp) => assert.throws(() => checkRiver(river(over)), pattern);
  fails({ steps: 601 }, /steps must be an integer from 0 to 600/);
  fails({ steps: 3.5 }, /steps must be an integer/);
  fails({ mobility: 3 }, /mobility must be a number from 0 to 2/);
  fails({ spacing: 0.7, cutoff: 1.2 }, /spacing \(0\.7 widths\) must not exceed half the cutoff \(1\.2 widths of the inlet channel\).*lower spacing or raise cutoff/);
  fails({ spacing: 0.7, cutoff: 1.6, discharge: 0.25 }, /must not exceed half the cutoff \(0\.8 widths/);
  fails({ confinement: 20, width: 8 }, /confinement \(20\) must be at least twice the widest channel \(22\.63\).*raise confinement or lower width or discharge/);
  fails({ smoothing: 20, spacing: 0.2 }, /smoothing \(20 widths\) at spacing 0\.2 needs 400 kernel taps.*lower smoothing or raise spacing/);
  fails({ length: 4000, width: 0.5, spacing: 0.2, confinement: 500 }, /length 4000 at spacing 0\.1 needs 32001 nodes.*lower length or raise spacing or width/);
  fails({ steps: 600, length: 500, width: 2, spacing: 0.2, cutoff: 3, confinement: 300 }, /steps \(600\).*work units.*lower steps, length or smoothing, or raise spacing/);
  assert.throws(() => riverRibbons({ ...river(), planform: "meander" as never }), /planform/);
  assert.throws(() => riverRibbons(river({}, -1)), /seed/);
  // Bank mobility beyond half a node per step is reported when it happens, with the step and the controls.
  assert.throws(() => riverRibbons(river({ mobility: 2, steps: 60 })), /step \d+: bank migration would move a node .* more than half the node spacing.*lower mobility, raise spacing or raise smoothing/);
  // Direct-API `steps` at the slider's hard maximum is admitted for the authored river.
  assert.doesNotThrow(() => checkRiver(river({ steps: 600 })));
});

/* -------------------------------------------------------------------------- consumers ---- */

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  closed = 0; open = 0; vertices = 0; rects = 0; fills: number[] = []; strokes: number[] = [];
  push() {} pop() {} translate() {} rotate() {} scale() {} noFill() {} noStroke() {}
  fill(...a: number[]) { this.fills.push(a[3]); } stroke(...a: number[]) { this.strokes.push(a[3]); } strokeWeight() {} strokeCap() {}
  circle() {} line() {} rect() { this.rects++; }
  beginShape() {} vertex() { this.vertices++; }
  endShape(mode?: unknown) { if (mode === this.CLOSE) this.closed++; else this.open++; }
}

test("banks are the centerline offset by half the width along the mitre normal, with a bounded mitre", () => {
  const straight = riverBanks(Float64Array.from([0, 0, 10, 0, 20, 0]), [1, 2, 3]);
  assert.deepEqual(straight.left, [[0, 1], [10, 2], [20, 3]]);
  assert.deepEqual(straight.right, [[0, -1], [10, -2], [20, -3]]);
  const corner = riverBanks(Float64Array.from([0, 0, 10, 0, 10, 10]), [2, 2, 2]);
  near(corner.left[1][0], 8, 1e-12); near(corner.left[1][1], 2, 1e-12); near(corner.right[1][0], 12, 1e-12); near(corner.right[1][1], -2, 1e-12);
  // A U-turn's mitre is capped at twice the half width.
  const hairpin = riverBanks(Float64Array.from([0, 0, 10, 0, 0, 0.001]), [1, 1, 1]);
  assert.ok(Math.hypot(hairpin.left[1][0] - 10, hairpin.left[1][1]) <= 2 + 1e-9);
});

test("ribbon half width is the discharge width swelled by curvature, capped inside the local radius", () => {
  const straight = Float64Array.from([0, 0, 5, 0, 10, 0]);
  const half = ribbonHalfWidths(straight, [8, 8, 8], [0, 0.05, 0.5], 8, 1);
  near(half[0], 4, 1e-12); near(half[1], 4 * (1 + 2 * 8 * 0.05), 1e-12); near(half[2], 4 * 2, 1e-12);
  near(ribbonHalfWidths(straight, [8, 8, 8], [0, 0.05, 0.5], 8, 0)[1], 4, 1e-12);
  near(ribbonHalfWidths(straight, [8, 8, 8], [0, 0.05, 0.5], 8, 1, 0.5)[2], 4, 1e-12);
  // On a circle of radius 3 the half width 4 would turn the inner bank inside out; it is held to 0.9 R.
  const ring = arc(3, 9, 2 * Math.PI * 0.6);
  near(ribbonHalfWidths(ring, new Float64Array(9).fill(8), new Float64Array(9), 8, 0)[4], 0.9 * 3, 1e-12);
});

test("three treatments read the one scene: the ribbon, faded scar lines or bands, and oxbows, each replaceable", () => {
  const input = createInstrument("river-ribbons"), recipe = riverRibbonsComposition(input), scene = riverRibbons(recipe.source);
  assert.ok(scene.oxbows.length > 0);
  const surface = new Recorder();
  drawRiverRibbons(surface, recipe);
  const scars = Math.ceil(scene.steps / recipe.scars!.every);
  assert.equal(surface.open, scars + 2, "scar lines plus the two bank lines");
  assert.equal(surface.closed, scene.oxbows.length + 1, "each oxbow ribbon plus the channel ribbon");
  // Older scars are fainter: alphas of the scar strokes fall monotonically with age, and the newest are at the authored opacity.
  const alphas = surface.strokes.slice(0, scars);
  assert.ok(alphas.every((alpha, k) => k === 0 || alpha >= alphas[k - 1]), "later steps are stronger");
  near(alphas[scars - 1], recipe.scars!.opacity * 255 * (1 - 0.85 * (scene.steps - 3 * (scars - 1)) / recipe.age.fade), 1e-9);
  // Callbacks replace any consumer and receive the producer's own values.
  const traces: Path[] = [], oxbows: Path[] = [];
  let ribbon: { left: readonly unknown[]; right: readonly unknown[] } | undefined;
  drawRiverRibbons(new Recorder(), recipe, { scar: (_s, path) => { traces.push(path); }, oxbow: (_s, path) => { oxbows.push(path); }, ribbon: (_s, r) => { ribbon = r; } });
  assert.deepEqual(traces.map((path) => path.id), riverTraces(scene, 3).map((path) => path.id));
  assert.equal(traces[0], riverTraces(scene, 3)[0], "the very same frozen path objects");
  assert.deepEqual(oxbows.map((path) => path.id), scene.oxbows.map((oxbow) => oxbow.id));
  assert.equal(oxbows[0], oxbowPaths(scene)[0]);
  assert.equal(ribbon!.left.length, scene.channel.ids.length);
  // Scar paths are the retained frames themselves at multiples of the interval, oldest first, and only ever grow with steps.
  assert.deepEqual(traces.slice(0, 3).map((path) => [path.level, path.levelFraction]), [[0, 0], [3, 3 / scene.steps], [6, 6 / scene.steps]]);
  const later = riverTraces(riverRibbons(river({ steps: scene.steps + 30 })), 3);
  assert.deepEqual(later.slice(0, traces.length).map((path) => path.points), traces.map((path) => path.points));
  // The scene and its paths are read-only.
  assert.throws(() => (scene.oxbows as unknown as unknown[]).push(1), TypeError);
  assert.throws(() => (traces[0].points as unknown as unknown[]).push(1), TypeError);
  // Off treatments draw nothing.
  const none = new Recorder();
  drawRiverRibbons(none, riverRibbonsComposition({ ...input, params: { ...input.params, showChannel: false, scars: "off", oxbows: "off", floodplain: false } }));
  assert.deepEqual([none.open, none.closed, none.rects], [0, 0, 0]);
});

test("the age field marks exactly the cells the channel occupied, stamped with the last step it was there", () => {
  const scene = riverRibbons(river({ steps: 90 }));
  const cell = 6, field = riverAgeField(scene, cell), [left, top] = field.bounds;
  assert.equal(riverAgeField(scene, cell), field, "cached for the scene");
  assert.equal(field.steps, scene.steps);
  const cellAt = (x: number, y: number) => Math.floor((y - top) / cell) * field.columns + Math.floor((x - left) / cell);
  // Every frame's centerline lies in cells stamped at least with that step.
  for (const frame of scene.frames) for (let i = 0; i < frame.ids.length - 1; i += 3) {
    const x = (frame.xy[2 * i] + frame.xy[2 * i + 2]) / 2, y = (frame.xy[2 * i + 1] + frame.xy[2 * i + 3]) / 2;
    assert.ok(field.last[cellAt(x, y)] >= frame.step, `step ${frame.step} node ${i}`);
  }
  assert.ok([...scene.channel.ids].every((_, i) => field.last[cellAt(scene.channel.xy[2 * i], scene.channel.xy[2 * i + 1])] === scene.steps), "the current channel is stamped with the current step");
  // Cells farther than half a cell from every node of every frame were never occupied.
  let checked = 0;
  for (let r = 0; r < field.rows; r += 2) for (let c = 0; c < field.columns; c += 2) {
    const cx = left + (c + 0.5) * cell, cy = top + (r + 0.5) * cell;
    if (field.last[r * field.columns + c] !== -1) continue;
    checked++;
    for (const frame of scene.frames) for (let i = 0; i < frame.ids.length; i++)
      assert.ok(Math.hypot(frame.xy[2 * i] - cx, frame.xy[2 * i + 1] - cy) > cell / 2, "an unstamped cell has no node inside it");
  }
  assert.ok(checked > 100);
  assert.throws(() => riverAgeField(scene, 0.01), /raise the floodplain cell size/);
  // A straight uniform channel stamps its own width: |y - axis| <= max(w / 2, cell / 2) at the last step.
  const flat = riverRibbons(river({ steps: 3, amplitude: 0, discharge: 1 })), flatField = riverAgeField(flat, 4);
  let occupied = 0, expected = 0;
  const [fl, ft] = flatField.bounds;
  for (let r = 0; r < flatField.rows; r++) for (let c = 0; c < flatField.columns; c++) {
    const x = fl + (c + 0.5) * 4, y = ft + (r + 0.5) * 4;
    const inside = Math.abs(y - flat.valley.cy) <= Math.max(flat.options.width / 2, 4 * Math.SQRT1_2) && x >= flat.channel.xy[0] - 0.5 && x <= flat.channel.xy[flat.channel.xy.length - 2] + 0.5;
    if (flatField.last[r * flatField.columns + c] >= 0) occupied++;
    if (inside) expected++;
  }
  assert.ok(Math.abs(occupied - expected) <= 4, `${occupied} occupied against ${expected} expected`);
  assert.ok(flatField.last.every((step) => step === -1 || step === 3));
});

/* ---------------------------------------------------------------------------- instrument ---- */

test("the instrument is registered once, resolves to a JSON recipe and prepares through prepareInstrument", async () => {
  assert.equal(definitions.filter((item) => item.id === "river-ribbons").length, 1);
  assert.equal(canPrepareInstrument("river-ribbons"), true);
  const input = createInstrument("river-ribbons");
  const recipe = riverRibbonsComposition(input);
  assert.deepEqual(JSON.parse(JSON.stringify(recipe)), recipe);
  assert.equal(recipe.kind, "river-ribbons");
  assert.deepEqual(validateInstrument(input), input);
  assert.equal(await prepareInstrument({ ...input, seed: 991 }, () => true), false);
  let polls = 0;
  assert.equal(await prepareInstrument({ ...input, seed: 991 }, () => ++polls > 20), false, "cancelled while stepping");
  assert.equal(isRiverCached(riverRibbonsComposition({ ...input, seed: 991 }).source), false);
  const params = { ...input.params, floodplain: true };
  assert.equal(await prepareInstrument({ ...input, seed: 991, params }, () => false), true);
  const prepared = riverRibbonsComposition({ ...input, seed: 991, params });
  assert.equal(isRiverCached(prepared.source), true);
  assert.equal(riverRibbons(prepared.source).options.seed, 991);
  assert.equal(usesSeed({ ...input, params: { ...input.params, amplitude: 0, heterogeneity: 0 } }), false);
  assert.equal(usesSeed({ ...input, params: { ...input.params, amplitude: 0, heterogeneity: 0.2 } }), true);
  assert.equal(usesSeed({ ...input, params: { ...input.params, planform: "sine-generated", heterogeneity: 0 } }), false);
  assert.equal(usesSeed(input), true);
  assert.throws(() => validateParameters("river-ribbons", { ...input.params, spacing: 0.8, cutoff: 1.5 }), /spacing/);
  assert.throws(() => validateParameters("river-ribbons", { ...input.params, steps: 601 }), /steps/);
  assert.equal(validateParameters("river-ribbons", { ...input.params, steps: 600 }).steps, 600);
});

test("controls: hidden ones follow their drivers, groups nest as declared, and only Size is proportional", () => {
  const input = createInstrument("river-ribbons");
  const shown = (over: Record<string, string | number | boolean>) => visibleParameters("river-ribbons", { ...input.params, ...over }).map((parameter) => parameter.key);
  assert.ok(shown({}).includes("harmonics") && !shown({}).includes("turn") && !shown({}).includes("waves"));
  assert.ok(shown({ planform: "sine-generated" }).includes("turn") && !shown({ planform: "sine-generated" }).includes("amplitude"));
  const noChannel = shown({ showChannel: false });
  assert.ok(!["channelOpacity", "widening", "banks", "bankWeight"].some((key) => noChannel.includes(key)), "a chain hides through its driver");
  assert.ok(!shown({ banks: false }).includes("bankWeight") && shown({}).includes("bankWeight"));
  assert.ok(!shown({ scars: "off" }).some((key) => ["scarEvery", "scarOpacity", "scarWeight"].includes(key)));
  assert.ok(shown({ scars: "bands" }).includes("scarEvery") && !shown({ scars: "bands" }).includes("scarWeight"));
  assert.ok(shown({ oxbows: "beads" }).includes("oxbowWeight") && !shown({ oxbows: "beads" }).includes("oxbowOpacity"));
  assert.ok(shown({ oxbows: "ribbon" }).includes("oxbowOpacity") && !shown({ oxbows: "ribbon" }).includes("oxbowWeight"));
  assert.ok(!shown({}).includes("plainCell") && shown({ floodplain: true }).includes("plainCell"));
  const tree = inspectorItems("river-ribbons", input.params);
  const flat = JSON.stringify(tree);
  assert.ok(flat.includes('"proportional":true'));
  assert.equal((flat.match(/"proportional":true/g) ?? []).length, 1);
  const definition = definitions.find((item) => item.id === "river-ribbons")!;
  const keys = definition.parameters.map((parameter: Parameter) => parameter.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const parameter of definition.parameters) if (parameter.type === "number") {
    assert.ok(parameter.min! >= parameter.hardMin! && parameter.max! <= parameter.hardMax!, `${parameter.key} slider interval is inside its hard limits`);
    const value = definition.defaults[parameter.key] as number;
    assert.ok(value >= parameter.min! && value <= parameter.max!, `${parameter.key} default is on its slider`);
  }
});

test("changing a control the inspector hides never changes what is drawn (seeded property test)", () => {
  const input = createInstrument("river-ribbons"), definition = definitions.find((item) => item.id === "river-ribbons")!;
  let state = 0x2f6e2b1;
  const random = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const drivers = definition.parameters.filter((parameter: Parameter) => parameter.type === "select" || parameter.type === "boolean");
  let compared = 0;
  for (let attempt = 0; attempt < 14; attempt++) {
    const values: Record<string, string | number | boolean> = { ...input.params, steps: 30 };
    for (const driver of drivers) {
      const pool = driver.type === "boolean" ? [false, true] : driver.options!.map((option) => option.value);
      values[driver.key] = pool[Math.floor(random() * pool.length)];
    }
    const visible = new Set(visibleParameters("river-ribbons", values).map((parameter) => parameter.key));
    const base = drawFingerprint({ ...input, params: values });
    for (const parameter of definition.parameters) {
      if (visible.has(parameter.key) || parameter.type !== "number") continue;
      const value = parameter.min! + (parameter.max! - parameter.min!) * (0.2 + 0.7 * random());
      const changed = { ...values, [parameter.key]: parameter.integer ? Math.round(value) : Math.round(value * 100) / 100 };
      compared++;
      assert.equal(drawFingerprint({ ...input, params: changed }), base, `${parameter.key} changed the drawing while hidden`);
    }
  }
  assert.ok(compared > 20, `${compared} hidden numeric changes compared`);
  // And the contrapositive for one visible control per group, to show the fingerprint can tell.
  const base = drawFingerprint(input);
  for (const change of [{ bankWeight: 2 }, { scarOpacity: 0.3 }, { oxbowOpacity: 0.9 }, { widening: 0 }, { mobility: 0.1 }, { fade: 400 }])
    assert.notEqual(drawFingerprint({ ...input, params: { ...input.params, ...change } }), base, JSON.stringify(change));
});

test("the discharge width at the outlet is the stated multiple of the inlet width, and the drawn ribbon keeps it", () => {
  const scene = riverRibbons(river({ steps: 60, discharge: 4, widening: 0 } as Partial<RiverOptions>));
  const last = scene.channel.width.length - 1;
  near(scene.channel.width[0], scene.options.width, 1e-9);
  near(scene.channel.width[last], scene.options.width * 2, 1e-9);
  const banks = riverBanks(scene.channel.xy, ribbonHalfWidths(scene.channel.xy, scene.channel.width, scene.channel.curvature, scene.options.width, 0));
  // Away from the ends and sharp bends the banks are one width apart.
  const gap = (i: number) => Math.hypot(banks.left[i][0] - banks.right[i][0], banks.left[i][1] - banks.right[i][1]);
  near(gap(last), scene.channel.width[last], 1e-6, "outlet");
  near(gap(0), scene.channel.width[0], 1e-6, "inlet");
});
