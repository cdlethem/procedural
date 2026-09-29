import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  bundledFrameStack, bundledSequenceIds, bundledSequenceInfo, createFrameStack, createRaster, rasterData, resolveFrameTime,
  type FrameStack, type Raster,
} from "../dist/index.js";
import { sinTurns } from "../dist/composition/frame-samples.js";

const solid = (value: number, size = 2, label = `solid${value}`): Raster =>
  createRaster({ width: size, height: size, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: new Uint8Array(size * size).fill(value), label });
const stackOf = (times: number[]): FrameStack => createFrameStack({ id: "t", times, frames: times.map((_, k) => solid(k * 10)) });

test("a frame stack rejects a missing frame, unequal frames and bad timestamps, naming the index", () => {
  const frames = [solid(1), solid(2), solid(3)];
  assert.throws(() => createFrameStack({ id: "m", times: [0, 1, 2], frames: [frames[0], undefined as never, frames[2]] }), /frame 1 is missing/);
  assert.throws(() => createFrameStack({ id: "m", times: [0, 1, 2], frames: [frames[0], {} as never, frames[2]] }), /frame 1 is not a Raster/);
  assert.throws(() => createFrameStack({ id: "s", times: [0, 1, 2], frames: [frames[0], solid(2, 3), frames[2]] }), /frame 1 has width 3 but frame 0 has 2/);
  const rgb = createRaster({ width: 2, height: 2, channels: 3, format: "u8", colorSpace: "srgb", alpha: "none", data: new Uint8Array(12) });
  assert.throws(() => createFrameStack({ id: "c", times: [0, 1], frames: [frames[0], rgb] }), /frame 1 has channels 3 but frame 0 has 1/);
  assert.throws(() => createFrameStack({ id: "t", times: [0, 1, 1], frames }), /timestamp 2 \(1\) must be greater than timestamp 1 \(1\)/);
  assert.throws(() => createFrameStack({ id: "t", times: [0, 1], frames }), /3 frames but 2 timestamps/);
  assert.throws(() => createFrameStack({ id: "t", times: [0, Number.NaN, 2], frames }), /timestamp 1 must be a finite/);
  assert.throws(() => createFrameStack({ id: "t", times: [], frames: [] }), /has 0 frames/);
  const big = solid(0, 2048);
  assert.throws(() => createFrameStack({ id: "b", times: Array.from({ length: 5 }, (_, k) => k), frames: Array(5).fill(big) }), /exceed 16777216 pixels/);
});

test("the content hash is the documented SHA-256 and follows content and time, not the id", () => {
  const a = solid(5), b = solid(9);
  const stack = createFrameStack({ id: "one", times: [0.5, 2.25], frames: [a, b] });
  const expected = createHash("sha256").update(`procedural-frame-stack/1\n2\n${a.hash}\n0.5\n${b.hash}\n2.25\n`).digest("hex");
  assert.equal(stack.hash, expected);
  assert.equal(createFrameStack({ id: "two", times: [0.5, 2.25], frames: [a, b] }).hash, expected);
  assert.notEqual(createFrameStack({ id: "one", times: [0.5, 2.5], frames: [a, b] }).hash, expected);
  assert.notEqual(createFrameStack({ id: "one", times: [0.5, 2.25], frames: [b, a] }).hash, expected);
  assert.equal(Object.isFrozen(stack) && Object.isFrozen(stack.frames) && Object.isFrozen(stack.times), true);
  assert.deepEqual([stack.start, stack.end, stack.duration, stack.count], [0.5, 2.25, 1.75, 2]);
});

test("interpolation policies resolve times on irregular timestamps exactly", () => {
  const stack = stackOf([0, 1, 3]);
  const at = (t: number, i: "hold" | "nearest" | "linear", e: "clamp" | "loop" | "mirror" | "fail" = "clamp") => resolveFrameTime(stack, t, i, e);
  assert.deepEqual([at(0.999, "hold").frame, at(1, "hold").frame, at(2.9, "hold").frame, at(3, "hold").frame], [0, 1, 1, 2]);
  // nearest: 0.5 is a tie between frames 0 and 1 and takes the later; 2 is a tie between 1 and 3's frame 2.
  assert.deepEqual([at(0.49, "nearest").frame, at(0.5, "nearest").frame, at(1.99, "nearest").frame, at(2, "nearest").frame], [0, 1, 1, 2]);
  const linear = at(2, "linear");
  assert.deepEqual([linear.frame, linear.next, linear.mix], [1, 2, 0.5]);
  assert.equal(at(0.25, "linear").mix, 0.25);
  assert.deepEqual([at(3, "linear").frame, at(3, "linear").next, at(3, "linear").mix], [2, 2, 0]);
});

