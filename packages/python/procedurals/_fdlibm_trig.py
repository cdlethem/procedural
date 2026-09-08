"""fdlibm5.3 sin/cos/atan/atan2, ported directly from the netlib fdlibm 5.3
distribution (s_sin.c, s_cos.c, k_sin.c, k_cos.c, e_rem_pio2.c, k_rem_pio2.c,
s_scalbn.c, s_atan.c, e_atan2.c; Copyright (C) 1993 by Sun Microsystems, Inc.;
"Permission to use, copy, modify, and distribute this software is freely
granted, provided that this notice is preserved.") for bit-exact parity with
java.lang.StrictMath.sin/cos/atan2, which is specified to match fdlibm5.3.
Every function below is a line-for-line translation of the corresponding C
function; comments cite the source file.
"""
import math
import struct

__all__ = ["fdlibm_sin", "fdlibm_cos", "fdlibm_atan", "fdlibm_atan2"]


def _bits(x):
    return struct.unpack(">Q", struct.pack(">d", x))[0]


def _from_bits(bits):
    return struct.unpack(">d", struct.pack(">Q", bits & 0xFFFFFFFFFFFFFFFF))[0]


def _hi32(x):
    hi = _bits(x) >> 32
    return hi - 0x100000000 if hi >= 0x80000000 else hi


def _lo32(x):
    lo = _bits(x) & 0xFFFFFFFF
    return lo - 0x100000000 if lo >= 0x80000000 else lo


def _with_bits(hi, lo):
    return _from_bits(((hi & 0xFFFFFFFF) << 32) | (lo & 0xFFFFFFFF))


def _with_hi(x, hi):
    return _with_bits(hi, _lo32(x))


def _trunc(value):
    return math.trunc(value)


# s_scalbn.c
_SCALBN_TWO54 = 1.80143985094819840000e+16
_SCALBN_TWOM54 = 5.55111512312578270212e-17
_SCALBN_HUGE = 1.0e+300
_SCALBN_TINY = 1.0e-300


def _copysign(x, y):
    return math.copysign(abs(x), y)


def _scalbn(x, n):
    hx = _hi32(x)
    lx = _lo32(x)
    k = (hx & 0x7ff00000) >> 20
    if k == 0:
        if (lx | (hx & 0x7fffffff)) == 0:
            return x
        x = x * _SCALBN_TWO54
        hx = _hi32(x)
        k = ((hx & 0x7ff00000) >> 20) - 54
        if n < -50000:
            return _SCALBN_TINY * x
    if k == 0x7ff:
        return x + x
    k = k + n
    if k > 0x7fe:
        return _SCALBN_HUGE * _copysign(_SCALBN_HUGE, x)
    if k > 0:
        return _with_hi(x, (hx & 0x800fffff) | (k << 20))
    if k <= -54:
        if n > 50000:
            return _SCALBN_HUGE * _copysign(_SCALBN_HUGE, x)
        return _SCALBN_TINY * _copysign(_SCALBN_TINY, x)
    k += 54
    x = _with_hi(x, (hx & 0x800fffff) | (k << 20))
    return x * _SCALBN_TWOM54


# k_sin.c
_KSIN_HALF = 5.00000000000000000000e-01
_KSIN_S1 = -1.66666666666666324348e-01
_KSIN_S2 = 8.33333333332248946124e-03
_KSIN_S3 = -1.98412698298579493134e-04
_KSIN_S4 = 2.75573137070700676789e-06
_KSIN_S5 = -2.50507602534068634195e-08
_KSIN_S6 = 1.58969099521155010221e-10


def _kernel_sin(x, y, iy):
    ix = _hi32(x) & 0x7fffffff
    if ix < 0x3e400000:
        if int(x) == 0:
            return x
    z = x * x
    v = z * x
    r = _KSIN_S2 + z * (_KSIN_S3 + z * (_KSIN_S4 + z * (_KSIN_S5 + z * _KSIN_S6)))
    if iy == 0:
        return x + v * (_KSIN_S1 + z * r)
    return x - ((z * (_KSIN_HALF * y - v * r) - y) - v * _KSIN_S1)


