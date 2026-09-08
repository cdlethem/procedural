package org.procedurals.paths;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable closed uniform Catmull-Rom curve with approximate distance lookup.
 * Motivated by 2018/Generativos/blobs and 2018/Generativos/databol (survey notes).
 * Unlike their per-span lookup, this retains every chord distance. Coordinates and
 * subdivisions are caller data; the evidence establishes no recommended ranges.
 * Tangents are raw local-parameter derivatives, not unit vectors. No simple polygon
 * or exact arc-length guarantee is made. See closed-spline-contract.md for semantics.
 */
public strictfp final class ClosedSpline2D {
    /** Stable portable failure; no failed call exposes partial output. */
    public static final class SplineException extends IllegalArgumentException {
        public final String code;
        private SplineException(String code) { super(code); this.code = code; }
    }

    /** Detached position and raw local-parameter tangent; see class provenance. */
    public static final class Sample {
        private final double x, y, tx, ty;
        private Sample(double[] values) {
            x = values[0]; y = values[1]; tx = values[2]; ty = values[3];
        }
        /** Drawing-coordinate x; see class provenance. */
        public double x() { return x; }
        /** Drawing-coordinate y; see class provenance. */
        public double y() { return y; }
        /** Raw tangent x, possibly zero; see class provenance. */
        public double tangentX() { return tx; }
        /** Raw tangent y, possibly zero; see class provenance. */
        public double tangentY() { return ty; }
    }

    private final double[][] controls;
    private final int count, resolution;
    private final double[] a, b, c, d, cumulative;
    private final double length;

    private ClosedSpline2D(double[][] owned, int subdivisions) {
        controls = owned;
        count = owned.length;
        resolution = subdivisions;
        a = new double[2 * count]; b = new double[2 * count];
        c = new double[2 * count]; d = new double[2 * count];
        for (int span = 0; span < count; span++) {
            for (int axis = 0; axis < 2; axis++) {
                double p0 = controls[(span + count - 1) % count][axis];
                double p1 = controls[span][axis];
                double p2 = controls[(span + 1) % count][axis];
                double p3 = controls[(span + 2) % count][axis];
                int k = 2 * span + axis;
                a[k] = mul(0.5, add(sub(add(-p0, mul(3, p1)), mul(3, p2)), p3));
                b[k] = mul(0.5, sub(add(sub(mul(2, p0), mul(5, p1)), mul(4, p2)), p3));
                c[k] = mul(0.5, add(-p0, p2));
                d[k] = p1;
            }
        }
        cumulative = new double[(int) ((long) count * resolution + 1)];
        double total = 0;
        int index = 0;
        for (int span = 0; span < count; span++) {
            double previousX = controls[span][0], previousY = controls[span][1];
            for (int step = 1; step <= resolution; step++) {
                double t = step / (double) resolution;
                double x = position(span, t, 0), y = position(span, t, 1);
                double dx = sub(x, previousX), dy = sub(y, previousY);
                double chord = computed(StrictMath.hypot(dx, dy));
                total = add(total, chord);
                cumulative[++index] = total;
                previousX = x; previousY = y;
            }
        }
        length = positiveZero(total);
    }

    /** Create from explicit controls/resolution; see blobs/databol provenance above. */
    public static ClosedSpline2D create(double[][] controls, int subdivisions) {
        if (controls == null) throw failure("INVALID_INPUT");
        bounds(controls.length, subdivisions);
        double[][] owned = new double[controls.length][2];
        for (int i = 0; i < controls.length; i++) {
            if (controls[i] == null || controls[i].length != 2) throw failure("INVALID_INPUT");
            owned[i][0] = coordinate(controls[i][0]);
            owned[i][1] = coordinate(controls[i][1]);
        }
        return new ClosedSpline2D(owned, subdivisions);
    }

    /** Interchange constructor; exact keys, no defaults. See class provenance. */
    public static ClosedSpline2D create(Object input) {
        Map<?, ?> map = record(input, "controls", "subdivisions", "INVALID_INPUT");
        Object raw = map.get("controls");
        if (!(raw instanceof List)) throw failure("INVALID_INPUT");
        List<?> rows = (List<?>) raw;
        if (rows.size() < 3 || rows.size() > 268435455) throw failure("INVALID_INPUT");
        double r = number(map.get("subdivisions"), "INVALID_INPUT");
        if (r < 1 || r > 2147483646 || r != Math.floor(r)) throw failure("INVALID_INPUT");
        int subdivisions = (int) r;
        bounds(rows.size(), subdivisions);
        double[][] owned = new double[rows.size()][2];
        for (int i = 0; i < rows.size(); i++) {
            if (!(rows.get(i) instanceof List)) throw failure("INVALID_INPUT");
            List<?> pair = (List<?>) rows.get(i);
            if (pair.size() != 2) throw failure("INVALID_INPUT");
            owned[i][0] = number(pair.get(0), "INVALID_INPUT");
            owned[i][1] = number(pair.get(1), "INVALID_INPUT");
        }
        return new ClosedSpline2D(owned, subdivisions);
    }

    /** Retained chord-sum length, not exact perimeter; see class provenance. */
    public double length() { return length; }
    /** Supplied control count, including duplicates; see class provenance. */
    public int controlCount() { return count; }
    /** Explicit chords per span; no recommended value. See class provenance. */
    public int subdivisions() { return resolution; }

    /** Detached periodic parameter sample; one unit per span. See class provenance. */
    public Sample sampleParameter(double value) {
        double[] target = new double[4];
        sampleParameter(value, target);
        return new Sample(target);
    }

    /** Detached approximate-distance sample in drawing units. See class provenance. */
    public Sample sampleDistance(double value) {
        double[] target = new double[4];
        sampleDistance(value, target);
        return new Sample(target);
    }

    /** Allocation-free four-value parameter output; atomic on error. See class provenance. */
    public void sampleParameter(double value, double[] target) {
        query(value); target(target);
        double wrapped = wrap(value, count);
        int span = (int) Math.floor(wrapped);
        write(span, wrapped - span, target);
    }

    /** Allocation-free four-value distance output; atomic on error. See class provenance. */
    public void sampleDistance(double value, double[] target) {
        query(value); target(target);
        if (length == 0) { write(0, 0, target); return; }
        double wrapped = wrap(value, length);
        if (wrapped == 0) { write(0, 0, target); return; }
        int lo = 0, hi = cumulative.length - 1;
        while (lo + 1 < hi) {
            int mid = lo + (hi - lo) / 2;
            if (cumulative[mid] <= wrapped) lo = mid;
            else hi = mid;
        }
        double numerator = sub(wrapped, cumulative[lo]);
        double denominator = sub(cumulative[lo + 1], cumulative[lo]);
        double u = computed(numerator / denominator);
        double local = computed(add(lo % resolution, u) / resolution);
        // Keep span and local separate: adding them would introduce another rounding.
        write(lo / resolution, local, target);
    }

    private void write(int span, double t, double[] target) {
        if (t == 1) { span = (span + 1) % count; t = 0; }
        double x = position(span, t, 0), y = position(span, t, 1);
        double tx = tangent(span, t, 0), ty = tangent(span, t, 1);
        target[0] = positiveZero(x); target[1] = positiveZero(y);
        target[2] = positiveZero(tx); target[3] = positiveZero(ty);
    }

    private double position(int span, double t, int axis) {
        if (t == 1) return controls[(span + 1) % count][axis];
        if (t == 0) return controls[span][axis];
        int k = 2 * span + axis;
        return add(mul(add(mul(add(mul(a[k], t), b[k]), t), c[k]), t), d[k]);
    }

    private double tangent(int span, double t, int axis) {
        int k = 2 * span + axis;
        if (t == 0) return c[k];
        return add(mul(add(mul(mul(3, a[k]), t), mul(2, b[k])), t), c[k]);
    }

    /** Exact {mode,value} query to detached point/tangent lists; see class provenance. */
    public Map<String, Object> sample(Object input) {
        Map<?, ?> map = record(input, "mode", "value", "INVALID_QUERY");
        Object mode = map.get("mode");
        if (!"parameter".equals(mode) && !"distance".equals(mode)) throw failure("INVALID_QUERY");
        double value = number(map.get("value"), "INVALID_QUERY");
        double[] values = new double[4];
        if ("parameter".equals(mode)) sampleParameter(value, values);
        else sampleDistance(value, values);
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("point", Arrays.asList(values[0], values[1]));
        result.put("tangent", Arrays.asList(values[2], values[3]));
        return result;
    }

    /** Detached creation descriptor, retaining order and resolution; see class provenance. */
    public Map<String, Object> serialize() {
        List<Object> rows = new ArrayList<Object>(count);
        for (double[] point : controls) rows.add(Arrays.asList(point[0], point[1]));
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("controls", rows); result.put("subdivisions", resolution);
        return result;
    }

    private static void bounds(int count, int resolution) {
        if (count < 3 || count > 268435455 || resolution < 1
                || (long) count * resolution > 2147483646L) throw failure("INVALID_INPUT");
    }
    private static Map<?, ?> record(Object raw, String first, String second, String code) {
        if (!(raw instanceof Map)) throw failure(code);
        Map<?, ?> map = (Map<?, ?>) raw;
        if (map.size() != 2 || !map.containsKey(first) || !map.containsKey(second)) throw failure(code);
        return map;
    }
    private static double number(Object raw, String code) {
        if (!(raw instanceof Byte || raw instanceof Short || raw instanceof Integer
                || raw instanceof Long || raw instanceof Float || raw instanceof Double)) throw failure(code);
        double value = ((Number) raw).doubleValue();
        if (!Double.isFinite(value)) throw failure(code);
        return positiveZero(value);
    }
    private static double coordinate(double value) {
        if (!Double.isFinite(value)) throw failure("INVALID_INPUT");
        return positiveZero(value);
    }
    private static void query(double value) {
        if (!Double.isFinite(value)) throw failure("INVALID_QUERY");
    }
    private static void target(double[] target) {
        if (target == null || target.length != 4) throw failure("INVALID_QUERY");
    }
    private static double wrap(double value, double period) {
        double wrapped = value % period;
        if (wrapped < 0) wrapped = add(wrapped, period);
        return wrapped == period ? 0 : positiveZero(wrapped);
    }
    private static double positiveZero(double value) { return value == 0 ? 0 : value; }
    private static double computed(double value) {
        if (!Double.isFinite(value)) throw failure("NUMERIC_OVERFLOW");
        return value;
    }
    private static double add(double a, double b) { return computed(a + b); }
    private static double sub(double a, double b) { return computed(a - b); }
    private static double mul(double a, double b) { return computed(a * b); }
    private static SplineException failure(String code) { return new SplineException(code); }
}
