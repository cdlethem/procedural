import assert from "node:assert/strict";
import * as studies from "../../packages/javascript/examples/materials-b-studies.js";

const slugs = ["extruded-seals", "stepped-blocks", "transported-ribbons", "twisting-streamers", "rounded-polyhedra", "subdivided-shells"];
const palettes = [[0x173f5f, 0x20639b, 0x3caea3, 0xf6d55c], [0xff0000, 0x00ff00, 0x0000ff, 0xffffff]];
const drawName = slug => "draw" + slug.split("-").map(part => part[0].toUpperCase() + part.slice(1)).join("");
function commands(slug, params, palette = palettes[0]) {
  const calls = [];
  const p = new Proxy({ CLOSE: "close", ROUND: "round" }, { get: (target, key) => key in target ? target[key] : (...args) => {
    for (const arg of args) if (typeof arg === "number") assert.ok(Number.isFinite(arg), `${slug}: ${key} finite`);
    calls.push([key, args]);
  } });
  studies[drawName(slug)](p, { params, palette, seed: 42 });
  return calls;
}
const vertices = calls => calls.filter(([name]) => name === "vertex").map(([, args]) => args);
const style = calls => calls.filter(([name]) => ["fill", "stroke", "noStroke", "strokeWeight"].includes(name));

for (const slug of slugs) {
  const settings = studies.materialsBSettings[slug];
  const defaults = settings.defaults;
  const baseline = commands(slug, defaults);
  assert.ok(vertices(baseline).length, `${slug}: faces are drawn`);
  assert.equal(baseline.some(([name]) => name === "background"), false, `${slug}: clear space is transparent`);
  assert.deepEqual(commands(slug, defaults), baseline, `${slug}: deterministic draw`);
  const edited = commands(slug, { ...defaults, ...settings.structuralEdit });
  assert.notDeepEqual(vertices(edited), vertices(baseline), `${slug}: structural edit changes actual mesh geometry`);
  const zoomed = commands(slug, { ...defaults, zoom: defaults.zoom * 1.2 });
  assert.notDeepEqual(vertices(zoomed), vertices(baseline), `${slug}: fixed zoom changes projected extent`);
  const pitched = commands(slug, { ...defaults, pitch: defaults.pitch + .2 });
  assert.notDeepEqual(vertices(pitched), vertices(baseline), `${slug}: pitch changes viewpoint`);
  const recolored = commands(slug, defaults, palettes[1]);
  assert.deepEqual(vertices(recolored), vertices(baseline), `${slug}: palette leaves geometry fixed`);
  assert.notDeepEqual(style(recolored), style(baseline), `${slug}: palette changes surface color`);
  for (const faceMode of ["bands", "facets"]) {
    const painted = commands(slug, { ...defaults, faceMode });
    assert.deepEqual(vertices(painted), vertices(baseline), `${slug}: ${faceMode} leaves geometry fixed`);
    assert.notDeepEqual(style(painted), style(baseline), `${slug}: ${faceMode} changes surface treatment`);
  }
  assert.ok(commands(slug, { ...defaults, weight: 0 }).some(([name]) => name === "noStroke"), `${slug}: zero weight hides outlines`);
  const legacy = slug.includes("ribbon") || slug.includes("streamer")
    ? { segments: 12, width: 54, rotation: .5, weight: 1, legacy: true }
    : slug.includes("polyhedra") || slug.includes("shells")
      ? { levels: 1, rotation: .6, weight: 1, legacy: true }
      : { height: 110, rotation: .55, weight: 1, legacy: true };
  assert.ok(vertices(commands(slug, legacy)).length, `${slug}: exact old-key legacy input still draws`);
}

console.log("p5 materials B modern geometry, surface, projection, and legacy paths passed");
