import assert from "node:assert/strict";
import test from "node:test";
import legacy from "../lib/legacy-v1.json";
import legacyV2 from "../lib/legacy-v2.json";
import legacyV3 from "../lib/legacy-v3.json";
import { cutRegions } from "../lib/cut-model.ts";
import {
  createDocument,
  createLayer,
  definition,
  MAX_LAYERS,
  techniques,
  validateDocument,
} from "../lib/studio.ts";

test("all 106 studio definitions create detached bounded v3 layers", () => {
  assert.equal(techniques.length, 106);
  assert.equal(MAX_LAYERS, 8);
  for (const technique of techniques) {
    const document = createDocument(technique.id);
    const validated = validateDocument(document);
    assert.deepEqual(validated, document);
    assert.notEqual(validated.layers[0], document.layers[0]);
    assert.ok(validated.layers[0].palette.length >= 2);
    assert.equal(definition(technique.id).id, technique.id);
  }
});
test("v3 admission requires a strict owned RGB palette and technique parameters", () => {
  const document: any = createDocument("placement-marks");
  document.layers[0].palette = [0x123456];
  assert.throws(() => validateDocument(document), /2 to 12 RGB/);
  document.layers[0].palette = [0x123456, 0x1000000];
  assert.throws(() => validateDocument(document), /RGB integer/);
  document.layers[0].palette = [0x123456, 0xabcdef];
  document.layers[0].params.minimum = 8;
  document.layers[0].params.maximum = 4;
  assert.throws(() => validateDocument(document), /cannot exceed/i);
  const unknown: any = createDocument();
  unknown.layers[0].params.unknown = 1;
  assert.throws(() => validateDocument(unknown), /unknown key/);
  assert.throws(
    () =>
      validateDocument({ ...createDocument(), bindingVersion: "studio-v1" }),
    /catalogSha256 is stale|technique is not supported/,
  );
});
test("exact numeric values use semantic domains rather than slider ticks", () => {
  const continuous = createDocument("band-marks");
  continuous.layers[0].params.weight = 0.837;
  assert.equal(validateDocument(continuous).layers[0].params.weight, 0.837);
  const count = createDocument("band-marks");
  count.layers[0].params.count = 24.5;
  assert.throws(() => validateDocument(count), /integer/);
  const matrix = createDocument("geometric-panel");
  matrix.layers[0].params.rows = 30;
  matrix.layers[0].params.offsetX = -37.25;
  assert.equal(validateDocument(matrix).layers[0].params.offsetX, -37.25);
  matrix.layers[0].params.columns = 100;
  assert.throws(() => validateDocument(matrix), /2048-cell/);
});
test("saved two-control studies migrate without losing their original drawing mode", () => {
  const ornament = createDocument("ornament-poster");
  ornament.layers[0].params = { motif: "leaves", tiered: false, cropped: true, dense: true };
  const restoredOrnament = validateDocument(ornament).layers[0].params;
  assert.equal(restoredOrnament.legacy, true);
  assert.deepEqual([restoredOrnament.motif, restoredOrnament.tiered,
    restoredOrnament.cropped, restoredOrnament.dense], ["leaves", false, true, true]);
  const panel = createDocument("geometric-panel");
  panel.layers[0].params = { marks: "bars", tight: true };
  const restoredPanel = validateDocument(panel).layers[0].params;
  assert.equal(restoredPanel.legacy, true);
  assert.deepEqual([restoredPanel.marks, restoredPanel.tight], ["bars", true]);
});
test("saved path and mesh study controls retain their historical drawing mode", () => {
  const originals: [string, Record<string, number>][] = [
    ["pull-marks", { radius: 170, power: 1.65, lines: 26, jitter: 1.25, weight: 1.35 }],
    ["projection-marks", { radius: 105, strength: 0.67, lines: 18, weight: 1.2 }],
    ["path-clip-marks", { paths: 8, steps: 70, wander: 9, notch: 300, weight: 1.25 }],
    ["ripple-interference", { passes: 18, scale: 22, weight: 1.3 }],
    ["pinned-waves", { passes: 22, scale: 20, weight: 1.7 }],
    ["rounded-panels", { iterations: 3, panels: 5, weight: 2 }],
    ["road-margins", { distance: 13, routes: 5, weight: 2 }],
    ["nested-contour-strokes", { distance: 10, rings: 7, weight: 2 }],
    ["faceted-silhouettes", { scale: 220, grain: 16, weight: 2 }],
    ["concave-grain", { scale: 230, grain: 34, weight: 1 }],
    ["extruded-seals", { height: 110, rotation: 0.55, weight: 1 }],
    ["stepped-blocks", { height: 80, rotation: 0.7, weight: 1 }],
    ["transported-ribbons", { segments: 12, width: 54, rotation: 0.5 }],
    ["twisting-streamers", { segments: 16, width: 38, rotation: 0.8 }],
    ["rounded-polyhedra", { levels: 1, rotation: 0.6, weight: 1 }],
    ["subdivided-shells", { levels: 1, rotation: 1.1, weight: 1 }],
  ];
  for (const [id, params] of originals) {
    const document = createDocument(id);
    assert.equal(document.layers[0].params.legacy, false, `${id}: new layers use editable controls`);
    document.layers[0].params = params;
    const restored = validateDocument(document).layers[0].params;
    assert.equal(restored.legacy, true, `${id}: exact predecessor uses historical renderer`);
    for (const [key, value] of Object.entries(params)) assert.equal(restored[key], value);
  }
  const invalid = createDocument("rounded-panels");
  invalid.layers[0].params = { iterations: 3, panels: 5, weight: 2, extra: 1 };
  assert.throws(() => validateDocument(invalid), /unknown key/);
  invalid.layers[0].params = { iterations: 3, panels: 5, weight: 2.1 };
  assert.equal(validateDocument(invalid).layers[0].params.weight, 2.1);
  invalid.layers[0].params = { iterations: 3.5, panels: 5, weight: 2.1 };
  assert.throws(() => validateDocument(invalid), /missing|unknown key|must be an integer|between/);
});
test("saved loop composition retains its exact historical layout", () => {
  const document = createDocument("loop-marks");
  document.layers[0].params = {
    tileScale: 1.35, outlineWeight: 0.9, opacity: 123, fans: true, moved: false,
  };
  const restored = validateDocument(document).layers[0].params;
  assert.equal(restored.legacy, true);
  assert.equal(restored.tileScale, 1.35);
  assert.equal(restored.fans, true);
  document.layers[0].params = { ...document.layers[0].params, extra: 1 };
  assert.throws(() => validateDocument(document), /unknown key/);
});
test("saved cellular and full-field studies acquire only the new controls they need", () => {
  const cellular: [string, Record<string, number>][] = [
    ["reaction-spots", { passes: 12, scale: 18, weight: 1.35 }],
    ["reaction-stripes", { passes: 16, scale: 13, weight: 1.5 }],
    ["organic-cells", { passes: 8, cellSize: 18, weight: 1.25 }],
    ["geometric-generations", { passes: 6, cellSize: 22, weight: 1.75 }],
  ];
  for (const [id, params] of cellular) {
    const old = createDocument(id);
    old.layers[0].params = params;
    const restored = validateDocument(old).layers[0].params;
    assert.equal(restored.legacy, true, `${id}: old state remains on its historical branch`);
    for (const [key, value] of Object.entries(params)) assert.equal(restored[key], value);
  }
  const additive: [string, Record<string, number | boolean>][] = [
    ["warp-marks", { strength: 14, scale: 34, stripe: 12 }],
    ["blur-marks", { radius: 5, stripe: 10, horizontal: false }],
    ["quantized-stripes", { stripes: 24, count: 5 }],
    ["perceptual-bands", { bands: 19, phase: 0.37 }],
    ["reduced-mosaic", { scale: 16.25, count: 5 }],
    ["nearest-feature-mosaic", { scale: 14.7, features: 13 }],
  ];
  for (const [id, params] of additive) {
    const old = createDocument(id);
    old.layers[0].params = params;
    const restored = validateDocument(old).layers[0].params;
    for (const [key, value] of Object.entries(params)) assert.equal(restored[key], value);
    assert.deepEqual(Object.keys(restored).sort(), Object.keys(createDocument(id).layers[0].params).sort());
  }
});
test("v3 layers require detached bounded transforms with exact fields", () => {
  const document = createDocument();
  assert.deepEqual(document.layers[0].transform, {
    x: 320,
    y: 320,
    scale: 1,
    rotation: 0,
  });
  const imported = validateDocument(document);
  assert.notEqual(imported.layers[0].transform, document.layers[0].transform);
  for (const [field, value, message] of [
    ["x", -641, /between -640 and 1280/],
    ["y", 1281, /between -640 and 1280/],
    ["scale", 0.049, /between 0.05 and 4/],
    ["rotation", 181, /between -180 and 180/],
  ] as const) {
    const invalid: any = structuredClone(document);
    invalid.layers[0].transform[field] = value;
    assert.throws(() => validateDocument(invalid), message);
  }
  const missing: any = structuredClone(document);
  delete missing.layers[0].transform;
  assert.throws(() => validateDocument(missing), /missing transform/);
  const unknown: any = structuredClone(document);
  unknown.layers[0].transform.extra = 1;
  assert.throws(() => validateDocument(unknown), /unknown key/);
  const fractional: any = structuredClone(document);
  fractional.layers[0].transform = {
    x: 320.25,
    y: -12.5,
    scale: 1.5,
    rotation: -45.5,
  };
  assert.deepEqual(
    validateDocument(fractional).layers[0].transform,
    fractional.layers[0].transform,
  );
});

