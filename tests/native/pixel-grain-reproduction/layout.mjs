const MASK_48 = (1n << 48n) - 1n;
const MULTIPLIER = 0x5deece66dn;
const ADDEND = 0xbn;
const TWO_POW_24 = 16777216;

function seedState(seed) {
  if (typeof seed !== "number" || !Number.isFinite(seed) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new TypeError("seed must be a uint32");
  }
  return (BigInt(seed) ^ MULTIPLIER) & MASK_48;
}

function next24(state) {
  const next = (state * MULTIPLIER + ADDEND) & MASK_48;
  return [next, Number(next >> 24n)];
}

function random100(state) {
  let nextState = state;
  let value;
  let draws = 0;
  do {
    let bits;
    [nextState, bits] = next24(nextState);
    draws += 1;
    value = Math.fround((bits / TWO_POW_24) * 100);
  } while (value === 100);
  return [nextState, value, draws];
}

/**
 * Private reproduction replay for the surveyed pixel-grain layout. It is not a
 * package API and intentionally models Processing's java.util.Random path.
 */
export function pixelGrainLayout(seed) {
  let state = seedState(seed);
  let consumedDraws = 0;
  const points = [];
  for (let row = 0; row < 24; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      for (let y = 0; y < 2; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          let value;
          let draws;
          [state, value, draws] = random100(state);
          consumedDraws += draws;
          if (value < 30) continue;
          points.push([30 + column * 80 + x * 9, 40 + row * 30 + y * 9]);
        }
      }
    }
  }
  return { points, consumedDraws };
}
