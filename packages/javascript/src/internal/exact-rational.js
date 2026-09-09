/**
 * Normalized exact rational arithmetic shared by internal geometry kernels.
 * Line-for-line port of org.procedurals.geometry.ExactRational (package-private Java
 * class shared by SegmentClip2D and NearestSegmentContact2D). Not exported by the
 * package entry point. Represents supplied binary64 values exactly (via their exact
 * significand*2^exponent decomposition) and converts results back with one
 * nearest-even binary64 rounding step, matching Java's BigInteger-based algorithm.
 */

// Shared scratch for exact binary64 <-> unsigned64-bit-pattern conversion.
const BIT_BUFFER = new ArrayBuffer(8);
const BIT_FLOAT = new Float64Array(BIT_BUFFER);
const BIT_UINT = new BigUint64Array(BIT_BUFFER);
function bitsOf(value) { BIT_FLOAT[0] = value; return BIT_UINT[0]; }
function fromBits(bits) { BIT_UINT[0] = bits & 0xffffffffffffffffn; return BIT_FLOAT[0]; }

function gcdBig(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) { const t = a % b; a = b; b = t; }
  return a;
}

function bitLength(value) {
  // value is a non-negative BigInt.
  return value === 0n ? 0 : value.toString(2).length;
}

export class ExactRational {
  constructor(numerator, denominator) {
    if (denominator === 0n) throw new RangeError("division by zero");
    if (numerator === 0n) { this.n = 0n; this.d = 1n; return; }
    if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
    if (denominator === 1n) { this.n = numerator; this.d = denominator; return; }
    const gcd = gcdBig(numerator, denominator);
    if (gcd === 1n) { this.n = numerator; this.d = denominator; }
    else { this.n = numerator / gcd; this.d = denominator / gcd; }
  }

  static of(value) {
    const bits = bitsOf(value); // unsigned 64-bit pattern
    const negative = (bits & (1n << 63n)) !== 0n;
    const exponent = Number((bits >> 52n) & 0x7ffn);
    const fraction = bits & 0xfffffffffffffn;
    if (exponent === 0 && fraction === 0n) return ExactRational.ZERO;
    const significand = exponent === 0 ? fraction : fraction | (1n << 52n);
    const power = exponent === 0 ? -1074 : exponent - 1075;
    const numerator = negative ? -significand : significand;
    return power >= 0
      ? new ExactRational(numerator << BigInt(power), 1n)
      : new ExactRational(numerator, 1n << BigInt(-power));
  }

  add(other) {
    if (other.n === 0n) return this;
    if (this.n === 0n) return other;
    if (this.d === other.d) return new ExactRational(this.n + other.n, this.d);
    return new ExactRational(this.n * other.d + other.n * this.d, this.d * other.d);
  }

  subtract(other) {
    if (other.n === 0n) return this;
    if (this.n === 0n) return new ExactRational(-other.n, other.d);
    if (this.d === other.d) return new ExactRational(this.n - other.n, this.d);
    return new ExactRational(this.n * other.d - other.n * this.d, this.d * other.d);
  }

  multiply(other) {
    if (this.n === 0n || other.n === 0n) return ExactRational.ZERO;
    if (this === ExactRational.ONE) return other;
    if (other === ExactRational.ONE) return this;
    return new ExactRational(this.n * other.n, this.d * other.d);
  }

  divide(other) {
    if (other.n === 0n) throw new RangeError("division by zero");
    if (this.n === 0n) return ExactRational.ZERO;
    if (other === ExactRational.ONE) return this;
    return new ExactRational(this.n * other.d, this.d * other.n);
  }

  signum() { return this.n < 0n ? -1 : this.n > 0n ? 1 : 0; }

  compareTo(other) {
    if (this === other || (this.n === other.n && this.d === other.d)) return 0;
    const ownSign = this.signum(), otherSign = other.signum();
    if (ownSign !== otherSign) return ownSign < otherSign ? -1 : 1;
    if (this.d === other.d) return this.n < other.n ? -1 : this.n > other.n ? 1 : 0;
    const left = this.n * other.d, right = other.n * this.d;
    return left < right ? -1 : left > right ? 1 : 0;
  }

  equals(other) { return other instanceof ExactRational && this.n === other.n && this.d === other.d; }

  /** Round to the nearest binary64, ties-to-even, matching Java's BigInteger algorithm exactly. */
  value() {
    if (this.signum() === 0) return 0;
    const absolute = this.n < 0n ? -this.n : this.n;
    let exponent = bitLength(absolute) - bitLength(this.d);
    const comparison = exponent >= 0
      ? (absolute < (this.d << BigInt(exponent)) ? -1 : absolute > (this.d << BigInt(exponent)) ? 1 : 0)
      : ((absolute << BigInt(-exponent)) < this.d ? -1 : (absolute << BigInt(-exponent)) > this.d ? 1 : 0);
    if (comparison < 0) exponent -= 1;
    const scale = exponent < -1022 ? 1074 : 52 - exponent;
    const scaledNumerator = scale >= 0 ? absolute << BigInt(scale) : absolute;
    const scaledDenominator = scale >= 0 ? this.d : this.d << BigInt(-scale);
    let quotient = scaledNumerator / scaledDenominator;
    const remainder = scaledNumerator % scaledDenominator;
    const half = (remainder << 1n) < scaledDenominator ? -1 : (remainder << 1n) > scaledDenominator ? 1 : 0;
    if (half > 0 || (half === 0 && (quotient & 1n) === 1n)) quotient += 1n;
    let magnitude;
    if (exponent < -1022) {
      magnitude = quotient;
    } else {
      if (bitLength(quotient) > 53) {
        quotient >>= 1n;
        exponent += 1;
      }
      magnitude = exponent > 1023 ? 0x7ff0000000000000n
        : ((BigInt(exponent + 1023) << 52n) | (quotient & 0xfffffffffffffn));
    }
    if (magnitude === 0n) return 0;
    return fromBits(magnitude | (this.signum() < 0 ? (1n << 63n) : 0n));
  }
}

ExactRational.ZERO = new ExactRational(0n, 1n);
ExactRational.ONE = new ExactRational(1n, 1n);
ExactRational.TWO = new ExactRational(2n, 1n);
