/**
 * JavaScript translation of netlib fdlibm 5.3:
 * https://www.netlib.org/fdlibm/
 * s_sin.c, s_cos.c, k_sin.c, k_cos.c, e_rem_pio2.c, k_rem_pio2.c,
 * s_scalbn.c, s_atan.c, e_atan2.c.
 *
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 *
 * Shared numerical implementation; not a public package export.
 */

// --- shared 64-bit bit-pattern scratch (high/low 32-bit words, big-endian). ---
const TRIG_BUFFER = new ArrayBuffer(8);
const TRIG_VIEW = new DataView(TRIG_BUFFER);
function hi32(x) { TRIG_VIEW.setFloat64(0, x, false); return TRIG_VIEW.getInt32(0, false); }
function lo32(x) { TRIG_VIEW.setFloat64(0, x, false); return TRIG_VIEW.getInt32(4, false); }
function withBits(hi, lo) { TRIG_VIEW.setInt32(0, hi | 0, false); TRIG_VIEW.setInt32(4, lo | 0, false); return TRIG_VIEW.getFloat64(0, false); }
function withHi(x, hi) { return withBits(hi, lo32(x)); }

// s_scalbn.c
const SCALBN_TWO54 = 1.80143985094819840000e+16;
const SCALBN_TWOM54 = 5.55111512312578270212e-17;
const SCALBN_HUGE = 1.0e+300;
const SCALBN_TINY = 1.0e-300;
function copysign(x, y) { return y < 0 || Object.is(y, -0) ? -Math.abs(x) : Math.abs(x); }
function scalbn(x, n) {
  let hx = hi32(x);
  const lx = lo32(x);
  let k = (hx & 0x7ff00000) >> 20;
  if (k === 0) {
    if ((lx | (hx & 0x7fffffff)) === 0) return x;
    x = x * SCALBN_TWO54;
    hx = hi32(x);
    k = ((hx & 0x7ff00000) >> 20) - 54;
    if (n < -50000) return SCALBN_TINY * x;
  }
  if (k === 0x7ff) return x + x;
  k = k + n;
  if (k > 0x7fe) return SCALBN_HUGE * copysign(SCALBN_HUGE, x);
  if (k > 0) return withHi(x, (hx & 0x800fffff) | (k << 20));
  if (k <= -54) {
    if (n > 50000) return SCALBN_HUGE * copysign(SCALBN_HUGE, x);
    return SCALBN_TINY * copysign(SCALBN_TINY, x);
  }
  k += 54;
  x = withHi(x, (hx & 0x800fffff) | (k << 20));
  return x * SCALBN_TWOM54;
}

// k_sin.c
const KSIN_HALF = 5.00000000000000000000e-01;
const KSIN_S1 = -1.66666666666666324348e-01;
const KSIN_S2 = 8.33333333332248946124e-03;
const KSIN_S3 = -1.98412698298579493134e-04;
const KSIN_S4 = 2.75573137070700676789e-06;
const KSIN_S5 = -2.50507602534068634195e-08;
const KSIN_S6 = 1.58969099521155010221e-10;
function kernelSin(x, y, iy) {
  const ix = hi32(x) & 0x7fffffff;
  if (ix < 0x3e400000) { if (((x) | 0) === 0) return x; }
  const z = x * x;
  const v = z * x;
  const r = KSIN_S2 + z * (KSIN_S3 + z * (KSIN_S4 + z * (KSIN_S5 + z * KSIN_S6)));
  if (iy === 0) return x + v * (KSIN_S1 + z * r);
  return x - ((z * (KSIN_HALF * y - v * r) - y) - v * KSIN_S1);
}

// k_cos.c
const KCOS_ONE = 1.00000000000000000000e+00;
const KCOS_C1 = 4.16666666666666019037e-02;
const KCOS_C2 = -1.38888888888741095749e-03;
const KCOS_C3 = 2.48015872894767294178e-05;
const KCOS_C4 = -2.75573143513906633035e-07;
const KCOS_C5 = 2.08757232129817482790e-09;
const KCOS_C6 = -1.13596475577881948265e-11;
function kernelCos(x, y) {
  const ix = hi32(x) & 0x7fffffff;
  if (ix < 0x3e400000) { if (((x) | 0) === 0) return KCOS_ONE; }
  const z = x * x;
  const r = z * (KCOS_C1 + z * (KCOS_C2 + z * (KCOS_C3 + z * (KCOS_C4 + z * (KCOS_C5 + z * KCOS_C6)))));
  if (ix < 0x3fd33333) return KCOS_ONE - (0.5 * z - (z * r - x * y));
  let qx;
  if (ix > 0x3fe90000) {
    qx = 0.28125;
  } else {
    qx = withBits(ix - 0x00200000, 0);
  }
  const hz = 0.5 * z - qx;
  const a = KCOS_ONE - qx;
  return a - (hz - (z * r - x * y));
}

