import assert from "node:assert/strict";
import test from "node:test";
import legacy from "../lib/legacy-v1.json";
import {
  createDocument,
  createLayer,
  definition,
  MAX_LAYERS,
  techniques,
  validateDocument,
} from "../lib/studio.ts";

test("all 24 studio definitions create detached bounded v2 layers", () => {
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
test("v2 admission requires a strict owned RGB palette and technique parameters", () => {
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
  assert.equal(migrated.bindingVersion, "studio-v2");
  assert.deepEqual(
    migrated.layers[0].palette,
    [0x493657, 0xb85065, 0xe6b89c, 0x467c89],
  );
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
