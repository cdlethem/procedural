package org.procedurals.sampling;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable retained triangle points for {@code sampling.seeded-triangle-points-2d}
 * and {@code sampling.triangle-coordinate-map-2d} 0.1.0.
 *
 * <p>Motivating evidence is in {@code survey/out/2018/Generativos/puntis/notes.md}
 * and {@code survey/out/2018/Generativos/puntis3/notes.md}. This independently
 * specified operation does not preserve those sketches' shared streams, brightness,
 * palette, triangle construction, or drawing. No default or encouraged parameter range
 * has been established; fixture values are exact conformance vectors only.</p>
 */
public final strictfp class TrianglePoints2D {
    private static final int MAX_COUNT = 1073741823;
    private static final long MAX_SAFE_INTEGER = 9007199254740991L;
    private static final String[] MAP_KEYS = {"triangle", "unitCoordinates"};
    private static final String[] SEEDED_KEYS = {"seed", "count", "triangle"};

    /** Validation or accessor failure whose {@link #code} is a catalog error code. */
    public static final class TrianglePointsException extends IllegalArgumentException {
        public final String code;

        public TrianglePointsException(String code) {
            super(code);
            this.code = code;
        }
    }

    private final double[] points;

    private TrianglePoints2D(double[] points) {
        this.points = points;
    }

    /**
     * Generates {@code count} points by consuming exactly two private xoshiro units per
     * point, in {@code u}, then {@code v} order. Count zero validates all input and does
     * not construct the stream. Motivated by the unused uniform helper described in
     * {@code survey/out/2018/Generativos/puntis2/notes.md}; the active source drawing
     * uses a different distribution. There are no defaults or encouraged count ranges.
     */
    public static TrianglePoints2D seeded(Object config) {
        Map<?, ?> record = record(config, SEEDED_KEYS);
        long seed = uint32(record.get("seed"));
        int count = count(record.get("count"));
        double[] triangle = triangle(record.get("triangle"));

        if (count == 0) return new TrianglePoints2D(new double[0]);
        double[] output = new double[count * 2];
        Xoshiro128StarStar11 stream = new Xoshiro128StarStar11(seed);
        for (int index = 0, offset = 0; index < count; index++, offset += 2) {
            double u = stream.unit();
            double v = stream.unit();
            double root = Math.sqrt(u);
            output[offset] = coordinate(triangle[0], triangle[2], triangle[4], root, v);
            output[offset + 1] = coordinate(triangle[1], triangle[3], triangle[5], root, v);
        }
        return new TrianglePoints2D(output);
    }

    /**
     * Maps caller-provided ordered closed-unit pairs without constructing or consuming a
     * random stream. Complete pair validation precedes output-sized allocation. Motivated
     * by the explicit coordinate substitutions in
     * {@code survey/out/2018/Generativos/puntis/notes.md} and
     * {@code survey/out/2018/Generativos/puntis3/notes.md}, corrected by the source audit.
     * No default or encouraged distribution is implied.
     */
    public static TrianglePoints2D map(Object config) {
        Map<?, ?> record = record(config, MAP_KEYS);
        double[] triangle = triangle(record.get("triangle"));
        Object supplied = record.get("unitCoordinates");
        if (!(supplied instanceof List)) invalidInput();
        List<?> units = (List<?>) supplied;
        int count = boundedLength(units);

        for (int index = 0; index < count; index++) validateUnitPair(units.get(index));

        double[] output = new double[count * 2];
        for (int index = 0, offset = 0; index < count; index++, offset += 2) {
            List<?> row = pairList(units.get(index));
            double u = unit(row.get(0));
            double v = unit(row.get(1));
            double root = Math.sqrt(u);
            output[offset] = coordinate(triangle[0], triangle[2], triangle[4], root, v);
            output[offset + 1] = coordinate(triangle[1], triangle[3], triangle[5], root, v);
        }
        return new TrianglePoints2D(output);
    }

    /** Current retained point count. */
    public int size() {
        return points.length / 2;
    }

    /** Returns a fresh detached {@code [x, y]} binary64 carrier. */
    public double[] pointAt(long index) {
        int checked = checkedIndex(index);
        return new double[] {points[2 * checked], points[2 * checked + 1]};
    }

    /** Numeric-carrier overload for Java interchange callers. */
    public double[] pointAt(Object index) {
        return pointAt(accessIndex(index));
    }

    /** Writes a point only after index, destination, and offset validation succeeds. */
    public void pointInto(long index, double[] destination, int offset) {
        int checked = checkedIndex(index);
        if (destination == null || offset < 0 || offset > destination.length - 2)
            throw new TrianglePointsException("INVALID_OUTPUT");
        destination[offset] = points[2 * checked];
        destination[offset + 1] = points[2 * checked + 1];
    }

    /** Numeric-carrier overload for Java interchange callers. */
    public void pointInto(Object index, double[] destination, int offset) {
        pointInto(accessIndex(index), destination, offset);
    }

    /** Materializes detached plain points; retained scalar storage is never exposed. */
    public Map<String, Object> toValues() {
        List<Object> values = new ArrayList<Object>(size());
        for (int index = 0; index < size(); index++) {
            List<Object> point = new ArrayList<Object>(2);
            point.add(Double.valueOf(points[2 * index]));
            point.add(Double.valueOf(points[2 * index + 1]));
            values.add(point);
        }
        Map<String, Object> output = new LinkedHashMap<String, Object>();
        output.put("points", values);
        return output;
    }

    private static double coordinate(double a, double b, double c, double root, double v) {
        return lerp(a, lerp(b, c, v), root);
    }

    /** The frozen endpoint-aware clamped scalar interpolation kernel. */
    private static double lerp(double a, double b, double t) {
        if (t == 0.0) return zero(a);
        if (t == 1.0) return zero(b);
        double raw;
        if ((a < 0.0 && b > 0.0) || (b < 0.0 && a > 0.0)) {
            raw = a * (1.0 - t) + b * t;
        } else {
            raw = a + (b - a) * t;
        }
        double lower = Math.min(a, b);
        double upper = Math.max(a, b);
        if (raw < lower) raw = lower;
        else if (raw > upper) raw = upper;
        if (!Double.isFinite(raw)) throw new AssertionError("finite endpoint interpolation produced nonfinite output");
        return zero(raw);
    }

    private int checkedIndex(long index) {
        if (index < 0L || index > MAX_SAFE_INTEGER) throw new TrianglePointsException("INVALID_INDEX");
        if (index >= size()) throw new TrianglePointsException("INDEX_OUT_OF_RANGE");
        return (int) index;
    }

    private static Map<?, ?> record(Object value, String[] keys) {
        if (!(value instanceof Map)) invalidInput();
        Map<?, ?> map = (Map<?, ?>) value;
        if (map.size() != keys.length) invalidInput();
        for (String key : keys) if (!map.containsKey(key)) invalidInput();
        return map;
    }

    private static int boundedLength(List<?> values) {
        int length = values.size();
        if (length < 0 || length > MAX_COUNT) invalidInput();
        return length;
    }

    private static double[] triangle(Object value) {
        if (!(value instanceof List) || ((List<?>) value).size() != 3) invalidInput();
        List<?> vertices = (List<?>) value;
        List<?> first = pairList(vertices.get(0));
        double ax = number(first.get(0));
        double ay = number(first.get(1));
        List<?> second = pairList(vertices.get(1));
        double bx = number(second.get(0));
        double by = number(second.get(1));
        List<?> third = pairList(vertices.get(2));
        double cx = number(third.get(0));
        double cy = number(third.get(1));
        return new double[] {ax, ay, bx, by, cx, cy};
    }

    private static List<?> pairList(Object value) {
        if (!(value instanceof List) || ((List<?>) value).size() != 2) invalidInput();
        return (List<?>) value;
    }

    private static void validateUnitPair(Object value) {
        List<?> row = pairList(value);
        unit(row.get(0));
        unit(row.get(1));
    }

    private static double unit(Object value) {
        double result = number(value);
        if (result < 0.0 || result > 1.0) invalidInput();
        return result;
    }

    private static double number(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
                || value instanceof Float || value instanceof Double)) invalidInput();
        double result = ((Number) value).doubleValue();
        if (!Double.isFinite(result)) invalidInput();
        return zero(result);
    }

    private static long uint32(Object value) {
        double result = number(value);
        if (result < 0.0 || result > 4294967295.0 || result != Math.floor(result)) invalidInput();
        return (long) result;
    }

    private static int count(Object value) {
        double result = number(value);
        if (result < 0.0 || result > MAX_COUNT || result != Math.floor(result)) invalidInput();
        return (int) result;
    }

    private static long accessIndex(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
                || value instanceof Float || value instanceof Double)) throw new TrianglePointsException("INVALID_INDEX");
        double result = ((Number) value).doubleValue();
        if (!Double.isFinite(result) || result < 0.0 || result > MAX_SAFE_INTEGER || result != Math.floor(result))
            throw new TrianglePointsException("INVALID_INDEX");
        return (long) result;
    }

    private static void invalidInput() {
        throw new TrianglePointsException("INVALID_INPUT");
    }

    private static double zero(double value) {
        return value == 0.0 ? 0.0 : value;
    }

    /** Private xoshiro128** 1.1 stream specified by the frozen seeded contract. */
    private static final class Xoshiro128StarStar11 {
        private int s0;
        private int s1;
        private int s2;
        private int s3;

        Xoshiro128StarStar11(long seed) {
            long state = seed & 0xffffffffL;
            state += 0x9e3779b97f4a7c15L;
            long first = splitmixOutput(state);
            state += 0x9e3779b97f4a7c15L;
            long second = splitmixOutput(state);
            s0 = (int) first;
            s1 = (int) (first >>> 32);
            s2 = (int) second;
            s3 = (int) (second >>> 32);
            if ((s0 | s1 | s2 | s3) == 0) throw new AssertionError("all-zero xoshiro state");
        }

        double unit() {
            return ((double) Integer.toUnsignedLong(nextU32())) / 4294967296.0;
        }

        private int nextU32() {
            int output = Integer.rotateLeft(s1 * 5, 7) * 9;
            int temporary = s1 << 9;
            s2 ^= s0;
            s3 ^= s1;
            s1 ^= s2;
            s0 ^= s3;
            s2 ^= temporary;
            s3 = Integer.rotateLeft(s3, 11);
            return output;
        }

        private static long splitmixOutput(long state) {
            long mixed = state;
            mixed = (mixed ^ (mixed >>> 30)) * 0xbf58476d1ce4e5b9L;
            mixed = (mixed ^ (mixed >>> 27)) * 0x94d049bb133111ebL;
            return mixed ^ (mixed >>> 31);
        }
    }
}
