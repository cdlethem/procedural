package org.procedurals.geometry;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Exact-topology clipping of supplied line segments against one simple polygon.
 * This operation is motivated by the retained clipping dependency in
 * {@code survey/out/2014/Generativos/Forms/forms1/notes.md}; hatch generation,
 * drawing, styling, and polygon boolean operations are deliberately outside it.
 * Inputs are binary64 coordinates and the topology is evaluated exactly before
 * each retained interval is rounded once to binary64.
 */
public final strictfp class SegmentClip2D {
    private static final long MAX_SAFE = 9007199254740991L;
    private static final int MAX_VERTICES = 1073741823;
    private static final int MAX_SEGMENTS = 536870911;
    private static final int MAX_OUTPUT = 536870911;
    private static final String[] KEYS = {"polygon", "segments", "maxWork", "maxOutputSegments"};
    private final double[] segments;
    private final double[] intervals;
    private final int[] sourceIndices;
    private final int size;

    /** Stable operation failure. Dynamic failures identify their source and merged interval. */
    public static final class SegmentClipException extends IllegalArgumentException {
        private static final long serialVersionUID = 1L;
        /** Catalog error code. */
        public final String code;
        /** Source ordinal for dynamic failures, otherwise {@code -1}. */
        public final int sourceIndex;
        /** Merged retained interval ordinal for dynamic failures, otherwise {@code -1}. */
        public final int intervalIndex;
        /** Representation-collapse stage ({@code parameter}, {@code endpoints}, or {@code gap}), otherwise null. */
        public final String stage;
        private SegmentClipException(String code) { this(code, -1, -1, null); }
        private SegmentClipException(String code, int sourceIndex, int intervalIndex, String stage) {
            super(code); this.code = code; this.sourceIndex = sourceIndex; this.intervalIndex = intervalIndex; this.stage = stage;
        }
    }

    private SegmentClip2D(Packed output) {
        // Packed owns these arrays only until this constructor returns. Retaining the backing
        // storage avoids an otherwise duplicate K-sized materialization at completion.
        this.segments = output.segments;
        this.intervals = output.intervals;
        this.sourceIndices = output.sources;
        this.size = output.size;
    }

    /**
     * Clips a passive record with exactly {@code polygon}, {@code segments}, {@code maxWork},
     * and {@code maxOutputSegments}. Polygon rows are finite coordinate pairs; source rows are
     * finite coordinate quadruples. Numeric values must be Byte, Short, Integer, Long, Float,
     * or Double. Static malformed-input failures precede work and topology failures.
     *
     * @throws SegmentClipException with a catalog code when the record, budget, polygon, output,
     *         or binary64 representation violates the operation contract
     * @throws OutOfMemoryError when the host cannot allocate required owned output
     * @param input passive record using the exact catalog input-schema keys and carriers
     * @return an owned packed clipping result
     */
    public static SegmentClip2D clip(Object input) {
        if (!(input instanceof Map)) throw error("INVALID_INPUT");
        Map<?, ?> record = (Map<?, ?>) input;
        keys(record);
        double[] polygon = validateRows(record.get("polygon"), 2, 3, MAX_VERTICES);
        double[] rawSegments = validateRows(record.get("segments"), 4, 0, MAX_SEGMENTS);
        long maxWork = integer(record.get("maxWork"), MAX_SAFE);
        long maxOutput = integer(record.get("maxOutputSegments"), MAX_OUTPUT);
        BigInteger v = BigInteger.valueOf(polygon.length / 2);
        BigInteger s = BigInteger.valueOf(rawSegments.length / 4);
        BigInteger vv = v.multiply(v);
        BigInteger work = vv.add(s.multiply(vv.multiply(BigInteger.valueOf(8)).add(v.multiply(BigInteger.valueOf(16))).add(BigInteger.valueOf(8))));
        if (work.compareTo(BigInteger.valueOf(maxWork)) > 0) throw error("WORK_LIMIT_EXCEEDED");
        Point[] region = points(polygon);
        validatePolygon(region);
        return new SegmentClip2D(calculate(region, rawSegments, (int) maxOutput));
    }

    /**
     * Returns the number of retained positive-length output segments.
     *
     * @return retained output count
     */
    public int size() { return size; }

    /**
     * Returns the original source ordinal for an output interval.
     *
     * @param index finite nonnegative safe integer output index
     * @return original segment ordinal
     * @throws SegmentClipException {@code INVALID_INDEX} or {@code INDEX_OUT_OF_RANGE}
     */
    public int sourceIndexAt(long index) { return sourceIndices[index(index)]; }
    /**
     * Numeric-carrier overload for {@link #sourceIndexAt(long)}.
     *
     * @param index Byte, Short, Integer, Long, Float, or Double safe integer index
     * @return original segment ordinal
     * @throws SegmentClipException {@code INVALID_INDEX} or {@code INDEX_OUT_OF_RANGE}
     */
    public int sourceIndexAt(Object index) { return sourceIndexAt(accessIndex(index)); }

    /**
     * Returns a detached {@code [startX,startY,endX,endY]} output segment.
     *
     * @param index finite nonnegative safe integer output index
     * @return a newly allocated four-coordinate row
     * @throws SegmentClipException {@code INVALID_INDEX} or {@code INDEX_OUT_OF_RANGE}
     */
    public double[] segmentAt(long index) { int i = index(index) * 4; return new double[] {segments[i], segments[i+1], segments[i+2], segments[i+3]}; }
    /**
     * Numeric-carrier overload for {@link #segmentAt(long)}.
     *
     * @param index Byte, Short, Integer, Long, Float, or Double safe integer index
     * @return a newly allocated four-coordinate row
     * @throws SegmentClipException {@code INVALID_INDEX} or {@code INDEX_OUT_OF_RANGE}
     */
    public double[] segmentAt(Object index) { return segmentAt(accessIndex(index)); }

    /**
     * Writes one output segment at {@code offset}. Index validation precedes destination
     * validation and no destination slot changes if either validation fails.
     *
     * @param index finite nonnegative safe integer output index
     * @param destination destination array, requiring four writable slots
     * @param offset first destination slot
     * @throws SegmentClipException {@code INVALID_INDEX}, {@code INDEX_OUT_OF_RANGE}, or
     *         {@code INVALID_OUTPUT}, in that precedence order
     */
    public void segmentInto(long index, double[] destination, int offset) {
        int i = index(index); destination(destination, offset, 4); i *= 4;
        destination[offset]=segments[i]; destination[offset+1]=segments[i+1]; destination[offset+2]=segments[i+2]; destination[offset+3]=segments[i+3];
    }
    /**
     * Numeric-carrier overload for {@link #segmentInto(long,double[],int)}.
     *
     * @param index Byte, Short, Integer, Long, Float, or Double safe integer index
     * @param destination destination array, requiring four writable slots
     * @param offset first destination slot
     * @throws SegmentClipException indexed and destination failures as for the long overload
     */
    public void segmentInto(Object index, double[] destination, int offset) { segmentInto(accessIndex(index), destination, offset); }

    /**
     * Returns a detached {@code [t0,t1]} parameter interval.
     *
     * @param index finite nonnegative safe integer output index
     * @return a newly allocated two-coordinate parameter row
     * @throws SegmentClipException {@code INVALID_INDEX} or {@code INDEX_OUT_OF_RANGE}
     */
    public double[] intervalAt(long index) { int i = index(index) * 2; return new double[] {intervals[i], intervals[i+1]}; }
    /**
     * Numeric-carrier overload for {@link #intervalAt(long)}.
     *
     * @param index Byte, Short, Integer, Long, Float, or Double safe integer index
     * @return a newly allocated two-coordinate parameter row
     * @throws SegmentClipException {@code INVALID_INDEX} or {@code INDEX_OUT_OF_RANGE}
     */
    public double[] intervalAt(Object index) { return intervalAt(accessIndex(index)); }

    /**
     * Writes one parameter interval atomically after complete index and destination validation.
     *
     * @param index finite nonnegative safe integer output index
     * @param destination destination array, requiring two writable slots
     * @param offset first destination slot
     * @throws SegmentClipException indexed and destination failures as for {@link #segmentInto(long, double[], int)}
     */
    public void intervalInto(long index, double[] destination, int offset) {
        int i = index(index); destination(destination, offset, 2); i *= 2;
        destination[offset]=intervals[i]; destination[offset+1]=intervals[i+1];
    }
    /**
     * Numeric-carrier overload for {@link #intervalInto(long,double[],int)}.
     *
     * @param index Byte, Short, Integer, Long, Float, or Double safe integer index
     * @param destination destination array, requiring two writable slots
     * @param offset first destination slot
     * @throws SegmentClipException indexed and destination failures as for the long overload
     */
    public void intervalInto(Object index, double[] destination, int offset) { intervalInto(accessIndex(index), destination, offset); }

    /**
     * Returns a detached passive output record in catalog order: {@code segments},
     * {@code sourceIndices}, and {@code intervals}. Nested rows are independently mutable.
     *
     * @return detached output-schema record with detached nested lists
     */
    public Map<String, Object> toValues() {
        List<Object> ss = new ArrayList<Object>(size), ids = new ArrayList<Object>(size), ts = new ArrayList<Object>(size);
        for (int i=0;i<size();i++) { ss.add(asList(segments, i*4, 4)); ids.add(Integer.valueOf(sourceIndices[i])); ts.add(asList(intervals, i*2, 2)); }
        Map<String,Object> values = new LinkedHashMap<String,Object>(); values.put("segments", ss); values.put("sourceIndices", ids); values.put("intervals", ts); return values;
    }

    private static Packed calculate(Point[] region, double[] raw, int limit) {
        Packed output = new Packed();
        for (int source = 0; source < raw.length / 4; source++) {
            int base = source * 4;
            Point a = point(raw[base], raw[base + 1]);
            Point b = point(raw[base + 2], raw[base + 3]);
            Point direction = subtract(b, a);
            if (same(a,b)) continue;
            ArrayList<ExactRational> cuts = new ArrayList<ExactRational>(region.length + 2);
            cuts.add(ExactRational.ZERO);
            cuts.add(ExactRational.ONE);
            for (int edge = 0; edge < region.length; edge++)
                addCuts(cuts, a, direction, region[edge], region[(edge + 1) % region.length]);
            Collections.sort(cuts);
            ArrayList<ExactRational> unique = unique(cuts);
            ArrayList<Interval> retained = new ArrayList<Interval>();
            for (int i = 0; i + 1 < unique.size(); i++) {
                ExactRational lo = unique.get(i);
                ExactRational hi = unique.get(i + 1);
                if (lo.equals(hi)) continue;
                Point midpoint = at(a, direction, lo.add(hi).divide(ExactRational.TWO));
                if (contains(region, midpoint)) {
                    if (!retained.isEmpty() && retained.get(retained.size() - 1).t1.equals(lo))
                        retained.get(retained.size() - 1).t1 = hi;
                    else
                        retained.add(new Interval(lo, hi));
                }
            }
            double previousEnd = 0;
            boolean hasPrevious = false;
            for (int i = 0; i < retained.size(); i++) {
                if (output.size() == limit) throw dynamic("OUTPUT_LIMIT_EXCEEDED", source, i, null);
                Interval interval = retained.get(i);
                double t0 = zero(interval.t0.value());
                double t1 = zero(interval.t1.value());
                if (t0 >= t1) throw dynamic("REPRESENTATION_COLLAPSE", source, i, "parameter");
                Point exactA = at(a, direction, interval.t0);
                Point exactB = at(a, direction, interval.t1);
                double ax = zero(interval.t0.equals(ExactRational.ZERO) ? raw[base] : exactA.x.value());
                double ay = zero(interval.t0.equals(ExactRational.ZERO) ? raw[base + 1] : exactA.y.value());
                double bx = zero(interval.t1.equals(ExactRational.ONE) ? raw[base + 2] : exactB.x.value());
                double by = zero(interval.t1.equals(ExactRational.ONE) ? raw[base + 3] : exactB.y.value());
                if (ax == bx && ay == by) throw dynamic("REPRESENTATION_COLLAPSE", source, i, "endpoints");
                if (hasPrevious && previousEnd >= t0) throw dynamic("REPRESENTATION_COLLAPSE", source, i, "gap");
                output.add(ax, ay, bx, by, t0, t1, source);
                previousEnd = t1;
                hasPrevious = true;
            }
        }
        return output;
    }

    private static void keys(Map<?, ?> map) {
        if (map.size() != KEYS.length) throw error("INVALID_INPUT");
        for (String key : KEYS) if (!map.containsKey(key)) throw error("INVALID_INPUT");
        for (Object key : map.keySet())
            if (!(key instanceof String) || !known((String) key)) throw error("INVALID_INPUT");
    }

    private static boolean known(String value) {
        for (String key : KEYS) if (key.equals(value)) return true;
        return false;
    }
    private static double[] validateRows(Object value,int width,int min,int max) {
        if (!(value instanceof List)) throw error("INVALID_INPUT");
        List<?> rows = (List<?>) value;
        if (rows.size() < min || rows.size() > max) throw error("INVALID_INPUT");
        long total = (long) rows.size() * width;
        if (total > Integer.MAX_VALUE) throw error("INVALID_INPUT");
        double[] result = new double[(int) total];
        int at = 0;
        for (Object row : rows) {
            if (!(row instanceof List) || ((List<?>) row).size() != width) throw error("INVALID_INPUT");
            for (Object item : (List<?>) row) result[at++] = number(item);
        }
        return result;
    }
    private static double number(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double))
            throw error("INVALID_INPUT");
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number)) throw error("INVALID_INPUT");
        return zero(number);
    }

    private static long integer(Object value, long maximum) {
        double number = number(value);
        if (number < 0 || number > maximum || number != Math.floor(number)) throw error("INVALID_INPUT");
        return (long) number;
    }

    private static Point[] points(double[] raw) {
        Point[] points = new Point[raw.length / 2];
        for (int i = 0; i < points.length; i++) points[i] = point(raw[i * 2], raw[i * 2 + 1]);
        return points;
    }
    private static void validatePolygon(Point[] p) {
        ExactRational area = ExactRational.ZERO;
        for (int i = 0; i < p.length; i++) {
            for (int j = i + 1; j < p.length; j++)
                if (same(p[i], p[j])) throw error("INVALID_POLYGON");
            Point a = p[i], b = p[(i + 1) % p.length], previous = p[(i + p.length - 1) % p.length];
            area = area.add(cross(a, b));
            if (cross(subtract(a, previous), subtract(b, a)).signum() == 0
                    && dot(subtract(a, previous), subtract(b, a)).signum() <= 0)
                throw error("INVALID_POLYGON");
        }
        if (area.signum() == 0) throw error("INVALID_POLYGON");
        for (int i = 0; i < p.length; i++)
            for (int j = i + 1; j < p.length; j++)
                if (j != i + 1 && !(i == 0 && j == p.length - 1)
                        && meet(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length]))
                    throw error("INVALID_POLYGON");
    }

    private static void addCuts(List<ExactRational> cuts, Point source, Point direction,
            Point edgeStart, Point edgeEnd) {
        Point edge = subtract(edgeEnd, edgeStart);
        Point offset = subtract(edgeStart, source);
        ExactRational denominator = cross(direction, edge);
        if (denominator.signum() != 0) {
            ExactRational t = cross(offset, edge).divide(denominator);
            ExactRational u = cross(offset, direction).divide(denominator);
            if (unit(t) && unit(u)) cuts.add(t);
        } else if (cross(offset, direction).signum() == 0) {
            boolean xAxis = direction.x.signum() != 0;
            ExactRational first = coordinate(edgeStart, xAxis).subtract(coordinate(source, xAxis))
                    .divide(coordinate(direction, xAxis));
            ExactRational second = coordinate(edgeEnd, xAxis).subtract(coordinate(source, xAxis))
                    .divide(coordinate(direction, xAxis));
            if (unit(first)) cuts.add(first);
            if (unit(second)) cuts.add(second);
        }
    }

    private static ArrayList<ExactRational> unique(List<ExactRational> cuts) {
        ArrayList<ExactRational> result = new ArrayList<ExactRational>();
        for (ExactRational cut : cuts)
            if (result.isEmpty() || !result.get(result.size() - 1).equals(cut)) result.add(cut);
        return result;
    }

    private static boolean contains(Point[] polygon, Point point) {
        boolean inside = false;
        for (int i = 0; i < polygon.length; i++) {
            Point first = polygon[i];
            Point second = polygon[(i + 1) % polygon.length];
            if (on(first, second, point)) return true;
            if ((first.y.compareTo(point.y) > 0) != (second.y.compareTo(point.y) > 0)) {
                ExactRational crossingX = first.x.add(point.y.subtract(first.y)
                        .multiply(second.x.subtract(first.x)).divide(second.y.subtract(first.y)));
                if (point.x.compareTo(crossingX) < 0) inside = !inside;
            }
        }
        return inside;
    }

    private static boolean meet(Point a, Point b, Point c, Point d) {
        return on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b)
                || cross(subtract(b, a), subtract(c, a)).signum()
                * cross(subtract(b, a), subtract(d, a)).signum() < 0
                && cross(subtract(d, c), subtract(a, c)).signum()
                * cross(subtract(d, c), subtract(b, c)).signum() < 0;
    }

    private static boolean on(Point start, Point end, Point point) {
        return cross(subtract(end, start), subtract(point, start)).signum() == 0
                && between(point.x, start.x, end.x) && between(point.y, start.y, end.y);
    }

    private static boolean between(ExactRational value, ExactRational a, ExactRational b) {
        return value.compareTo(a.compareTo(b) <= 0 ? a : b) >= 0
                && value.compareTo(a.compareTo(b) <= 0 ? b : a) <= 0;
    }

    private static Point point(double x, double y) {
        return new Point(ExactRational.of(x), ExactRational.of(y));
    }

    private static Point subtract(Point a, Point b) {
        return new Point(a.x.subtract(b.x), a.y.subtract(b.y));
    }

    private static Point at(Point a, Point d, ExactRational t) {
        return new Point(a.x.add(d.x.multiply(t)), a.y.add(d.y.multiply(t)));
    }

    private static ExactRational cross(Point a, Point b) {
        return a.x.multiply(b.y).subtract(a.y.multiply(b.x));
    }

    private static ExactRational dot(Point a, Point b) {
        return a.x.multiply(b.x).add(a.y.multiply(b.y));
    }

    private static ExactRational coordinate(Point p, boolean x) {
        return x ? p.x : p.y;
    }

    private static boolean unit(ExactRational r) {
        return r.compareTo(ExactRational.ZERO) >= 0 && r.compareTo(ExactRational.ONE) <= 0;
    }

    private static boolean same(Point a, Point b) {
        return a.x.equals(b.x) && a.y.equals(b.y);
    }

    private static double zero(double x) {
        return x == 0.0 ? 0.0 : x;
    }

    private static List<Object> asList(double[] values, int at, int width) {
        List<Object> out = new ArrayList<Object>(width);
        for (int i = 0; i < width; i++) out.add(Double.valueOf(values[at + i]));
        return out;
    }

    private static long accessIndex(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double))
            throw error("INVALID_INDEX");
        double n = ((Number) value).doubleValue();
        if (!Double.isFinite(n) || n < 0 || n > MAX_SAFE || n != Math.floor(n))
            throw error("INVALID_INDEX");
        return (long) n;
    }

    private int index(long value) {
        if (value < 0 || value > MAX_SAFE) throw error("INVALID_INDEX");
        if (value >= size) throw error("INDEX_OUT_OF_RANGE");
        return (int) value;
    }

    private static void destination(double[] target, int offset, int width) {
        if (target == null || offset < 0 || offset > target.length - width)
            throw error("INVALID_OUTPUT");
    }

    private static SegmentClipException error(String code) {
        return new SegmentClipException(code);
    }

    private static SegmentClipException dynamic(String code, int source, int interval, String stage) {
        return new SegmentClipException(code, source, interval, stage);
    }

    private static final class Point {
        final ExactRational x;
        final ExactRational y;

        Point(ExactRational x, ExactRational y) {
            this.x = x;
            this.y = y;
        }
    }

    private static final class Interval {
        final ExactRational t0;
        ExactRational t1;

        Interval(ExactRational t0, ExactRational t1) {
            this.t0 = t0;
            this.t1 = t1;
        }
    }

    /** Growable private packed output; its backing arrays transfer to one completed result. */
    private static final class Packed {
        private double[] segments = new double[16];
        private double[] intervals = new double[8];
        private int[] sources = new int[4];
        private int size;

        int size() { return size; }

        void add(double startX, double startY, double endX, double endY,
                double t0, double t1, int source) {
            if (size == sources.length) grow();
            int segment = size * 4;
            int interval = size * 2;
            segments[segment] = startX;
            segments[segment + 1] = startY;
            segments[segment + 2] = endX;
            segments[segment + 3] = endY;
            intervals[interval] = t0;
            intervals[interval + 1] = t1;
            sources[size] = source;
            size++;
        }

        private void grow() {
            int next = sources.length > MAX_OUTPUT / 2 ? MAX_OUTPUT : sources.length * 2;
            segments = copy(segments, next * 4);
            intervals = copy(intervals, next * 2);
            sources = copy(sources, next);
        }

        private static double[] copy(double[] input, int length) {
            double[] result = new double[length];
            System.arraycopy(input, 0, result, 0, input.length);
            return result;
        }

        private static int[] copy(int[] input, int length) {
            int[] result = new int[length];
            System.arraycopy(input, 0, result, 0, input.length);
            return result;
        }
    }

}
