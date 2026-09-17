import { ExactRational } from "./internal/exact-rational.js";
import { captureRegion, compareRegionsDetailed, denseArray, inputRegion, integer, plainRecord, validateRegion, validationWork, witness } from "./internal/region-utils.js";
import { captureStripInput, taperedStrokeStrip2D, TaperedStrokeStrip2DError } from "./tapered-stroke-strip-2d.js";

export class SelectTaperedStrokeStrips2DError extends Error {
  constructor(code) { super(code); this.name = "SelectTaperedStrokeStrips2DError"; this.code = code; }
}
const noAgainst = () => ({ ...witness(), againstKind: "NONE", againstIndex: -1 });
function candidateRecord(candidate) {
  plainRecord(candidate, ["id", "points", "widths", "closed", "cap", "join", "miterLimit"], SelectTaperedStrokeStrips2DError);
  if (typeof candidate.id !== "string" || candidate.id.length === 0) throw new SelectTaperedStrokeStrips2DError("INVALID_INPUT");
  return candidate;
}
function stripInput(candidate) { return { points: candidate.points, widths: candidate.widths, closed: candidate.closed, cap: candidate.cap, join: candidate.join, miterLimit: candidate.miterLimit, maxWork: Number.MAX_SAFE_INTEGER }; }
function copiedWitness(value, againstKind, againstIndex) { return { ...value.witness, againstKind, againstIndex }; }
function compare(a, b) {
  try { return compareRegionsDetailed(a, b); }
  catch (error) {
    if (error?.message === "NUMERIC_OVERFLOW") throw new SelectTaperedStrokeStrips2DError("NUMERIC_OVERFLOW");
    throw error;
  }
}

/** Ordered, conservative selection of valid strips against strict exclusions and peers. */
export function selectTaperedStrokeStrips2D(configuration) {
  const input = plainRecord(configuration, ["candidates", "clearance", "exclusions", "maxAccepted", "maxWork"], SelectTaperedStrokeStrips2DError);
  denseArray(input.candidates, SelectTaperedStrokeStrips2DError); denseArray(input.exclusions, SelectTaperedStrokeStrips2DError);
  const clearance = (() => { const n = input.clearance; if (typeof n !== "number" || !Number.isFinite(n) || n < 0) throw new SelectTaperedStrokeStrips2DError("INVALID_INPUT"); return n === 0 ? 0 : n; })();
  const maxAccepted = integer(input.maxAccepted, SelectTaperedStrokeStrips2DError), maxWork = integer(input.maxWork, SelectTaperedStrokeStrips2DError);
  const candidates = input.candidates.map(candidateRecord), ids = new Set(); for (const c of candidates) { if (ids.has(c.id)) throw new SelectTaperedStrokeStrips2DError("INVALID_INPUT"); ids.add(c.id); captureStripInput(stripInput(c), SelectTaperedStrokeStrips2DError, false); }
  let exclusions;
  try { exclusions = input.exclusions.map((value) => captureRegion(value, SelectTaperedStrokeStrips2DError)); }
  catch (error) { if (error instanceof SelectTaperedStrokeStrips2DError) throw error; throw new SelectTaperedStrokeStrips2DError(error.message); }
  let sumN = 0n, sumE = 0n, sumESquared = 0n, sumV = 0n;
  for (const candidate of candidates) {
    const n = BigInt(candidate.points.length), e = 4n * n + 4n;
    sumN += n; sumE += e; sumESquared += e * e;
    sumV += e * e + 16n * e + 16n;
  }
  let sumF = 0n, sumU = 0n;
  for (const exclusion of exclusions) { sumF += BigInt(exclusion.edges); sumU += validationWork(exclusion); }
  const c = BigInt(candidates.length), x = BigInt(exclusions.length);
  // Expand the exact pair sum algebraically; no quadratic enumeration is needed merely
  // to discover that a candidate set exceeds its declared work allowance.
  const candidateExclusionPairs = x * sumV + c * sumU + 12n * sumE * sumF + x * sumE + c * sumF;
  const candidatePairs = (c - 1n) * (sumV + sumE) + 6n * (sumE * sumE - sumESquared);
  const planned = 32n * sumN + sumV + sumU + candidateExclusionPairs + candidatePairs;
  if (planned > BigInt(maxWork)) throw new SelectTaperedStrokeStrips2DError("WORK_LIMIT");
  for (const exclusion of exclusions) validateRegion(exclusion, SelectTaperedStrokeStrips2DError);
  const accepted = [], rejected = [], acceptedRegions = [], clearanceSquared = ExactRational.of(clearance).multiply(ExactRational.of(clearance));
  for (const candidate of candidates) {
    if (accepted.length >= maxAccepted) { rejected.push({ id: candidate.id, reason: "LIMIT", witness: { ...witness("LIMIT"), againstKind: "NONE", againstIndex: -1 } }); continue; }
    let strip;
    try { strip = taperedStrokeStrip2D(stripInput(candidate)); }
    catch (error) { if (error instanceof TaperedStrokeStrip2DError) throw new SelectTaperedStrokeStrips2DError(error.code); throw error; }
    if (strip.status === "REJECTED") { rejected.push({ id: candidate.id, reason: "INVALID_STRIP_TOPOLOGY", witness: { ...strip.witness, againstKind: "NONE", againstIndex: -1 } }); continue; }
    let actual;
    try { actual = inputRegion(strip.visible, SelectTaperedStrokeStrips2DError); } catch { rejected.push({ id: candidate.id, reason: "INVALID_STRIP_TOPOLOGY", witness: { ...witness("INVALID_RING"), againstKind: "NONE", againstIndex: -1 } }); continue; }
    let decision = null;
    for (let i = 0; i < exclusions.length && !decision; i += 1) { const compared = compare(actual, exclusions[i]); if (compared.relation === "INTERSECTS" || compared.squared.compareTo(clearanceSquared) < 0) decision = { reason: compared.relation === "INTERSECTS" ? "INTERSECTS" : "CLEARANCE", witness: copiedWitness(compared, "EXCLUSION", i) }; }
    for (let i = 0; i < acceptedRegions.length && !decision; i += 1) { const compared = compare(actual, acceptedRegions[i]); if (compared.relation === "INTERSECTS" || compared.squared.compareTo(clearanceSquared) < 0) decision = { reason: compared.relation === "INTERSECTS" ? "INTERSECTS" : "CLEARANCE", witness: copiedWitness(compared, "ACCEPTED", i) }; }
    if (decision) { rejected.push({ id: candidate.id, ...decision }); continue; }
    acceptedRegions.push(actual); accepted.push({ id: candidate.id, visible: strip.visible, centerline: strip.centerline, resolvedJoins: strip.resolvedJoins, witness: noAgainst() });
  }
  return { accepted, rejected };
}
