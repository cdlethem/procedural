package org.procedurals.geometry;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Ordered outward point deformation motivated by
 * {@code survey/out/2019/generativos/colidion/notes.md}.
 * Each disc receives the point changed by preceding discs. Exact centers use positiveX;
 * later discs may undo earlier exclusion. This is not collision resolution or clipping.
 * Strength is explicit caller data with no default or recommended artistic range.
 */
public strictfp final class DiscProjection2D {
    /** Stable contract failure with no partially published result. */
    public static final class DiscProjectionException extends IllegalArgumentException {
        public final String code;
        DiscProjectionException(String code) { super(code); this.code = code; }
    }

    private static final long MAX_SAFE = 9007199254740991L;
    private final double[] coordinates;

    private DiscProjection2D(double[] coordinates) { this.coordinates = coordinates; }

    /** Projects exact points/discs/strength/maxTests records; inputs are never retained. */
    public static DiscProjection2D project(Object input) {
        if (!(input instanceof Map)) invalid();
        Map<?, ?> record = (Map<?, ?>) input;
        keys(record, "points", "discs", "strength", "maxTests");
        double[] points = rows(record.get("points"), 2);
        double[] discs = rows(record.get("discs"), 3);
        double strength = number(record.get("strength"));
        checkStrength(strength);
        double budget = number(record.get("maxTests"));
        if (budget < 0 || budget > MAX_SAFE || budget != Math.floor(budget)) invalid();
        return calculate(points, discs, strength, (long) budget);
    }

    /**
     * Projects packed xy points through ordered centerX/centerY/radius triples.
     * All values must be finite, radii positive, strength in[0,1], and maxTests a safe
     * nonnegative integer. No default/range recommendation; all N*M tests count even
     * at strength zero. Caller buffers must remain stable throughout the call.
     */
    public static DiscProjection2D project(double[] points, double[] discs,
            double strength, long maxTests) {
        if (points == null || points.length % 2 != 0) invalid();
        for (double value : points) finite(value);
        if (discs == null || discs.length % 3 != 0) invalid();
        for (int i = 0; i < discs.length; i++) {
            finite(discs[i]);
            if (i % 3 == 2 && discs[i] <= 0) invalid();
        }
        checkStrength(strength);
        if (maxTests < 0 || maxTests > MAX_SAFE) invalid();
        return calculate(points, discs, strength, maxTests);
    }

    private static DiscProjection2D calculate(double[] points, double[] discs,
            double strength, long maxTests) {
        long tests = (points.length / 2L) * (discs.length / 3L);
        if (tests > maxTests) throw error("WORK_LIMIT");
        double[] output = new double[points.length];
        for (int i = 0; i < points.length; i += 2) {
            double x = points[i];
            double y = points[i + 1];
            if (strength != 0) {
                for (int j = 0; j < discs.length; j += 3) {
                    double dx = x - discs[j];
                    double dy = y - discs[j + 1];
                    if (Double.isInfinite(dx) || Double.isInfinite(dy)) continue;
                    double hi = Math.max(Math.abs(dx), Math.abs(dy));
                    double lo = Math.min(Math.abs(dx), Math.abs(dy));
                    double distance = 0;
                    if (hi != 0) {
                        double ratio = lo / hi;
                        double square = ratio * ratio;
                        double root = Math.sqrt(1 + square);
                        distance = hi * root;
                    }
                    double radius = discs[j + 2];
                    if (distance >= radius) continue; // Includes infinite distance.
                    double ux = distance == 0 ? 1 : dx / distance;
                    double uy = distance == 0 ? 0 : dy / distance;
                    double gap = radius - distance;
                    double movement = strength * gap;
                    double moveX = ux * movement;
                    double moveY = uy * movement;
                    double nextX = x + moveX;
                    double nextY = y + moveY;
                    if (!Double.isFinite(nextX) || !Double.isFinite(nextY)) {
                        throw error("NUMERIC_OVERFLOW");
                    }
                    x = nextX;
                    y = nextY;
                }
            }
            output[i] = positiveZero(x);
            output[i + 1] = positiveZero(y);
        }
        return new DiscProjection2D(output);
    }

    /** Returns the retained number of points. */
    public int size() { return coordinates.length / 2; }

    /** Returns a detached packed xy buffer. */
    public double[] points() { return coordinates.clone(); }

    /** Returns detached portable point rows under the points key. */
    public Map<String, Object> toValues() {
        List<Object> rows = new ArrayList<Object>(size());
        for (int i = 0; i < coordinates.length; i += 2) {
            rows.add(Arrays.asList(coordinates[i], coordinates[i + 1]));
        }
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("points", rows);
        return result;
    }

    /**
     * Writes one point atomically. INVALID_INDEX precedes INDEX_OUT_OF_RANGE, which
     * precedes INVALID_OUTPUT for a null/short target or invalid offset.
     */
    public void pointInto(long index, double[] target, int offset) {
        if (index < 0 || index > MAX_SAFE) throw error("INVALID_INDEX");
        if (index >= size()) throw error("INDEX_OUT_OF_RANGE");
        if (target == null || offset < 0 || offset > target.length - 2) {
            throw error("INVALID_OUTPUT");
        }
        int start = (int) index * 2;
        target[offset] = coordinates[start];
        target[offset + 1] = coordinates[start + 1];
    }

    private static double[] rows(Object input, int stride) {
        if (!(input instanceof List)) invalid();
        List<?> rows = (List<?>) input;
        if (rows.size() > Integer.MAX_VALUE / stride) invalid();
        double[] output = new double[rows.size() * stride];
        int index = 0;
        for (Object item : rows) {
            if (!(item instanceof List)) invalid();
            List<?> row = (List<?>) item;
            if (row.size() != stride) invalid();
            int column = 0;
            for (Object value : row) {
                double number = number(value);
                if (stride == 3 && column == 2 && number <= 0) invalid();
                output[index++] = number;
                column++;
            }
        }
        return output;
    }

    private static void checkStrength(double strength) {
        finite(strength);
        if (strength < 0 || strength > 1) invalid();
    }

    private static double number(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double)) invalid();
        double number = ((Number) value).doubleValue();
        finite(number);
        return number;
    }

    private static void finite(double value) { if (!Double.isFinite(value)) invalid(); }
    private static double positiveZero(double value) { return value == 0 ? 0 : value; }
    private static void keys(Map<?, ?> record, String... keys) {
        if (record.size() != keys.length) invalid();
        for (String key : keys) if (!record.containsKey(key)) invalid();
    }
    private static void invalid() { throw error("INVALID_INPUT"); }
    private static DiscProjectionException error(String code) { return new DiscProjectionException(code); }
}
