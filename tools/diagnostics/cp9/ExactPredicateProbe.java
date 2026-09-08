import java.math.BigInteger;
import java.util.Random;

/**
 * Private CP9 feasibility diagnostic: signs of determinants over represented binary64 values.
 * It does not triangulate or draw geometry.
 */
public final class ExactPredicateProbe {
    private static final class Point {
        final double x;
        final double y;

        Point(double x, double y) {
            this.x = x;
            this.y = y;
        }
    }

    /** A value m * 2^e, kept independently of the common-exponent implementation. */
    private static final class Dyadic {
        final BigInteger mantissa;
        final int exponent;

        Dyadic(BigInteger mantissa, int exponent) {
            this.mantissa = mantissa;
            this.exponent = mantissa.signum() == 0 ? 0 : exponent;
        }

        static Dyadic of(double value) {
            long bits = Double.doubleToRawLongBits(value);
            int field = (int) ((bits >>> 52) & 0x7ffL);
            long fraction = bits & 0x000fffffffffffffL;
            long significand = field == 0 ? fraction : fraction | (1L << 52);
            if ((bits & Long.MIN_VALUE) != 0) {
                significand = -significand;
            }
            int exponent = field == 0 ? -1074 : field - 1075;
            return new Dyadic(BigInteger.valueOf(significand), exponent);
        }

        Dyadic subtract(Dyadic other) {
            int shared = Math.min(exponent, other.exponent);
            BigInteger left = mantissa.shiftLeft(exponent - shared);
            BigInteger right = other.mantissa.shiftLeft(other.exponent - shared);
            return new Dyadic(left.subtract(right), shared);
        }

        Dyadic add(Dyadic other) {
            int shared = Math.min(exponent, other.exponent);
            BigInteger left = mantissa.shiftLeft(exponent - shared);
            BigInteger right = other.mantissa.shiftLeft(other.exponent - shared);
            return new Dyadic(left.add(right), shared);
        }

        Dyadic multiply(Dyadic other) {
            return new Dyadic(mantissa.multiply(other.mantissa), exponent + other.exponent);
        }
    }

    private static int exponent(double value) {
        long bits = Double.doubleToRawLongBits(value);
        int field = (int) ((bits >>> 52) & 0x7ffL);
        long fraction = bits & 0x000fffffffffffffL;
        return fraction == 0 && field == 0 ? 0 : field == 0 ? -1074 : field - 1075;
    }

    private static BigInteger integerAt(double value, int sharedExponent) {
        long bits = Double.doubleToRawLongBits(value);
        int field = (int) ((bits >>> 52) & 0x7ffL);
        long fraction = bits & 0x000fffffffffffffL;
        long significand = field == 0 ? fraction : fraction | (1L << 52);
        if ((bits & Long.MIN_VALUE) != 0) {
            significand = -significand;
        }
        return BigInteger.valueOf(significand).shiftLeft(exponent(value) - sharedExponent);
    }

    private static int minimumExponent(double... values) {
        int minimum = Integer.MAX_VALUE;
        for (double value : values) {
            long bits = Double.doubleToRawLongBits(value);
            if ((bits & 0x7fffffffffffffffL) != 0) {
                minimum = Math.min(minimum, exponent(value));
            }
        }
        return minimum == Integer.MAX_VALUE ? 0 : minimum;
    }

    private static int orientationInteger(Point a, Point b, Point c) {
        int shared = minimumExponent(a.x, a.y, b.x, b.y, c.x, c.y);
        BigInteger ax = integerAt(a.x, shared);
        BigInteger ay = integerAt(a.y, shared);
        BigInteger bx = integerAt(b.x, shared);
        BigInteger by = integerAt(b.y, shared);
        BigInteger cx = integerAt(c.x, shared);
        BigInteger cy = integerAt(c.y, shared);
        return bx.subtract(ax).multiply(cy.subtract(ay))
                .subtract(by.subtract(ay).multiply(cx.subtract(ax))).signum();
    }

