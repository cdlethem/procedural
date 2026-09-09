/**
 * JavaScript translation of netlib fdlibm 5.3 e_pow.c, revision 1.5 (2004-04-22):
 * https://www.netlib.org/fdlibm/e_pow.c
 *
 * Copyright (C) 2004 by Sun Microsystems, Inc. All rights reserved.
 *
 * Permission to use, copy, modify, and distribute this software is freely granted,
 * provided that this notice is preserved.
 *
 * The bit-word helpers replace C's __HI/__LO lvalue macros. The algorithm, constants,
 * branch order, and binary64 operations are a direct translation of e_pow.c; this is
 * not derived from OpenJDK's FdLibm.java. See THIRD_PARTY_NOTICES.md for the audited
 * source digest.
 */
const INFINITY = Infinity;

// --- shared 64-bit bit-pattern scratch (high/low 32-bit words, big-endian). ---
const BIT_BUFFER = new ArrayBuffer(8);
const BIT_VIEW = new DataView(BIT_BUFFER);
function hi32(x) { BIT_VIEW.setFloat64(0, x, false); return BIT_VIEW.getInt32(0, false); }
function lo32(x) { BIT_VIEW.setFloat64(0, x, false); return BIT_VIEW.getInt32(4, false); }
function withBits(hi, lo) { BIT_VIEW.setInt32(0, hi | 0, false); BIT_VIEW.setInt32(4, lo | 0, false); return BIT_VIEW.getFloat64(0, false); }
function withHi(x, hi) { return withBits(hi, lo32(x)); }
function withLo(x, lo) { return withBits(hi32(x), lo); }

/* s_scalbn.c — https://www.netlib.org/fdlibm/s_scalbn.c
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 */
const SCALBN_TWO54 = 1.80143985094819840000e+16;
const SCALBN_TWOM54 = 5.55111512312578270212e-17;
const SCALBN_HUGE = 1.0e+300;
const SCALBN_TINY = 1.0e-300;
function copysign(x, y) { return (y < 0 || Object.is(y, -0)) ? -Math.abs(x) : Math.abs(x); }
function scalbn(x, n) {
  let hx = hi32(x);
  let lx = lo32(x);
  let k = (hx & 0x7ff00000) >> 20;
  if (k === 0) {
    if ((lx | (hx & 0x7fffffff)) === 0) return x;
    x *= SCALBN_TWO54;
    hx = hi32(x);
    k = ((hx & 0x7ff00000) >> 20) - 54;
    if (n < -50000) return SCALBN_TINY * x;
  }
  if (k === 0x7ff) return x + x;
  k = k + n;
  if (k > 0x7fe) return copysign(SCALBN_HUGE, x) * SCALBN_HUGE;
  if (k > 0) return withHi(x, (hx & 0x800fffff) | (k << 20));
  if (k <= -54) {
    if (n > 50000) return copysign(SCALBN_HUGE, x) * SCALBN_HUGE;
    return copysign(SCALBN_TINY, x) * SCALBN_TINY;
  }
  k += 54;
  x = withHi(x, (hx & 0x800fffff) | (k << 20));
  return x * SCALBN_TWOM54;
}

const INV_LN2 = 1.4426950408889634;
const INV_LN2_H = 1.4426950216293335;
const INV_LN2_L = 1.9259629911266175e-08;
const CP = 0.9617966939259756;
const CP_H = 0.9617967009544373;
const CP_L = -7.028461650952758e-09;
const BP = [1.0, 1.5];
const DP_H = [0.0, 0.5849624872207642];
const DP_L = [0.0, 1.350039202129749e-08];
const L1 = 0.5999999999999946;
const L2 = 0.4285714285785502;
const L3 = 0.33333332981837743;
const L4 = 0.272728123808534;
const L5 = 0.23066074577556175;
const L6 = 0.20697501780033842;
const OVT = 8.0085662595372944372e-0017;
const P1 = 0.16666666666666602;
const P2 = -0.0027777777777015593;
const P3 = 6.613756321437934e-05;
const P4 = -1.6533902205465252e-06;
const P5 = 4.1381367970572385e-08;
const LG2 = 0.6931471805599453;
const LG2_H = 0.6931471824645996;
const LG2_L = -1.904654299957768e-09;

/**
 * fdlibm5.3 pow(x, y), matching java.lang.StrictMath.pow bit-for-bit.
 */
