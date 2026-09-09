/*
 * Direct JavaScript translation of netlib fdlibm e_hypot.c 1.3 (95/01/18).
 * Source: https://www.netlib.org/fdlibm/e_hypot.c
 * Source SHA-256: 87425adcaeabfebcf9f78ba774f4b29d2a158c1f948e2b3129e74b5d6e9cc2ff
 *
 * ====================================================
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================
 *
 * Translation correction: after the original subnormal path multiplies a and b
 * by 2^1022, refresh their high words before the split formulas. The saved C
 * words describe the unscaled operands and cannot describe those scaled values.
 * This correction is deliberate and is not taken from OpenJDK source.
 */

const BUFFER = new ArrayBuffer(8);
const VIEW = new DataView(BUFFER);
const WORD_MASK = 0xffffffffn;

function bitsOf(value) {
  VIEW.setFloat64(0, value, false);
  return VIEW.getBigUint64(0, false);
}

function fromBits(bits) {
  VIEW.setBigUint64(0, bits & 0xffffffffffffffffn, false);
  return VIEW.getFloat64(0, false);
}

function highWord(value) {
  return Number(bitsOf(value) >> 32n) >>> 0;
}

function lowWord(value) {
  return Number(bitsOf(value) & WORD_MASK) >>> 0;
}

function withHighWord(value, high) {
  return fromBits((BigInt(high >>> 0) << 32n) | (bitsOf(value) & WORD_MASK));
}

function positiveZero(value) {
  return value === 0 ? 0 : value;
}

/**
 * Internal fdlibm e_hypot candidate. It has no public package export.
 */
export function fdlibmHypot(x, y) {
  let a = x;
  let b = y;
  let ha = highWord(x) & 0x7fffffff;
  let hb = highWord(y) & 0x7fffffff;

  if (hb > ha) {
    const value = a;
    a = b;
    b = value;
    const word = ha;
    ha = hb;
    hb = word;
  }
  a = withHighWord(a, ha);
  b = withHighWord(b, hb);
  if (ha - hb > 0x3c00000) return positiveZero(a + b);

  let k = 0;
  if (ha > 0x5f300000) {
    if (ha >= 0x7ff00000) {
      let w = a + b;
      if (((ha & 0xfffff) | lowWord(a)) === 0) w = a;
      if (((hb ^ 0x7ff00000) | lowWord(b)) === 0) w = b;
      return positiveZero(w);
    }
    ha -= 0x25800000;
    hb -= 0x25800000;
    k += 600;
    a = withHighWord(a, ha);
    b = withHighWord(b, hb);
  }

  if (hb < 0x20b00000) {
    if (hb <= 0x000fffff) {
      if ((hb | lowWord(b)) === 0) return positiveZero(a);
      let t1 = withHighWord(0, 0x7fd00000);
      b *= t1;
      a *= t1;
      k -= 1022;
      // See the documented translation correction above.
      ha = highWord(a) & 0x7fffffff;
      hb = highWord(b) & 0x7fffffff;
    } else {
      ha += 0x25800000;
      hb += 0x25800000;
      k -= 600;
      a = withHighWord(a, ha);
      b = withHighWord(b, hb);
    }
  }

  let w = a - b;
  if (w > b) {
    let t1 = withHighWord(0, ha);
    const t2 = a - t1;
    w = Math.sqrt(t1 * t1 - (b * (-b) - t2 * (a + t1)));
  } else {
    a = a + a;
    const y1 = withHighWord(0, hb);
    const y2 = b - y1;
    const t1 = withHighWord(0, ha + 0x00100000);
    const t2 = a - t1;
    w = Math.sqrt(t1 * y1 - (w * (-w) - (t1 * y2 + t2 * b)));
  }
  if (k !== 0) {
    const t1 = withHighWord(1, highWord(1) + k * 0x00100000);
    return positiveZero(t1 * w);
  }
  return positiveZero(w);
}
