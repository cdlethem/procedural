import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { validatePalette, paletteNumbers, withPalettePrompt } from "../lib/palettes";
import { paletteStore, PaletteConflict } from "../lib/harness/palettes";
import { WORK_ROOT } from "../lib/harness/core";
import { generatePalette, validatePalettePrompt } from "../lib/harness/palette-generation";

const draft = { name: "  Sea glass  ", colors: ["#113355", "#AABBCC", "#f5f1e9"] };
test("palette storage persists detached colors and protects concurrent edits/deletion", () => {
  mkdirSync(join(WORK_ROOT, "palette-tests"), { recursive: true });
  const root = mkdtempSync(join(WORK_ROOT, "palette-tests", "store-"));
  try {
    const store = paletteStore(root), saved = store.create(draft);
    assert.equal(saved.name, "Sea glass");
    assert.deepEqual(saved.colors, ["#113355", "#aabbcc", "#f5f1e9"]);
    const applied = paletteNumbers(saved);
    saved.colors[0] = "#000000";
    const loaded = paletteStore(root).read(saved.id);
    assert.equal(loaded.colors[0], "#113355");
    const updated = store.update({ ...loaded, name: "Tide", colors: ["#ffffff", "#000000"] });
    assert.equal(updated.id, loaded.id); assert.equal(updated.revision, 2);
    assert.deepEqual(applied, [0x113355, 0xaabbcc, 0xf5f1e9]);
    assert.throws(() => store.update(loaded), PaletteConflict);
    assert.throws(() => store.remove(loaded), PaletteConflict);
    assert.deepEqual(store.list(), [updated]);
    const copy = store.create(updated);
    assert.notEqual(copy.id, updated.id); assert.equal(copy.revision, 1);
    store.remove(updated); assert.equal(store.list().length, 1);
    assert.throws(() => store.read(updated.id), /deleted/);
    assert.deepEqual(store.read(copy.id).colors, updated.colors);
    assert.throws(() => store.read("../../outside"), /not found/);
    assert.throws(() => store.update({ ...copy, colors: ["red", "blue"] }), /six-digit/);
    assert.deepEqual(store.read(copy.id), copy);
  } finally { rmSync(root, { recursive: true }); }
});

test("palette validation rejects invalid colors and retains meaningful order/repetition", () => {
  for (const input of [null, [], { ...draft, name: " " }, { ...draft, name: "x".repeat(81) }, { ...draft, colors: ["#000000"] }, { ...draft, colors: Array(13).fill("#000000") }, { ...draft, colors: ["#fff", "#123456"] }, { ...draft, colors: [123, "#123456"] }]) assert.throws(() => validatePalette(input));
  assert.deepEqual(validatePalette({ name: "Repeat", colors: ["#000000", "#ffffff", "#000000"] }).colors, ["#000000", "#ffffff", "#000000"]);
  const prompt = withPalettePrompt("Keep the circles and transparency.", draft);
  assert.match(prompt, /#113355, #aabbcc, #f5f1e9/);
  assert.match(prompt, /Keep the circles and transparency/);
  assert.equal(withPalettePrompt("Existing request"), "Existing request");
  for (const input of [{ prompt: "x", count: 5 }, { prompt: "blue", count: 13 }, { prompt: "blue", count: 2.5 }, { prompt: "x".repeat(2001), count: 5 }]) assert.throws(() => validatePalettePrompt(input));
});

test("model palette creation validates count/content and propagates cancellation", async () => {
  const originalFetch = globalThis.fetch;
  let reply: unknown = { name: "Dusk", colors: ["#113355", "#aabbcc", "#f5f1e9"] };
  let captured: Record<string, unknown> = {};
  const controller = new AbortController();
  globalThis.fetch = async (url, init) => {
    assert.equal(init?.signal, controller.signal);
    if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "test-model" }] });
    captured = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] });
  };
  try {
    const generated = await generatePalette({ prompt: "Quiet coastal dusk", count: 3 }, controller.signal);
    assert.deepEqual(generated, reply);
    assert.equal(captured.max_tokens, 512);
    assert.match(JSON.stringify(captured.messages), /exactly 3 colors/);
    reply = { name: "Wrong count", colors: ["#000000", "#ffffff"] };
    await assert.rejects(generatePalette({ prompt: "Coast", count: 3 }, controller.signal), /instead of 3/);
    reply = { name: "Bad colors", colors: ["red", "blue", "gold"] };
    await assert.rejects(generatePalette({ prompt: "Coast", count: 3 }, controller.signal), /six-digit/);
    globalThis.fetch = async (_url, init) => { init?.signal?.throwIfAborted(); throw new Error("Unexpected call"); };
    controller.abort();
    await assert.rejects(generatePalette({ prompt: "Coast", count: 3 }, controller.signal), /abort/i);
  } finally { globalThis.fetch = originalFetch; }
});