export function fdlibmPow(x, y) {
  // e_pow.c lines 107--177. Keep the word tests rather than Java convenience
  // predicates: they define the signed-zero, NaN, and integer-parity branches.
  const hx = hi32(x), lx = lo32(x), hy = hi32(y), ly = lo32(y);
  let ix = hx & 0x7fffffff, iy = hy & 0x7fffffff;
  if ((iy | ly) === 0) return 1.0;
  if (Number.isNaN(x) || Number.isNaN(y)) return x + y;
  let yIsInt = 0;
  if (hx < 0) {
    if (iy >= 0x43400000) yIsInt = 2;
    else if (iy >= 0x3ff00000) {
      const k = (iy >> 20) - 0x3ff;
      if (k > 20) {
        const j = (ly >>> (52 - k));
        if ((j << (52 - k)) === ly) yIsInt = 2 - (j & 1);
      } else if (ly === 0) {
        const j = iy >>> (20 - k);
        if ((j << (20 - k)) === iy) yIsInt = 2 - (j & 1);
      }
    }
  }

  if (ly === 0) {
    if (iy === 0x7ff00000) {
      if (((ix - 0x3ff00000) | lx) === 0) return y - y;
      if (ix >= 0x3ff00000) return hy >= 0 ? y : 0.0;
      return hy < 0 ? -y : 0.0;
    }
    if (iy === 0x3ff00000) return hy < 0 ? 1.0 / x : x;
    if (hy === 0x40000000) return x * x;
    if (hy === 0x3fe00000 && hx >= 0) return Math.sqrt(x);
  }

  let xAbs = Math.abs(x);

  if (lx === 0 && (ix === 0x7ff00000 || ix === 0 || ix === 0x3ff00000)) {
    let z = xAbs;
    if (hy < 0) z = 1.0 / z;
    if (hx < 0) {
      if (((ix - 0x3ff00000) | yIsInt) === 0) {
        z = (z - z) / (z - z);
      } else if (yIsInt === 1) {
        z = -1.0 * z;
      }
    }
    return z;
  }

  let n = (hx >> 31) + 1;

  if ((n | yIsInt) === 0) return (x - x) / (x - x);

  let s = 1.0;
  if ((n | (yIsInt - 1)) === 0) s = -1.0;

  let pH, pL, t1, t2;
  if (iy > 0x41e00000) {
    if (iy > 0x43f00000) {
      if (ix <= 0x3fefffff) return hy < 0 ? INFINITY : 0.0;
      if (ix >= 0x3ff00000) return hy > 0 ? INFINITY : 0.0;
    }
    if (ix < 0x3fefffff) return hy < 0 ? s * INFINITY : s * 0.0;
    if (ix > 0x3ff00000) return hy > 0 ? s * INFINITY : s * 0.0;
    const t = xAbs - 1.0;
    const w = (t * t) * (0.5 - t * (0.3333333333333333333333 - t * 0.25));
    const u = INV_LN2_H * t;
    const v = t * INV_LN2_L - w * INV_LN2;
    t1 = u + v;
    t1 = withLo(t1, 0);
    t2 = v - (t1 - u);
  } else {
    let k = 0;
    n = 0;
    if (ix < 0x00100000) {
      xAbs *= 9007199254740992.0;
      n -= 53;
      ix = hi32(xAbs);
    }
    n += (ix >> 20) - 0x3ff;
    const j = ix & 0x000fffff;
    ix = j | 0x3ff00000;
    if (j <= 0x3988e) k = 0;
    else if (j < 0xbb67a) k = 1;
    else { k = 0; n += 1; ix -= 0x00100000; }
    xAbs = withHi(xAbs, ix);

    const u = xAbs - BP[k];
    const v = 1.0 / (xAbs + BP[k]);
    let ss = u * v;
    let sH = ss;
    sH = withLo(sH, 0);
    let tH = 0.0;
    tH = withHi(tH, ((ix >> 1) | 0x20000000) + 0x00080000 + (k << 18));
    const tL = xAbs - (tH - BP[k]);
    const sL = v * ((u - sH * tH) - sH * tL);
    let s2 = ss * ss;
    let r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
    r += sL * (sH + ss);
    s2 = sH * sH;
    let tH2 = 3.0 + s2 + r;
    tH2 = withLo(tH2, 0);
    const tL2 = r - ((tH2 - 3.0) - s2);
    const u2 = sH * tH2;
    const v2 = sL * tH2 + tL2 * ss;
    pH = u2 + v2;
    pH = withLo(pH, 0);
    pL = v2 - (pH - u2);
    const zH = CP_H * pH;
    const zL = CP_L * pH + pL * CP + DP_L[k];
    const t = n;
    t1 = ((zH + zL) + DP_H[k]) + t;
    t1 = withLo(t1, 0);
    t2 = zL - (((t1 - t) - DP_H[k]) - zH);
  }

  const y1raw = y;
  let y1 = y1raw;
  y1 = withLo(y1, 0);
  pL = (y - y1) * t1 + y * t2;
  pH = y1 * t1;
  let z = pL + pH;
  let j2 = hi32(z);
  let i2 = lo32(z);
  if (j2 >= 0x40900000) {
    if (((j2 - 0x40900000) | i2) !== 0) return s * INFINITY;
    else {
      if (pL + OVT > z - pH) return s * INFINITY;
    }
  } else if ((j2 & 0x7fffffff) >= 0x4090cc00) {
    if (((j2 - 0xc090cc00) | i2) !== 0) return s * 0.0;
    else {
      if (pL <= z - pH) return s * 0.0;
    }
  }

  let i3 = j2 & 0x7fffffff;
  let k2 = (i3 >> 20) - 0x3ff;
  let n2 = 0;
  if (i3 > 0x3fe00000) {
    n2 = j2 + (0x00100000 >> (k2 + 1));
    k2 = ((n2 & 0x7fffffff) >> 20) - 0x3ff;
    let t = 0.0;
    t = withHi(t, (n2 & ~(0x000fffff >> k2)));
    n2 = ((n2 & 0x000fffff) | 0x00100000) >> (20 - k2);
    if (j2 < 0) n2 = -n2;
    pH -= t;
  }
  let t = pL + pH;
  t = withLo(t, 0);
  const u3 = t * LG2_H;
  const v3 = (pL - (t - pH)) * LG2 + t * LG2_L;
  z = u3 + v3;
  const w = v3 - (z - u3);
  let tt = z * z;
  let t1b = z - tt * (P1 + tt * (P2 + tt * (P3 + tt * (P4 + tt * P5))));
  let r2 = (z * t1b) / (t1b - 2.0) - (w + z * w);
  z = 1.0 - (r2 - z);
  let jz = hi32(z);
  jz += (n2 << 20);
  if ((jz >> 20) <= 0) {
    z = scalbn(z, n2);
  } else {
    let zHi = hi32(z);
    zHi += (n2 << 20);
    z = withHi(z, zHi);
  }
  return s * z;
}
