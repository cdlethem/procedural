package org.procedurals.sampling;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Ordered, retained circle placements independently specified from the packing-related
 * notes at survey/out/2018/Generativos/caramelo/notes.md,
 * survey/out/2018/Generativos/candy/notes.md, and
 * survey/out/2017/Generativos/studio/notes.md. Contract:
 * sampling.ordered-circle-filter-2d and sampling.seeded-circle-placement-2d 0.1.0.
 * Discrete fixture settings are conformance examples, not approved continuous ranges or defaults.
 */
public final strictfp class CirclePlacements2D {
    private static final int MAX_ATTEMPTS = 1073741823;
    private static final long MAX_SAFE_INTEGER = 9007199254740991L;
    private static final String[] FILTER_KEYS = {"centres", "radii", "separationScale"};
    private static final String[] SEEDED_KEYS = {"seed", "attempts", "origin", "extent", "radiusRange", "separationScale"};

    /** Validation/access failure whose {@link #code} is a catalog error code. */
    public static final class PlacementException extends IllegalArgumentException {
        public final String code;
        public PlacementException(String code) { super(code); this.code = code; }
    }

    /** Dynamic arithmetic failure with its specified proposal index and calculation stage. */
    public static final class PlacementArithmeticException extends java.lang.ArithmeticException {
        public final String code;
        public final int candidateIndex;
        public final String stage;
        public PlacementArithmeticException(int candidateIndex, String stage) {
            super("PLACEMENT_ARITHMETIC_INVALID");
            this.code = "PLACEMENT_ARITHMETIC_INVALID";
            this.candidateIndex = candidateIndex;
            this.stage = stage;
        }
    }

    private final double[] coordinates;
    private final double[] radii;
    private final int[] sourceIndices;
    private final int attempts;

    private CirclePlacements2D(double[] coordinates, double[] radii, int[] sourceIndices, int attempts) {
        this.coordinates = coordinates;
        this.radii = radii;
        this.sourceIndices = sourceIndices;
        this.attempts = attempts;
    }

    /** Filters supplied candidates in input order through the shared size-aware kernel. */
    public static CirclePlacements2D filter(Object config) {
        Map<?, ?> record = record(config, FILTER_KEYS);
        Object centresObject = record.get("centres");
        Object radiiObject = record.get("radii");
        if (!(centresObject instanceof List) || !(radiiObject instanceof List)) invalid();
        List<?> centres = (List<?>) centresObject;
        List<?> suppliedRadii = (List<?>) radiiObject;
        int count = boundedLength(centres);
        if (suppliedRadii.size() != count) invalid();
        double scale = positive(record.get("separationScale"));

        // Complete static validation is deliberately separate from pair work/allocation.
        for (int i = 0; i < count; i++) {
            validatePair(centres.get(i));
            positive(suppliedRadii.get(i));
        }

        Builder kept = new Builder(count);
        for (int i = 0; i < count; i++) {
            List<?> point = asPair(centres.get(i));
            double x = number(point.get(0));
            double y = number(point.get(1));
            double radius = positive(suppliedRadii.get(i));
            if (kept.accepts(x, y, radius, scale, i)) kept.append(x, y, radius, i);
        }
        return kept.finish(count);
    }

    /** Generates exactly four portable xoshiro units per attempt, then applies the shared kernel. */
    public static CirclePlacements2D seeded(Object config) {
        Map<?, ?> record = record(config, SEEDED_KEYS);
        long seed = uint32(record.get("seed"));
        int count = attemptCount(record.get("attempts"));
        double[] origin = pair(record.get("origin"));
        double[] extent = positivePair(record.get("extent"));
        double[] range = positivePair(record.get("radiusRange"));
        if (range[0] > range[1]) invalid();
        double scale = positive(record.get("separationScale"));

        if (count == 0) return new CirclePlacements2D(new double[0], new double[0], new int[0], 0);
        Builder kept = new Builder(count);
        Xoshiro128StarStar11 stream = new Xoshiro128StarStar11(seed);
        Candidate proposal = new Candidate();
        for (int i = 0; i < count; i++) {
            mapInto(proposal, stream.unit(), stream.unit(), stream.unit(), stream.unit(),
                    origin[0], origin[1], extent[0], extent[1], range[0], range[1], i);
            if (kept.accepts(proposal.x, proposal.y, proposal.radius, scale, i))
                kept.append(proposal.x, proposal.y, proposal.radius, i);
        }
        return kept.finish(count);
    }

    public int size() { return radii.length; }
    public int attempts() { return attempts; }

    public double[] pointAt(long index) {
        int checked = pointIndex(index);
        return new double[] {coordinates[2 * checked], coordinates[2 * checked + 1]};
    }
    public double[] pointAt(Object index) { return pointAt(accessIndex(index)); }

    public void pointInto(long index, double[] destination, int offset) {
        int checked = pointIndex(index);
        if (destination == null || offset < 0 || offset > destination.length - 2) throw new PlacementException("INVALID_OUTPUT");
        destination[offset] = coordinates[2 * checked];
        destination[offset + 1] = coordinates[2 * checked + 1];
    }
    public void pointInto(Object index, double[] destination, int offset) { pointInto(accessIndex(index), destination, offset); }

    public double radiusAt(long index) { return radii[pointIndex(index)]; }
    public double radiusAt(Object index) { return radiusAt(accessIndex(index)); }
    public int sourceIndexAt(long index) { return sourceIndices[pointIndex(index)]; }
    public int sourceIndexAt(Object index) { return sourceIndexAt(accessIndex(index)); }

    /** Materializes a detached interchange value; it never exposes retained buffers. */
    public Map<String, Object> toValues() {
        List<Object> centres = new ArrayList<Object>(size());
        List<Object> resultRadii = new ArrayList<Object>(size());
        List<Object> indices = new ArrayList<Object>(size());
        for (int i = 0; i < size(); i++) {
            List<Object> point = new ArrayList<Object>(2);
            point.add(Double.valueOf(coordinates[2 * i]));
            point.add(Double.valueOf(coordinates[2 * i + 1]));
            centres.add(point);
            resultRadii.add(Double.valueOf(radii[i]));
            indices.add(Integer.valueOf(sourceIndices[i]));
        }
        Map<String, Object> output = new LinkedHashMap<String, Object>();
        output.put("centres", centres);
        output.put("radii", resultRadii);
        output.put("sourceIndices", indices);
        output.put("attempts", Integer.valueOf(attempts));
        return output;
    }

    private int pointIndex(long index) {
        if (index < 0 || index > MAX_SAFE_INTEGER) throw new PlacementException("INVALID_INDEX");
        if (index >= size()) throw new PlacementException("INDEX_OUT_OF_RANGE");
        return (int) index;
    }

    private static Map<?, ?> record(Object config, String[] keys) {
        if (!(config instanceof Map)) invalid();
        Map<?, ?> map = (Map<?, ?>) config;
        if (map.size() != keys.length) invalid();
        for (String key : keys) if (!map.containsKey(key)) invalid();
        return map;
    }

    private static int boundedLength(List<?> list) {
        int length = list.size();
        if (length < 0 || length > MAX_ATTEMPTS) invalid();
        return length;
    }

    private static List<?> asPair(Object value) {
        if (!(value instanceof List) || ((List<?>) value).size() != 2) invalid();
        return (List<?>) value;
    }

    private static void validatePair(Object value) {
        List<?> list = asPair(value);
        number(list.get(0)); number(list.get(1));
    }

    private static double[] pair(Object value) {
        List<?> list = asPair(value);
        return new double[] {number(list.get(0)), number(list.get(1))};
    }

    private static double[] positivePair(Object value) {
        List<?> list = asPair(value);
        return new double[] {positive(list.get(0)), positive(list.get(1))};
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

    private static int attemptCount(Object value) {
        double n = number(value);
        if (n < 0.0 || n > MAX_ATTEMPTS || n != Math.floor(n)) invalid();
        return (int) n;
    }

    private static long uint32(Object value) {
        double n = number(value);
        if (n < 0.0 || n > 4294967295.0 || n != Math.floor(n)) invalid();
        return (long) n;
    }

    private static long accessIndex(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
              || value instanceof Float || value instanceof Double)) throw new PlacementException("INVALID_INDEX");
        double n = ((Number) value).doubleValue();
        if (!Double.isFinite(n) || n < 0.0 || n > MAX_SAFE_INTEGER || n != Math.floor(n))
            throw new PlacementException("INVALID_INDEX");
        return (long) n;
    }

    private static void invalid() { throw new PlacementException("INVALID_INPUT"); }
    private static double zero(double value) { return value == 0.0 ? 0.0 : value; }
    private static double checked(double value, int candidateIndex, String stage) {
        if (!Double.isFinite(value)) throw new PlacementArithmeticException(candidateIndex, stage);
        return value;
    }

    /** Package-private only so the native fixture harness can exercise the real mapper. */
    static Candidate mapForTest(double ux, double uy, double u, double v, Object config) {
        Map<?, ?> record = record(config, SEEDED_KEYS);
        attemptCount(record.get("attempts")); uint32(record.get("seed"));
        double[] origin = pair(record.get("origin"));
        double[] extent = positivePair(record.get("extent"));
        double[] range = positivePair(record.get("radiusRange"));
        if (range[0] > range[1]) invalid(); positive(record.get("separationScale"));
        Candidate candidate = new Candidate();
        mapInto(candidate, ux, uy, u, v, origin[0], origin[1], extent[0], extent[1], range[0], range[1], 0);
        return candidate;
    }

    private static void mapInto(Candidate candidate, double ux, double uy, double u, double v, double ox, double oy,
                                double width, double height, double minRadius, double maxRadius, int index) {
        double px = width * ux;
        if (!Double.isFinite(px)) throw new AssertionError("validated mapping product x");
        double x = checked(px + ox, index, "proposal_x");
        double py = height * uy;
        if (!Double.isFinite(py)) throw new AssertionError("validated mapping product y");
        double y = checked(py + oy, index, "proposal_y");
        double span = maxRadius - minRadius;
        if (!Double.isFinite(span)) throw new AssertionError("validated radius span");
        double first = span * u;
        if (!Double.isFinite(first)) throw new AssertionError("validated radius first");
        double second = first * v;
        if (!Double.isFinite(second)) throw new AssertionError("validated radius second");
        double radius = minRadius + second;
        if (!(Double.isFinite(radius) && radius > 0.0)) throw new AssertionError("validated radius mapping");
        candidate.x = zero(x); candidate.y = zero(y); candidate.radius = radius;
    }

    static final class Candidate {
        double x, y, radius;
    }

    static final class Xoshiro128StarStar11 {
        private int s0, s1, s2, s3;
        Xoshiro128StarStar11(long seed) {
            long state = seed & 0xffffffffL;
            state = splitmixState(state); long first = splitmixOutput(state);
            state = splitmixState(state); long second = splitmixOutput(state);
            s0 = (int) first; s1 = (int) (first >>> 32); s2 = (int) second; s3 = (int) (second >>> 32);
            if ((s0 | s1 | s2 | s3) == 0) throw new AssertionError("all-zero xoshiro state");
        }
        int nextU32() {
            int result = Integer.rotateLeft(s1 * 5, 7) * 9;
            int t = s1 << 9;
            s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t; s3 = Integer.rotateLeft(s3, 11);
            return result;
        }
        double unit() { return ((double) Integer.toUnsignedLong(nextU32())) / 4294967296.0; }
        int[] stateForTest() { return new int[] {s0, s1, s2, s3}; }
        private static long splitmixState(long state) { return state + 0x9e3779b97f4a7c15L; }
        private static long splitmixOutput(long state) {
            long z = state;
            z = (z ^ (z >>> 30)) * 0xbf58476d1ce4e5b9L;
            z = (z ^ (z >>> 27)) * 0x94d049bb133111ebL;
            return z ^ (z >>> 31);
        }
    }

    private static final class Builder {
        private double[] coordinates;
        private double[] radii;
        private int[] indices;
        private int size;
        Builder(int attempts) {
            int initial = attempts == 0 ? 0 : Math.min(attempts, 16);
            coordinates = new double[initial * 2]; radii = new double[initial]; indices = new int[initial];
        }
        boolean accepts(double x, double y, double radius, double scale, int candidateIndex) {
            for (int i = 0; i < size; i++) {
                double dx = checked(x - coordinates[2 * i], candidateIndex, "difference_x");
                double dy = checked(y - coordinates[2 * i + 1], candidateIndex, "difference_y");
                double xx = checked(dx * dx, candidateIndex, "square_x");
                if (dx != 0.0 && xx == 0.0) throw new PlacementArithmeticException(candidateIndex, "square_x");
                double yy = checked(dy * dy, candidateIndex, "square_y");
                if (dy != 0.0 && yy == 0.0) throw new PlacementArithmeticException(candidateIndex, "square_y");
                double squared = checked(xx + yy, candidateIndex, "distance_squared");
                double sum = checked(radius + radii[i], candidateIndex, "radius_sum");
                double threshold = checked(sum * scale, candidateIndex, "threshold");
                if (!(threshold > 0.0)) throw new PlacementArithmeticException(candidateIndex, "threshold");
                double thresholdSquared = checked(threshold * threshold, candidateIndex, "threshold_squared");
                if (thresholdSquared == 0.0) throw new PlacementArithmeticException(candidateIndex, "threshold_squared");
                if (squared < thresholdSquared) return false;
            }
            return true;
        }
        void append(double x, double y, double radius, int sourceIndex) {
            if (size == radii.length) grow();
            coordinates[2 * size] = zero(x); coordinates[2 * size + 1] = zero(y);
            radii[size] = radius; indices[size] = sourceIndex; size++;
        }
        private void grow() {
            int current = radii.length;
            if (current >= MAX_ATTEMPTS) throw new OutOfMemoryError("circle placement capacity");
            int next = current == 0 ? 1 : current + Math.max(1, current >>> 1);
            if (next < 0 || next > MAX_ATTEMPTS) next = MAX_ATTEMPTS;
            double[] nextCoordinates = new double[next * 2];
            double[] nextRadii = new double[next]; int[] nextIndices = new int[next];
            System.arraycopy(coordinates, 0, nextCoordinates, 0, size * 2);
            System.arraycopy(radii, 0, nextRadii, 0, size); System.arraycopy(indices, 0, nextIndices, 0, size);
            coordinates = nextCoordinates; radii = nextRadii; indices = nextIndices;
        }
        CirclePlacements2D finish(int attempts) {
            if (size == radii.length) return new CirclePlacements2D(coordinates, radii, indices, attempts);
            double[] finalCoordinates = new double[size * 2]; double[] finalRadii = new double[size]; int[] finalIndices = new int[size];
            System.arraycopy(coordinates, 0, finalCoordinates, 0, size * 2);
            System.arraycopy(radii, 0, finalRadii, 0, size); System.arraycopy(indices, 0, finalIndices, 0, size);
            return new CirclePlacements2D(finalCoordinates, finalRadii, finalIndices, attempts);
        }
    }
}
