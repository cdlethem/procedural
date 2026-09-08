package org.procedurals.topology;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable retained endpoint branches for {@code topology.seeded-endpoint-branches-2d}
 * 0.1.0.
 *
 * <p>The independently specified kernel is motivated by
 * {@code survey/out/2018/Generativos/arbolito3/notes.md} and
 * {@code survey/out/2018/Generativos/arbolito4/notes.md}. It does not reproduce their
 * Processing stream, recursive traversal, colour, line weight, terminal marks, forest
 * placement, or rendering. The source observations and measured depth/spread edits do not
 * establish defaults, encouraged values, or continuous artistic ranges.</p>
 */
public final strictfp class BranchTree2D {
    private static final int MAX_SEGMENTS = 357913941;
    private static final long MAX_SAFE_INTEGER = 9007199254740991L;
    private static final String[] KEYS = {"seed", "root", "rules", "maxSegments"};
    private static final String[] ROOT_KEYS = {"origin", "heading", "length"};
    private static final String[] RULE_KEYS = {"lengthScale", "slots"};
    private static final String[] SLOT_KEYS = {"probability", "turn"};

    /** Static validation or accessor failure with its stable catalog error {@link #code}. */
    public static final class BranchException extends IllegalArgumentException {
        public final String code;
        public BranchException(String code) {
            super(code);
            this.code = code;
        }
    }

    /** Arithmetic failure while materializing the root or one selected child. */
    public static final class BranchArithmeticException extends ArithmeticException {
        public final String code;
        public final int parentIndex;
        public final int slotIndex;
        public final String stage;
        public BranchArithmeticException(int parentIndex, int slotIndex, String stage) {
            super("BRANCH_ARITHMETIC_INVALID");
            this.code = "BRANCH_ARITHMETIC_INVALID";
            this.parentIndex = parentIndex;
            this.slotIndex = slotIndex;
            this.stage = stage;
        }
    }

    /** A selected child would exceed the declared retained-segment capacity. */
    public static final class SegmentLimitException extends IllegalArgumentException {
        public final String code;
        public final int parentIndex;
        public final int slotIndex;
        public SegmentLimitException(int parentIndex, int slotIndex) {
            super("SEGMENT_LIMIT_EXCEEDED");
            this.code = "SEGMENT_LIMIT_EXCEEDED";
            this.parentIndex = parentIndex;
            this.slotIndex = slotIndex;
        }
    }

    private final double[] startX;
    private final double[] startY;
    private final double[] endX;
    private final double[] endY;
    private final double[] headings;
    private final double[] lengths;
    private final int[] parents;
    private final int[] generations;
    private final int[] childCounts;

    private BranchTree2D(Storage storage) {
        startX = storage.startX;
        startY = storage.startY;
        endX = storage.endX;
        endY = storage.endY;
        headings = storage.headings;
        lengths = storage.lengths;
        parents = storage.parents;
        generations = storage.generations;
        childCounts = storage.childCounts;
    }

    /**
     * Generates a detached breadth-first retained tree from the required passive record.
     * Every static input is validated before root arithmetic, retained storage allocation,
     * or private RNG initialization.
     * Motivated by {@code survey/out/2018/Generativos/arbolito3/notes.md} and
     * {@code survey/out/2018/Generativos/arbolito4/notes.md}. Their measured depth and
     * spread edits establish impact, not defaults or encouraged parameter ranges.
     */
    public static BranchTree2D generate(Object config) {
        Map<?, ?> record = record(config, KEYS);
        long seed = uint32(record.get("seed"));
        Root root = root(record.get("root"));
        Rule[] rules = rules(record.get("rules"));
        int maxSegments = maximum(record.get("maxSegments"));

        double rootDx = zero(Math.cos(root.heading) * root.length);
        if (!Double.isFinite(rootDx)) throw new BranchArithmeticException(-1, -1, "delta_x");
        double rootDy = zero(Math.sin(root.heading) * root.length);
        if (!Double.isFinite(rootDy)) throw new BranchArithmeticException(-1, -1, "delta_y");
        double rootEndX = zero(root.x + rootDx);
        if (!Double.isFinite(rootEndX)) throw new BranchArithmeticException(-1, -1, "position_x");
        double rootEndY = zero(root.y + rootDy);
        if (!Double.isFinite(rootEndY)) throw new BranchArithmeticException(-1, -1, "position_y");
        Storage storage = new Storage(maxSegments);
        storage.append(root.x, root.y, rootEndX, rootEndY, root.heading, root.length, -1, 0);
        if (rules.length == 0) return new BranchTree2D(storage.finish());

        Xoshiro128StarStar11 stream = new Xoshiro128StarStar11(seed);
        for (int parentIndex = 0; parentIndex < storage.size; parentIndex++) {
            int generation = storage.generations[parentIndex];
            if (generation >= rules.length) continue;
            Rule rule = rules[generation];
            double scale = interpolate(rule.scaleLow, rule.scaleHigh, stream.unit());
            for (int slotIndex = 0; slotIndex < rule.slots.length; slotIndex++) {
                Slot slot = rule.slots[slotIndex];
                double gate = stream.unit();
                if (!(gate < slot.probability)) continue;
                if (storage.size >= maxSegments) throw new SegmentLimitException(parentIndex, slotIndex);
                double turn = interpolate(slot.turnLow, slot.turnHigh, stream.unit());
                double childLength = zero(storage.lengths[parentIndex] * scale);
                if (!Double.isFinite(childLength))
                    throw new BranchArithmeticException(parentIndex, slotIndex, "length");
                double childHeading = zero(storage.headings[parentIndex] + turn);
                if (!Double.isFinite(childHeading))
                    throw new BranchArithmeticException(parentIndex, slotIndex, "heading");
                double childDx = zero(Math.cos(childHeading) * childLength);
                if (!Double.isFinite(childDx))
                    throw new BranchArithmeticException(parentIndex, slotIndex, "delta_x");
                double childDy = zero(Math.sin(childHeading) * childLength);
                if (!Double.isFinite(childDy))
                    throw new BranchArithmeticException(parentIndex, slotIndex, "delta_y");
                double childEndX = zero(storage.endX[parentIndex] + childDx);
                if (!Double.isFinite(childEndX))
                    throw new BranchArithmeticException(parentIndex, slotIndex, "position_x");
                double childEndY = zero(storage.endY[parentIndex] + childDy);
                if (!Double.isFinite(childEndY))
                    throw new BranchArithmeticException(parentIndex, slotIndex, "position_y");
                storage.append(storage.endX[parentIndex], storage.endY[parentIndex], childEndX, childEndY,
                        childHeading, childLength, parentIndex, generation + 1);
                storage.childCounts[parentIndex]++;
            }
        }
        return new BranchTree2D(storage.finish());
    }

    /** Retained segment count. */
    public int size() { return parents.length; }

    /** Returns a fresh detached {@code [startX,startY,endX,endY]} binary64 carrier. */
    public double[] segmentAt(long index) {
        int checked = checkedIndex(index);
        return new double[] {startX[checked], startY[checked], endX[checked], endY[checked]};
    }

    /** Numeric-carrier overload for Java interchange callers. */
    public double[] segmentAt(Object index) { return segmentAt(accessIndex(index)); }

    /** Writes four segment coordinates after all index and destination validation succeeds. */
    public void segmentInto(long index, double[] destination, int offset) {
        int checked = checkedIndex(index);
        if (destination == null || offset < 0 || offset > destination.length - 4)
            throw new BranchException("INVALID_OUTPUT");
        destination[offset] = startX[checked];
        destination[offset + 1] = startY[checked];
        destination[offset + 2] = endX[checked];
        destination[offset + 3] = endY[checked];
    }

    /** Numeric-carrier overload for Java interchange callers. */
    public void segmentInto(Object index, double[] destination, int offset) {
        segmentInto(accessIndex(index), destination, offset);
    }

    /** Aligned nominal heading. */
    public double headingAt(long index) { return headings[checkedIndex(index)]; }
    /** Numeric-carrier overload for Java interchange callers. */
    public double headingAt(Object index) { return headingAt(accessIndex(index)); }
    /** Aligned nominal length. */
    public double lengthAt(long index) { return lengths[checkedIndex(index)]; }
    /** Numeric-carrier overload for Java interchange callers. */
    public double lengthAt(Object index) { return lengthAt(accessIndex(index)); }
    /** Aligned retained parent index. */
    public int parentAt(long index) { return parents[checkedIndex(index)]; }
    /** Numeric-carrier overload for Java interchange callers. */
    public int parentAt(Object index) { return parentAt(accessIndex(index)); }
    /** Aligned retained generation. */
    public int generationAt(long index) { return generations[checkedIndex(index)]; }
    /** Numeric-carrier overload for Java interchange callers. */
    public int generationAt(Object index) { return generationAt(accessIndex(index)); }
    /** Aligned direct child count. */
    public int childCountAt(long index) { return childCounts[checkedIndex(index)]; }
    /** Numeric-carrier overload for Java interchange callers. */
    public int childCountAt(Object index) { return childCountAt(accessIndex(index)); }

    /** Materializes detached ordinary output and never exposes retained packed arrays. */
    public Map<String, Object> toValues() {
        int count = size();
        List<Object> segments = new ArrayList<Object>(count);
        List<Object> outputHeadings = new ArrayList<Object>(count);
        List<Object> outputLengths = new ArrayList<Object>(count);
        List<Object> outputParents = new ArrayList<Object>(count);
        List<Object> outputGenerations = new ArrayList<Object>(count);
        List<Object> outputChildCounts = new ArrayList<Object>(count);
        for (int index = 0; index < count; index++) {
            List<Object> segment = new ArrayList<Object>(4);
            segment.add(Double.valueOf(startX[index]));
            segment.add(Double.valueOf(startY[index]));
            segment.add(Double.valueOf(endX[index]));
            segment.add(Double.valueOf(endY[index]));
            segments.add(segment);
            outputHeadings.add(Double.valueOf(headings[index]));
            outputLengths.add(Double.valueOf(lengths[index]));
            outputParents.add(Integer.valueOf(parents[index]));
            outputGenerations.add(Integer.valueOf(generations[index]));
            outputChildCounts.add(Integer.valueOf(childCounts[index]));
        }
        Map<String, Object> values = new LinkedHashMap<String, Object>();
        values.put("segments", segments);
        values.put("headings", outputHeadings);
        values.put("lengths", outputLengths);
        values.put("parents", outputParents);
        values.put("generations", outputGenerations);
        values.put("childCounts", outputChildCounts);
        return values;
    }

    private static double interpolate(double low, double high, double unit) {
        if (unit == 0.0) return zero(low);
        if (unit == 1.0) return zero(high);
        double raw;
        if ((low < 0.0 && high > 0.0) || (high < 0.0 && low > 0.0)) {
            raw = low * (1.0 - unit) + high * unit;
        } else {
            raw = low + (high - low) * unit;
        }
        double minimum = Math.min(low, high);
        double maximum = Math.max(low, high);
        if (raw < minimum) raw = minimum;
        else if (raw > maximum) raw = maximum;
        if (!Double.isFinite(raw)) throw new AssertionError("finite interval interpolation produced nonfinite output");
        return zero(raw);
    }

    private int checkedIndex(long index) {
        if (index < 0L || index > MAX_SAFE_INTEGER) throw new BranchException("INVALID_INDEX");
        if (index >= size()) throw new BranchException("INDEX_OUT_OF_RANGE");
        return (int) index;
    }

    private static Map<?, ?> record(Object value, String[] keys) {
        if (!(value instanceof Map)) invalidInput();
        Map<?, ?> map = (Map<?, ?>) value;
        if (map.size() != keys.length) invalidInput();
        for (String key : keys) if (!map.containsKey(key)) invalidInput();
        return map;
    }

    private static Root root(Object value) {
        Map<?, ?> record = record(value, ROOT_KEYS);
        List<?> origin = pair(record.get("origin"));
        double x = number(origin.get(0));
        double y = number(origin.get(1));
        double heading = number(record.get("heading"));
        double length = nonnegative(record.get("length"));
        return new Root(x, y, heading, length);
    }

    private static Rule[] rules(Object value) {
        if (!(value instanceof List)) invalidInput();
        List<?> input = (List<?>) value;
        Rule[] output = new Rule[input.size()];
        int ruleIndex = 0;
        for (Object suppliedRule : input) {
            Map<?, ?> record = record(suppliedRule, RULE_KEYS);
            List<?> scale = pair(record.get("lengthScale"));
            double scaleLow = nonnegative(scale.get(0));
            double scaleHigh = nonnegative(scale.get(1));
            if (scaleLow > scaleHigh) invalidInput();
            Object suppliedSlots = record.get("slots");
            if (!(suppliedSlots instanceof List)) invalidInput();
            List<?> inputSlots = (List<?>) suppliedSlots;
            Slot[] slots = new Slot[inputSlots.size()];
            int slotIndex = 0;
            for (Object suppliedSlot : inputSlots) {
                Map<?, ?> slotRecord = record(suppliedSlot, SLOT_KEYS);
                double probability = number(slotRecord.get("probability"));
                if (probability < 0.0 || probability > 1.0) invalidInput();
                List<?> turn = pair(slotRecord.get("turn"));
                double turnLow = number(turn.get(0));
                double turnHigh = number(turn.get(1));
                if (turnLow > turnHigh) invalidInput();
                slots[slotIndex++] = new Slot(probability, turnLow, turnHigh);
            }
            output[ruleIndex++] = new Rule(scaleLow, scaleHigh, slots);
        }
        return output;
    }

    private static List<?> pair(Object value) {
        if (!(value instanceof List) || ((List<?>) value).size() != 2) invalidInput();
        return (List<?>) value;
    }

    private static double number(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
                || value instanceof Float || value instanceof Double)) invalidInput();
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number)) invalidInput();
        return zero(number);
    }

    private static double nonnegative(Object value) {
        double number = number(value);
        if (number < 0.0) invalidInput();
        return number;
    }

    private static long uint32(Object value) {
        double number = number(value);
        if (number < 0.0 || number > 4294967295.0 || number != Math.floor(number)) invalidInput();
        return (long) number;
    }

    private static int maximum(Object value) {
        double number = number(value);
        if (number < 1.0 || number > MAX_SEGMENTS || number != Math.floor(number)) invalidInput();
        return (int) number;
    }

    private static long accessIndex(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
                || value instanceof Float || value instanceof Double)) throw new BranchException("INVALID_INDEX");
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number < 0.0 || number > MAX_SAFE_INTEGER || number != Math.floor(number))
            throw new BranchException("INVALID_INDEX");
        return (long) number;
    }

    private static void invalidInput() { throw new BranchException("INVALID_INPUT"); }
    private static double zero(double value) { return value == 0.0 ? 0.0 : value; }

    private static final class Root {
        final double x, y, heading, length;
        Root(double x, double y, double heading, double length) {
            this.x = x; this.y = y; this.heading = heading; this.length = length;
        }
    }
    private static final class Rule {
        final double scaleLow, scaleHigh;
        final Slot[] slots;
        Rule(double scaleLow, double scaleHigh, Slot[] slots) {
            this.scaleLow = scaleLow; this.scaleHigh = scaleHigh; this.slots = slots;
        }
    }
    private static final class Slot {
        final double probability, turnLow, turnHigh;
        Slot(double probability, double turnLow, double turnHigh) {
            this.probability = probability; this.turnLow = turnLow; this.turnHigh = turnHigh;
        }
    }
    /** Private xoshiro128** 1.1 state, initialized by two SplitMix64 outputs. */
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

    /** Growable packed six-binary64/three-int storage; no node objects are retained. */
    private static final class Storage {
        double[] startX, startY, endX, endY, headings, lengths;
        int[] parents, generations, childCounts;
        int size;
        final int maximum;

        Storage(int maximum) {
            this.maximum = maximum;
            int initial = Math.min(maximum, 16);
            startX = new double[initial]; startY = new double[initial];
            endX = new double[initial]; endY = new double[initial];
            headings = new double[initial]; lengths = new double[initial];
            parents = new int[initial]; generations = new int[initial]; childCounts = new int[initial];
        }

        void append(double x0, double y0, double x1, double y1, double heading, double length,
                    int parent, int generation) {
            ensure(size + 1);
            startX[size] = x0; startY[size] = y0; endX[size] = x1; endY[size] = y1;
            headings[size] = heading; lengths[size] = length;
            parents[size] = parent; generations[size] = generation; childCounts[size] = 0;
            size++;
        }

        Storage finish() {
            if (size != startX.length) {
                startX = copy(startX, size); startY = copy(startY, size); endX = copy(endX, size); endY = copy(endY, size);
                headings = copy(headings, size); lengths = copy(lengths, size);
                parents = copy(parents, size); generations = copy(generations, size); childCounts = copy(childCounts, size);
            }
            return this;
        }

        private void ensure(int needed) {
            if (needed <= startX.length) return;
            int capacity = startX.length;
            while (capacity < needed) {
                int next = capacity + Math.max(capacity, 16);
                // Grow to the declared cap once, rather than copying every appended
                // node when doubling would overshoot a non-power-of-two maximum.
                capacity = next <= capacity ? maximum : Math.min(next, maximum);
            }
            startX = copy(startX, capacity); startY = copy(startY, capacity); endX = copy(endX, capacity); endY = copy(endY, capacity);
            headings = copy(headings, capacity); lengths = copy(lengths, capacity);
            parents = copy(parents, capacity); generations = copy(generations, capacity); childCounts = copy(childCounts, capacity);
        }
        private static double[] copy(double[] source, int length) {
            double[] copy = new double[length];
            System.arraycopy(source, 0, copy, 0, Math.min(source.length, length));
            return copy;
        }
        private static int[] copy(int[] source, int length) {
            int[] copy = new int[length];
            System.arraycopy(source, 0, copy, 0, Math.min(source.length, length));
            return copy;
        }
    }
}
