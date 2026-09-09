package org.procedurals.geometry;

import java.math.BigInteger;

/**
 * Normalized exact rational arithmetic shared by package-private geometry kernels.
 *
 * <p>This type is deliberately not public API. It represents supplied binary64 values
 * exactly and converts results with one nearest-even binary64 rounding step.</p>
 */
final class ExactRational implements Comparable<ExactRational> {
    static final ExactRational ZERO = new ExactRational(BigInteger.ZERO, BigInteger.ONE);
    static final ExactRational ONE = new ExactRational(BigInteger.ONE, BigInteger.ONE);
    static final ExactRational TWO = new ExactRational(BigInteger.valueOf(2), BigInteger.ONE);
    final BigInteger n;
    final BigInteger d;

    ExactRational(BigInteger numerator, BigInteger denominator) {
        if (denominator.signum() == 0) throw new ArithmeticException();
        if (numerator.signum() == 0) {
            n = BigInteger.ZERO;
            d = BigInteger.ONE;
            return;
        }
        if (denominator.signum() < 0) {
            numerator = numerator.negate();
            denominator = denominator.negate();
        }
        if (denominator.equals(BigInteger.ONE)) {
            n = numerator;
            d = denominator;
            return;
        }
        BigInteger gcd = numerator.gcd(denominator);
        if (gcd.equals(BigInteger.ONE)) {
            n = numerator;
            d = denominator;
        } else {
            n = numerator.divide(gcd);
            d = denominator.divide(gcd);
        }
    }

    static ExactRational of(double value) {
        long bits = Double.doubleToRawLongBits(value);
        int exponent = (int) ((bits >>> 52) & 2047);
        long fraction = bits & 0xfffffffffffffL;
        if (exponent == 0 && fraction == 0) return ZERO;
        long significand = exponent == 0 ? fraction : fraction | (1L << 52);
        int power = exponent == 0 ? -1074 : exponent - 1075;
        BigInteger numerator = BigInteger.valueOf(significand);
        if (bits < 0) numerator = numerator.negate();
        return power >= 0 ? new ExactRational(numerator.shiftLeft(power), BigInteger.ONE)
                : new ExactRational(numerator, BigInteger.ONE.shiftLeft(-power));
    }

    ExactRational add(ExactRational other) {
        if (other.n.signum() == 0) return this;
        if (n.signum() == 0) return other;
        if (d.equals(other.d)) return new ExactRational(n.add(other.n), d);
        return new ExactRational(n.multiply(other.d).add(other.n.multiply(d)), d.multiply(other.d));
    }

    ExactRational subtract(ExactRational other) {
        if (other.n.signum() == 0) return this;
        if (n.signum() == 0) return new ExactRational(other.n.negate(), other.d);
        if (d.equals(other.d)) return new ExactRational(n.subtract(other.n), d);
        return new ExactRational(n.multiply(other.d).subtract(other.n.multiply(d)), d.multiply(other.d));
    }

    ExactRational multiply(ExactRational other) {
        if (n.signum() == 0 || other.n.signum() == 0) return ZERO;
        if (this == ONE) return other;
        if (other == ONE) return this;
        return new ExactRational(n.multiply(other.n), d.multiply(other.d));
    }

    ExactRational divide(ExactRational other) {
        if (other.n.signum() == 0) throw new ArithmeticException();
        if (n.signum() == 0) return ZERO;
        if (other == ONE) return this;
        return new ExactRational(n.multiply(other.d), d.multiply(other.n));
    }

    int signum() { return n.signum(); }

    @Override public int compareTo(ExactRational other) {
        if (this == other || n.equals(other.n) && d.equals(other.d)) return 0;
        int ownSign = n.signum();
        int otherSign = other.n.signum();
        if (ownSign != otherSign) return ownSign < otherSign ? -1 : 1;
        if (d.equals(other.d)) return n.compareTo(other.n);
        return n.multiply(other.d).compareTo(other.n.multiply(d));
    }

    @Override public boolean equals(Object value) {
        if (!(value instanceof ExactRational)) return false;
        ExactRational other = (ExactRational) value;
        return n.equals(other.n) && d.equals(other.d);
    }

    @Override public int hashCode() { return 31 * n.hashCode() + d.hashCode(); }

    double value() {
        if (signum() == 0) return 0.0;
        BigInteger absolute = n.abs();
        int exponent = absolute.bitLength() - d.bitLength();
        int comparison = exponent >= 0 ? absolute.compareTo(d.shiftLeft(exponent))
                : absolute.shiftLeft(-exponent).compareTo(d);
        if (comparison < 0) exponent--;
        int scale = exponent < -1022 ? 1074 : 52 - exponent;
        BigInteger scaledNumerator = scale >= 0 ? absolute.shiftLeft(scale) : absolute;
        BigInteger scaledDenominator = scale >= 0 ? d : d.shiftLeft(-scale);
        BigInteger[] quotientAndRemainder = scaledNumerator.divideAndRemainder(scaledDenominator);
        BigInteger quotient = quotientAndRemainder[0];
        int half = quotientAndRemainder[1].shiftLeft(1).compareTo(scaledDenominator);
        if (half > 0 || half == 0 && quotient.testBit(0)) quotient = quotient.add(BigInteger.ONE);
        long magnitude;
        if (exponent < -1022) {
            magnitude = quotient.longValueExact();
        } else {
            if (quotient.bitLength() > 53) {
                quotient = quotient.shiftRight(1);
                exponent++;
            }
            magnitude = exponent > 1023 ? 0x7ff0000000000000L
                    : ((long) (exponent + 1023) << 52) | (quotient.longValueExact() & 0xfffffffffffffL);
        }
        if (magnitude == 0) return 0.0;
        return Double.longBitsToDouble(magnitude | (signum() < 0 ? Long.MIN_VALUE : 0));
    }
}