# k_cos.c
_KCOS_ONE = 1.00000000000000000000e+00
_KCOS_C1 = 4.16666666666666019037e-02
_KCOS_C2 = -1.38888888888741095749e-03
_KCOS_C3 = 2.48015872894767294178e-05
_KCOS_C4 = -2.75573143513906633035e-07
_KCOS_C5 = 2.08757232129817482790e-09
_KCOS_C6 = -1.13596475577881948265e-11


def _kernel_cos(x, y):
    ix = _hi32(x) & 0x7fffffff
    if ix < 0x3e400000:
        if int(x) == 0:
            return _KCOS_ONE
    z = x * x
    r = z * (_KCOS_C1 + z * (_KCOS_C2 + z * (_KCOS_C3 + z * (_KCOS_C4 + z * (_KCOS_C5 + z * _KCOS_C6)))))
    if ix < 0x3fd33333:
        return _KCOS_ONE - (0.5 * z - (z * r - x * y))
    if ix > 0x3fe90000:
        qx = 0.28125
    else:
        qx = _with_bits(ix - 0x00200000, 0)
    hz = 0.5 * z - qx
    a = _KCOS_ONE - qx
    return a - (hz - (z * r - x * y))


# e_rem_pio2.c
_TWO_OVER_PI = [
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
]
_NPIO2_HW = [
    0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C,
    0x4025FDBB, 0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C,
    0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A,
    0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
    0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB,
    0x404858EB, 0x404921FB,
]
_REM_HALF = 5.00000000000000000000e-01
_REM_TWO24 = 1.67772160000000000000e+07
_REM_INVPIO2 = 6.36619772367581382433e-01
_REM_PIO2_1 = 1.57079632673412561417e+00
_REM_PIO2_1T = 6.07710050650619224932e-11
_REM_PIO2_2 = 6.07710050630396597660e-11
_REM_PIO2_2T = 2.02226624879595063154e-21
_REM_PIO2_3 = 2.02226624871116645580e-21
_REM_PIO2_3T = 8.47842766036889956997e-32

# k_rem_pio2.c
_INIT_JK = [2, 3, 4, 6]
_PIO2 = [
    1.57079625129699707031e+00, 7.54978941586159635335e-08, 5.39030252995776476554e-15,
    3.28200341580791294123e-22, 1.27065575308067607349e-29, 1.22933308981111328932e-36,
    2.73370053816464559624e-44, 2.16741683877804819444e-51,
]
_KREM_TWO24 = 1.67772160000000000000e+07
_KREM_TWON24 = 5.96046447753906250000e-08


