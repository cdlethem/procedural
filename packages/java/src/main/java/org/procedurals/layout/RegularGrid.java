package org.procedurals.layout;

import java.util.Arrays;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Compact row-major planar positions; no rendering or random state.
 * Motivated by 2017/Generativos/circlesAlpha (source cell counts require +1)
 * and the extracted lattice in 2019/generativos/paraisooscuro.
 * Origin and positive spacing use caller coordinate units. Counts count points.
 * No artistic default or encouraged range has been established by the survey.
 * Behavior: catalog/operations/regular-grid.json, layout.regular-grid 0.1.0.
 */
public strictfp final class RegularGrid {
    /** Largest supported point count; this is a representation ceiling, not an artistic range. */
    public static final long MAX_SIZE = 9007199254740991L;

    /** Validation or indexed-access failure with a stable catalog error code. */
    public static final class GridException extends IllegalArgumentException {
        /** Stable code: {@code INVALID_INPUT}, {@code GRID_SIZE_OVERFLOW}, {@code COORDINATE_OVERFLOW}, {@code INVALID_INDEX}, {@code INDEX_OUT_OF_RANGE}, or {@code INVALID_OUTPUT}. */
        public final String code;
        /**
         * Creates a stable grid failure.
         *
         * @param code catalog error code
         */
        public GridException(String code) { super(code); this.code = code; }
    }

    private final double ox, oy, dx, dy;
    private final int columns, rows;
    private final long size;

    private RegularGrid(double ox, double oy, double dx, double dy, int columns, int rows, long size) {
        this.ox = ox; this.oy = oy; this.dx = dx; this.dy = dy;
        this.columns = columns; this.rows = rows; this.size = size;
    }

    /**
     * Creates an immutable row-major point sequence from explicit caller-coordinate units.
     * {@code origin} and {@code spacing} are two-number {@code [x,y]} lists; spacing must be
     * positive. {@code columns} and {@code rows} count points, rather than cells, and may be
     * zero. Input values are copied and zero is canonicalized; no artistic default or
     * recommended range is supplied. Motivated by {@code circlesAlpha} and {@code paraisooscuro}
     * as recorded in {@code catalog/operations/regular-grid.json}.
     *
     * @param input exactly {@code origin}, {@code spacing}, {@code columns}, and {@code rows}
     * @return immutable detached grid descriptor without output-sized position storage
     * @throws GridException {@code INVALID_INPUT}, {@code GRID_SIZE_OVERFLOW}, or
     *         {@code COORDINATE_OVERFLOW} when validation fails in contract order
     */
    public static RegularGrid create(Map<String, ?> input) {
        if (input == null || input.size() != 4 || !input.keySet().containsAll(
                Arrays.asList("origin", "spacing", "columns", "rows"))) fail("INVALID_INPUT");
        List<?> origin = vector(input.get("origin"));
        List<?> spacing = vector(input.get("spacing"));
        double ox = number(origin.get(0)), oy = number(origin.get(1));
        double dx = positive(spacing.get(0)), dy = positive(spacing.get(1));
        int columns = count(input.get("columns")), rows = count(input.get("rows"));
        // Products of two nonnegative int32 values fit int64 exactly.
        long size = (long) columns * (long) rows;
        if (size > MAX_SIZE) fail("GRID_SIZE_OVERFLOW");
        if (size != 0) {
            coordinate(ox, dx, columns - 1);
            coordinate(oy, dy, rows - 1);
        }
        return new RegularGrid(ox, oy, dx, dy, columns, rows, size);
    }

    /**
     * Returns the number of points, equal to {@code columns * rows}; it is not a cell count.
     *
     * @return row-major point count
     */
    public long size() { return size; }

    /**
     * Returns detached canonical construction values in catalog-key order. Mutating this map or
     * either nested list cannot change the grid; pass it to {@link #create(Map)} to reconstruct.
     *
     * @return detached {@code origin}, {@code spacing}, {@code columns}, and {@code rows} map
     */
    public Map<String, Object> toMap() {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("origin", new ArrayList<Double>(Arrays.asList(ox, oy)));
        result.put("spacing", new ArrayList<Double>(Arrays.asList(dx, dy)));
        result.put("columns", columns); result.put("rows", rows);
        return result;
    }

    /**
     * Returns a fresh binary64 {@code [x,y]} point at a row-major index. X changes fastest;
     * coordinates use caller units and separately rounded multiply then add operations.
     *
     * @param index finite nonnegative safe-integer point index
     * @return detached two-coordinate point
     * @throws GridException {@code INVALID_INDEX} before {@code INDEX_OUT_OF_RANGE}
     */
    public double[] pointAt(long index) {
        validateIndex(index);
        double[] point = new double[2];
        write(index, point, 0);
        return point;
    }

    /**
     * Java-interchange overload for {@link #pointAt(long)} accepting supported numeric carriers.
     *
     * @param index Byte, Short, Integer, Long, Float, or Double safe-integer point index
     * @return detached two-coordinate point
     * @throws GridException {@code INVALID_INDEX} before {@code INDEX_OUT_OF_RANGE}
     */
    public double[] pointAt(Object index) { return pointAt(indexValue(index)); }

    /**
     * Writes exactly two binary64 coordinates after index, range, destination, and offset
     * validation. It retains no destination storage and leaves all destination slots unchanged
     * on failure.
     *
     * @param index finite nonnegative safe-integer point index
     * @param out writable destination requiring two slots from {@code offset}
     * @param offset nonnegative first destination slot
     * @throws GridException {@code INVALID_INDEX}, then {@code INDEX_OUT_OF_RANGE}, then
     *         {@code INVALID_OUTPUT}
     */
    public void pointInto(long index, double[] out, int offset) {
        validateIndex(index);
        if (out == null || offset < 0 || offset > out.length - 2) fail("INVALID_OUTPUT");
        write(index, out, offset);
    }

    /**
     * Java-interchange overload for {@link #pointInto(long, double[], int)}.
     *
     * @param index Byte, Short, Integer, Long, Float, or Double safe-integer point index
     * @param out writable destination requiring two slots from {@code offset}
     * @param offset nonnegative first destination slot
     * @throws GridException indexed and destination failures in the long-overload order
     */
    public void pointInto(Object index, double[] out, int offset) {
        pointInto(indexValue(index), out, offset);
    }

    private void write(long index, double[] out, int offset) {
        long column = index % columns;
        long row = (index - column) / columns;
        double x = coordinate(ox, dx, column), y = coordinate(oy, dy, row);
        out[offset] = x; out[offset + 1] = y;
    }

    private void validateIndex(long index) {
        if (index < 0 || index > MAX_SIZE) fail("INVALID_INDEX");
        if (index >= size) fail("INDEX_OUT_OF_RANGE");
    }

    private static long indexValue(Object value) {
        if (!supportedNumber(value)) { fail("INVALID_INDEX"); return 0; }
        double n = ((Number) value).doubleValue();
        if (!finite(n) || n < 0 || n > MAX_SIZE || n != Math.floor(n)) fail("INVALID_INDEX");
        return (long) n;
    }

    private static List<?> vector(Object value) {
        if (!(value instanceof List) || ((List<?>) value).size() != 2) fail("INVALID_INPUT");
        return (List<?>) value;
    }

    private static double number(Object value) {
        if (!supportedNumber(value)) { fail("INVALID_INPUT"); return 0; }
        double n = ((Number) value).doubleValue();
        if (!finite(n)) fail("INVALID_INPUT");
        return n == 0 ? 0.0 : n;
    }

    private static double positive(Object value) {
        double n = number(value);
        if (!(n > 0)) fail("INVALID_INPUT");
        return n;
    }

    private static int count(Object value) {
        double n = number(value);
        if (n < 0 || n > Integer.MAX_VALUE || n != Math.floor(n)) fail("INVALID_INPUT");
        return (int) n;
    }

    private static double coordinate(double origin, double spacing, long index) {
        double product = (double) index * spacing;
        if (!finite(product)) { fail("COORDINATE_OVERFLOW"); return 0; }
        double value = origin + product;
        if (!finite(value)) fail("COORDINATE_OVERFLOW");
        return value == 0 ? 0.0 : value;
    }

    // Explicit host representations prevent lossy BigDecimal/custom Number coercion.
    private static boolean supportedNumber(Object value) {
        return value instanceof Byte || value instanceof Short || value instanceof Integer
            || value instanceof Long || value instanceof Float || value instanceof Double;
    }

    private static boolean finite(double value) { return !Double.isNaN(value) && !Double.isInfinite(value); }

    private static void fail(String code) { throw new GridException(code); }
}
