import java.math.BigInteger;
import java.util.Random;

/** Private interval-filter check against common-exponent exact integer orientation. */
public strictfp final class OrientationFilterProbe {
    private static long cases, certified, unknown;

    private static double productLower(double al, double ah, double bl, double bh) {
        return Math.nextDown(Math.min(Math.min(al * bl, al * bh), Math.min(ah * bl, ah * bh)));
    }

    private static double productUpper(double al, double ah, double bl, double bh) {
        return Math.nextUp(Math.max(Math.max(al * bl, al * bh), Math.max(ah * bl, ah * bh)));
    }

    /** Zero means unknown, including exact zero. It must trigger the exact fallback. */
    static int filter(double ax, double ay, double bx, double by, double cx, double cy) {
        double x1 = bx - ax, y1 = by - ay, x2 = cx - ax, y2 = cy - ay;
        if (!Double.isFinite(x1) || !Double.isFinite(y1) || !Double.isFinite(x2) || !Double.isFinite(y2)) return 0;
        double xl1 = Math.nextDown(x1), xh1 = Math.nextUp(x1);
        double yl1 = Math.nextDown(y1), yh1 = Math.nextUp(y1);
        double xl2 = Math.nextDown(x2), xh2 = Math.nextUp(x2);
        double yl2 = Math.nextDown(y2), yh2 = Math.nextUp(y2);
        if (!Double.isFinite(xl1) || !Double.isFinite(xh1) || !Double.isFinite(yl1) || !Double.isFinite(yh1)
                || !Double.isFinite(xl2) || !Double.isFinite(xh2) || !Double.isFinite(yl2) || !Double.isFinite(yh2)) return 0;
        double leftLow = productLower(xl1, xh1, yl2, yh2), leftHigh = productUpper(xl1, xh1, yl2, yh2);
        double rightLow = productLower(yl1, yh1, xl2, xh2), rightHigh = productUpper(yl1, yh1, xl2, xh2);
        if (!Double.isFinite(leftLow) || !Double.isFinite(leftHigh) || !Double.isFinite(rightLow) || !Double.isFinite(rightHigh)) return 0;
        double lower = Math.nextDown(leftLow - rightHigh), upper = Math.nextUp(leftHigh - rightLow);
        if (!Double.isFinite(lower) || !Double.isFinite(upper)) return 0;
        return lower > 0 ? 1 : upper < 0 ? -1 : 0;
    }

    private static int exponent(double value) {
        int field = (int)((Double.doubleToRawLongBits(value) >>> 52) & 2047L);
        return field == 0 ? -1074 : field - 1075;
    }

    private static BigInteger integer(double value, int base) {
        long bits = Double.doubleToRawLongBits(value);
        long significand = bits & 0xfffffffffffffL;
        if (((bits >>> 52) & 2047L) != 0) significand |= 1L << 52;
        if (bits < 0) significand = -significand;
        return BigInteger.valueOf(significand).shiftLeft(exponent(value) - base);
    }

    private static int exact(double[] p) {
        int base = 1024;
        for (double value : p) if (value != 0) base = Math.min(base, exponent(value));
        if (base == 1024) return 0;
        BigInteger ax = integer(p[0], base), ay = integer(p[1], base);
        BigInteger bx = integer(p[2], base), by = integer(p[3], base);
        BigInteger cx = integer(p[4], base), cy = integer(p[5], base);
        return bx.subtract(ax).multiply(cy.subtract(ay)).subtract(by.subtract(ay).multiply(cx.subtract(ax))).signum();
    }

    private static void check(double... p) {
        int observed = filter(p[0], p[1], p[2], p[3], p[4], p[5]);
        int expected = exact(p);
        cases++;
        if (observed == 0) unknown++; else certified++;
        if (observed != 0 && observed != expected) {
            StringBuilder message = new StringBuilder("incorrect certified sign: ");
            for (double value : p) message.append(Double.toHexString(value)).append(' ');
            throw new AssertionError(message.toString());
        }
    }

    private static double randomFinite(Random random) {
        double value;
        do { value = Double.longBitsToDouble(random.nextLong()); } while (!Double.isFinite(value));
        return value;
    }

    public static void main(String[] args) throws Exception {
        check(0, 0, 1, 0, 0, 1);
        check(0, 0, 134217729, 134217728, 134217728, 134217727);
        check(-Double.MAX_VALUE, 0, Double.MAX_VALUE, 0, 0, 1);
        double[] boundary = {-Double.MAX_VALUE, -Math.scalb(1.0, 500), -1.0, -Double.MIN_NORMAL,
            -Double.MIN_VALUE, -0.0, 0.0, Double.MIN_VALUE, Double.MIN_NORMAL, 1.0, Math.scalb(1.0, 500), Double.MAX_VALUE};
        for (double x : boundary) for (double y : boundary) {
            check(0, 0, x, y, y, x);
            double nx = Math.nextUp(x), ny = Math.nextDown(y);
            if (Double.isFinite(nx) && Double.isFinite(ny)) check(x, y, nx, y, x, ny);
        }
        Random random = new Random(42L);
        for (int i = 0; i < 50000; i++) {
            double[] points = new double[6];
            for (int j = 0; j < 6; j++) points[j] = random.nextDouble() * 1280 - 640;
            check(points);
        }
        for (int i = 0; i < 20000; i++) {
            double[] points = new double[6];
            for (int j = 0; j < 6; j++) points[j] = randomFinite(random);
            check(points);
        }
        for (int i = 0; i < 20000; i++) {
            double x = Math.scalb(1 + random.nextDouble(), random.nextInt(1001) - 500);
            check(0, 0, x, x, 2 * x, 2 * x);
            check(0, 0, x, x, Math.nextUp(x), Math.nextDown(x));
        }
        long fixtureTriples = 0;
        if (args.length == 1) {
            for (String line : java.nio.file.Files.readAllLines(java.nio.file.Paths.get(args[0]))) {
                String[] parts = line.split(" ");
                if (parts.length != 6) throw new AssertionError("fixture triple shape");
                double[] values = new double[6];
                for (int i = 0; i < 6; i++) values[i] = Double.valueOf(parts[i]);
                check(values); fixtureTriples++;
            }
        }
        System.out.println("{\"status\":\"passed\",\"cases\":" + cases + ",\"certified\":" + certified
            + ",\"exact_fallback\":" + unknown + ",\"fixture_ordered_triples\":" + fixtureTriples + ",\"seed\":42,\"scope\":\"private filter diagnostic; proof and public integration remain separate\"}");
    }
}