def _kernel_rem_pio2(x, y, e0, nx, prec, ipio2):
    iq = [0] * 20
    f = [0.0] * 20
    fq = [0.0] * 20
    q = [0.0] * 20

    jk = _INIT_JK[prec]
    jp = jk
    jx = nx - 1
    jv = _trunc((e0 - 3) / 24)
    if jv < 0:
        jv = 0
    q0 = e0 - 24 * (jv + 1)

    j = jv - jx
    m = jx + jk
    for i in range(m + 1):
        f[i] = 0.0 if j < 0 else float(ipio2[j])
        j += 1

    for i in range(jk + 1):
        fw = 0.0
        for j in range(jx + 1):
            fw += x[j] * f[jx + i - j]
        q[i] = fw

    jz = jk
    while True:
        i = 0
        j = jz
        z = q[jz]
        while j > 0:
            fw = float(_trunc(_KREM_TWON24 * z))
            iq[i] = _trunc(z - _KREM_TWO24 * fw)
            z = q[j - 1] + fw
            i += 1
            j -= 1

        z = _scalbn(z, q0)
        z -= 8.0 * math.floor(z * 0.125)
        n = _trunc(z)
        z -= float(n)
        ih = 0
        if q0 > 0:
            i = iq[jz - 1] >> (24 - q0)
            n += i
            iq[jz - 1] -= i << (24 - q0)
            ih = iq[jz - 1] >> (23 - q0)
        elif q0 == 0:
            ih = iq[jz - 1] >> 23
        elif z >= 0.5:
            ih = 2

        if ih > 0:
            n += 1
            carry = 0
            for i in range(jz):
                j = iq[i]
                if carry == 0:
                    if j != 0:
                        carry = 1
                        iq[i] = 0x1000000 - j
                else:
                    iq[i] = 0xffffff - j
            if q0 > 0:
                if q0 == 1:
                    iq[jz - 1] &= 0x7fffff
                elif q0 == 2:
                    iq[jz - 1] &= 0x3fffff
            if ih == 2:
                z = 1.0 - z
                if carry != 0:
                    z -= _scalbn(1.0, q0)

        recompute = False
        if z == 0.0:
            j = 0
            for i in range(jz - 1, jk - 1, -1):
                j |= iq[i]
            if j == 0:
                kk = 1
                while iq[jk - kk] == 0:
                    kk += 1
                for i in range(jz + 1, jz + kk + 1):
                    f[jx + i] = float(ipio2[jv + i])
                    fw = 0.0
                    for jj in range(jx + 1):
                        fw += x[jj] * f[jx + i - jj]
                    q[i] = fw
                jz += kk
                recompute = True
        if not recompute:
            break

    if z == 0.0:
        jz -= 1
        q0 -= 24
        while iq[jz] == 0:
            jz -= 1
            q0 -= 24
    else:
        z = _scalbn(z, -q0)
        if z >= _KREM_TWO24:
            fw = float(_trunc(_KREM_TWON24 * z))
            iq[jz] = _trunc(z - _KREM_TWO24 * fw)
            jz += 1
            q0 += 24
            iq[jz] = _trunc(fw)
        else:
            iq[jz] = _trunc(z)

    fw = _scalbn(1.0, q0)
    for i in range(jz, -1, -1):
        q[i] = fw * iq[i]
        fw *= _KREM_TWON24

    for i in range(jz, -1, -1):
        fw = 0.0
        k = 0
        while k <= jp and k <= jz - i:
            fw += _PIO2[k] * q[i + k]
            k += 1
        fq[jz - i] = fw

    if prec == 0:
        fw = 0.0
        for i in range(jz, -1, -1):
            fw += fq[i]
        y[0] = fw if ih == 0 else -fw
    elif prec in (1, 2):
        fw = 0.0
        for i in range(jz, -1, -1):
            fw += fq[i]
        y[0] = fw if ih == 0 else -fw
        fw = fq[0] - fw
        for i in range(1, jz + 1):
            fw += fq[i]
        y[1] = fw if ih == 0 else -fw
    else:
        for i in range(jz, 0, -1):
            fw = fq[i - 1] + fq[i]
            fq[i] += fq[i - 1] - fw
            fq[i - 1] = fw
        for i in range(jz, 1, -1):
            fw = fq[i - 1] + fq[i]
            fq[i] += fq[i - 1] - fw
            fq[i - 1] = fw
        fw = 0.0
        for i in range(jz, 1, -1):
            fw += fq[i]
        if ih == 0:
            y[0], y[1], y[2] = fq[0], fq[1], fw
        else:
            y[0], y[1], y[2] = -fq[0], -fq[1], -fw
    return n & 7


def _ieee754_rem_pio2(x, y):
    hx = _hi32(x)
    ix = hx & 0x7fffffff
    if ix <= 0x3fe921fb:
        y[0] = x
        y[1] = 0
        return 0
    if ix < 0x4002d97c:
        if hx > 0:
            z = x - _REM_PIO2_1
            if ix != 0x3ff921fb:
                y[0] = z - _REM_PIO2_1T
                y[1] = (z - y[0]) - _REM_PIO2_1T
            else:
                z -= _REM_PIO2_2
                y[0] = z - _REM_PIO2_2T
                y[1] = (z - y[0]) - _REM_PIO2_2T
            return 1
        z = x + _REM_PIO2_1
        if ix != 0x3ff921fb:
            y[0] = z + _REM_PIO2_1T
            y[1] = (z - y[0]) + _REM_PIO2_1T
        else:
            z += _REM_PIO2_2
            y[0] = z + _REM_PIO2_2T
            y[1] = (z - y[0]) + _REM_PIO2_2T
        return -1
    if ix <= 0x413921fb:
        t = abs(x)
        n = _trunc(t * _REM_INVPIO2 + _REM_HALF)
        fn = float(n)
        r = t - fn * _REM_PIO2_1
        w = fn * _REM_PIO2_1T
        if n < 32 and ix != _NPIO2_HW[n - 1]:
            y[0] = r - w
        else:
            j = ix >> 20
            y[0] = r - w
            i = j - ((_hi32(y[0]) >> 20) & 0x7ff)
            if i > 16:
                t2 = r
                w = fn * _REM_PIO2_2
                r = t2 - w
                w = fn * _REM_PIO2_2T - ((t2 - r) - w)
                y[0] = r - w
                i = j - ((_hi32(y[0]) >> 20) & 0x7ff)
                if i > 49:
                    t3 = r
                    w = fn * _REM_PIO2_3
                    r = t3 - w
                    w = fn * _REM_PIO2_3T - ((t3 - r) - w)
                    y[0] = r - w
        y[1] = (r - y[0]) - w
        if hx < 0:
            y[0] = -y[0]
            y[1] = -y[1]
            return -n
        return n
    if ix >= 0x7ff00000:
        y[0] = y[1] = x - x
        return 0
    z = _with_bits(ix, _lo32(x))
    e0 = (ix >> 20) - 1046
    z = _with_bits(ix - (e0 << 20), _lo32(z))
    tx = [0.0, 0.0, 0.0]
    for i in range(2):
        tx[i] = float(_trunc(z))
        z = (z - tx[i]) * _REM_TWO24
    tx[2] = z
    nx = 3
    while tx[nx - 1] == 0.0:
        nx -= 1
    n = _kernel_rem_pio2(tx, y, e0, nx, 2, _TWO_OVER_PI)
    if hx < 0:
        y[0] = -y[0]
        y[1] = -y[1]
        return -n
    return n


