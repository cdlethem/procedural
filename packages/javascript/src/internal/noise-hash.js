// Internal arithmetic, not exported by the package entry point.
// lowbias32: skeeto/hash-prospector, Unlicense; see THIRD_PARTY_NOTICES.md.
function unsigned32(value) {
  return value >>> 0;
}

export function mix32(value) {
  let mixed = unsigned32(value);
  mixed = unsigned32(mixed ^ (mixed >>> 16));
  mixed = unsigned32(Math.imul(mixed, 0x7feb352d));
  mixed = unsigned32(mixed ^ (mixed >>> 15));
  mixed = unsigned32(Math.imul(mixed, 0x846ca68b));
  return unsigned32(mixed ^ (mixed >>> 16));
}

export function cornerHash(seed, i, j) {
  const a = mix32(unsigned32(seed ^ unsigned32(i) ^ 0x9e3779b9));
  return mix32(unsigned32(a ^ unsigned32(j) ^ 0x85ebca6b));
}