// e_rem_pio2.c
const TWO_OVER_PI = [
  0xA2F983, 0x6E4E44, 0x1529FC, 0x2757D1, 0xF534DD, 0xC0DB62,
  0x95993C, 0x439041, 0xFE5163, 0xABDEBB, 0xC561B7, 0x246E3A,
  0x424DD2, 0xE00649, 0x2EEA09, 0xD1921C, 0xFE1DEB, 0x1CB129,
  0xA73EE8, 0x8235F5, 0x2EBB44, 0x84E99C, 0x7026B4, 0x5F7E41,
  0x3991D6, 0x398353, 0x39F49C, 0x845F8B, 0xBDF928, 0x3B1FF8,
  0x97FFDE, 0x05980F, 0xEF2F11, 0x8B5A0A, 0x6D1F6D, 0x367ECF,
  0x27CB09, 0xB74F46, 0x3F669E, 0x5FEA2D, 0x7527BA, 0xC7EBE5,
  0xF17B3D, 0x0739F7, 0x8A5292, 0xEA6BFB, 0x5FB11F, 0x8D5D08,
  0x560330, 0x46FC7B, 0x6BABF0, 0xCFBC20, 0x9AF436, 0x1DA9E3,
  0x91615E, 0xE61B08, 0x659985, 0x5F14A0, 0x68408D, 0xFFD880,
  0x4D7327, 0x310606, 0x1556CA, 0x73A8C9, 0x60E27B, 0xC08C6B,
];
const NPIO2_HW = [
  0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C,
  0x4025FDBB, 0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C,
  0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A,
  0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
  0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB,
  0x404858EB, 0x404921FB,
];
const REM_HALF = 5.00000000000000000000e-01;
const REM_TWO24 = 1.67772160000000000000e+07;
const REM_INVPIO2 = 6.36619772367581382433e-01;
const REM_PIO2_1 = 1.57079632673412561417e+00;
const REM_PIO2_1T = 6.07710050650619224932e-11;
const REM_PIO2_2 = 6.07710050630396597660e-11;
const REM_PIO2_2T = 2.02226624879595063154e-21;
const REM_PIO2_3 = 2.02226624871116645580e-21;
const REM_PIO2_3T = 8.47842766036889956997e-32;

// k_rem_pio2.c
const INIT_JK = [2, 3, 4, 6];
const PIO2 = [
  1.57079625129699707031e+00, 7.54978941586159635335e-08, 5.39030252995776476554e-15,
  3.28200341580791294123e-22, 1.27065575308067607349e-29, 1.22933308981111328932e-36,
  2.73370053816464559624e-44, 2.16741683877804819444e-51,
];
const KREM_TWO24 = 1.67772160000000000000e+07;
const KREM_TWON24 = 5.96046447753906250000e-08;