def fdlibm_sin(x):
    """fdlibm5.3 sin(x); bit-exact with java.lang.StrictMath.sin."""
    ix = _hi32(x) & 0x7fffffff
    if ix <= 0x3fe921fb:
        return _kernel_sin(x, 0.0, 0)
    if ix >= 0x7ff00000:
        return x - x
    y = [0.0, 0.0]
    n = _ieee754_rem_pio2(x, y)
    branch = n & 3
    if branch == 0:
        return _kernel_sin(y[0], y[1], 1)
    if branch == 1:
        return _kernel_cos(y[0], y[1])
    if branch == 2:
        return -_kernel_sin(y[0], y[1], 1)
    return -_kernel_cos(y[0], y[1])


def fdlibm_cos(x):
    """fdlibm5.3 cos(x); bit-exact with java.lang.StrictMath.cos."""
    ix = _hi32(x) & 0x7fffffff
    if ix <= 0x3fe921fb:
        return _kernel_cos(x, 0.0)
    if ix >= 0x7ff00000:
        return x - x
    y = [0.0, 0.0]
    n = _ieee754_rem_pio2(x, y)
    branch = n & 3
    if branch == 0:
        return _kernel_cos(y[0], y[1])
    if branch == 1:
        return -_kernel_sin(y[0], y[1], 1)
    if branch == 2:
        return -_kernel_cos(y[0], y[1])
    return _kernel_sin(y[0], y[1], 1)


# s_atan.c
_ATAN_HI = [
    4.63647609000806093515e-01, 7.85398163397448278999e-01,
    9.82793723247329054082e-01, 1.57079632679489655800e+00,
]
_ATAN_LO = [
    2.26987774529616870924e-17, 3.06161699786838301793e-17,
    1.39033110312309984516e-17, 6.12323399573676603587e-17,
]
_ATAN_AT = [
    3.33333333333329318027e-01, -1.99999999998764832476e-01,
    1.42857142725034663711e-01, -1.11111104054623557880e-01,
    9.09088713343650656196e-02, -7.69187620504482999495e-02,
    6.66107313738753120669e-02, -5.83357013379057348645e-02,
    4.97687799461593236017e-02, -3.65315727442169155270e-02,
    1.62858201153657823623e-02,
]
_ATAN_HUGE = 1.0e300


