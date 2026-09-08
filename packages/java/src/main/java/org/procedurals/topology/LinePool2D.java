package org.procedurals.topology;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Retained ordered segments for {@code topology.seeded-line-pool-2d} 0.1.0.
 *
 * <p>This independently specified generator is motivated by
 * {@code survey/out/2019/generativos/brotes/notes.md}.  It owns a private
 * xoshiro stream and only retains final segment coordinates and division flags;
 * placement, colours, tips, ancestry, and rendering belong to a composition.</p>
 */
public final strictfp class LinePool2D {
    private static final int MAX_SEGMENTS = 536870911;
    private static final long MAX_SAFE_INTEGER = 9007199254740991L;
    private static final String[] KEYS = {
            "seed", "segment", "attempts", "firstCutAngleScale", "minCutLength", "maxSegments"
    };

    /** Static input or accessor validation failure with a stable catalog {@link #code}. */
    public static final class LinePoolException extends IllegalArgumentException {
        public final String code;

        LinePoolException(String code) {
            super(code);
            this.code = code;
        }
    }

    /** A checked transition intermediate became nonfinite. */
    public static final class ArithmeticOverflowException extends ArithmeticException {
        public final String code = "ARITHMETIC_OVERFLOW";
        public final int attempt;
        public final String stage;
        /** Zero-based child append ordinal; absent for non-child stages. */
        public final Integer childOrdinal;

        ArithmeticOverflowException(int attempt, String stage) {
            this(attempt, stage, null);
        }

        ArithmeticOverflowException(int attempt, String stage, int childOrdinal) {
            this(attempt, stage, Integer.valueOf(childOrdinal));
        }

        private ArithmeticOverflowException(int attempt, String stage, Integer childOrdinal) {
            super("ARITHMETIC_OVERFLOW");
            this.attempt = attempt;
            this.stage = stage;
            this.childOrdinal = childOrdinal;
        }
    }

    /** Appending the selected policy children would exceed the configured capacity. */
    public static final class SegmentLimitException extends IllegalArgumentException {
        public final String code = "SEGMENT_LIMIT_EXCEEDED";
        public final int attempt;
        public final int selectedIndex;

        SegmentLimitException(int attempt, int selectedIndex) {
            super("SEGMENT_LIMIT_EXCEEDED");
            this.attempt = attempt;
            this.selectedIndex = selectedIndex;
        }
    }

    private final double[] coordinates;
    private final boolean[] divided;
    private final int attempts;
    private final int successfulCuts;
    private final int skips;

    private LinePool2D(Storage storage, int attempts, int successfulCuts, int skips) {
        this.coordinates = storage.coordinates;
        this.divided = storage.divided;
        this.attempts = attempts;
        this.successfulCuts = successfulCuts;
        this.skips = skips;
    }

    /**
     * Generates a detached pool from the required passive Java carrier record.
     * The parameter decision is recorded in
     * {@code design/capabilities/line-pool-admission.md}: the inspected control
     * experiment tested 9,000, 90,000, and 180,000 attempts, and first-cut angle
     * scales 0.7, 1.4, and 2.1. Those discrete observations do not establish a
     * default or continuous encouraged range. {@code minCutLength} is a caller
     * coordinate-unit termination threshold based on the source's 4-unit skip,
     * not a measured artistic range.
     */
    public static LinePool2D generate(Object config) {
        Map<?, ?> record = record(config, KEYS);
        long seed = uint32(record.get("seed"));
        double[] initial = segment(record.get("segment"));
        int attempts = attempts(record.get("attempts"));
        double firstCutAngleScale = nonnegative(record.get("firstCutAngleScale"));
        double minCutLength = positive(record.get("minCutLength"));
        int maxSegments = maximum(record.get("maxSegments"));

        Storage storage = new Storage(maxSegments);
        storage.append(initial[0], initial[1], initial[2], initial[3], false);
        if (attempts == 0) return new LinePool2D(storage.finish(), 0, 0, 0);

        Xoshiro128StarStar11 stream = new Xoshiro128StarStar11(seed);
        int successfulCuts = 0;
        int skips = 0;
        for (int attempt = 0; attempt < attempts; attempt++) {
            int selectedIndex = Math.min(storage.size - 1,
                    (int) Math.floor((stream.unit() * storage.size) * range(0.8, 1.0, stream)));
            int base = selectedIndex * 4;
            double sx = storage.coordinates[base];
            double sy = storage.coordinates[base + 1];
            double ex = storage.coordinates[base + 2];
            double ey = storage.coordinates[base + 3];
            double dx = checked(ex - sx, attempt, "difference_x");
            double dy = checked(ey - sy, attempt, "difference_y");
            double xx = checked(dx * dx, attempt, "square_x");
            double yy = checked(dy * dy, attempt, "square_y");
            double squared = checked(xx + yy, attempt, "squared_length");
            double length = StrictMath.sqrt(squared);
            double heading = StrictMath.atan2(dy, dx);
            if (length < minCutLength) {
                skips++;
                continue;
            }

            double fraction = range(range(0.6, 0.7, stream), range(0.0, 0.8, stream), stream);
            boolean wasDivided = storage.divided[selectedIndex];
            if (wasDivided) fraction = fraction * 0.4;
            double remainder = length * (1.0 - fraction);

            boolean firstPresent = false;
            boolean firstContinuation = false;
            double firstTurn = 0.0;
            double firstDistance = 0.0;
            double firstContinuationX = 0.0;
            double firstContinuationY = 0.0;
            boolean secondPresent = false;
            double secondTurn = 0.0;
            double secondDistance = 0.0;
            int childCount;
            if (!wasDivided) {
                double a = checked(range(0.0, 1.2, stream) * range(0.2, 1.0, stream)
                        * firstCutAngleScale, attempt, "spread_positive");
                double b = checked(range(0.0, 1.2, stream) * range(0.2, 1.0, stream)
                        * firstCutAngleScale, attempt, "spread_negative");
                stream.unit();
                double l0 = checked(remainder * range(0.9, 1.2, stream), attempt, "length_positive");
                double l1 = checked(remainder * range(0.9, 1.2, stream), attempt, "length_negative");
                double l2 = checked(remainder * range(0.9, 1.2, stream), attempt, "length_straight");
                double h0 = checked(heading + a, attempt, "heading_positive");
                double h1 = checked(heading - b, attempt, "heading_negative");
                double h2 = checked(heading + range(-0.1, 0.1, stream), attempt, "heading_straight");
                int choice = Math.min(2, (int) Math.floor(3.0 * stream.unit()));
                if (choice == 0) {
                    childCount = 0;
                } else if (choice == 1) {
                    firstPresent = true;
                    firstTurn = h0;
                    firstDistance = l0;
                    secondPresent = true;
                    secondTurn = h1;
                    secondDistance = l1;
                    childCount = 2;
                } else {
                    firstPresent = true;
                    firstTurn = h2;
                    firstDistance = l2;
                    childCount = 1;
                }
            } else {
                double deviation = range(0.1, 0.4, stream);
                double sign = stream.unit() < 0.5 ? -1.0 : 1.0;
                deviation = (deviation * sign) * 2.0;
                double distance = checked(remainder * range(0.9, 1.1, stream), attempt, "length_repeat");
                double turn = checked(heading + deviation, attempt, "heading_repeat");
                firstPresent = true;
                firstContinuation = true;
                firstContinuationX = ex;
                firstContinuationY = ey;
                secondPresent = true;
                secondTurn = turn;
                secondDistance = distance;
                childCount = 2;
            }

            if (storage.size + childCount > maxSegments)
                throw new SegmentLimitException(attempt, selectedIndex);
            double nx = checked(sx + checked(dx * fraction, attempt, "cut_delta_x"), attempt, "cut_x");
            double ny = checked(sy + checked(dy * fraction, attempt, "cut_delta_y"), attempt, "cut_y");

            double firstEndX = 0.0;
            double firstEndY = 0.0;
            boolean firstDivided = false;
            if (firstPresent) {
                if (firstContinuation) {
                    firstEndX = firstContinuationX;
                    firstEndY = firstContinuationY;
                    firstDivided = true;
                } else {
                    firstEndX = checked(nx + checked(StrictMath.cos(firstTurn) * firstDistance,
                            attempt, "child_delta_x", 0), attempt, "child_x", 0);
                    firstEndY = checked(ny + checked(StrictMath.sin(firstTurn) * firstDistance,
                            attempt, "child_delta_y", 0), attempt, "child_y", 0);
                }
            }
            double secondEndX = 0.0;
            double secondEndY = 0.0;
            boolean secondDivided = false;
            if (secondPresent) {
                secondEndX = checked(nx + checked(StrictMath.cos(secondTurn) * secondDistance,
                        attempt, "child_delta_x", 1), attempt, "child_x", 1);
                secondEndY = checked(ny + checked(StrictMath.sin(secondTurn) * secondDistance,
                        attempt, "child_delta_y", 1), attempt, "child_y", 1);
            }

            storage.coordinates[base + 2] = nx;
            storage.coordinates[base + 3] = ny;
            storage.divided[selectedIndex] = true;
            if (firstPresent) storage.append(nx, ny, firstEndX, firstEndY, firstDivided);
            if (secondPresent) storage.append(nx, ny, secondEndX, secondEndY, secondDivided);
            successfulCuts++;
        }
        return new LinePool2D(storage.finish(), attempts, successfulCuts, skips);
    }

    /** Retained segment count. */
    public int size() { return divided.length; }
    /** Configured number of selection attempts. */
    public int attempts() { return attempts; }
    /** Number of attempts that cut their selected parent. */
    public int successfulCuts() { return successfulCuts; }
    /** Number of attempts skipped because their selected segment was short. */
    public int skips() { return skips; }

    /** Returns a fresh detached {@code [startX,startY,endX,endY]} carrier. */
    public double[] segmentAt(long index) {
        int checked = checkedIndex(index);
        int base = checked * 4;
        return new double[] {output(coordinates[base]), output(coordinates[base + 1]),
                output(coordinates[base + 2]), output(coordinates[base + 3])};
    }

    /** Numeric-carrier overload for Java interchange callers. */
    public double[] segmentAt(Object index) { return segmentAt(accessIndex(index)); }

    /** Writes a segment only after index, destination, and offset are all valid. */
    public void segmentInto(long index, double[] destination, int offset) {
        int checked = checkedIndex(index);
        if (destination == null || offset < 0 || offset > destination.length - 4)
            throw new LinePoolException("INVALID_OUTPUT");
        int base = checked * 4;
        destination[offset] = output(coordinates[base]);
        destination[offset + 1] = output(coordinates[base + 1]);
        destination[offset + 2] = output(coordinates[base + 2]);
        destination[offset + 3] = output(coordinates[base + 3]);
    }

    /** Numeric-carrier overload for Java interchange callers. */
    public void segmentInto(Object index, double[] destination, int offset) {
        segmentInto(accessIndex(index), destination, offset);
    }

    /** Division flag: true for a cut parent or a continuation appended on a revisit. */
    public boolean dividedAt(long index) { return divided[checkedIndex(index)]; }
    /** Numeric-carrier overload for Java interchange callers. */
    public boolean dividedAt(Object index) { return dividedAt(accessIndex(index)); }

    /** Materializes a detached ordinary output carrier. */
    public Map<String, Object> toValues() {
        int count = size();
        List<Object> segments = new ArrayList<Object>(count);
        List<Object> flags = new ArrayList<Object>(count);
        for (int index = 0; index < count; index++) {
            int base = index * 4;
            List<Object> segment = new ArrayList<Object>(4);
            segment.add(Double.valueOf(output(coordinates[base])));
            segment.add(Double.valueOf(output(coordinates[base + 1])));
            segment.add(Double.valueOf(output(coordinates[base + 2])));
            segment.add(Double.valueOf(output(coordinates[base + 3])));
            segments.add(segment);
            flags.add(Boolean.valueOf(divided[index]));
        }
        Map<String, Object> values = new LinkedHashMap<String, Object>();
        values.put("segments", segments);
        values.put("divided", flags);
        values.put("attempts", Integer.valueOf(attempts));
        values.put("successfulCuts", Integer.valueOf(successfulCuts));
        values.put("skips", Integer.valueOf(skips));
        return values;
    }

    private int checkedIndex(long index) {
        if (index < 0L || index > MAX_SAFE_INTEGER) throw new LinePoolException("INVALID_INDEX");
        if (index >= size()) throw new LinePoolException("INDEX_OUT_OF_RANGE");
        return (int) index;
    }

    private static Map<?, ?> record(Object value, String[] keys) {
        if (!(value instanceof Map)) invalidInput();
        Map<?, ?> map = (Map<?, ?>) value;
        if (map.size() != keys.length) invalidInput();
        for (String key : keys) if (!map.containsKey(key)) invalidInput();
        return map;
    }

    private static double[] segment(Object value) {
        if (!(value instanceof List) || ((List<?>) value).size() != 4) invalidInput();
        List<?> values = (List<?>) value;
        return new double[] {number(values.get(0)), number(values.get(1)), number(values.get(2)), number(values.get(3))};
    }

    private static double number(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
                || value instanceof Float || value instanceof Double)) invalidInput();
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number)) invalidInput();
        return number;
    }

    private static long uint32(Object value) {
        double number = number(value);
        if (number < 0.0 || number > 4294967295.0 || number != Math.floor(number)) invalidInput();
        return (long) number;
    }

    private static int attempts(Object value) {
        double number = number(value);
        if (number < 0.0 || number > Integer.MAX_VALUE || number != Math.floor(number)) invalidInput();
        return (int) number;
    }

    private static double nonnegative(Object value) {
        double number = number(value);
        if (number < 0.0) invalidInput();
        return number;
    }

    private static double positive(Object value) {
        double number = number(value);
        if (!(number > 0.0)) invalidInput();
        return number;
    }

    private static int maximum(Object value) {
        double number = number(value);
        if (number < 1.0 || number > MAX_SEGMENTS || number != Math.floor(number)) invalidInput();
        return (int) number;
    }

    private static long accessIndex(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
                || value instanceof Float || value instanceof Double)) throw new LinePoolException("INVALID_INDEX");
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number < 0.0 || number > MAX_SAFE_INTEGER || number != Math.floor(number))
            throw new LinePoolException("INVALID_INDEX");
        return (long) number;
    }

    private static double range(double low, double high, Xoshiro128StarStar11 stream) {
        if (low >= high) return low;
        return low + ((high - low) * stream.unit());
    }

    private static double checked(double value, int attempt, String stage) {
        if (!Double.isFinite(value)) throw new ArithmeticOverflowException(attempt, stage);
        return value;
    }

    private static double checked(double value, int attempt, String stage, int childOrdinal) {
        if (!Double.isFinite(value)) throw new ArithmeticOverflowException(attempt, stage, childOrdinal);
        return value;
    }

    private static double output(double value) { return value == 0.0 ? 0.0 : value; }
    private static void invalidInput() { throw new LinePoolException("INVALID_INPUT"); }

    /** Private xoshiro128** 1.1 stream, seeded by two SplitMix64 outputs. */
    private static final class Xoshiro128StarStar11 {
        private int s0, s1, s2, s3;

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

        double unit() { return ((double) Integer.toUnsignedLong(nextU32())) / 4294967296.0; }

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

    /** Growable packed four-binary64-plus-flag storage; no segment objects are retained. */
    private static final class Storage {
        double[] coordinates;
        boolean[] divided;
        int size;
        final int maximum;

        Storage(int maximum) {
            this.maximum = maximum;
            int initial = Math.min(maximum, 16);
            coordinates = new double[initial * 4];
            divided = new boolean[initial];
        }

        void append(double x0, double y0, double x1, double y1, boolean flag) {
            ensure(size + 1);
            int base = size * 4;
            coordinates[base] = x0;
            coordinates[base + 1] = y0;
            coordinates[base + 2] = x1;
            coordinates[base + 3] = y1;
            divided[size] = flag;
            size++;
        }

        Storage finish() {
            if (size != divided.length) {
                double[] exactCoordinates = new double[size * 4];
                boolean[] exactFlags = new boolean[size];
                System.arraycopy(coordinates, 0, exactCoordinates, 0, exactCoordinates.length);
                System.arraycopy(divided, 0, exactFlags, 0, size);
                coordinates = exactCoordinates;
                divided = exactFlags;
            }
            return this;
        }

        private void ensure(int needed) {
            if (needed <= divided.length) return;
            int capacity = divided.length;
            while (capacity < needed) {
                int next = capacity + Math.max(capacity, 16);
                capacity = next <= capacity ? maximum : Math.min(next, maximum);
            }
            double[] nextCoordinates = new double[capacity * 4];
            boolean[] nextFlags = new boolean[capacity];
            System.arraycopy(coordinates, 0, nextCoordinates, 0, size * 4);
            System.arraycopy(divided, 0, nextFlags, 0, size);
            coordinates = nextCoordinates;
            divided = nextFlags;
        }
    }
}