function kernelRemPio2(x, y, e0, nx, prec, ipio2) {
  const iq = new Array(20).fill(0);
  const f = new Array(20).fill(0);
  const fq = new Array(20).fill(0);
  const q = new Array(20).fill(0);
  let jz, jx, jv, jp, jk, carry, n, i, j, k, m, q0, ih;
  let z, fw;

  jk = INIT_JK[prec];
  jp = jk;
  jx = nx - 1;
  jv = Math.trunc((e0 - 3) / 24);
  if (jv < 0) jv = 0;
  q0 = e0 - 24 * (jv + 1);

  j = jv - jx; m = jx + jk;
  for (i = 0; i <= m; i++, j++) f[i] = (j < 0) ? 0.0 : ipio2[j];

  for (i = 0; i <= jk; i++) {
    fw = 0.0;
    for (j = 0; j <= jx; j++) fw += x[j] * f[jx + i - j];
    q[i] = fw;
  }

  jz = jk;
  for (;;) {
    i = 0; j = jz; z = q[jz];
    for (; j > 0; i++, j--) {
      fw = Math.trunc(KREM_TWON24 * z);
      iq[i] = Math.trunc(z - KREM_TWO24 * fw);
      z = q[j - 1] + fw;
    }

    z = scalbn(z, q0);
    z -= 8.0 * Math.floor(z * 0.125);
    n = Math.trunc(z);
    z -= n;
    ih = 0;
    if (q0 > 0) {
      i = (iq[jz - 1] >> (24 - q0)); n += i;
      iq[jz - 1] -= i << (24 - q0);
      ih = iq[jz - 1] >> (23 - q0);
    } else if (q0 === 0) {
      ih = iq[jz - 1] >> 23;
    } else if (z >= 0.5) {
      ih = 2;
    }

    if (ih > 0) {
      n += 1; carry = 0;
      for (i = 0; i < jz; i++) {
        j = iq[i];
        if (carry === 0) {
          if (j !== 0) { carry = 1; iq[i] = 0x1000000 - j; }
        } else {
          iq[i] = 0xffffff - j;
        }
      }
      if (q0 > 0) {
        if (q0 === 1) iq[jz - 1] &= 0x7fffff;
        else if (q0 === 2) iq[jz - 1] &= 0x3fffff;
      }
      if (ih === 2) {
        z = 1.0 - z;
        if (carry !== 0) z -= scalbn(1.0, q0);
      }
    }

    if (z === 0.0) {
      j = 0;
      for (i = jz - 1; i >= jk; i--) j |= iq[i];
      if (j === 0) {
        let kk;
        for (kk = 1; iq[jk - kk] === 0; kk++) { /* count */ }
        for (i = jz + 1; i <= jz + kk; i++) {
          f[jx + i] = ipio2[jv + i];
          fw = 0.0;
          for (j = 0; j <= jx; j++) fw += x[j] * f[jx + i - j];
          q[i] = fw;
        }
        jz += kk;
        continue;
      }
    }
    break;
  }

  if (z === 0.0) {
    jz -= 1; q0 -= 24;
    while (iq[jz] === 0) { jz--; q0 -= 24; }
  } else {
    z = scalbn(z, -q0);
    if (z >= KREM_TWO24) {
      fw = Math.trunc(KREM_TWON24 * z);
      iq[jz] = Math.trunc(z - KREM_TWO24 * fw);
      jz += 1; q0 += 24;
      iq[jz] = fw;
    } else {
      iq[jz] = Math.trunc(z);
    }
  }

  fw = scalbn(1.0, q0);
  for (i = jz; i >= 0; i--) { q[i] = fw * iq[i]; fw *= KREM_TWON24; }

  for (i = jz; i >= 0; i--) {
    fw = 0.0;
    for (k = 0; k <= jp && k <= jz - i; k++) fw += PIO2[k] * q[i + k];
    fq[jz - i] = fw;
  }

  if (prec === 0) {
    fw = 0.0;
    for (i = jz; i >= 0; i--) fw += fq[i];
    y[0] = (ih === 0) ? fw : -fw;
  } else if (prec === 1 || prec === 2) {
    fw = 0.0;
    for (i = jz; i >= 0; i--) fw += fq[i];
    y[0] = (ih === 0) ? fw : -fw;
    fw = fq[0] - fw;
    for (i = 1; i <= jz; i++) fw += fq[i];
    y[1] = (ih === 0) ? fw : -fw;
  } else {
    for (i = jz; i > 0; i--) {
      fw = fq[i - 1] + fq[i];
      fq[i] += fq[i - 1] - fw;
      fq[i - 1] = fw;
    }
    for (i = jz; i > 1; i--) {
      fw = fq[i - 1] + fq[i];
      fq[i] += fq[i - 1] - fw;
      fq[i - 1] = fw;
    }
    fw = 0.0;
    for (i = jz; i >= 2; i--) fw += fq[i];
    if (ih === 0) { y[0] = fq[0]; y[1] = fq[1]; y[2] = fw; }
    else { y[0] = -fq[0]; y[1] = -fq[1]; y[2] = -fw; }
  }
  return n & 7;
}