def fdlibm_atan(x):
    """fdlibm5.3 atan(x); bit-exact with java.lang.StrictMath.atan."""
    hx = _hi32(x)
    ix = hx & 0x7fffffff
    if ix >= 0x44100000:
        if ix > 0x7ff00000 or (ix == 0x7ff00000 and _lo32(x) != 0):
            return x + x
        return _ATAN_HI[3] + _ATAN_LO[3] if hx > 0 else -_ATAN_HI[3] - _ATAN_LO[3]
    if ix < 0x3fdc0000:
        if ix < 0x3e200000:
            if _ATAN_HUGE + x > 1.0:
                return x
        id_ = -1
    else:
        x = abs(x)
        if ix < 0x3ff30000:
            if ix < 0x3fe60000:
                id_ = 0
                x = (2.0 * x - 1.0) / (2.0 + x)
            else:
                id_ = 1
                x = (x - 1.0) / (x + 1.0)
        elif ix < 0x40038000:
            id_ = 2
            x = (x - 1.5) / (1.0 + 1.5 * x)
        else:
            id_ = 3
            x = -1.0 / x
    z = x * x
    w = z * z
    s1 = z * (_ATAN_AT[0] + w * (_ATAN_AT[2] + w * (_ATAN_AT[4] + w * (_ATAN_AT[6] + w * (_ATAN_AT[8] + w * _ATAN_AT[10])))))
    s2 = w * (_ATAN_AT[1] + w * (_ATAN_AT[3] + w * (_ATAN_AT[5] + w * (_ATAN_AT[7] + w * _ATAN_AT[9]))))
    if id_ < 0:
        return x - x * (s1 + s2)
    result = _ATAN_HI[id_] - ((x * (s1 + s2) - _ATAN_LO[id_]) - x)
    return -result if hx < 0 else result


# e_atan2.c
_ATAN2_TINY = 1.0e-300
_ATAN2_PI_O_4 = 7.8539816339744827900e-01
_ATAN2_PI_O_2 = 1.5707963267948965580e+00
_ATAN2_PI = 3.1415926535897931160e+00
_ATAN2_PI_LO = 1.2246467991473531772e-16


def _ulo32(x):
    return _bits(x) & 0xFFFFFFFF


def _low_nonzero_mask(ulx):
    neg = (-ulx) & 0xFFFFFFFF
    return (ulx | neg) >> 31


def fdlibm_atan2(y, x):
    """fdlibm5.3 atan2(y, x); bit-exact with java.lang.StrictMath.atan2."""
    hx = _hi32(x)
    ix = hx & 0x7fffffff
    ulx = _ulo32(x)
    lx = _lo32(x)
    hy = _hi32(y)
    iy = hy & 0x7fffffff
    uly = _ulo32(y)
    ly = _lo32(y)
    if (ix | _low_nonzero_mask(ulx)) > 0x7ff00000 or (iy | _low_nonzero_mask(uly)) > 0x7ff00000:
        return x + y
    if (hx - 0x3ff00000) | lx == 0:
        return fdlibm_atan(y)
    m = ((hy >> 31) & 1) | ((hx >> 30) & 2)
    if (iy | ly) == 0:
        if m in (0, 1):
            return y
        if m == 2:
            return _ATAN2_PI + _ATAN2_TINY
        return -_ATAN2_PI - _ATAN2_TINY
    if (ix | lx) == 0:
        return -_ATAN2_PI_O_2 - _ATAN2_TINY if hy < 0 else _ATAN2_PI_O_2 + _ATAN2_TINY
    if ix == 0x7ff00000:
        if iy == 0x7ff00000:
            if m == 0:
                return _ATAN2_PI_O_4 + _ATAN2_TINY
            if m == 1:
                return -_ATAN2_PI_O_4 - _ATAN2_TINY
            if m == 2:
                return 3.0 * _ATAN2_PI_O_4 + _ATAN2_TINY
            return -3.0 * _ATAN2_PI_O_4 - _ATAN2_TINY
        if m == 0:
            return 0.0
        if m == 1:
            return -0.0
        if m == 2:
            return _ATAN2_PI + _ATAN2_TINY
        return -_ATAN2_PI - _ATAN2_TINY
    if iy == 0x7ff00000:
        return -_ATAN2_PI_O_2 - _ATAN2_TINY if hy < 0 else _ATAN2_PI_O_2 + _ATAN2_TINY
    k = (iy - ix) >> 20
    if k > 60:
        z = _ATAN2_PI_O_2 + 0.5 * _ATAN2_PI_LO
    elif hx < 0 and k < -60:
        z = 0.0
    else:
        z = fdlibm_atan(abs(y / x))
    if m == 0:
        return z
    if m == 1:
        return _with_hi(z, _hi32(z) ^ 0x80000000)
    if m == 2:
        return _ATAN2_PI - (z - _ATAN2_PI_LO)
    return (z - _ATAN2_PI_LO) - _ATAN2_PI
