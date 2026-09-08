package org.procedurals.layout;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable seeded equal-quadrant leaves specified by
 * {@code layout.seeded-quadrant-partition-2d} 0.1.0 and its reviewed catalog contract.
 *
 * <p>Motivating source evidence: {@code survey/out/2018/Generativos/mosaic02} and
 * {@code survey/out/2018/Generativos/mosaic}. This operation is independently specified
 * from those sketches; their Processing RNG/prelude, painting, and mesh work are not used.
 * The private investigation observed discrete replacement settings 100 and 200 and
 * selection fractions 0.5 and 1.0. They are neither defaults nor encouraged ranges.</p>
 */
public final strictfp class QuadrantPartition2D {
    private static final int MAX_REPLACEMENTS = 178956970;
    private static final long MAX_SAFE_INTEGER = 9007199254740991L;
    private static final String[] KEYS = {"seed", "replacements", "origin", "extent", "selectionFraction"};

    /** Validation or accessor failure with its stable catalog error code. */
    public static final class PartitionException extends IllegalArgumentException {
        public final String code;
        public PartitionException(String code) { super(code); this.code = code; }
    }

    /** A requested replacement whose binary64 midpoint cannot be represented inside its parent. */
    public static final class PartitionArithmeticException extends ArithmeticException {
        public final String code;
        public final int replacementIndex;
        public final String stage;
        public PartitionArithmeticException(int replacementIndex, String stage) {
            super("PARTITION_ARITHMETIC_INVALID");
            this.code = "PARTITION_ARITHMETIC_INVALID";
            this.replacementIndex = replacementIndex;
            this.stage = stage;
        }
    }

    private final double[] left;
    private final double[] top;
    private final double[] right;
    private final double[] bottom;
    private final int[] ids;
    private final int replacements;

    private QuadrantPartition2D(double[] left, double[] top, double[] right, double[] bottom, int[] ids, int replacements) {
        this.left = left;
        this.top = top;
        this.right = right;
        this.bottom = bottom;
        this.ids = ids;
        this.replacements = replacements;
    }

    /** Generates the detached immutable leaf sequence from the required passive configuration.
     * See the {@code layout.seeded-quadrant-partition-2d} catalog contract. */
    public static QuadrantPartition2D generate(Object config) {
        return generateInternal(config, null);
    }

    /** Current retained leaf count. */
    public int size() { return ids.length; }

    /** Requested successful replacement count. */
    public int replacements() { return replacements; }

    /** Returns a fresh {@code [left, top, right, bottom]} binary64 array. */
    public double[] boundsAt(long index) {
        int checked = checkedIndex(index);
        return new double[] {left[checked], top[checked], right[checked], bottom[checked]};
    }

    /** Numeric-carrier overload for portable Java interchange. */
    public double[] boundsAt(Object index) { return boundsAt(accessIndex(index)); }

    /** Writes four binary64 bounds after all index and destination validation succeeds. */
    public void boundsInto(long index, double[] destination, int offset) {
        int checked = checkedIndex(index);
        if (destination == null || offset < 0 || offset > destination.length - 4)
            throw new PartitionException("INVALID_OUTPUT");
        destination[offset] = left[checked];
        destination[offset + 1] = top[checked];
        destination[offset + 2] = right[checked];
        destination[offset + 3] = bottom[checked];
    }

    /** Numeric-carrier overload for portable Java interchange. */
    public void boundsInto(Object index, double[] destination, int offset) {
        boundsInto(accessIndex(index), destination, offset);
    }

    /** Returns the stable within-run creation identity for a retained leaf. */
    public int idAt(long index) { return ids[checkedIndex(index)]; }

    /** Numeric-carrier overload for portable Java interchange. */
    public int idAt(Object index) { return idAt(accessIndex(index)); }

    /** Materializes detached bounds, identities, and replacement count. */
    public Map<String, Object> toValues() {
        List<Object> bounds = new ArrayList<Object>(size());
        List<Object> outputIds = new ArrayList<Object>(size());
        for (int i = 0; i < size(); i++) {
            List<Object> row = new ArrayList<Object>(4);
            row.add(Double.valueOf(left[i]));
            row.add(Double.valueOf(top[i]));
            row.add(Double.valueOf(right[i]));
            row.add(Double.valueOf(bottom[i]));
            bounds.add(row);
            outputIds.add(Integer.valueOf(ids[i]));
        }
        Map<String, Object> values = new LinkedHashMap<String, Object>();
        values.put("bounds", bounds);
        values.put("ids", outputIds);
        values.put("replacements", Integer.valueOf(replacements));
        return values;
    }

    // Package-private fixture seam; it is not a public operation API.
    static int[] selectionTraceForTest(Object config) {
        Map<?, ?> record = record(config);
        int count = replacementCount(record.get("replacements"));
        int[] trace = new int[count];
        generateInternal(record, trace);
        return trace;
    }

    private static QuadrantPartition2D generateInternal(Object config, int[] trace) {
        Map<?, ?> record = record(config);
        long seed = uint32(record.get("seed"));
        int count = replacementCount(record.get("replacements"));
        double[] origin = pair(record.get("origin"), false);
        double[] extent = pair(record.get("extent"), true);
        double fraction = positive(record.get("selectionFraction"));
        if (fraction > 1.0) invalid();

        double rootRight = origin[0] + extent[0];
        double rootBottom = origin[1] + extent[1];
        if (!Double.isFinite(rootRight) || !Double.isFinite(rootBottom)
                || !(rootRight > origin[0]) || !(rootBottom > origin[1]))
            throw new PartitionException("INVALID_RECTANGLE");
        double representedWidth = rootRight - origin[0];
        double representedHeight = rootBottom - origin[1];
        if (!Double.isFinite(representedWidth) || !Double.isFinite(representedHeight)
                || !(representedWidth > 0.0) || !(representedHeight > 0.0))
            throw new PartitionException("INVALID_RECTANGLE");

        Builder builder = new Builder(count);
        builder.appendRoot(zero(origin[0]), zero(origin[1]), zero(rootRight), zero(rootBottom));
        if (count == 0) return builder.finish(0);

        Xoshiro128StarStar11 stream = new Xoshiro128StarStar11(seed);
        for (int replacementIndex = 0; replacementIndex < count; replacementIndex++) {
            int liveCount = builder.size;
            double unit = stream.unit();
            double limit = liveCount * fraction;
            double product = unit * limit;
            int selected = (int) Math.floor(product);
            if (selected < 0 || selected >= liveCount) throw new AssertionError("validated selection outside live range");
            if (trace != null) trace[replacementIndex] = selected;

            double parentLeft = builder.left[selected];
            double parentTop = builder.top[selected];
            double parentRight = builder.right[selected];
            double parentBottom = builder.bottom[selected];
            double spanX = parentRight - parentLeft;
            double halfX = spanX * 0.5;
            double midpointX = parentLeft + halfX;
            if (!(parentLeft < midpointX && midpointX < parentRight))
                throw new PartitionArithmeticException(replacementIndex, "midpoint_x");
            double spanY = parentBottom - parentTop;
            double halfY = spanY * 0.5;
            double midpointY = parentTop + halfY;
            if (!(parentTop < midpointY && midpointY < parentBottom))
                throw new PartitionArithmeticException(replacementIndex, "midpoint_y");

            builder.replace(selected, parentLeft, parentTop, parentRight, parentBottom, midpointX, midpointY,
                    4 * replacementIndex + 1);
        }
        return builder.finish(count);
    }

    private int checkedIndex(long index) {
        if (index < 0L || index > MAX_SAFE_INTEGER) throw new PartitionException("INVALID_INDEX");
        if (index >= size()) throw new PartitionException("INDEX_OUT_OF_RANGE");
        return (int) index;
    }

    private static Map<?, ?> record(Object value) {
        if (!(value instanceof Map)) invalid();
        Map<?, ?> map = (Map<?, ?>) value;
        if (map.size() != KEYS.length) invalid();
        for (String key : KEYS) if (!map.containsKey(key)) invalid();
        return map;
    }

    private static double[] pair(Object value, boolean positive) {
        if (!(value instanceof List) || ((List<?>) value).size() != 2) invalid();
        List<?> values = (List<?>) value;
        return new double[] {positive ? positive(values.get(0)) : number(values.get(0)),
                positive ? positive(values.get(1)) : number(values.get(1))};
    }

    private static double number(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
                || value instanceof Float || value instanceof Double)) invalid();
        double result = ((Number) value).doubleValue();
        if (!Double.isFinite(result)) invalid();
        return zero(result);
    }

    private static double positive(Object value) {
        double result = number(value);
        if (!(result > 0.0)) invalid();
        return result;
    }

    private static long uint32(Object value) {
        double result = number(value);
        if (result < 0.0 || result > 4294967295.0 || result != Math.floor(result)) invalid();
        return (long) result;
    }

    private static int replacementCount(Object value) {
        double result = number(value);
        if (result < 0.0 || result > MAX_REPLACEMENTS || result != Math.floor(result)) invalid();
        return (int) result;
    }

    private static long accessIndex(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
                || value instanceof Float || value instanceof Double)) throw new PartitionException("INVALID_INDEX");
        double result = ((Number) value).doubleValue();
        if (!Double.isFinite(result) || result < 0.0 || result > MAX_SAFE_INTEGER || result != Math.floor(result))
            throw new PartitionException("INVALID_INDEX");
        return (long) result;
    }

    private static void invalid() { throw new PartitionException("INVALID_INPUT"); }
    private static double zero(double value) { return value == 0.0 ? 0.0 : value; }

    /** Package-private stream seam for shared deterministic vectors. */
    static final class Xoshiro128StarStar11 {
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
        int nextU32() {
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
        double unit() { return ((double) Integer.toUnsignedLong(nextU32())) / 4294967296.0; }
        int[] stateForTest() { return new int[] {s0, s1, s2, s3}; }
        private static long splitmixOutput(long state) {
            long mixed = state;
            mixed = (mixed ^ (mixed >>> 30)) * 0xbf58476d1ce4e5b9L;
            mixed = (mixed ^ (mixed >>> 27)) * 0x94d049bb133111ebL;
            return mixed ^ (mixed >>> 31);
        }
    }

    private static final class Builder {
        private double[] left;
        private double[] top;
        private double[] right;
        private double[] bottom;
        private int[] ids;
        private int size;

        Builder(int replacements) {
            int finalSize = 1 + 3 * replacements;
            int initial = Math.min(finalSize, 16);
            left = new double[initial];
            top = new double[initial];
            right = new double[initial];
            bottom = new double[initial];
            ids = new int[initial];
        }

        void appendRoot(double rootLeft, double rootTop, double rootRight, double rootBottom) {
            left[0] = rootLeft;
            top[0] = rootTop;
            right[0] = rootRight;
            bottom[0] = rootBottom;
            ids[0] = 0;
            size = 1;
        }

        void replace(int selected, double parentLeft, double parentTop, double parentRight, double parentBottom,
                     double midpointX, double midpointY, int firstId) {
            ensure(size + 4);
            int append = size;
            left[append] = parentLeft; top[append] = parentTop; right[append] = midpointX; bottom[append] = midpointY; ids[append] = firstId;
            left[append + 1] = midpointX; top[append + 1] = parentTop; right[append + 1] = parentRight; bottom[append + 1] = midpointY; ids[append + 1] = firstId + 1;
            left[append + 2] = midpointX; top[append + 2] = midpointY; right[append + 2] = parentRight; bottom[append + 2] = parentBottom; ids[append + 2] = firstId + 2;
            left[append + 3] = parentLeft; top[append + 3] = midpointY; right[append + 3] = midpointX; bottom[append + 3] = parentBottom; ids[append + 3] = firstId + 3;
            int moved = size - selected - 1 + 4;
            System.arraycopy(left, selected + 1, left, selected, moved);
            System.arraycopy(top, selected + 1, top, selected, moved);
            System.arraycopy(right, selected + 1, right, selected, moved);
            System.arraycopy(bottom, selected + 1, bottom, selected, moved);
            System.arraycopy(ids, selected + 1, ids, selected, moved);
            size += 3;
        }

        private void ensure(int needed) {
            if (needed <= left.length) return;
            int capacity = left.length;
            while (capacity < needed) {
                int next = capacity + Math.max(capacity, 16);
                if (next < 0 || next > MAX_REPLACEMENTS * 3 + 1) { capacity = needed; break; }
                capacity = next;
            }
            left = copy(left, capacity); top = copy(top, capacity); right = copy(right, capacity); bottom = copy(bottom, capacity); ids = copy(ids, capacity);
        }

        QuadrantPartition2D finish(int replacements) {
            if (size != left.length) {
                left = copy(left, size); top = copy(top, size); right = copy(right, size); bottom = copy(bottom, size); ids = copy(ids, size);
            }
            return new QuadrantPartition2D(left, top, right, bottom, ids, replacements);
        }

        private static double[] copy(double[] source, int size) {
            double[] output = new double[size];
            System.arraycopy(source, 0, output, 0, Math.min(source.length, size));
            return output;
        }
        private static int[] copy(int[] source, int size) {
            int[] output = new int[size];
            System.arraycopy(source, 0, output, 0, Math.min(source.length, size));
            return output;
        }
    }
}
