package org.procedurals.geometry;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Finds the nearest closed-segment contact for each directed query segment.
 *
 * <p>Queries and obstacles use caller coordinate units, origins, and axes. Contacts are
 * selected with exact rational arithmetic from supplied binary64 values before their
 * parameter and point are rounded once to binary64. The operation was admitted as the
 * independent contact dependency from {@code 2018/Generativos/plasma007#2}, documented at
 * {@code survey/out/2018/Generativos/plasma007/notes.md}; it does not include that sketch's
 * ray generation or ordered two-pass drawing orchestration.</p>
 *
 * <p>The supplied {@code maxWork} bounds abstract query-obstacle pair tests. Counts are
 * representation ceilings, not recommended artistic ranges. Execution uses O(Q*O) exact
 * pair tests, O(Q+O) captured coordinate storage, and O(Q) retained result storage.</p>
 */
public final strictfp class NearestSegmentContact2D {
    private static final long MAX_COUNT = 536870911L;
    private static final long MAX_SAFE = 9007199254740991L;
    private static final String QUERIES = "queries";
    private static final String OBSTACLES = "obstacles";
    private static final String MAX_WORK = "maxWork";

    private final Contact[] hits;

    private NearestSegmentContact2D(Contact[] hits) {
        this.hits = hits;
    }

    /**
     * Evaluates a passive record containing {@code queries}, {@code obstacles}, and
     * {@code maxWork}.
     *
     * <p>Each list entry is a finite {@code [x0,y0,x1,y1]} quadruple. Java accepts only
     * {@link Byte}, {@link Short}, {@link Integer}, {@link Long}, {@link Float}, and
     * {@link Double} numeric carriers; booleans and strings are not coerced. Inputs are
     * fully validated before the exact pair-test work preflight and are never retained or
     * mutated.</p>
     *
     * @param configuration passive configuration record in the frozen operation schema
     * @return owned result with one hit or miss entry for each query
     * @throws ContactException when static validation, work preflight, or output
     *         representability fails
     */
    public static NearestSegmentContact2D find(Object configuration) {
        Map<?, ?> record = record(configuration);
        double[] queries = quadruples(record.get(QUERIES));
        double[] obstacles = quadruples(record.get(OBSTACLES));
        long maxWork = whole(record.get(MAX_WORK));
        int queryCount = queries.length / 4;
        int obstacleCount = obstacles.length / 4;
        BigInteger work = BigInteger.valueOf(queryCount).multiply(BigInteger.valueOf(obstacleCount));
        if (work.compareTo(BigInteger.valueOf(maxWork)) > 0) throw error("WORK_LIMIT_EXCEEDED");

        Obstacle[] exactObstacles = exactObstacles(obstacles, obstacleCount);
        Contact[] hits = new Contact[queryCount];
        for (int queryIndex = 0; queryIndex < queryCount; queryIndex++) {
            int queryOffset = queryIndex * 4;
            Point start = point(queries[queryOffset], queries[queryOffset + 1]);
            Point end = point(queries[queryOffset + 2], queries[queryOffset + 3]);
            Point direction = subtract(end, start);
            ExactRational nearest = null;
            int obstacleIndex = -1;
            for (int candidateIndex = 0; candidateIndex < obstacleCount; candidateIndex++) {
                Obstacle obstacle = exactObstacles[candidateIndex];
                ExactRational candidate = contact(start, end, direction, obstacle);
                if (candidate != null && (nearest == null || candidate.compareTo(nearest) < 0)) {
                    nearest = candidate;
                    obstacleIndex = candidateIndex;
                }
            }
            if (nearest != null) {
                hits[queryIndex] = roundedContact(queryIndex, obstacleIndex, queries, queryOffset,
                        start, direction, nearest);
            }
        }
        return new NearestSegmentContact2D(hits);
    }

    /**
     * Returns the number of entries, including explicit misses, in original query order.
     *
     * @return query count represented by this result
     */
    public int size() {
        return hits.length;
    }

    /**
     * Returns one immutable contact or {@code null} for the query's miss.
     *
     * @param index zero-based query position; negative indices fail before upper-bound checks
     * @return immutable selected contact, or {@code null} when no obstacle contacts the query
     * @throws ContactException with {@code INVALID_INDEX} for a negative index or
     *         {@code INDEX_OUT_OF_RANGE} when index is at least {@link #size()}
     */
    public Contact hitAt(long index) {
        if (index < 0) throw error("INVALID_INDEX");
        if (index >= hits.length) throw error("INDEX_OUT_OF_RANGE");
        return hits[(int) index];
    }

    /**
     * Exports detached lists and records in the operation's output schema.
     *
     * <p>Changing the returned map, its hit list, a point list, or a hit record cannot change
     * this result.</p>
     *
     * @return independently owned {@code {hits:[null|{obstacleIndex,t,point}]}} data
     */
    public Map<String, Object> toValues() {
        List<Object> values = new ArrayList<Object>(hits.length);
        for (Contact contact : hits) {
            if (contact == null) {
                values.add(null);
            } else {
                List<Object> point = new ArrayList<Object>(2);
                point.add(Double.valueOf(contact.x));
                point.add(Double.valueOf(contact.y));
                Map<String, Object> value = new LinkedHashMap<String, Object>();
                value.put("obstacleIndex", Integer.valueOf(contact.obstacleIndex));
                value.put("t", Double.valueOf(contact.t));
                value.put("point", point);
                values.add(value);
            }
        }
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("hits", values);
        return result;
    }

    private static Contact roundedContact(int queryIndex, int obstacleIndex, double[] queries,
            int offset, Point start, Point direction, ExactRational parameter) {
        boolean atStart = parameter.equals(ExactRational.ZERO);
        boolean atEnd = parameter.equals(ExactRational.ONE);
        double t = zero(parameter.value());
        if (!atStart && !atEnd && (t == 0.0 || t == 1.0)) {
            throw dynamic("REPRESENTATION_COLLAPSE", queryIndex, "parameter");
        }
        if (atStart) {
            return new Contact(obstacleIndex, t, queries[offset], queries[offset + 1]);
        }
        if (atEnd) {
            return new Contact(obstacleIndex, t, queries[offset + 2], queries[offset + 3]);
        }
        Point exact = at(start, direction, parameter);
        double x = zero(exact.x.value());
        double y = zero(exact.y.value());
        if (same(x, y, queries[offset], queries[offset + 1])
                || same(x, y, queries[offset + 2], queries[offset + 3])) {
            throw dynamic("REPRESENTATION_COLLAPSE", queryIndex, "point");
        }
        return new Contact(obstacleIndex, t, x, y);
    }

    private static ExactRational contact(Point start, Point end, Point direction,
            Obstacle obstacle) {
        Point obstacleStart = obstacle.start;
        Point obstacleEnd = obstacle.end;
        Point obstacleDirection = obstacle.direction;
        if (same(start, end)) {
            return on(obstacleStart, obstacleEnd, start) ? ExactRational.ZERO : null;
        }
        Point offset = subtract(obstacleStart, start);
        ExactRational denominator = cross(direction, obstacleDirection);
        if (denominator.signum() != 0) {
            ExactRational t = cross(offset, obstacleDirection).divide(denominator);
            ExactRational u = cross(offset, direction).divide(denominator);
            return unit(t) && unit(u) ? t : null;
        }
        if (cross(offset, direction).signum() != 0) return null;
        boolean xAxis = direction.x.signum() != 0;
        ExactRational first = coordinate(obstacleStart, xAxis).subtract(coordinate(start, xAxis))
                .divide(coordinate(direction, xAxis));
        ExactRational second = coordinate(obstacleEnd, xAxis).subtract(coordinate(start, xAxis))
                .divide(coordinate(direction, xAxis));
        ExactRational lower = first.compareTo(second) <= 0 ? first : second;
        ExactRational upper = first.compareTo(second) <= 0 ? second : first;
        ExactRational t = lower.compareTo(ExactRational.ZERO) < 0 ? ExactRational.ZERO : lower;
        return t.compareTo(ExactRational.ONE) <= 0 && t.compareTo(upper) <= 0 ? t : null;
    }

    private static boolean on(Point start, Point end, Point point) {
        Point direction = subtract(end, start);
        if (same(start, end)) return same(start, point);
        if (cross(direction, subtract(point, start)).signum() != 0) return false;
        boolean xAxis = direction.x.signum() != 0;
        ExactRational value = coordinate(point, xAxis);
        ExactRational first = coordinate(start, xAxis);
        ExactRational second = coordinate(end, xAxis);
        return between(value, first, second);
    }

    private static boolean between(ExactRational value, ExactRational first, ExactRational second) {
        if (first.compareTo(second) <= 0) {
            return value.compareTo(first) >= 0 && value.compareTo(second) <= 0;
        }
        return value.compareTo(second) >= 0 && value.compareTo(first) <= 0;
    }

    private static boolean unit(ExactRational value) {
        return value.compareTo(ExactRational.ZERO) >= 0 && value.compareTo(ExactRational.ONE) <= 0;
    }

    private static Point point(double x, double y) {
        return new Point(ExactRational.of(x), ExactRational.of(y));
    }

    private static Obstacle[] exactObstacles(double[] values, int count) {
        Obstacle[] result = new Obstacle[count];
        for (int index = 0; index < count; index++) {
            int offset = index * 4;
            Point start = point(values[offset], values[offset + 1]);
            Point end = point(values[offset + 2], values[offset + 3]);
            result[index] = new Obstacle(start, end, subtract(end, start));
        }
        return result;
    }

    private static Point subtract(Point first, Point second) {
        return new Point(first.x.subtract(second.x), first.y.subtract(second.y));
    }

    private static Point at(Point start, Point direction, ExactRational t) {
        return new Point(start.x.add(direction.x.multiply(t)), start.y.add(direction.y.multiply(t)));
    }

    private static ExactRational cross(Point first, Point second) {
        return first.x.multiply(second.y).subtract(first.y.multiply(second.x));
    }

    private static ExactRational coordinate(Point point, boolean xAxis) {
        return xAxis ? point.x : point.y;
    }

    private static Map<?, ?> record(Object value) {
        if (!(value instanceof Map)) throw error("INVALID_INPUT");
        Map<?, ?> record = (Map<?, ?>) value;
        if (record.size() != 3 || !record.containsKey(QUERIES) || !record.containsKey(OBSTACLES)
                || !record.containsKey(MAX_WORK)) throw error("INVALID_INPUT");
        for (Object key : record.keySet()) {
            if (!(key instanceof String) || !(QUERIES.equals(key) || OBSTACLES.equals(key)
                    || MAX_WORK.equals(key))) throw error("INVALID_INPUT");
        }
        return record;
    }

    private static double[] quadruples(Object value) {
        if (!(value instanceof List)) throw error("INVALID_INPUT");
        List<?> rows = (List<?>) value;
        if (rows.size() > MAX_COUNT) throw error("INVALID_INPUT");
        double[] result = new double[rows.size() * 4];
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            Object rowValue = rows.get(rowIndex);
            if (!(rowValue instanceof List) || ((List<?>) rowValue).size() != 4) {
                throw error("INVALID_INPUT");
            }
            List<?> row = (List<?>) rowValue;
            for (int column = 0; column < 4; column++) result[rowIndex * 4 + column] = number(row.get(column));
        }
        return result;
    }

    private static double number(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double)) {
            throw error("INVALID_INPUT");
        }
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number)) throw error("INVALID_INPUT");
        return zero(number);
    }

    private static long whole(Object value) {
        double number = number(value);
        if (number < 0 || number > MAX_SAFE || number != Math.floor(number)) {
            throw error("INVALID_INPUT");
        }
        return (long) number;
    }

    private static boolean same(Point first, Point second) {
        return first.x.equals(second.x) && first.y.equals(second.y);
    }

    private static boolean same(double x, double y, double otherX, double otherY) {
        return x == otherX && y == otherY;
    }

    private static double zero(double value) {
        return value == 0.0 ? 0.0 : value;
    }

    private static ContactException error(String code) {
        return new ContactException(code, -1, null);
    }

    private static ContactException dynamic(String code, int queryIndex, String stage) {
        return new ContactException(code, queryIndex, stage);
    }

    private static final class Point {
        final ExactRational x;
        final ExactRational y;

        Point(ExactRational x, ExactRational y) {
            this.x = x;
            this.y = y;
        }
    }

    /** Captured exact obstacle geometry reused across all query pair tests in one call. */
    private static final class Obstacle {
        final Point start;
        final Point end;
        final Point direction;

        Obstacle(Point start, Point end, Point direction) {
            this.start = start;
            this.end = end;
            this.direction = direction;
        }
    }

    /** Immutable nearest-contact values owned by a {@link NearestSegmentContact2D} result. */
    public static final class Contact {
        /** Zero-based ordinal of the selected supplied obstacle. */
        public final int obstacleIndex;
        /** Closed directed-query parameter, rounded once to canonical binary64. */
        public final double t;
        /** Contact horizontal coordinate in caller units, rounded once to canonical binary64. */
        public final double x;
        /** Contact vertical coordinate in caller units, rounded once to canonical binary64. */
        public final double y;

        private Contact(int obstacleIndex, double t, double x, double y) {
            this.obstacleIndex = obstacleIndex;
            this.t = t;
            this.x = x;
            this.y = y;
        }
    }

    /**
     * Signals an operation error with stable contract detail.
     *
     * <p>{@link #queryIndex} is {@code -1} and {@link #stage} is {@code null} except for
     * an interior-contact representation collapse.</p>
     */
    public static final class ContactException extends IllegalArgumentException {
        /** Stable operation error code. */
        public final String code;
        /** Query ordinal for a representation collapse, otherwise {@code -1}. */
        public final int queryIndex;
        /** Collapse stage {@code parameter} or {@code point}, otherwise {@code null}. */
        public final String stage;

        private ContactException(String code, int queryIndex, String stage) {
            super(code);
            this.code = code;
            this.queryIndex = queryIndex;
            this.stage = stage;
        }
    }
}
