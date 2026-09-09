import java.math.BigInteger;

/** Private exact arithmetic diagnostic; not a shipped numeric API. */
final class RationalStudy implements Comparable<RationalStudy> {
  static final RationalStudy ZERO = new RationalStudy(BigInteger.ZERO, BigInteger.ONE);
  static final RationalStudy ONE = new RationalStudy(BigInteger.ONE, BigInteger.ONE);
  final BigInteger numerator;
  final BigInteger denominator;

  RationalStudy(BigInteger n, BigInteger d) {
    if (d.signum() == 0) throw new ArithmeticException("zero denominator");
    if (d.signum() < 0) { n = n.negate(); d = d.negate(); }
    BigInteger gcd = n.gcd(d);
    numerator = n.divide(gcd); denominator = d.divide(gcd);
  }

  static RationalStudy of(double value) {
    if (!Double.isFinite(value)) throw new IllegalArgumentException("finite input required");
    long bits = Double.doubleToRawLongBits(value);
    int exponent = (int)((bits >>> 52) & 2047);
    long fraction = bits & 0xfffffffffffffL;
    if (exponent == 0 && fraction == 0) return ZERO;
    long significand = exponent == 0 ? fraction : fraction | (1L << 52);
    int power = exponent == 0 ? -1074 : exponent - 1075;
    BigInteger n = BigInteger.valueOf(significand);
    if (bits < 0) n = n.negate();
    return power >= 0 ? new RationalStudy(n.shiftLeft(power), BigInteger.ONE)
        : new RationalStudy(n, BigInteger.ONE.shiftLeft(-power));
  }
  RationalStudy add(RationalStudy b) {
    return new RationalStudy(numerator.multiply(b.denominator).add(b.numerator.multiply(denominator)), denominator.multiply(b.denominator));
  }
  RationalStudy subtract(RationalStudy b) {
    return new RationalStudy(numerator.multiply(b.denominator).subtract(b.numerator.multiply(denominator)), denominator.multiply(b.denominator));
  }
  RationalStudy multiply(RationalStudy b) {
    return new RationalStudy(numerator.multiply(b.numerator), denominator.multiply(b.denominator));
  }
  RationalStudy divide(RationalStudy b) {
    return new RationalStudy(numerator.multiply(b.denominator), denominator.multiply(b.numerator));
  }
  int signum() { return numerator.signum(); }
  public int compareTo(RationalStudy b) { return numerator.multiply(b.denominator).compareTo(b.numerator.multiply(denominator)); }
  public boolean equals(Object b) {
    if (!(b instanceof RationalStudy)) return false;
    RationalStudy r=(RationalStudy)b;
    return numerator.equals(r.numerator) && denominator.equals(r.denominator);
  }
  public int hashCode() { return 31*numerator.hashCode()+denominator.hashCode(); }

  /** Exact quotient rounding, nearest with ties to even; zero canonicalized positive. */
  double doubleValue() {
    if (signum() == 0) return 0.0;
    BigInteger n=numerator.abs(), d=denominator;
    int e=n.bitLength()-d.bitLength();
    int comparison=e>=0?n.compareTo(d.shiftLeft(e)):n.shiftLeft(-e).compareTo(d);
    if(comparison<0)e--;
    int scale=e < -1022 ? 1074 : 52-e;
    BigInteger scaledN=scale>=0?n.shiftLeft(scale):n;
    BigInteger scaledD=scale>=0?d:d.shiftLeft(-scale);
    BigInteger[] qr=scaledN.divideAndRemainder(scaledD);
    int half=qr[1].shiftLeft(1).compareTo(scaledD);
    BigInteger q=qr[0];
    if(half>0 || half==0 && q.testBit(0))q=q.add(BigInteger.ONE);
    long magnitude;
    if(e < -1022) {
      magnitude=q.longValueExact(); // Includes carry to the smallest normal.
    } else {
      if(q.bitLength()>53){q=q.shiftRight(1);e++;}
      magnitude=e>1023?0x7ff0000000000000L:((long)(e+1023)<<52)|(q.longValueExact()&0xfffffffffffffL);
    }
    if(magnitude==0)return 0.0;
    return Double.longBitsToDouble(magnitude | (signum()<0?Long.MIN_VALUE:0));
  }
}
