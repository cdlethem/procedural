import { fdlibmCos, fdlibmSin } from "./fdlibm-trig.js";
import { MAX_ARRAY, computed, inputNumber, itemAt, passiveArray, passiveRecord, positiveZero, safeInteger, valueAt } from "./internal/agent-behavior-utils.js";

const KEYS = ["agents", "field", "sensorDistance", "sensorAngleTurns", "turnGain", "dt", "maxWork"];
const TAU = 6.283185307179586;
export class SensorMotorStep2DError extends Error { constructor(code) { super(code); this.name = "SensorMotorStep2DError"; this.code = code; } }
function input(value) { return inputNumber(value, SensorMotorStep2DError); }
function checked(value) { return computed(value, SensorMotorStep2DError); }
function nonnegative(value) { const result = input(value); if (result < 0) throw new SensorMotorStep2DError("INVALID_INPUT"); return result; }
function vector(value) { const source = passiveArray(value, SensorMotorStep2DError, 2); return [input(itemAt(source, 0)), input(itemAt(source, 1))]; }
function captureAgents(value) {
  const source = passiveArray(value, SensorMotorStep2DError); const agents = new Array(source.length);
  for (let i = 0; i < source.length; i += 1) { const agent = passiveRecord(itemAt(source, i), ["position", "headingTurns", "speed"], SensorMotorStep2DError); agents[i] = [vector(valueAt(agent, "position")), input(valueAt(agent, "headingTurns")), nonnegative(valueAt(agent, "speed"))]; }
  return agents;
}
function captureField(value) {
  const field = passiveRecord(value, ["values", "columns", "rows", "origin", "spacing", "boundary"], SensorMotorStep2DError);
  const valuesIn = passiveArray(valueAt(field, "values"), SensorMotorStep2DError);
  const columns = safeInteger(valueAt(field, "columns"), SensorMotorStep2DError, 1, MAX_ARRAY);
  const rows = safeInteger(valueAt(field, "rows"), SensorMotorStep2DError, 1, MAX_ARRAY);
  const cells = columns * rows;
  if (!Number.isSafeInteger(cells) || cells > MAX_ARRAY || valuesIn.length !== cells) throw new SensorMotorStep2DError("INVALID_INPUT");
  const values = new Array(cells); for (let i = 0; i < cells; i += 1) values[i] = input(itemAt(valuesIn, i));
  const origin = vector(valueAt(field, "origin")); const spacing = vector(valueAt(field, "spacing"));
  if (spacing[0] <= 0 || spacing[1] <= 0) throw new SensorMotorStep2DError("INVALID_INPUT");
  const boundary = valueAt(field, "boundary"); if (boundary !== "clamp" && boundary !== "wrap" && boundary !== "zero") throw new SensorMotorStep2DError("INVALID_INPUT");
  return { values, columns, rows, origin, spacing, boundary };
}
function wrapped(value, extent) { let result = checked(value % extent); if (result < 0) result = checked(result + extent); if (result >= extent) result = 0; return result; }
function sample(field, x, y) {
  let gx = checked(checked(x - field.origin[0]) / field.spacing[0]); let gy = checked(checked(y - field.origin[1]) / field.spacing[1]);
  if (field.boundary === "zero" && (gx < 0 || gx > field.columns - 1 || gy < 0 || gy > field.rows - 1)) return 0;
  if (field.boundary === "clamp") { gx = Math.min(field.columns - 1, Math.max(0, gx)); gy = Math.min(field.rows - 1, Math.max(0, gy)); }
  else if (field.boundary === "wrap") { gx = wrapped(gx, field.columns); gy = wrapped(gy, field.rows); }
  const x0 = Math.floor(gx), y0 = Math.floor(gy); const tx = checked(gx - x0), ty = checked(gy - y0);
  const x1 = field.boundary === "wrap" ? (x0 + 1) % field.columns : Math.min(x0 + 1, field.columns - 1);
  const y1 = field.boundary === "wrap" ? (y0 + 1) % field.rows : Math.min(y0 + 1, field.rows - 1);
  const a = field.values[y0 * field.columns + x0], b = field.values[y0 * field.columns + x1], c = field.values[y1 * field.columns + x0], d = field.values[y1 * field.columns + x1];
  const bottom = checked(a + checked(checked(b - a) * tx)); const top = checked(c + checked(checked(d - c) * tx)); return checked(bottom + checked(checked(top - bottom) * ty));
}

/** Synchronously sample an explicit scalar grid with paired old-state probes. */
export function sensorMotorStep2D(inputValue) {
  const record = passiveRecord(inputValue, KEYS, SensorMotorStep2DError); const agents = captureAgents(valueAt(record, "agents")); const field = captureField(valueAt(record, "field"));
  const sensorDistance = nonnegative(valueAt(record, "sensorDistance")); const sensorAngle = input(valueAt(record, "sensorAngleTurns")); if (sensorAngle < 0 || sensorAngle > 0.5) throw new SensorMotorStep2DError("INVALID_INPUT");
  const turnGain = input(valueAt(record, "turnGain")); const dt = input(valueAt(record, "dt")); if (dt <= 0) throw new SensorMotorStep2DError("INVALID_INPUT"); const maxWork = safeInteger(valueAt(record, "maxWork"), SensorMotorStep2DError, 0);
  const work = agents.length * 3; if (!Number.isSafeInteger(work) || work > maxWork) throw new SensorMotorStep2DError("WORK_LIMIT");
  const nextAgents = new Array(agents.length), probes = new Array(agents.length), samples = new Array(agents.length);
  for (let i = 0; i < agents.length; i += 1) {
    const [position, heading, speed] = agents[i]; const h0 = checked(heading - Math.floor(heading));
    const leftAngle = checked(TAU * checked(h0 - sensorAngle)), rightAngle = checked(TAU * checked(h0 + sensorAngle));
    const leftX = checked(position[0] + checked(sensorDistance * checked(fdlibmCos(leftAngle)))); const leftY = checked(position[1] + checked(sensorDistance * checked(fdlibmSin(leftAngle))));
    const left = sample(field, leftX, leftY);
    const rightX = checked(position[0] + checked(sensorDistance * checked(fdlibmCos(rightAngle)))); const rightY = checked(position[1] + checked(sensorDistance * checked(fdlibmSin(rightAngle))));
    const right = sample(field, rightX, rightY); const difference = checked(right - left); const turn = checked(turnGain * difference); const unwrapped = checked(h0 + checked(dt * turn)); const h1 = checked(unwrapped - Math.floor(unwrapped));
    const velocityX = checked(speed * checked(fdlibmCos(checked(TAU * h1)))); const velocityY = checked(speed * checked(fdlibmSin(checked(TAU * h1)))); const x = checked(position[0] + checked(dt * velocityX)); const y = checked(position[1] + checked(dt * velocityY));
    nextAgents[i] = { position: [positiveZero(x), positiveZero(y)], headingTurns: positiveZero(h1), speed: positiveZero(speed) }; probes[i] = { left: [positiveZero(leftX), positiveZero(leftY)], right: [positiveZero(rightX), positiveZero(rightY)] }; samples[i] = { left: positiveZero(left), right: positiveZero(right) };
  }
  return { agents: nextAgents, probes, samples };
}
