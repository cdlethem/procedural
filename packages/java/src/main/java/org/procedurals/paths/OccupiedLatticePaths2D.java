package org.procedurals.paths;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Retained shared-occupancy cardinal lattice paths for
 * {@code path.occupied-lattice-paths-2d} 0.1.0.
 *
 * <p>This independently specified core is motivated by
 * {@code survey/out/2019/generativos/tata/notes.md}. It deliberately does not reproduce
 * tata's omitted starts, random proposals, scene stream, or rendering.</p>
 */
public final strictfp class OccupiedLatticePaths2D {
    private static final int MAX_CELLS = 1073741823;
    private static final int MAX_STEPS = 1073741822;
    private static final long MAX_SAFE_INTEGER = 9007199254740991L;
    private static final String[] KEYS = {"dimensions", "starts", "maxSteps", "maxCells", "random"};
    private static final String[] RANDOM_KEYS = {"seed", "state"};

    /** Validation or retained-access failure with its stable catalog error code. */
    public static final class LatticeException extends IllegalArgumentException {
        public final String code;
        public LatticeException(String code) {
            super(code);
            this.code = code;
        }
    }

    private final int[] x;
    private final int[] y;
    private final int[] offsets;
    private final String[] reasons;
    private final long[] randomState;

    private OccupiedLatticePaths2D(Storage storage, long[] state) {
        this.x = storage.trimX();
        this.y = storage.trimY();
        this.offsets = storage.trimOffsets();
        this.reasons = storage.trimReasons();
        this.randomState = state;
    }

    /**
     * Generates a detached batch from the five-key passive configuration record.
     * Static validation precedes capacity admission, private-stream initialization,
     * sparse occupancy and owned retained storage.
     */
    public static OccupiedLatticePaths2D generate(Object config) {
        Map<?, ?> record = record(config, KEYS);
        List<?> dimensions = pair(record.get("dimensions"));
        int columns = positiveInt(dimensions.get(0));
        int rows = positiveInt(dimensions.get(1));
        Object startValue = record.get("starts");
        if (!(startValue instanceof List)) invalidInput();
        List<?> starts = (List<?>) startValue;
        if (starts.size() > MAX_CELLS) invalidInput();
        validateStarts(starts, columns, rows);
        int maxSteps = boundedInt(record.get("maxSteps"), 0, MAX_STEPS);
        int maxCells = boundedInt(record.get("maxCells"), 0, MAX_CELLS);
        Initial initial = random(record.get("random"));
        long potential = ((long) starts.size()) * (((long) maxSteps) + 1L);
        if (potential > maxCells) throw new LatticeException("WORK_LIMIT_EXCEEDED");

        // Capture only after every static field and the conservative bound are valid.
        int[] startX = new int[starts.size()];
        int[] startY = new int[starts.size()];
        int index = 0;
        for (Object item : starts) {
            List<?> start = (List<?>) item;
            startX[index] = (int) integral(start.get(0));
            startY[index] = (int) integral(start.get(1));
            index++;
        }
        Xoshiro128StarStar11 stream = new Xoshiro128StarStar11(initial);
        Storage storage = new Storage(starts.size(), maxCells);
        LongSet occupied = new LongSet(Math.min(maxCells, Math.max(16, starts.size())));
        for (int path = 0; path < starts.size(); path++) {
            int currentX = startX[path],
                    currentY = startY[path];
            storage.beginPath();
            if (occupied.contains(key(currentX, currentY))) {
                storage.endPath("occupied-start");
                continue;
            }
            occupied.add(key(currentX, currentY));
            storage.append(currentX, currentY);
            if (maxSteps == 0) {
                storage.endPath("step-limit");
                continue;
            }
            int moved = 0;
            while (moved < maxSteps) {
                int count = 0;
                long candidate0 = 0L, candidate1 = 0L,
                        candidate2 = 0L, candidate3 = 0L;
                if (currentY > 0 && !occupied.contains(key(currentX, currentY - 1))) {
                    candidate0 = key(currentX, currentY - 1); count++;
                }
                if (currentX + 1 < columns && !occupied.contains(key(currentX + 1, currentY))) {
                    long candidate = key(currentX + 1, currentY);
                    if (count == 0) candidate0 = candidate; else if (count == 1) candidate1 = candidate;
                    else if (count == 2) candidate2 = candidate; else candidate3 = candidate;
                    count++;
                }
                if (currentY + 1 < rows && !occupied.contains(key(currentX, currentY + 1))) {
                    long candidate = key(currentX, currentY + 1);
                    if (count == 0) candidate0 = candidate; else if (count == 1) candidate1 = candidate;
                    else if (count == 2) candidate2 = candidate; else candidate3 = candidate;
                    count++;
                }
                if (currentX > 0 && !occupied.contains(key(currentX - 1, currentY))) {
                    long candidate = key(currentX - 1, currentY);
                    if (count == 0) candidate0 = candidate; else if (count == 1) candidate1 = candidate;
                    else if (count == 2) candidate2 = candidate; else candidate3 = candidate;
                    count++;
                }
                if (count == 0) {
                    storage.endPath("blocked");
                    break;
                }
                int chosen = (int) ((Integer.toUnsignedLong(stream.nextU32()) * count) >>> 32);
                long selected;
                if (chosen == 0)
                    selected = candidate0;
                else if (chosen == 1)
                    selected = candidate1;
                else if (chosen == 2)
                    selected = candidate2;
                else
                    selected = candidate3;
                currentX = (int) (selected >> 32);
                currentY = (int) selected;
                occupied.add(key(currentX, currentY));
                storage.append(currentX, currentY);
                moved++;
                if (moved == maxSteps) {
                    storage.endPath("step-limit");
                }
            }
        }
        return new OccupiedLatticePaths2D(storage, stream.state());
    }

    /** Number of paths, including empty occupied-start paths. */
    public int pathCount() {
        return reasons.length;
    }
    /** Retained cell count for the indexed path. */
    public int pathLengthAt(long path) {
        return offsets[pathIndex(path) + 1] - offsets[pathIndex(path)];
    }
    /** Numeric-carrier overload for Java interchange callers. */
    public int pathLengthAt(Object path) {
        return pathLengthAt(accessIndex(path));
    }
    /** Returns a fresh detached {@code [x,y]} pair. */
    public int[] cellAt(long path, long cell) {
        int p = pathIndex(path);
        return pairAt(p, cellIndex(p, cell));
    }
    /** Numeric-carrier overload for Java interchange callers. */
    public int[] cellAt(Object path, Object cell) {
        long p = accessIndex(path);
        int checked = pathIndex(p);
        return pairAt(checked, cellIndex(checked, accessIndex(cell)));
    }
    /** Writes two cells only after path, cell and destination validation. */
    public void cellInto(long path, long cell, int[] output, int offset) {
        int p = pathIndex(path);
        int c = cellIndex(p, cell);
        write(p, c, output, offset);
    }
    /** Numeric-carrier overload with the same field-ordered validation. */
    public void cellInto(Object path, Object cell, int[] output, int offset) {
        long p = accessIndex(path);
        int checked = pathIndex(p);
        int c = cellIndex(checked, accessIndex(cell));
        write(checked, c, output, offset);
    }
    /** Completion reason aligned to the supplied start. */
    public String completionReasonAt(long path) {
        return reasons[pathIndex(path)];
    }
    /** Numeric-carrier overload for Java interchange callers. */
    public String completionReasonAt(Object path) {
        return completionReasonAt(accessIndex(path));
    }
    /** Returns a fresh unsigned-value carrier represented by Java longs. */
    public long[] randomState() {
        return randomState.clone();
    }

    /** Materializes detached ordinary JSON-compatible output. */
    public Map<String, Object> toValues() {
        List<Object> paths = new ArrayList<Object>(reasons.length);
        List<Object> outputReasons = new ArrayList<Object>(reasons.length);
        for (int p = 0; p < reasons.length; p++) {
            List<Object> path = new ArrayList<Object>(offsets[p + 1] - offsets[p]);
            for (int i = offsets[p]; i < offsets[p + 1]; i++) {
                List<Object> cell = new ArrayList<Object>(2);
                cell.add(Integer.valueOf(x[i]));
                cell.add(Integer.valueOf(y[i]));
                path.add(cell);
            }
            paths.add(path);
            outputReasons.add(reasons[p]);
        }
        List<Object> state = new ArrayList<Object>(4);
        for (int i = 0; i < 4; i++) {
            state.add(Long.valueOf(randomState[i]));
        }
        Map<String, Object> values = new LinkedHashMap<String, Object>();
        values.put("paths", paths);
        values.put("completionReasons", outputReasons);
        values.put("randomState", state);
        return values;
    }

    private int pathIndex(long path) {
        if (path < 0 || path > MAX_SAFE_INTEGER)
            throw new LatticeException("INVALID_INDEX");
        if (path >= reasons.length)
            throw new LatticeException("INDEX_OUT_OF_RANGE");
        return (int) path;
    }

    private int cellIndex(int path, long cell) {
        if (cell < 0 || cell > MAX_SAFE_INTEGER)
            throw new LatticeException("INVALID_INDEX");
        int length = offsets[path + 1] - offsets[path];
        if (cell >= length)
            throw new LatticeException("INDEX_OUT_OF_RANGE");
        return (int) cell;
    }

    private int[] pairAt(int path, int cell) {
        int at = offsets[path] + cell;
        return new int[] {x[at], y[at]};
    }

    private void write(int path, int cell, int[] output, int offset) {
        if (output == null || offset < 0 || offset > output.length - 2)
            throw new LatticeException("INVALID_OUTPUT");
        int at = offsets[path] + cell;
        output[offset] = x[at];
        output[offset + 1] = y[at];
    }

    private static long accessIndex(Object value) {
        if (!numeric(value))
            throw new LatticeException("INVALID_INDEX");
        double n = ((Number) value).doubleValue();
        if (!Double.isFinite(n) || n < 0 || n > MAX_SAFE_INTEGER || n != Math.floor(n))
            throw new LatticeException("INVALID_INDEX");
        return (long) n;
    }

    private static void validateStarts(List<?> starts, int columns, int rows) {
        for (Object item : starts) {
            List<?> pair = pair(item);
            long x = integral(pair.get(0));
            if (x < 0 || x >= columns) invalidInput();
            long y = integral(pair.get(1));
            if (y < 0 || y >= rows) invalidInput();
        }
    }
    private static Initial random(Object value) {
        Map<?, ?> r = recordEither(value, RANDOM_KEYS);
        boolean seed = r.containsKey("seed"), state = r.containsKey("state");
        if (seed == state)
            invalidInput();
        if (seed)
            return new Initial(uint32(r.get("seed")), null);
        List<?> words = state(r.get("state"));
        long[] result = new long[4];
        long any = 0;
        for (int i = 0; i < 4; i++) {
            result[i] = uint32(words.get(i));
            any |= result[i];
        }
        if (any == 0)
            invalidInput();
        return new Initial(-1, result);
    }

    private static Map<?, ?> record(Object value, String[] keys) {
        if (!(value instanceof Map))
            invalidInput();
        Map<?, ?> map = (Map<?, ?>) value;
        if (map.size() != keys.length)
            invalidInput();
        for (String key : keys)
            if (!map.containsKey(key)) invalidInput();
        return map;
    }

    private static Map<?, ?> recordEither(Object value, String[] keys) {
        if (!(value instanceof Map))
            invalidInput();
        Map<?, ?> map = (Map<?, ?>) value;
        if (map.size() != 1)
            invalidInput();
        for (String key : keys)
            if (map.containsKey(key)) return map;
        invalidInput();
        return null;
    }

    private static List<?> pair(Object value) {
        if (!(value instanceof List) || ((List<?>) value).size() != 2)
            invalidInput();
        return (List<?>) value;
    }

    private static List<?> state(Object value) {
        if (!(value instanceof List) || ((List<?>) value).size() != 4)
            invalidInput();
        return (List<?>) value;
    }

    private static boolean numeric(Object value) {
        return value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double;
    }

    private static long integral(Object value) {
        if (!numeric(value))
            invalidInput();
        double n = ((Number) value).doubleValue();
        if (!Double.isFinite(n) || n != Math.floor(n))
            invalidInput();
        return (long) n;
    }

    private static int positiveInt(Object value) {
        return boundedInt(value, 1, Integer.MAX_VALUE);
    }

    private static int boundedInt(Object value, int lower, int upper) {
        long n = integral(value);
        if (n < lower || n > upper)
            invalidInput();
        return (int) n;
    }

    private static long uint32(Object value) {
        long n = integral(value);
        if (n < 0 || n > 0xffffffffL)
            invalidInput();
        return n;
    }

    private static void invalidInput() {
        throw new LatticeException("INVALID_INPUT");
    }

    private static long key(int x, int y) {
        return (((long) x) << 32) ^ (y & 0xffffffffL);
    }

    private static final class Initial {
        final long seed;
        final long[] state;

        Initial(long seed, long[] state) {
            this.seed = seed;
            this.state = state;
        }
    }

    private static final class Xoshiro128StarStar11 {
        int s0, s1, s2, s3;

        Xoshiro128StarStar11(Initial initial) {
            if (initial.state != null) {
                s0 = (int) initial.state[0];
                s1 = (int) initial.state[1];
                s2 = (int) initial.state[2];
                s3 = (int) initial.state[3];
            } else {
                long a = initial.seed;
                a += 0x9e3779b97f4a7c15L;
                long q0 = mix(a);
                a += 0x9e3779b97f4a7c15L;
                long q1 = mix(a);
                s0 = (int) q0;
                s1 = (int) (q0 >>> 32);
                s2 = (int) q1;
                s3 = (int) (q1 >>> 32);
            }
        }

        int nextU32() {
            int out = Integer.rotateLeft(s1 * 5, 7) * 9, t = s1 << 9;
            s2 ^= s0;
            s3 ^= s1;
            s1 ^= s2;
            s0 ^= s3;
            s2 ^= t;
            s3 = Integer.rotateLeft(s3, 11);
            return out;
        }

        long[] state() {
            return new long[] {
                Integer.toUnsignedLong(s0), Integer.toUnsignedLong(s1),
                Integer.toUnsignedLong(s2), Integer.toUnsignedLong(s3)
            };
        }

        static long mix(long z) {
            z = (z ^ (z >>> 30)) * 0xbf58476d1ce4e5b9L;
            z = (z ^ (z >>> 27)) * 0x94d049bb133111ebL;
            return z ^ (z >>> 31);
        }
    }

    private static final class Storage {
        int[] x, y, offsets;
        String[] reasons;
        int cells, paths;
        final int maximum;

        Storage(int pathCount, int maximum) {
            this.maximum = maximum;
            int initial = Math.min(maximum, 16);
            x = new int[initial];
            y = new int[initial];
            int pathInitial = Math.min(pathCount, 16);
            reasons = new String[pathInitial];
            offsets = new int[pathInitial + 1];
        }

        void beginPath() {
            ensurePaths(paths + 1);
            offsets[paths] = cells;
        }

        void append(int px, int py) {
            ensureCells(cells + 1);
            x[cells] = px;
            y[cells++] = py;
        }

        void endPath(String reason) {
            reasons[paths] = reason;
            offsets[++paths] = cells;
        }

        int[] trimX() {
            return copy(x, cells);
        }

        int[] trimY() {
            return copy(y, cells);
        }

        int[] trimOffsets() {
            return copy(offsets, paths + 1);
        }

        String[] trimReasons() {
            String[] r = new String[paths];
            System.arraycopy(reasons, 0, r, 0, paths);
            return r;
        }

        void ensureCells(int needed) {
            if (needed <= x.length) return;
            int n = grow(x.length, needed, maximum);
            x = copy(x, n);
            y = copy(y, n);
        }

        void ensurePaths(int needed) {
            if (needed <= reasons.length) return;
            int n = grow(reasons.length, needed, maximum);
            String[] r = new String[n];
            System.arraycopy(reasons, 0, r, 0, reasons.length);
            reasons = r;
            offsets = copy(offsets, n + 1);
        }

        static int grow(int old, int needed, int max) {
            int n = Math.max(1, old);
            while (n < needed) n = Math.min(max, n + Math.max(n, 16));
            return n;
        }

        static int[] copy(int[] a, int n) {
            int[] b = new int[n];
            System.arraycopy(a, 0, b, 0, Math.min(a.length, n));
            return b;
        }
    }
    /** Open-addressed primitive sparse occupancy; no boxed cells in the transition loop. */
    private static final class LongSet {
        private static final int MAX_CAPACITY = 1 << 30;
        long[] keys;
        byte[] used;
        int size;
        int threshold;

        LongSet(int expected) {
            int capacity = 16;
            long desired = ((long) expected) * 2L;
            while (capacity < desired && capacity < MAX_CAPACITY) capacity <<= 1;
            keys = new long[capacity];
            used = new byte[capacity];
            threshold = threshold(capacity);
        }

        boolean contains(long key) {
            int index = (int) mix(key) & (keys.length - 1);
            while (used[index] != 0) {
                if (keys[index] == key) return true;
                index = (index + 1) & (keys.length - 1);
            }
            return false;
        }

        void add(long key) {
            if (size >= threshold && keys.length < MAX_CAPACITY) rehash(nextCapacity(keys.length));
            int index = (int) mix(key) & (keys.length - 1);
            while (used[index] != 0) {
                if (keys[index] == key) return;
                index = (index + 1) & (keys.length - 1);
            }
            used[index] = 1;
            keys[index] = key;
            size++;
        }

        private void rehash(int capacity) {
            long[] oldKeys = keys;
            byte[] oldUsed = used;
            keys = new long[capacity];
            used = new byte[capacity];
            threshold = threshold(capacity);
            size = 0;
            for (int index = 0; index < oldKeys.length; index++) if (oldUsed[index] != 0) add(oldKeys[index]);
        }

        static int nextCapacity(int capacity) {
            return capacity >= MAX_CAPACITY ? MAX_CAPACITY : capacity << 1;
        }

        static int threshold(int capacity) {
            if (capacity == MAX_CAPACITY) return MAX_CAPACITY;
            return (int) ((((long) capacity) * 2L) / 3L);
        }

        static long mix(long value) {
            value ^= value >>> 33;
            value *= 0xff51afd7ed558ccdL;
            value ^= value >>> 33;
            return value;
        }
    }
}
