import assert from "node:assert/strict";
import test from "node:test";
import { definitions, PROCEDURE_LENGTH, validateProcedure } from "../dist/index.js";

test("a procedure is two trimmed sentences of 60 to 360 characters ending with a full stop", () => {
  const ok = "Sites are scattered across the frame and each grows a cell until the cells meet. Every shared wall is inked.";
  validateProcedure({ id: "probe", procedure: ok });
  assert.throws(() => validateProcedure({ id: "probe", procedure: " leading space." }), /trimmed/);
  assert.throws(() => validateProcedure({ id: "probe", procedure: "Too short to say anything." }), /60 to 360 characters/);
  assert.throws(() => validateProcedure({ id: "probe", procedure: ok.repeat(4) }), /60 to 360 characters/);
  assert.throws(() => validateProcedure({ id: "probe", procedure: ok.slice(0, -1) }), /full stop/);
  assert.throws(() => validateProcedure({ id: "probe", procedure: ok.replace(" and each", "\nand each") }), /single spaces/);
  assert.throws(() => validateProcedure({ id: "probe", procedure: "One long sentence that says what the procedure does from start to end without a break." }), /exactly two sentences/);
  assert.throws(() => validateProcedure({ id: "probe", procedure: ok + " Then it stops." }), /exactly two sentences/);
  assert.equal(PROCEDURE_LENGTH.min, 60);
});

test("every published instrument states its procedure without leading with its own title", () => {
  for (const item of definitions) {
    validateProcedure(item);
    assert.ok(!item.procedure.toLowerCase().startsWith(item.title.toLowerCase()), `${item.id} procedure starts with its title`);
  }
});