function ieee754RemPio2(x, y) {
  const hx = hi32(x);
  const ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) { y[0] = x; y[1] = 0; return 0; }
  if (ix < 0x4002d97c) {
    if (hx > 0) {
      let z = x - REM_PIO2_1;
      if (ix !== 0x3ff921fb) {
        y[0] = z - REM_PIO2_1T;
        y[1] = (z - y[0]) - REM_PIO2_1T;
      } else {
        z -= REM_PIO2_2;
        y[0] = z - REM_PIO2_2T;
        y[1] = (z - y[0]) - REM_PIO2_2T;
      }
      return 1;
    }
    let z = x + REM_PIO2_1;
    if (ix !== 0x3ff921fb) {
      y[0] = z + REM_PIO2_1T;
      y[1] = (z - y[0]) + REM_PIO2_1T;
    } else {
      z += REM_PIO2_2;
      y[0] = z + REM_PIO2_2T;
      y[1] = (z - y[0]) + REM_PIO2_2T;
    }
    return -1;
  }
  if (ix <= 0x413921fb) {
    const t = Math.abs(x);
    const n = Math.trunc(t * REM_INVPIO2 + REM_HALF);
    const fn = n;
    let r = t - fn * REM_PIO2_1;
    let w = fn * REM_PIO2_1T;
    if (n < 32 && ix !== NPIO2_HW[n - 1]) {
      y[0] = r - w;
    } else {
      const j = ix >> 20;
      y[0] = r - w;
      let i = j - ((hi32(y[0]) >> 20) & 0x7ff);
      if (i > 16) {
        const t2 = r;
        w = fn * REM_PIO2_2;
        r = t2 - w;
        w = fn * REM_PIO2_2T - ((t2 - r) - w);
        y[0] = r - w;
        i = j - ((hi32(y[0]) >> 20) & 0x7ff);
        if (i > 49) {
          const t3 = r;
          w = fn * REM_PIO2_3;
          r = t3 - w;
          w = fn * REM_PIO2_3T - ((t3 - r) - w);
          y[0] = r - w;
        }
      }
    }
    y[1] = (r - y[0]) - w;
    if (hx < 0) { y[0] = -y[0]; y[1] = -y[1]; return -n; }
    return n;
  }
  if (ix >= 0x7ff00000) { y[0] = y[1] = x - x; return 0; }
  let z = withBits(ix, lo32(x));
  const e0 = (ix >> 20) - 1046;
  z = withBits(ix - (e0 << 20), lo32(z));
  const tx = [0, 0, 0];
  for (let i = 0; i < 2; i++) {
    tx[i] = Math.trunc(z);
    z = (z - tx[i]) * REM_TWO24;
  }
  tx[2] = z;
  let nx = 3;
  while (tx[nx - 1] === 0.0) nx--;
  const n = kernelRemPio2(tx, y, e0, nx, 2, TWO_OVER_PI);
  if (hx < 0) { y[0] = -y[0]; y[1] = -y[1]; return -n; }
  return n;
}

