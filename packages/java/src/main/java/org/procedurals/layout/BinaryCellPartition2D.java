package org.procedurals.layout;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable ordered integer-cell rectangles from attempted binary cuts.
 * Implements {@code layout.binary-cell-partition-2d} 0.1.0.
 *
 * <p>Independently specified from {@code survey/out/2018/Generativos/poop/notes.md}
 * and {@code survey/out/2018/Generativos/barab/notes.md}. CP17's private native study
 * observed attempts20/80/240 and RANDOM/LONGEST policies; these are not defaults or
 * encouraged ranges. Drawing, scaling and source RNG replay remain outside this class.</p>
 */
public final strictfp class BinaryCellPartition2D {
    private static final int MAX_ATTEMPTS = 2147483646;
    private static final String[] KEYS = {"seed", "columns", "rows", "attempts", "axisPolicy"};

    /** Validation failure carrying the stable catalog error code. */
    public static final class PartitionException extends IllegalArgumentException {
        public final String code;

        /** Constructs a failure with its catalog code. */
        public PartitionException(String code) {
            super(code);
            this.code = code;
        }
    }

    private final int[] left, top, right, bottom;
    private final int splits;

    private BinaryCellPartition2D(int[] left, int[] top, int[] right, int[] bottom, int splits) {
        this.left = left;
        this.top = top;
        this.right = right;
        this.bottom = bottom;
        this.splits = splits;
    }

    /**
     * Generates from exactly seed, columns, rows, attempts and axisPolicy in a passive Map.
     * Six standard boxed numeric types are accepted for finite exact integers. Input is
     * not retained; malformed keys, carriers or values raise INVALID_INPUT.
     */
    public static BinaryCellPartition2D generate(Object input) {
        if (!(input instanceof Map)) invalid();
        Map<?, ?> map = (Map<?, ?>) input;
        if (map.size() != KEYS.length) invalid();
        for (String key : KEYS) if (!map.containsKey(key)) invalid();
        long seed = integer(map.get("seed"), 0, 4294967295L);
        int columns = (int) integer(map.get("columns"), 1, Integer.MAX_VALUE);
        int rows = (int) integer(map.get("rows"), 1, Integer.MAX_VALUE);
        int attempts = (int) integer(map.get("attempts"), 0, MAX_ATTEMPTS);
        Object policy = map.get("axisPolicy");
        if (!(policy instanceof String)) invalid();
        return generate(seed, columns, rows, attempts, (String) policy);
    }

    /**
     * Generates a tiling of [0,0,columns,rows] using a private uint32-seeded stream.
     * Columns/rows are positive integer cell counts; attempts is0..2147483646, a
     * representation ceiling rather than a resource promise. Policy is RANDOM or LONGEST.
     * Failed unit-axis cuts consume attempts. Invalid values raise INVALID_INPUT.
     */
    public static BinaryCellPartition2D generate(long seed, int columns, int rows,
                                                int attempts, String axisPolicy) {
        if (seed < 0 || seed > 4294967295L || columns < 1 || rows < 1
                || attempts < 0 || attempts > MAX_ATTEMPTS
                || !("RANDOM".equals(axisPolicy) || "LONGEST".equals(axisPolicy))) invalid();
        boolean randomAxis = "RANDOM".equals(axisPolicy);
        int[] left = new int[1], top = new int[1];
        int[] right = {columns}, bottom = {rows};
        int size = 1, splits = 0;
        QuadrantPartition2D.Xoshiro128StarStar11 stream =
                new QuadrantPartition2D.Xoshiro128StarStar11(seed);
        for (int attempt = 0; attempt < attempts; attempt++) {
            int selected = (int) Math.floor(stream.unit() * size);
            int x = left[selected], y = top[selected];
            int x2 = right[selected], y2 = bottom[selected];
            int width = x2 - x, height = y2 - y;
            boolean splitWidth = randomAxis ? stream.unit() < 0.5 : width > height;
            int extent = splitWidth ? width : height;
            if (extent == 1) continue;
            int cut = 1 + (int) Math.floor(stream.unit() * (extent - 1));

            if (size == left.length) {
                int capacity = (int) Math.min((long) attempts + 1,
                        Math.max((long) size + 1, (long) size * 2));
                left = Arrays.copyOf(left, capacity);
                top = Arrays.copyOf(top, capacity);
                right = Arrays.copyOf(right, capacity);
                bottom = Arrays.copyOf(bottom, capacity);
            }
            int survivors = size - selected - 1;
            System.arraycopy(left, selected + 1, left, selected, survivors);
            System.arraycopy(top, selected + 1, top, selected, survivors);
            System.arraycopy(right, selected + 1, right, selected, survivors);
            System.arraycopy(bottom, selected + 1, bottom, selected, survivors);
            int lower = size - 1, upper = size;
            left[lower] = x; top[lower] = y;
            right[lower] = splitWidth ? x + cut : x2;
            bottom[lower] = splitWidth ? y2 : y + cut;
            left[upper] = splitWidth ? x + cut : x;
            top[upper] = splitWidth ? y : y + cut;
            right[upper] = x2; bottom[upper] = y2;
            size++;
            splits++;
        }
        if (size != left.length) {
            left = Arrays.copyOf(left, size); top = Arrays.copyOf(top, size);
            right = Arrays.copyOf(right, size); bottom = Arrays.copyOf(bottom, size);
        }
        return new BinaryCellPartition2D(left, top, right, bottom, splits);
    }

    /** Returns the retained leaf count, always splits()+1. */
    public int size() { return left.length; }

    /** Returns successful cuts, which may be fewer than attempted cuts. */
    public int splits() { return splits; }

    /** Returns a fresh [left,top,right,bottom] integer-cell array at the ordered index. */
    public int[] boundsAt(long index) {
        int i = checkedIndex(index);
        return new int[]{left[i], top[i], right[i], bottom[i]};
    }

    /**
     * Writes bounds into exactly int[4], without allocation or retention. Validates index
     * before destination; INVALID_INDEX, INDEX_OUT_OF_RANGE or INVALID_OUTPUT leaves it intact.
     */
    public void boundsInto(long index, int[] destination) {
        int i = checkedIndex(index);
        if (destination == null || destination.length != 4)
            throw new PartitionException("INVALID_OUTPUT");
        destination[0] = left[i]; destination[1] = top[i];
        destination[2] = right[i]; destination[3] = bottom[i];
    }

    /** Returns a detached portable {bounds,splits} record, including fresh nested rows. */
    public Map<String, Object> toValues() {
        List<Object> bounds = new ArrayList<Object>(size());
        for (int i = 0; i < size(); i++)
            bounds.add(Arrays.asList(left[i], top[i], right[i], bottom[i]));
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("bounds", bounds);
        result.put("splits", splits);
        return result;
    }

    private int checkedIndex(long index) {
        if (index < 0 || index > 9007199254740991L) throw new PartitionException("INVALID_INDEX");
        if (index >= size()) throw new PartitionException("INDEX_OUT_OF_RANGE");
        return (int) index;
    }

    private static long integer(Object value, long minimum, long maximum) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double)) invalid();
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number < minimum || number > maximum
                || number != Math.floor(number)) invalid();
        return (long) number;
    }

    private static void invalid() { throw new PartitionException("INVALID_INPUT"); }
}
