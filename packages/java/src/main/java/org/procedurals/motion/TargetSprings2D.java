package org.procedurals.motion;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Owned, ordered target-spring state for {@code motion.target-springs-2d} 0.1.0.
 *
 * <p>This is independently specified from the target force, velocity, and position
 * update observed in {@code survey/out/2018/Generativos/araniaaas/notes.md}. It does
 * not reproduce that sketch's Processing-float arithmetic, pointer policy, random
 * response, topology, or drawing. The motivating evidence establishes no default or
 * encouraged strength or retention range; callers supply every coefficient.</p>
 *
 * <p>The retained batch is deliberately mutable only through {@link #step(Object)}.
 * Every successful step is one separately rounded binary64 recurrence. Input and
 * exported carriers are detached, and a failed step leaves the current state intact.</p>
 */
public final strictfp class TargetSprings2D {
    private static final int MAX_BODIES = 357913941;
    private static final long MAX_SAFE_INTEGER = 9007199254740991L;
    private static final String[] STATE_KEYS = {"bodies"};
    private static final String[] BODY_KEYS = {"position", "velocity", "strength", "retention"};

    /** Static input, indexed-access, or destination failure with a stable catalog code. */
    public static final class SpringException extends IllegalArgumentException {
        public final String code;

        public SpringException(String code) {
            super(code);
            this.code = code;
        }
    }

    /** First non-finite primitive in an otherwise statically valid spring step. */
    public static final class SpringArithmeticException extends ArithmeticException {
        public final String code;
        public final int bodyIndex;
        public final String axis;
        public final String stage;

        public SpringArithmeticException(int bodyIndex, String axis, String stage) {
            super("SPRING_ARITHMETIC_INVALID");
            this.code = "SPRING_ARITHMETIC_INVALID";
            this.bodyIndex = bodyIndex;
            this.axis = axis;
            this.stage = stage;
        }
    }

    /* Per body: position x/y, velocity x/y, strength, retention. */
    private double[] current;
    private double[] scratch;
    private final double[] capturedTargets;
    private final int count;

    private TargetSprings2D(double[] current, double[] scratch, double[] capturedTargets, int count) {
        this.current = current;
        this.scratch = scratch;
        this.capturedTargets = capturedTargets;
        this.count = count;
    }

    /**
     * Imports a detached output-schema state. Construction validates all static input
     * before allocating the owned output-sized buffers and never performs a step.
     * See {@link TargetSprings2D} for provenance and the no-default/no-range policy.
     */
    public static TargetSprings2D create(Object state) {
        Map<?, ?> record = record(state, STATE_KEYS, "INVALID_INPUT");
        Object suppliedBodies = record.get("bodies");
        if (!(suppliedBodies instanceof List)) invalidInput();
        List<?> bodies = (List<?>) suppliedBodies;
        int count = boundedBodyCount(bodies);

        // This complete pass must precede all owned output-sized allocation.
        for (Object body : bodies) validateBody(body);

        int stateLength = count * 6;
        double[] current = new double[stateLength];
        double[] scratch = new double[stateLength];
        double[] capturedTargets = new double[count * 2];
        Iterator<?> bodyIterator = bodies.iterator();
        for (int offset = 0; bodyIterator.hasNext(); offset += 6) {
            Map<?, ?> body = record(bodyIterator.next(), BODY_KEYS, "INVALID_INPUT");
            List<?> position = pair(body.get("position"), "INVALID_INPUT");
            List<?> velocity = pair(body.get("velocity"), "INVALID_INPUT");
            current[offset] = number(position.get(0), "INVALID_INPUT");
            current[offset + 1] = number(position.get(1), "INVALID_INPUT");
            current[offset + 2] = number(velocity.get(0), "INVALID_INPUT");
            current[offset + 3] = number(velocity.get(1), "INVALID_INPUT");
            current[offset + 4] = strength(body.get("strength"));
            current[offset + 5] = retention(body.get("retention"));
            // Coefficients are immutable within a batch, so both swap buffers own them.
            scratch[offset + 4] = current[offset + 4];
            scratch[offset + 5] = current[offset + 5];
        }
        return new TargetSprings2D(current, scratch, capturedTargets, count);
    }

    /**
     * Advances from canonical target pairs or a packed {@code double[]} passed through
     * interchange code. Targets are fully validated and captured before recurrence.
     * See {@link TargetSprings2D} for provenance and the no-default/no-range policy.
     */
    public void step(Object targets) {
        if (targets instanceof double[]) {
            step((double[]) targets);
            return;
        }
        if (!(targets instanceof List)) invalidInput();
        List<?> pairs = (List<?>) targets;
        if (pairs.size() != count) invalidInput();

        for (Object pair : pairs) validateTargetPair(pair);
        Iterator<?> targetIterator = pairs.iterator();
        for (int offset = 0; targetIterator.hasNext(); offset += 2) {
            List<?> pair = pair(targetIterator.next(), "INVALID_INPUT");
            capturedTargets[offset] = number(pair.get(0), "INVALID_INPUT");
            capturedTargets[offset + 1] = number(pair.get(1), "INVALID_INPUT");
        }
        advance();
    }

    /**
     * Allocation-free-after-warmup target path for exactly {@code 2 * size()} packed
     * binary64 values in body, x/y order. The caller buffer is never retained.
     * See {@link TargetSprings2D} for provenance and the no-default/no-range policy.
     */
    public void step(double[] targets) {
        if (targets == null || targets.length != capturedTargets.length) invalidInput();
        for (int index = 0; index < targets.length; index++) {
            if (!finite(targets[index])) invalidInput();
        }
        for (int index = 0; index < targets.length; index++) capturedTargets[index] = zero(targets[index]);
        advance();
    }

    /** Current body count. See {@link TargetSprings2D} for provenance and parameter policy. */
    public int size() {
        return count;
    }

    /** Returns a detached current {@code [x, y]} position; see {@link TargetSprings2D}. */
    public double[] positionAt(Object index) {
        return positionAt(accessIndex(index));
    }

    /** Returns a detached current {@code [x, y]} position; see {@link TargetSprings2D}. */
    public double[] positionAt(long index) {
        int checked = checkedIndex(index);
        int offset = checked * 6;
        return new double[] {current[offset], current[offset + 1]};
    }

    /** Returns a detached current {@code [x, y]} velocity; see {@link TargetSprings2D}. */
    public double[] velocityAt(Object index) {
        return velocityAt(accessIndex(index));
    }

    /** Returns a detached current {@code [x, y]} velocity; see {@link TargetSprings2D}. */
    public double[] velocityAt(long index) {
        int checked = checkedIndex(index);
        int offset = checked * 6;
        return new double[] {current[offset + 2], current[offset + 3]};
    }

    /** Writes a position after index and destination validation; see {@link TargetSprings2D}. */
    public void positionInto(Object index, double[] output, int offset) {
        positionInto(accessIndex(index), output, offset);
    }

    /** Writes a position after index and destination validation; see {@link TargetSprings2D}. */
    public void positionInto(long index, double[] output, int offset) {
        int checked = checkedIndex(index);
        checkOutput(output, offset);
        int source = checked * 6;
        output[offset] = current[source];
        output[offset + 1] = current[source + 1];
    }

    /** Writes a velocity after index and destination validation; see {@link TargetSprings2D}. */
    public void velocityInto(Object index, double[] output, int offset) {
        velocityInto(accessIndex(index), output, offset);
    }

    /** Writes a velocity after index and destination validation; see {@link TargetSprings2D}. */
    public void velocityInto(long index, double[] output, int offset) {
        int checked = checkedIndex(index);
        checkOutput(output, offset);
        int source = checked * 6;
        output[offset] = current[source + 2];
        output[offset + 1] = current[source + 3];
    }

    /** Fixed per-body target-force coefficient; see {@link TargetSprings2D}. */
    public double strengthAt(Object index) {
        return strengthAt(accessIndex(index));
    }

    /** Fixed per-body target-force coefficient; see {@link TargetSprings2D}. */
    public double strengthAt(long index) {
        return current[checkedIndex(index) * 6 + 4];
    }

    /** Fixed per-body velocity-retention coefficient; see {@link TargetSprings2D}. */
    public double retentionAt(Object index) {
        return retentionAt(accessIndex(index));
    }

    /** Fixed per-body velocity-retention coefficient; see {@link TargetSprings2D}. */
    public double retentionAt(long index) {
        return current[checkedIndex(index) * 6 + 5];
    }

    /** Materializes detached output-schema state; see {@link TargetSprings2D}. */
    public Map<String, Object> toValues() {
        List<Object> bodies = new ArrayList<Object>(count);
        for (int index = 0, offset = 0; index < count; index++, offset += 6) {
            List<Object> position = new ArrayList<Object>(2);
            position.add(Double.valueOf(current[offset]));
            position.add(Double.valueOf(current[offset + 1]));
            List<Object> velocity = new ArrayList<Object>(2);
            velocity.add(Double.valueOf(current[offset + 2]));
            velocity.add(Double.valueOf(current[offset + 3]));
            Map<String, Object> body = new LinkedHashMap<String, Object>();
            body.put("position", position);
            body.put("velocity", velocity);
            body.put("strength", Double.valueOf(current[offset + 4]));
            body.put("retention", Double.valueOf(current[offset + 5]));
            bodies.add(body);
        }
        Map<String, Object> values = new LinkedHashMap<String, Object>();
        values.put("bodies", bodies);
        return values;
    }

    private void advance() {
        for (int body = 0, stateOffset = 0, targetOffset = 0;
                body < count; body++, stateOffset += 6, targetOffset += 2) {
            advanceAxis(body, stateOffset, targetOffset, "x", 0);
            advanceAxis(body, stateOffset, targetOffset + 1, "y", 1);
        }
        double[] completed = current;
        current = scratch;
        scratch = completed;
    }

    private void advanceAxis(int body, int stateOffset, int targetOffset, String axis, int axisOffset) {
        double delta = capturedTargets[targetOffset] - current[stateOffset + axisOffset];
        arithmetic(delta, body, axis, "delta");
        double force = delta * current[stateOffset + 4];
        arithmetic(force, body, axis, "force");
        double advanced = current[stateOffset + 2 + axisOffset] + force;
        arithmetic(advanced, body, axis, "advanced");
        double position = current[stateOffset + axisOffset] + advanced;
        arithmetic(position, body, axis, "position");
        double velocity = advanced * current[stateOffset + 5];
        arithmetic(velocity, body, axis, "velocity");
        scratch[stateOffset + axisOffset] = zero(position);
        scratch[stateOffset + 2 + axisOffset] = zero(velocity);
    }

    private static void validateBody(Object supplied) {
        Map<?, ?> body = record(supplied, BODY_KEYS, "INVALID_INPUT");
        List<?> position = pair(body.get("position"), "INVALID_INPUT");
        number(position.get(0), "INVALID_INPUT");
        number(position.get(1), "INVALID_INPUT");
        List<?> velocity = pair(body.get("velocity"), "INVALID_INPUT");
        number(velocity.get(0), "INVALID_INPUT");
        number(velocity.get(1), "INVALID_INPUT");
        strength(body.get("strength"));
        retention(body.get("retention"));
    }

    private static void validateTargetPair(Object supplied) {
        List<?> target = pair(supplied, "INVALID_INPUT");
        number(target.get(0), "INVALID_INPUT");
        number(target.get(1), "INVALID_INPUT");
    }

    private static int boundedBodyCount(List<?> bodies) {
        int count = bodies.size();
        if (count > MAX_BODIES) invalidInput();
        return count;
    }

    private static Map<?, ?> record(Object value, String[] keys, String code) {
        if (!(value instanceof Map)) fail(code);
        Map<?, ?> map = (Map<?, ?>) value;
        if (map.size() != keys.length) fail(code);
        for (int index = 0; index < keys.length; index++) if (!map.containsKey(keys[index])) fail(code);
        return map;
    }

    private static List<?> pair(Object value, String code) {
        if (!(value instanceof List) || ((List<?>) value).size() != 2) fail(code);
        return (List<?>) value;
    }

    private static double strength(Object value) {
        double result = number(value, "INVALID_INPUT");
        if (result < 0.0) invalidInput();
        return result;
    }

    private static double retention(Object value) {
        double result = number(value, "INVALID_INPUT");
        if (result < 0.0 || result > 1.0) invalidInput();
        return result;
    }

    private static double number(Object value, String code) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double)) fail(code);
        double result = ((Number) value).doubleValue();
        if (!finite(result)) fail(code);
        return zero(result);
    }

    private static long accessIndex(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double)) invalidIndex();
        double index = ((Number) value).doubleValue();
        if (!finite(index) || index < 0.0 || index > MAX_SAFE_INTEGER || index != Math.floor(index)) invalidIndex();
        return (long) index;
    }

    private int checkedIndex(long index) {
        if (index < 0L || index > MAX_SAFE_INTEGER) invalidIndex();
        if (index >= count) throw new SpringException("INDEX_OUT_OF_RANGE");
        return (int) index;
    }

    private static void checkOutput(double[] output, int offset) {
        if (output == null || offset < 0 || offset > output.length - 2)
            throw new SpringException("INVALID_OUTPUT");
    }

    private static void arithmetic(double value, int bodyIndex, String axis, String stage) {
        if (!finite(value)) throw new SpringArithmeticException(bodyIndex, axis, stage);
    }

    private static boolean finite(double value) {
        return !Double.isNaN(value) && !Double.isInfinite(value);
    }

    private static double zero(double value) {
        return value == 0.0 ? 0.0 : value;
    }

    private static void invalidInput() {
        throw new SpringException("INVALID_INPUT");
    }

    private static void invalidIndex() {
        throw new SpringException("INVALID_INDEX");
    }

    private static void fail(String code) {
        throw new SpringException(code);
    }
}