test("end behaviour is explicit: clamp, loop, mirror and fail", () => {
  const stack = stackOf([0, 1, 3]);
  const r = (t: number, e: "clamp" | "loop" | "mirror" | "fail") => resolveFrameTime(stack, t, "linear", e).time;
  assert.deepEqual([r(-2, "clamp"), r(7, "clamp")], [0, 3]);
  assert.equal(r(3.5, "loop"), 0.5);
  assert.equal(r(-0.5, "loop"), 2.5);
  assert.equal(r(3.5, "mirror"), 2.5);
  assert.equal(r(-0.5, "mirror"), 0.5);
  assert.equal(r(6.5, "mirror"), 0.5);
  assert.equal(r(3, "fail"), 3);
  assert.throws(() => resolveFrameTime(stack, 3.001, "hold", "fail", "Change Window length"), /Time 3\.001 s is outside the frame sequence \[0, 3\] s and the end behaviour is fail\. Change Window length/);
  assert.throws(() => resolveFrameTime(stack, Number.NaN, "hold", "clamp"), /finite/);
  const single = createFrameStack({ id: "one", times: [4], frames: [solid(1)] });
  for (const e of ["clamp", "loop", "mirror", "fail"] as const) assert.equal(resolveFrameTime(single, 99, "linear", e).frame, 0);
});

test("bundled sequences are cached, evenly timed and their timestamps span the scene's duration", () => {
  for (const id of bundledSequenceIds) {
    const stack = bundledFrameStack(id, 3, 9);
    assert.equal(stack, bundledFrameStack(id, 3, 9));
    assert.equal(stack.count, 9);
    assert.equal([stack.width, stack.height].join("x"), "128x128");
    assert.equal(stack.end, bundledSequenceInfo[id].duration);
    stack.times.forEach((t, k) => assert.ok(Math.abs(t - (bundledSequenceInfo[id].duration * k) / 8) < 1e-12));
    assert.notEqual(stack.hash, bundledFrameStack(id, 4, 9).hash, `${id}: the seed changes the scene`);
    assert.notEqual(stack.frames[0].hash, stack.frames[1].hash, `${id}: it moves`);
  }
  assert.throws(() => bundledFrameStack("walkers", 3, 1), /frames must be an integer in \[2, 240\].*change Frames/);
  assert.throws(() => bundledFrameStack("nope" as never, 3, 8), /Unknown bundled sequence/);
});

test("pinned bundled sequence hashes (identical on every engine)", () => {
  const pinned: Record<string, string> = {
    walkers: "af83dade1d0af7d89f87879504a76a52ea22d76e859dd66eb2f3e37411aff323",
    sunrise: "44af55067c59e41708239a2a9405c90630fb973fe7d6d471f5e6b5b457931592",
    orbits: "06a0973ea44b379154ebe792db3e6026de033ff55be10a562ea43c1af0fc607a",
    windmill: "fb99c542ec39f88ca68a015b34510a6f8b04a3a0e19d5ef675741fdc3eaa6848",
  };
  for (const id of bundledSequenceIds) assert.equal(bundledFrameStack(id, 3, 8).hash, pinned[id], id);
});

test("the looping scenes end where they begin (whole turns), the others do not", () => {
  const difference = (id: "orbits" | "windmill" | "walkers" | "sunrise") => {
    const stack = bundledFrameStack(id, 6, 9), a = rasterData(stack.frames[0]).data as Uint8Array, b = rasterData(stack.frames[8]).data as Uint8Array;
    let differing = 0;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 2) differing++;
    return differing / a.length;
  };
  assert.ok(difference("orbits") < 0.001, `orbits ${difference("orbits")}`);
  assert.ok(difference("windmill") < 0.001, `windmill ${difference("windmill")}`);
  assert.ok(difference("walkers") > 0.05);
  assert.ok(difference("sunrise") > 0.3);
});

test("the polynomial sine used by the scenes matches the true sine", () => {
  let worst = 0;
  for (let i = -400; i <= 400; i++) worst = Math.max(worst, Math.abs(sinTurns(i / 97) - Math.sin((2 * Math.PI * i) / 97)));
  assert.ok(worst < 1e-7, `${worst}`);
  assert.ok(Math.abs(sinTurns(0.25) - 1) < 1e-7);
  assert.equal(sinTurns(0), 0);
});
