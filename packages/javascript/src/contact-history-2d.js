import { MAX_SAFE, itemAt, passiveArray, passiveRecord, safeInteger, valueAt } from "./internal/agent-behavior-utils.js";

const KEYS = ["ids", "pairs", "contacts", "lingerSteps", "maxWork"];

export class ContactHistory2DError extends Error {
  constructor(code) { super(code); this.name = "ContactHistory2DError"; this.code = code; }
}

function invalid() { throw new ContactHistory2DError("INVALID_INPUT"); }
function captureIds(value) {
  const source = passiveArray(value, ContactHistory2DError);
  const ids = new Array(source.length); const seen = new Set();
  for (let i = 0; i < source.length; i += 1) {
    const id = safeInteger(itemAt(source, i), ContactHistory2DError, 0);
    if (seen.has(id)) invalid();
    seen.add(id); ids[i] = id;
  }
  return ids;
}
function index(value, count) {
  const result = safeInteger(value, ContactHistory2DError, 0);
  if (result >= count) invalid();
  return result;
}
function capturePairs(value, ids) {
  const source = passiveArray(value, ContactHistory2DError); const pairs = new Array(source.length);
  let previousLeft = -1, previousRight = -1;
  for (let i = 0; i < source.length; i += 1) {
    const pair = passiveArray(itemAt(source, i), ContactHistory2DError, 2);
    const left = index(itemAt(pair, 0), ids.length), right = index(itemAt(pair, 1), ids.length);
    if (left >= right || left < previousLeft || (left === previousLeft && right <= previousRight)) invalid();
    const a = ids[left], b = ids[right]; pairs[i] = a < b ? [a, b] : [b, a]; previousLeft = left; previousRight = right;
  }
  pairs.sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
  return pairs;
}
function captureContacts(value) {
  const source = passiveArray(value, ContactHistory2DError); const contacts = new Array(source.length);
  let previousLeft = -1, previousRight = -1;
  for (let i = 0; i < source.length; i += 1) {
    const record = passiveRecord(itemAt(source, i), ["ids", "activeTicks", "missingTicks"], ContactHistory2DError);
    const pair = passiveArray(valueAt(record, "ids"), ContactHistory2DError, 2);
    const left = safeInteger(itemAt(pair, 0), ContactHistory2DError, 0), right = safeInteger(itemAt(pair, 1), ContactHistory2DError, 0);
    const activeTicks = safeInteger(valueAt(record, "activeTicks"), ContactHistory2DError, 1);
    const missingTicks = safeInteger(valueAt(record, "missingTicks"), ContactHistory2DError, 0);
    if (left >= right || left < previousLeft || (left === previousLeft && right <= previousRight)) invalid();
    contacts[i] = [left, right, activeTicks, missingTicks]; previousLeft = left; previousRight = right;
  }
  return contacts;
}

/** Advance sorted caller-ID contact history. Implements spatial.contact-history-2d 0.1.0. */
export function contactHistory2D(input) {
  const record = passiveRecord(input, KEYS, ContactHistory2DError);
  const ids = captureIds(valueAt(record, "ids"));
  const pairs = capturePairs(valueAt(record, "pairs"), ids);
  const contacts = captureContacts(valueAt(record, "contacts"));
  const lingerSteps = safeInteger(valueAt(record, "lingerSteps"), ContactHistory2DError, 0);
  const maxWork = safeInteger(valueAt(record, "maxWork"), ContactHistory2DError, 0);
  const work = ids.length + pairs.length + contacts.length;
  if (!Number.isSafeInteger(work) || work > maxWork) throw new ContactHistory2DError("WORK_LIMIT");
  const liveIds = new Set(ids); const output = []; let current = 0, history = 0;
  while (current < pairs.length || history < contacts.length) {
    const pair = current < pairs.length ? pairs[current] : undefined;
    const old = history < contacts.length ? contacts[history] : undefined;
    const compare = old === undefined ? -1 : pair === undefined ? 1 : pair[0] !== old[0] ? pair[0] - old[0] : pair[1] - old[1];
    if (compare < 0) { output.push({ ids: [pair[0], pair[1]], activeTicks: 1, missingTicks: 0 }); current += 1; continue; }
    if (compare > 0) {
      if (liveIds.has(old[0]) && liveIds.has(old[1]) && old[3] < lingerSteps) {
        if (old[3] === MAX_SAFE) throw new ContactHistory2DError("NUMERIC_OVERFLOW");
        output.push({ ids: [old[0], old[1]], activeTicks: old[2], missingTicks: old[3] + 1 });
      }
      history += 1; continue;
    }
    if (old[2] === MAX_SAFE) throw new ContactHistory2DError("NUMERIC_OVERFLOW");
    output.push({ ids: [pair[0], pair[1]], activeTicks: old[2] + 1, missingTicks: 0 }); current += 1; history += 1;
  }
  return { contacts: output };
}