// s_sin.c
export function fdlibmSin(x) {
  const ix = hi32(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelSin(x, 0.0, 0);
  if (ix >= 0x7ff00000) return x - x;
  const y = [0, 0];
  const n = ieee754RemPio2(x, y);
  switch (n & 3) {
    case 0: return kernelSin(y[0], y[1], 1);
    case 1: return kernelCos(y[0], y[1]);
    case 2: return -kernelSin(y[0], y[1], 1);
    default: return -kernelCos(y[0], y[1]);
  }
}

// s_cos.c
export function fdlibmCos(x) {
  const ix = hi32(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelCos(x, 0.0);
  if (ix >= 0x7ff00000) return x - x;
  const y = [0, 0];
  const n = ieee754RemPio2(x, y);
  switch (n & 3) {
    case 0: return kernelCos(y[0], y[1]);
    case 1: return -kernelSin(y[0], y[1], 1);
    case 2: return -kernelCos(y[0], y[1]);
    default: return kernelSin(y[0], y[1], 1);
  }
}

// s_atan.c
const ATAN_HI = [
  4.63647609000806093515e-01, 7.85398163397448278999e-01,
  9.82793723247329054082e-01, 1.57079632679489655800e+00,
];
const ATAN_LO = [
  2.26987774529616870924e-17, 3.06161699786838301793e-17,
  1.39033110312309984516e-17, 6.12323399573676603587e-17,
];
const ATAN_AT = [
  3.33333333333329318027e-01, -1.99999999998764832476e-01,
  1.42857142725034663711e-01, -1.11111104054623557880e-01,
  9.09088713343650656196e-02, -7.69187620504482999495e-02,
  6.66107313738753120669e-02, -5.83357013379057348645e-02,
  4.97687799461593236017e-02, -3.65315727442169155270e-02,
  1.62858201153657823623e-02,
];
const ATAN_HUGE = 1.0e300;
export function fdlibmAtan(x) {
  let hx = hi32(x);
  let ix = hx & 0x7fffffff;
  if (ix >= 0x44100000) {
    if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lo32(x) !== 0)) return x + x;
    return hx > 0 ? ATAN_HI[3] + ATAN_LO[3] : -ATAN_HI[3] - ATAN_LO[3];
  }
  let id;
  if (ix < 0x3fdc0000) {
    if (ix < 0x3e200000) {
      if (ATAN_HUGE + x > 1.0) return x;
    }
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) { id = 0; x = (2.0 * x - 1.0) / (2.0 + x); }
      else { id = 1; x = (x - 1.0) / (x + 1.0); }
    } else if (ix < 0x40038000) { id = 2; x = (x - 1.5) / (1.0 + 1.5 * x); }
    else { id = 3; x = -1.0 / x; }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (ATAN_AT[0] + w * (ATAN_AT[2] + w * (ATAN_AT[4] + w * (ATAN_AT[6] + w * (ATAN_AT[8] + w * ATAN_AT[10])))));
  const s2 = w * (ATAN_AT[1] + w * (ATAN_AT[3] + w * (ATAN_AT[5] + w * (ATAN_AT[7] + w * ATAN_AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const result = ATAN_HI[id] - ((x * (s1 + s2) - ATAN_LO[id]) - x);
  return hx < 0 ? -result : result;
}

// e_atan2.c
const ATAN2_TINY = 1.0e-300;
const ATAN2_PI_O_4 = 7.8539816339744827900e-01;
const ATAN2_PI_O_2 = 1.5707963267948965580e+00;
const ATAN2_PI = 3.1415926535897931160e+00;
const ATAN2_PI_LO = 1.2246467991473531772e-16;
function lowNonzeroMask(lx) { return (lx | -lx) >>> 31; }
export function fdlibmAtan2(y, x) {
  const hx = hi32(x), ix = hx & 0x7fffffff, lx = lo32(x);
  const hy = hi32(y), iy = hy & 0x7fffffff, ly = lo32(y);
  if ((ix | lowNonzeroMask(lx)) > 0x7ff00000 || (iy | lowNonzeroMask(ly)) > 0x7ff00000) return x + y;
  if ((((hx - 0x3ff00000) | lx) >>> 0) === 0) return fdlibmAtan(y);
  const m = ((hy >>> 31) & 1) | ((hx >>> 30) & 2);
  if ((iy | ly) === 0) {
    switch (m) {
      case 0: case 1: return y;
      case 2: return ATAN2_PI + ATAN2_TINY;
      default: return -ATAN2_PI - ATAN2_TINY;
    }
  }
  if ((ix | lx) === 0) return hy < 0 ? -ATAN2_PI_O_2 - ATAN2_TINY : ATAN2_PI_O_2 + ATAN2_TINY;
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) {
      switch (m) {
        case 0: return ATAN2_PI_O_4 + ATAN2_TINY;
        case 1: return -ATAN2_PI_O_4 - ATAN2_TINY;
        case 2: return 3.0 * ATAN2_PI_O_4 + ATAN2_TINY;
        default: return -3.0 * ATAN2_PI_O_4 - ATAN2_TINY;
      }
    }
    switch (m) {
      case 0: return 0.0;
      case 1: return -0.0;
      case 2: return ATAN2_PI + ATAN2_TINY;
      default: return -ATAN2_PI - ATAN2_TINY;
    }
  }
  if (iy === 0x7ff00000) return hy < 0 ? -ATAN2_PI_O_2 - ATAN2_TINY : ATAN2_PI_O_2 + ATAN2_TINY;
  const k = (iy - ix) >> 20;
  let z;
  if (k > 60) z = ATAN2_PI_O_2 + 0.5 * ATAN2_PI_LO;
  else if (hx < 0 && k < -60) z = 0.0;
  else z = fdlibmAtan(Math.abs(y / x));
  switch (m) {
    case 0: return z;
    case 1: return withHi(z, hi32(z) ^ 0x80000000);
    case 2: return ATAN2_PI - (z - ATAN2_PI_LO);
    default: return (z - ATAN2_PI_LO) - ATAN2_PI;
  }
}
