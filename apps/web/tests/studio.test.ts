import assert from "node:assert/strict";
import test from "node:test";
import {
  createDocument,
  createLayer,
  MAX_LAYERS,
  techniques,
  validateDocument,
} from "../lib/studio.ts";
import {
  commandCount,
  createPathMarks,
  pathMarkCommands,
} from "../../../packages/javascript/examples/path-marks/path-marks.js";
import {
  createMarkField,
  markCommands,
} from "../../../packages/javascript/examples/field-marks/mark-field.js";

test("new documents are valid detached v1 payloads", () => {
  const document = createDocument("path-marks");
  const validated = validateDocument(document);
  assert.deepEqual(validated, document);
  assert.notEqual(validated, document);
  assert.notEqual(validated.layers, document.layers);
  validated.layers[0].params.steps = 50;
  assert.equal(document.layers[0].params.steps, 600);
});
test("layers are unique and technique schemas are bounded", () => {
  assert.notEqual(createLayer("field-marks").id, createLayer("field-marks").id);
  assert.equal(techniques.length, 4);
  assert.equal(MAX_LAYERS, 8);
  assert.throws(
    () =>
      validateDocument({
        ...createDocument(),
        layers: Array.from({ length: 9 }, (_, index) => ({
          ...createLayer("field-marks"),
          id: `l${index}`,
        })),
      }),
    /at most 8/,
  );
});
test("successful imports reserve arbitrary IDs without advancing an unsafe counter", () => {
  const imported = createDocument();
  imported.layers[0].id = "layer-99999999999999999999999";
  validateDocument(imported);
  const first = createLayer("field-marks");
  const second = createLayer("field-marks");
  assert.notEqual(first.id, imported.layers[0].id);
  assert.notEqual(first.id, second.id);
  assert.doesNotThrow(() =>
    validateDocument({ ...createDocument(), layers: [first, second] }),
  );
  const rejected = createDocument();
  rejected.layers[0].id = "reserved-only-if-valid";
  rejected.layers[0].params.columns = 999;
  assert.throws(() => validateDocument(rejected), /between 16 and 160/);
  const afterRejectedImport = createLayer("field-marks").id;
  assert.match(afterRejectedImport, /^layer-\d+$/);
  assert.ok(Number(afterRejectedImport.slice(6)) < 1000);
});
test("document admission rejects malformed and unsafe values", () => {
  const document: any = createDocument("placement-marks");
  document.layers[0].params.unknown = 1;
  assert.throws(() => validateDocument(document), /unknown key/);
  document.layers[0].params = {
    ...createDocument("placement-marks").layers[0].params,
    minimum: 8,
    maximum: 4,
  };
  assert.throws(() => validateDocument(document), /cannot exceed/);
  assert.throws(
    () => validateDocument({ ...createDocument(), background: "transparent" }),
    /opaque RGB/,
  );
  assert.throws(
    () =>
      validateDocument({ ...createDocument(), catalogSha256: "0".repeat(64) }),
    /stale or unsupported/,
  );
});
test("real field and path composition helpers are deterministic and bounded by studio controls", () => {
  const field = createMarkField(7, 16, 16, 4);
  const first = [...markCommands(field, 12, [0, 1, 2, 3, 4])];
  const second = [
    ...markCommands(createMarkField(7, 16, 16, 4), 12, [0, 1, 2, 3, 4]),
  ];
  assert.deepEqual(first, second);
  assert.equal(first.length, 256);
  const movement = createPathMarks(7, 50, 0.4);
  assert.equal(commandCount(movement, false), 24 * 13);
  assert.equal(
    [...pathMarkCommands(movement, false, 12, [1, 2, 3, 4, 5])].length,
    24 * 13,
  );
});
