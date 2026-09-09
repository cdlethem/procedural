package org.procedurals.layout;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Caller-directed retained rectangular regions with stable never-reused identities.
 * Implements {@code layout.retained-rectangle-cuts-2d} 0.1.0.
 *
 * <p>Independently specified from
 * {@code survey/out/2019/generativos/griton/notes.md}. The motivating work supplies
 * retained unequal regions; its source-specific selection, ratios, omission, drawing, and
 * random behavior are outside this operation. Bounds use caller coordinate units. The survey
 * establishes no default or encouraged artistic coordinate range; finite positive extents are
 * representational requirements.</p>
 */
public final strictfp class RetainedRectangles2D {
    private static final long MAX_LEAF_ID = 9007199254740990L;
    private static final long EXHAUSTED_NEXT_ID = 9007199254740991L;

    private final LinkedHashMap<Long, Leaf> leaves;
    private long nextId;

    private RetainedRectangles2D(double left, double top, double right, double bottom) {
        leaves = new LinkedHashMap<Long, Leaf>();
        leaves.put(Long.valueOf(0L), new Leaf(0L, left, top, right, bottom));
        nextId = 1L;
    }

    /**
     * Creates a root from exactly {@code {bounds:[left,top,right,bottom]}}.
     * Only Byte, Short, Integer, Long, Float, and Double coordinate carriers are accepted.
     */
    public static RetainedRectangles2D create(Object config) {
        if (!(config instanceof Map)) invalidInput();
        Map<?, ?> record = (Map<?, ?>) config;
        if (record.size() != 1 || !record.containsKey("bounds")) invalidInput();
        Object rawBounds = record.get("bounds");
        if (!(rawBounds instanceof List)) invalidInput();
        List<?> bounds = (List<?>) rawBounds;
        if (bounds.size() != 4) invalidInput();
        double left = coordinate(bounds.get(0));
        double top = coordinate(bounds.get(1));
        double right = coordinate(bounds.get(2));
        double bottom = coordinate(bounds.get(3));
        return createValidated(left, top, right, bottom);
    }

    /**
     * Creates a root from four finite bounds with positive separately representable extents.
     */
    public static RetainedRectangles2D create(double left, double top, double right, double bottom) {
        if (!finite(left) || !finite(top) || !finite(right) || !finite(bottom)) invalidInput();
        return createValidated(zero(left), zero(top), zero(right), zero(bottom));
    }

    /**
     * Replaces a live leaf with low-coordinate then high-coordinate children and returns their IDs.
     */
    public long[] cut(long id, String axis, double coordinate) {
        checkedId(id);
        Leaf parent = leaves.get(Long.valueOf(id));
        if (parent == null) unknownId();
        if (!("X".equals(axis) || "Y".equals(axis))) invalidInput();
        if (!finite(coordinate)) invalidInput();
        coordinate = zero(coordinate);
        boolean cutX = "X".equals(axis);
        double low = cutX ? parent.left : parent.top;
        double high = cutX ? parent.right : parent.bottom;
        if (!(coordinate > low && coordinate < high)) invalidCut();
        if (leaves.size() >= Integer.MAX_VALUE || nextId > EXHAUSTED_NEXT_ID - 2L) limitExceeded();

        long lowId = nextId;
        long highId = nextId + 1L;
        Leaf lowLeaf;
        Leaf highLeaf;
        if (cutX) {
            lowLeaf = new Leaf(lowId, parent.left, parent.top, coordinate, parent.bottom);
            highLeaf = new Leaf(highId, coordinate, parent.top, parent.right, parent.bottom);
        } else {
            lowLeaf = new Leaf(lowId, parent.left, parent.top, parent.right, coordinate);
            highLeaf = new Leaf(highId, parent.left, coordinate, parent.right, parent.bottom);
        }
        leaves.remove(Long.valueOf(id));
        leaves.put(Long.valueOf(lowId), lowLeaf);
        leaves.put(Long.valueOf(highId), highLeaf);
        nextId += 2L;
        return new long[] {lowId, highId};
    }

    /** Removes a live leaf without replacing it or changing later identity allocation. */
    public void remove(long id) {
        checkedId(id);
        if (leaves.remove(Long.valueOf(id)) == null) unknownId();
    }

    /** Returns the immutable value for a live leaf. */
    public Leaf leaf(long id) {
        checkedId(id);
        Leaf leaf = leaves.get(Long.valueOf(id));
        if (leaf == null) unknownId();
        return leaf;
    }

    /** Returns a detached mutable list in current live-leaf order. */
    public List<Leaf> leaves() {
        return new ArrayList<Leaf>(leaves.values());
    }

    /** Returns the current live-leaf count. */
    public int size() {
        return leaves.size();
    }

    /**
     * Materializes a fully detached mutable {@code {nextId,leaves:[{id,bounds}]}} snapshot.
     * This snapshot is descriptive only and is not a restoration or replay input.
     */
    public Map<String, Object> toValues() {
        List<Object> values = new ArrayList<Object>(leaves.size());
        for (Leaf leaf : leaves.values()) {
            List<Object> bounds = new ArrayList<Object>(4);
            bounds.add(Double.valueOf(leaf.left));
            bounds.add(Double.valueOf(leaf.top));
            bounds.add(Double.valueOf(leaf.right));
            bounds.add(Double.valueOf(leaf.bottom));
            Map<String, Object> value = new LinkedHashMap<String, Object>();
            value.put("id", Long.valueOf(leaf.id));
            value.put("bounds", bounds);
            values.add(value);
        }
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("nextId", Long.valueOf(nextId));
        result.put("leaves", values);
        return result;
    }

    /** Immutable live or historical rectangle value. */
    public static final class Leaf {
        public final long id;
        public final double left;
        public final double top;
        public final double right;
        public final double bottom;

        private Leaf(long id, double left, double top, double right, double bottom) {
            this.id = id;
            this.left = left;
            this.top = top;
            this.right = right;
            this.bottom = bottom;
        }
    }

    /** Validation failure carrying the stable catalog error code. */
    public static final class EditException extends IllegalArgumentException {
        public final String code;

        private EditException(String code) {
            super(code);
            this.code = code;
        }
    }

    private static RetainedRectangles2D createValidated(double left, double top, double right, double bottom) {
        if (!(left < right) || !(top < bottom)) invalidInput();
        double width = right - left;
        double height = bottom - top;
        if (!finite(width) || !finite(height)) invalidInput();
        return new RetainedRectangles2D(left, top, right, bottom);
    }

    private static double coordinate(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double)) invalidInput();
        double result = ((Number) value).doubleValue();
        if (!finite(result)) invalidInput();
        return zero(result);
    }

    private static boolean finite(double value) {
        return !Double.isNaN(value) && !Double.isInfinite(value);
    }

    private static double zero(double value) {
        return value == 0.0 ? 0.0 : value;
    }

    private static void checkedId(long id) {
        if (id < 0L || id > MAX_LEAF_ID) throw new EditException("INVALID_ID");
    }

    private static void invalidInput() { throw new EditException("INVALID_INPUT"); }
    private static void unknownId() { throw new EditException("UNKNOWN_ID"); }
    private static void invalidCut() { throw new EditException("INVALID_CUT"); }
    private static void limitExceeded() { throw new EditException("LIMIT_EXCEEDED"); }
}
