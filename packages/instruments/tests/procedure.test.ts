import assert from "node:assert/strict";
import test from "node:test";
import { definitions, PROCEDURE_LENGTH, validateProcedure } from "../dist/index.js";

test("a procedure is one trimmed paragraph of 60 to 360 characters ending with a full stop", () => {
  const ok = "Scatter sites across the frame, grow a cell around each until the cells meet, then ink every shared wall.";
  validateProcedure({ id: "probe", procedure: ok });
  assert.throws(() => validateProcedure({ id: "probe", procedure: " leading space." }), /trimmed/);
  assert.throws(() => validateProcedure({ id: "probe", procedure: "Too short to say anything." }), /60 to 360 characters/);
  assert.throws(() => validateProcedure({ id: "probe", procedure: ok.repeat(4) }), /60 to 360 characters/);
  assert.throws(() => validateProcedure({ id: "probe", procedure: ok.slice(0, -1) }), /full stop/);
  assert.throws(() => validateProcedure({ id: "probe", procedure: ok.replace(", grow", ",\ngrow") }), /single spaces/);
  assert.equal(PROCEDURE_LENGTH.min, 60);
});

test("every published instrument states its procedure without leading with its own title", () => {
  for (const item of definitions) {
    validateProcedure(item);
    assert.ok(!item.procedure.toLowerCase().startsWith(item.title.toLowerCase()), `${item.id} procedure starts with its title`);
  }
});
