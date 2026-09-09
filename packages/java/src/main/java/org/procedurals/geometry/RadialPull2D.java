package org.procedurals.geometry;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable ordered radial displacement influences.
 *
 * <p>This operation is motivated by {@code survey/out/2018/Generativos/curvespace/notes.md},
 * its curvespace computation, the private CP19 radial-warp study, and
 * {@code design/operations/radial-pull-contract.md}. The private study observed
 * radius 120/180 and power 2/0.5 edits; these are observations rather than a
 * continuous useful range, defaults, or recommendations. Each influence pulls the
 * original query toward its center within its radius; contributions are summed
 * in supplied order. The exact-center contribution is zero and radius endpoints
 * contribute zero. The limiting field is discontinuous at each center and
 * transformed paths may fold or self-intersect. This class performs no rendering, clipping,
 * inversion, topology preservation, or field sampling.</p>
 */
public strictfp final class RadialPull2D {
    private static final String INFLUENCES = "influences";
    private static final long MAX_COUNT = 536870911L;
    private static final String INVALID_INPUT = "INVALID_INPUT";
    private static final String INVALID_QUERY = "INVALID_QUERY";
    private static final String NUMERIC_OVERFLOW = "NUMERIC_OVERFLOW";

    /** Stable failure code for malformed construction, queries, and arithmetic overflow. */
    public static final class PullException extends IllegalArgumentException {
        public final String code;

        private PullException(String code) {
            super(code);
            this.code = code;
        }
    }

    /** Detached transformed point in the caller's drawing coordinate units. */
    public static final class Point {
        private final double x;
        private final double y;

        private Point(double x, double y) {
            this.x = x;
            this.y = y;
        }

        /** Returns transformed x, normalized to positive zero. */
        public double x() { return x; }

        /** Returns transformed y, normalized to positive zero. */
        public double y() { return y; }
    }

    private final double[] influences;
    private final int count;

    private RadialPull2D(double[] owned, int count) {
        influences = owned;
        this.count = count;
    }

    /** Creates an immutable field from exact finite {@code [x,y,radius,power]} rows. */
    public static RadialPull2D create(double[][] input) {
        if (input == null || input.length > MAX_COUNT) invalidInput();
        double[] owned = new double[input.length * 4];
        for (int i = 0; i < input.length; i++) {
            double[] row = input[i];
            if (row == null || row.length != 4) invalidInput();
            int offset = i * 4;
            owned[offset] = finite(row[0], INVALID_INPUT);
            owned[offset + 1] = finite(row[1], INVALID_INPUT);
            owned[offset + 2] = positive(row[2]);
            owned[offset + 3] = positive(row[3]);
        }
        return new RadialPull2D(owned, input.length);
    }

    /** Creates an immutable field from exactly {@code {influences: List<List<number>>}}. */
    public static RadialPull2D create(Object descriptor) {
        if (!(descriptor instanceof Map)) invalidInput();
        Map<?, ?> map = (Map<?, ?>) descriptor;
        if (map.size() != 1 || !map.containsKey(INFLUENCES)) invalidInput();
        Object raw = map.get(INFLUENCES);
        if (!(raw instanceof List)) invalidInput();
        List<?> rows = (List<?>) raw;
        if (rows.size() > MAX_COUNT) invalidInput();
        double[] owned = new double[rows.size() * 4];
        for (int i = 0; i < rows.size(); i++) {
            Object rowValue = rows.get(i);
            if (!(rowValue instanceof List)) invalidInput();
            List<?> row = (List<?>) rowValue;
            if (row.size() != 4) invalidInput();
            int offset = i * 4;
            owned[offset] = number(row.get(0), INVALID_INPUT);
            owned[offset + 1] = number(row.get(1), INVALID_INPUT);
            owned[offset + 2] = positive(number(row.get(2), INVALID_INPUT));
            owned[offset + 3] = positive(number(row.get(3), INVALID_INPUT));
        }
        return new RadialPull2D(owned, rows.size());
    }

    /** Returns the immutable influence count, including duplicates. */
    public int influenceCount() { return count; }

    /** Returns a detached descriptor with fresh influence rows and positive zeros. */
    public Map<String, Object> serialize() {
        List<Object> rows = new ArrayList<Object>(count);
        for (int i = 0; i < count; i++) {
            int offset = i * 4;
            rows.add(Arrays.<Object>asList(influences[offset], influences[offset + 1],
                    influences[offset + 2], influences[offset + 3]));
        }
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put(INFLUENCES, rows);
        return result;
    }

    /** Transforms an exact finite two-number query into a detached numeric list. */
    public List<Object> transform(Object query) {
        if (!(query instanceof List)) invalidQuery();
        List<?> values = (List<?>) query;
        if (values.size() != 2) invalidQuery();
        double x = number(values.get(0), INVALID_QUERY);
        double y = number(values.get(1), INVALID_QUERY);
        Point point = transform(x, y);
        return Arrays.<Object>asList(point.x(), point.y());
    }

    /** Transforms finite coordinates and returns a detached immutable point. */
    public Point transform(double x, double y) {
        double[] result = new double[2];
        calculate(finite(x, INVALID_QUERY), finite(y, INVALID_QUERY), result);
        return new Point(result[0], result[1]);
    }

    /** Writes exactly two transformed coordinates after all validation and arithmetic succeed. */
    public void transform(double x, double y, double[] target) {
        double checkedX = finite(x, INVALID_QUERY);
        double checkedY = finite(y, INVALID_QUERY);
        if (target == null || target.length != 2) invalidQuery();
        calculate(checkedX, checkedY, target);
    }

    private void calculate(double x, double y, double[] result) {
        double sumX = 0.0;
        double sumY = 0.0;
        for (int i = 0; i < count; i++) {
            int offset = i * 4;
            double dx = influences[offset] - x;
            double dy = influences[offset + 1] - y;
            if (Double.isInfinite(dx) || Double.isInfinite(dy)) {
                continue;
            }
            double distance = StrictMath.hypot(dx, dy);
            double radius = influences[offset + 2];
            if (distance == 0.0 || distance >= radius) {
                continue;
            }
            double ratio = checkedDivide(distance, radius);
            double fraction = checkedPow(ratio, influences[offset + 3]);
            double remaining = checkedSubtract(1.0, fraction);
            double amount = checkedMultiply(radius, remaining);
            double ux = checkedDivide(dx, distance);
            double uy = checkedDivide(dy, distance);
            sumX = checkedAdd(sumX, checkedMultiply(ux, amount));
            sumY = checkedAdd(sumY, checkedMultiply(uy, amount));
        }
        double finalX = checkedAdd(x, sumX);
        double finalY = checkedAdd(y, sumY);
        result[0] = positiveZero(finalX);
        result[1] = positiveZero(finalY);
    }

    private static double positive(double value) {
        if (!Double.isFinite(value) || value <= 0.0) invalidInput();
        return value;
    }

    private static double finite(double value, String code) {
        if (!Double.isFinite(value)) fail(code);
        return positiveZero(value);
    }

    private static double number(Object raw, String code) {
        if (!(raw instanceof Byte || raw instanceof Short || raw instanceof Integer
                || raw instanceof Long || raw instanceof Float || raw instanceof Double)) {
            fail(code);
        }
        return finite(((Number) raw).doubleValue(), code);
    }

    private static double checkedAdd(double a, double b) { return checked(a + b); }
    private static double checkedSubtract(double a, double b) { return checked(a - b); }
    private static double checkedMultiply(double a, double b) { return checked(a * b); }
    private static double checkedDivide(double a, double b) { return checked(a / b); }
    private static double checkedPow(double a, double b) { return checked(StrictMath.pow(a, b)); }

    private static double checked(double value) {
        if (!Double.isFinite(value)) fail(NUMERIC_OVERFLOW);
        return value;
    }

    private static double positiveZero(double value) { return value == 0.0 ? 0.0 : value; }
    private static void invalidInput() { fail(INVALID_INPUT); }
    private static void invalidQuery() { fail(INVALID_QUERY); }
    private static void fail(String code) { throw new PullException(code); }
}