test("successful imports reserve IDs without reserving rejected payload IDs", () => {
  const imported: any = createDocument();
  imported.layers[0].id = "layer-99999999999999999999999";
  validateDocument(imported);
  const first = createLayer("field-marks"),
    second = createLayer("field-marks");
  assert.notEqual(first.id, imported.layers[0].id);
  assert.notEqual(first.id, second.id);
  const rejected: any = createDocument();
  rejected.layers[0].id = "reserved-only-if-valid";
  rejected.layers[0].palette = [0];
  assert.throws(() => validateDocument(rejected));
  assert.match(createLayer("field-marks").id, /^layer-\d+$/);
});
test("frozen v1 documents migrate palette and lattice controls only after exact v1 validation", () => {
  const base: any = {
    schemaVersion: 1,
    bindingVersion: legacy.bindingVersion,
    catalogSha256: legacy.catalogSha256,
    width: 640,
    height: 640,
    background: "#ECE7DA",
    layers: [
      {
        id: "legacy-lattice",
        technique: "lattice-marks",
        visible: true,
        opacity: 1,
        seed: 7,
        params: {
          many: true,
          longPaths: true,
          dots: true,
          wide: true,
          palette: "neon",
        },
      },
    ],
  };
  const migrated = validateDocument(base);
  assert.equal(migrated.bindingVersion, "studio-v3");
  assert.deepEqual(
    migrated.layers[0].palette,
    [0x493657, 0xb85065, 0xe6b89c, 0x467c89],
  );
  assert.deepEqual(migrated.layers[0].transform, {
    x: 320,
    y: 320,
    scale: 1,
    rotation: 0,
  });
  assert.deepEqual(migrated.layers[0].params, {
    count: 36,
    steps: 36,
    weight: 15.6,
    dotSize: 6,
    dots: true,
    grid: true,
  });
  const invalid = structuredClone(base);
  invalid.layers[0].params.unknown = true;
  assert.throws(() => validateDocument(invalid), /unknown key/);
  const field = structuredClone(base);
  field.layers[0] = {
    ...field.layers[0],
    technique: "field-marks",
    params: {
      columns: 80,
      rows: 80,
      pitch: 8,
      maxLength: 14,
      palette: "original",
      bars: false,
    },
  };
  assert.deepEqual(
    validateDocument(field).layers[0].palette,
    [0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7],
  );
});

