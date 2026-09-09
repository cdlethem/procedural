import assert from "node:assert/strict";
import test from "node:test";
import legacy from "../lib/legacy-v1.json";
import legacyV2 from "../lib/legacy-v2.json";
import { cutRegions } from "../lib/cut-model.ts";
import {
  createDocument,
  createLayer,
  definition,
  MAX_LAYERS,
  techniques,
  validateDocument,
} from "../lib/studio.ts";

test("all 24 studio definitions create detached bounded v3 layers", () => {
  assert.equal(techniques.length, 24);
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

test("exact v2 documents migrate all techniques without changing their drawing settings", () => {
  for (const technique of techniques) {
    const current = createDocument(technique.id);
    const old: any = structuredClone(current);
    old.bindingVersion = legacyV2.bindingVersion;
    old.catalogSha256 = legacyV2.catalogSha256;
    delete old.layers[0].cutEdits;
    delete old.layers[0].transform;
    assert.deepEqual(validateDocument(old), current);
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