    private static int incircleInteger(Point a, Point b, Point c, Point d) {
        int shared = minimumExponent(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
        BigInteger adx = integerAt(a.x, shared).subtract(integerAt(d.x, shared));
        BigInteger ady = integerAt(a.y, shared).subtract(integerAt(d.y, shared));
        BigInteger bdx = integerAt(b.x, shared).subtract(integerAt(d.x, shared));
        BigInteger bdy = integerAt(b.y, shared).subtract(integerAt(d.y, shared));
        BigInteger cdx = integerAt(c.x, shared).subtract(integerAt(d.x, shared));
        BigInteger cdy = integerAt(c.y, shared).subtract(integerAt(d.y, shared));
        BigInteger alift = adx.multiply(adx).add(ady.multiply(ady));
        BigInteger blift = bdx.multiply(bdx).add(bdy.multiply(bdy));
        BigInteger clift = cdx.multiply(cdx).add(cdy.multiply(cdy));
        BigInteger bc = bdx.multiply(cdy).subtract(bdy.multiply(cdx));
        BigInteger ac = adx.multiply(cdy).subtract(ady.multiply(cdx));
        BigInteger ab = adx.multiply(bdy).subtract(ady.multiply(bdx));
        return alift.multiply(bc).subtract(blift.multiply(ac)).add(clift.multiply(ab)).signum();
    }

    private static int orientationDyadic(Point a, Point b, Point c) {
        Dyadic ax = Dyadic.of(a.x);
        Dyadic ay = Dyadic.of(a.y);
        Dyadic bx = Dyadic.of(b.x);
        Dyadic by = Dyadic.of(b.y);
        Dyadic cx = Dyadic.of(c.x);
        Dyadic cy = Dyadic.of(c.y);
        return bx.subtract(ax).multiply(cy.subtract(ay))
                .subtract(by.subtract(ay).multiply(cx.subtract(ax))).mantissa.signum();
    }

    private static int incircleDyadic(Point a, Point b, Point c, Point d) {
        Dyadic adx = Dyadic.of(a.x).subtract(Dyadic.of(d.x));
        Dyadic ady = Dyadic.of(a.y).subtract(Dyadic.of(d.y));
        Dyadic bdx = Dyadic.of(b.x).subtract(Dyadic.of(d.x));
        Dyadic bdy = Dyadic.of(b.y).subtract(Dyadic.of(d.y));
        Dyadic cdx = Dyadic.of(c.x).subtract(Dyadic.of(d.x));
        Dyadic cdy = Dyadic.of(c.y).subtract(Dyadic.of(d.y));
        Dyadic alift = adx.multiply(adx).add(ady.multiply(ady));
        Dyadic blift = bdx.multiply(bdx).add(bdy.multiply(bdy));
        Dyadic clift = cdx.multiply(cdx).add(cdy.multiply(cdy));
        Dyadic bc = bdx.multiply(cdy).subtract(bdy.multiply(cdx));
        Dyadic ac = adx.multiply(cdy).subtract(ady.multiply(cdx));
        Dyadic ab = adx.multiply(bdy).subtract(ady.multiply(bdx));
        return alift.multiply(bc).subtract(blift.multiply(ac)).add(clift.multiply(ab)).mantissa.signum();
    }

    private static double directOrientationValue(Point a, Point b, Point c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    private static double directIncircleValue(Point a, Point b, Point c, Point d) {
        double adx = a.x - d.x;
        double ady = a.y - d.y;
        double bdx = b.x - d.x;
        double bdy = b.y - d.y;
        double cdx = c.x - d.x;
        double cdy = c.y - d.y;
        double alift = adx * adx + ady * ady;
        double blift = bdx * bdx + bdy * bdy;
        double clift = cdx * cdx + cdy * cdy;
        return alift * (bdx * cdy - bdy * cdx)
                - blift * (adx * cdy - ady * cdx)
                + clift * (adx * bdy - ady * bdx);
    }

    private static String sign(int sign) {
        return sign < 0 ? "negative" : sign > 0 ? "positive" : "zero";
    }

    private static String directSign(double value) {
        return Double.isFinite(value) ? sign(Double.compare(value, 0.0d)) : "nonfinite";
    }

    private static void requireEqual(int first, int second, String label) {
        if (first != second) {
            throw new AssertionError(label + ": " + first + " != " + second);
        }
    }

    private static String caseJson(String id, Point a, Point b, Point c, Point d) {
        int orientation = orientationInteger(a, b, c);
        int circle = incircleInteger(a, b, c, d);
        requireEqual(orientation, orientationDyadic(a, b, c), id + " orientation oracle");
        requireEqual(circle, incircleDyadic(a, b, c, d), id + " incircle oracle");
        return "{\"id\":\"" + id + "\",\"orientation_exact\":\"" + sign(orientation)
                + "\",\"orientation_direct\":\"" + directSign(directOrientationValue(a, b, c))
                + "\",\"incircle_exact\":\"" + sign(circle)
                + "\",\"incircle_direct\":\"" + directSign(directIncircleValue(a, b, c, d)) + "\"}";
    }

    private static long benchmarkOrientation() {
        Random random = new Random(42L);
        long checksum = 0;
        long started = System.nanoTime();
        for (int index = 0; index < 100000; index++) {
            Point a = new Point(random.nextDouble() * 640.0d, random.nextDouble() * 640.0d);
            Point b = new Point(random.nextDouble() * 640.0d, random.nextDouble() * 640.0d);
            Point c = new Point(random.nextDouble() * 640.0d, random.nextDouble() * 640.0d);
            checksum = checksum * 31 + orientationInteger(a, b, c);
        }
        long elapsed = System.nanoTime() - started;
        if (checksum == Long.MIN_VALUE) {
            throw new AssertionError("unreachable checksum");
        }
        return elapsed;
    }

    private static long benchmarkIncircle() {
        Random random = new Random(42L);
        long checksum = 0;
        long started = System.nanoTime();
        for (int index = 0; index < 20000; index++) {
            Point a = new Point(random.nextDouble() * 640.0d, random.nextDouble() * 640.0d);
            Point b = new Point(random.nextDouble() * 640.0d, random.nextDouble() * 640.0d);
            Point c = new Point(random.nextDouble() * 640.0d, random.nextDouble() * 640.0d);
            Point d = new Point(random.nextDouble() * 640.0d, random.nextDouble() * 640.0d);
            checksum = checksum * 31 + incircleInteger(a, b, c, d);
        }
        long elapsed = System.nanoTime() - started;
        if (checksum == Long.MIN_VALUE) {
            throw new AssertionError("unreachable checksum");
        }
        return elapsed;
    }

    public static void main(String[] args) {
        double min = Double.longBitsToDouble(1L);
        double max = Double.MAX_VALUE;
        String[] cases = {
            caseJson("ordinary", new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(.25, .25)),
            caseJson("integer-cancellation", new Point(0, 0), new Point(134217729, 134217728), new Point(134217728, 134217727), new Point(1, 1)),
            caseJson("minimum-subnormal", new Point(0, 0), new Point(min, 0), new Point(0, min), new Point(min, min)),
            caseJson("extreme-difference", new Point(-max, 0), new Point(max, 0), new Point(0, 1), new Point(0, 2)),
            caseJson("cocircular", new Point(1, 0), new Point(0, 1), new Point(-1, 0), new Point(0, -1)),
            caseJson("signed-zero", new Point(-0.0d, 0), new Point(1, -0.0d), new Point(-0.0d, 1), new Point(.25, .25))
        };
        long orientationNanos = benchmarkOrientation();
        long incircleNanos = benchmarkIncircle();
        System.out.println("{\"status\":\"passed\",\"java\":\"" + System.getProperty("java.version")
                + "\",\"cases\":[" + String.join(",", cases) + "]"
                + ",\"ordinary_orientation_100000_ns\":" + orientationNanos
                + ",\"ordinary_incircle_20000_ns\":" + incircleNanos + "}");
    }
}