test("exact v2 documents retain their drawing settings", () => {
  const revisedLegacy = new Set([
    "loop-marks", "pull-marks", "projection-marks", "path-clip-marks",
    "ripple-interference", "pinned-waves",
  ]);
  for (const technique of legacyV2.techniques) {
    const current = createDocument(technique.id);
    const old: any = structuredClone(current);
    old.layers[0].params = structuredClone(technique.defaults);
    old.bindingVersion = legacyV2.bindingVersion;
    old.catalogSha256 = legacyV2.catalogSha256;
    delete old.layers[0].cutEdits;
    delete old.layers[0].transform;
    const migrated = validateDocument(old);
    if (revisedLegacy.has(technique.id)) {
      assert.equal(migrated.layers[0].params.legacy, true, technique.id);
      for (const [key, value] of Object.entries(technique.defaults))
        assert.deepEqual(migrated.layers[0].params[key], value, `${technique.id}.${key}`);
    } else {
      assert.deepEqual(migrated, current);
    }
    old.layers[0].cutEdits = [];
    assert.throws(() => validateDocument(old), /unknown key/);
  }
});

test("manual cuts are detached, replayable document state with strict admission", () => {
  const document = createDocument("cut-marks");
  const before = cutRegions(document.layers[0]);
  const leaf = before[0];
  document.layers[0].cutEdits.push({
    kind: "cut",
    id: leaf.id,
    axis: "X",
    coordinate: (leaf.bounds[0] + leaf.bounds[2]) / 2,
  });
  const imported = validateDocument(JSON.parse(JSON.stringify(document)));
  assert.deepEqual(imported, document);
  assert.equal(cutRegions(imported.layers[0]).length, before.length + 1);
  assert.notEqual(
    imported.layers[0].cutEdits[0],
    document.layers[0].cutEdits[0],
  );
  const invalid: any = structuredClone(document);
  invalid.layers[0].cutEdits[0].coordinate = leaf.bounds[0];
  assert.throws(() => validateDocument(invalid));
  assert.deepEqual(
    cutRegions(imported.layers[0]),
    cutRegions(document.layers[0]),
  );
  const moved: any = structuredClone(document);
  moved.layers[0].transform = {
    x: 111.5,
    y: 508.25,
    scale: 0.75,
    rotation: 30,
  };
  const movedImported = validateDocument(moved);
  assert.deepEqual(
    movedImported.layers[0].cutEdits,
    document.layers[0].cutEdits,
  );
  assert.deepEqual(
    cutRegions(movedImported.layers[0]),
    cutRegions(document.layers[0]),
  );
  const other = createDocument("field-marks");
  other.layers[0].cutEdits = document.layers[0].cutEdits;
  assert.throws(() => validateDocument(other));
  const missing: any = createDocument("cut-marks");
  delete missing.layers[0].cutEdits;
  assert.throws(() => validateDocument(missing), /missing cutEdits/);
});


test("the previous exact v3 binding preserves existing projects after additive expansion", () => {
  const current = createDocument("cut-marks");
  const region = cutRegions(current.layers[0])[0];
  current.layers[0].cutEdits = [{ kind: "cut", id: region.id, axis: "X", coordinate: (region.bounds[0] + region.bounds[2]) / 2 }];
  current.layers[0].transform = { x: 260, y: 355, scale: 0.8, rotation: 23 };
  current.layers[0].palette = [0x102030, 0xf0e0d0];
  const saved = { ...current, catalogSha256: legacyV3.catalogSha256 };
  const imported = validateDocument(saved);
  assert.deepEqual(imported, current);
  assert.notEqual(imported.layers[0].cutEdits, saved.layers[0].cutEdits);
  assert.notEqual(imported.layers[0].transform, saved.layers[0].transform);
  assert.deepEqual(cutRegions(imported.layers[0]), cutRegions(saved.layers[0]));
  assert.throws(() => validateDocument({ ...saved, catalogSha256: "unknown" }), /stale or unsupported/);
  const forged = { ...createDocument("cell-mosaic"), catalogSha256: legacyV3.catalogSha256 };
  assert.throws(() => validateDocument(forged), /not available in the previous studio-v3 binding/);
});
