package org.procedurals.layout;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Native Java ownership, access-order, and bounded-work checks for CP4 partition leaves. */
public final class QuadrantPartitionNative {
    private static int assertions;
    private static volatile long sink;
    private QuadrantPartitionNative() { }
    private interface Action { void run(); }
    private static final class OddNumber extends Number {
        public int intValue() { return 1; } public long longValue() { return 1L; }
        public float floatValue() { return 1.0f; } public double doubleValue() { return 1.0; }
    }

    private static void check(boolean condition, String detail) {
        assertions++;
        if (!condition) throw new AssertionError(detail);
    }
    private static boolean raw(double a, double b) {
        return Double.doubleToRawLongBits(a) == Double.doubleToRawLongBits(b);
    }
    private static List<Object> pair(Object x, Object y) {
        return new ArrayList<Object>(Arrays.asList(x, y));
    }
    private static Map<String, Object> config(Object replacements) {
        Map<String, Object> value = new LinkedHashMap<String, Object>();
        value.put("seed", Long.valueOf(42));
        value.put("replacements", replacements);
        value.put("origin", pair(Double.valueOf(0.0), Double.valueOf(0.0)));
        value.put("extent", pair(Double.valueOf(640.0), Double.valueOf(480.0)));
        value.put("selectionFraction", Double.valueOf(0.5));
        return value;
    }
    private static void expect(String code, Action action) {
        try {
            action.run();
            throw new AssertionError("expected " + code);
        } catch (QuadrantPartition2D.PartitionException error) {
            check(code.equals(error.code), "wrong code " + error.code);
        }
    }

    private static void ownershipAndAccess() {
        Map<String, Object> input = config(Integer.valueOf(4));
        QuadrantPartition2D result = QuadrantPartition2D.generate(input);
        check(result.size() == 13 && result.replacements() == 4, "size/replacements");
        double[] retainedZero = result.boundsAt(0L);
        int retainedZeroId = result.idAt(0L);
        @SuppressWarnings("unchecked") List<Object> origin = (List<Object>) input.get("origin");
        @SuppressWarnings("unchecked") List<Object> extent = (List<Object>) input.get("extent");
        origin.set(0, Double.valueOf(777.0)); extent.set(0, Double.valueOf(777.0));
        input.put("seed", Long.valueOf(9)); input.put("selectionFraction", Double.valueOf(1.0));
        check(Arrays.equals(result.boundsAt(0L), retainedZero), "input detachment");
        double[] first = result.boundsAt(0L);
        first[0] = 99.0;
        check(Arrays.equals(result.boundsAt(0L), retainedZero), "boundsAt detachment");
        Map<String, Object> values = result.toValues();
        @SuppressWarnings("unchecked") List<Object> bounds = (List<Object>) values.get("bounds");
        @SuppressWarnings("unchecked") List<Object> ids = (List<Object>) values.get("ids");
        @SuppressWarnings("unchecked") List<Object> firstRow = (List<Object>) bounds.get(0);
        firstRow.set(0, Double.valueOf(88.0)); bounds.remove(1); ids.set(0, Integer.valueOf(88)); values.clear();
        check(Arrays.equals(result.boundsAt(0L), retainedZero) && result.idAt(0L) == retainedZeroId, "toValues detachment");
        double[] output = {9.0, 9.0, 9.0, 9.0, 9.0, 9.0};
        result.boundsInto(Long.valueOf(0), output, 1);
        check(raw(output[0], 9.0) && raw(output[1], retainedZero[0]) && raw(output[2], retainedZero[1])
                && raw(output[3], retainedZero[2]) && raw(output[4], retainedZero[3]) && raw(output[5], 9.0), "boundsInto slots");
        double[] unchanged = output.clone();
        expect("INVALID_INDEX", new Action() { public void run() { result.boundsInto(Double.valueOf(Double.NaN), output, -1); }});
        check(Arrays.equals(output, unchanged), "invalid index must not write");
        expect("INDEX_OUT_OF_RANGE", new Action() { public void run() { result.boundsInto(Long.valueOf(result.size()), null, -1); }});
        check(Arrays.equals(output, unchanged), "out of range must not write");
        expect("INVALID_OUTPUT", new Action() { public void run() { result.boundsInto(Long.valueOf(0), null, 0); }});
        expect("INVALID_OUTPUT", new Action() { public void run() { result.boundsInto(Long.valueOf(0), output, 3); }});
        expect("INVALID_OUTPUT", new Action() { public void run() { result.boundsInto(Long.valueOf(0), output, -1); }});
        check(Arrays.equals(output, unchanged), "invalid destination must not write");
        check(result.idAt(Float.valueOf(0.0f)) == retainedZeroId, "integral float index accepted");
        expect("INVALID_INDEX", new Action() { public void run() { result.boundsAt(new BigInteger("1")); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.idAt(new BigDecimal("1")); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.boundsAt(new OddNumber()); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.boundsAt(Boolean.TRUE); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.boundsAt(Double.valueOf(0.5)); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.boundsAt(Long.valueOf(9007199254740992L)); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.boundsAt(Double.valueOf(-1.0)); }});
        expect("INDEX_OUT_OF_RANGE", new Action() { public void run() { result.idAt(Long.valueOf(result.size())); }});
        for (Object carrier : new Object[] {Byte.valueOf((byte) 2), Short.valueOf((short) 2), Integer.valueOf(2), Long.valueOf(2), Float.valueOf(2.0f), Double.valueOf(2.0)}) {
            Map<String, Object> valid = config(carrier);
            valid.put("seed", carrier);
            valid.put("origin", pair(carrier, carrier));
            valid.put("extent", pair(carrier, carrier));
            valid.put("selectionFraction", Double.valueOf(1.0));
            QuadrantPartition2D.generate(valid);
        }
        Map<String, Object> bad = config(Integer.valueOf(1)); bad.put("seed", new BigInteger("1"));
        expect("INVALID_INPUT", new Action() { public void run() { QuadrantPartition2D.generate(bad); }});
        Map<String, Object> badPair = config(Integer.valueOf(1)); badPair.put("origin", new double[] {0.0, 0.0});
        expect("INVALID_INPUT", new Action() { public void run() { QuadrantPartition2D.generate(badPair); }});
        Map<String, Object> nan = config(Integer.valueOf(1)); nan.put("selectionFraction", Double.valueOf(Double.NaN));
        expect("INVALID_INPUT", new Action() { public void run() { QuadrantPartition2D.generate(nan); }});
        Map<String, Object> infinity = config(Integer.valueOf(1)); infinity.put("extent", pair(Double.POSITIVE_INFINITY, Double.valueOf(1.0)));
        expect("INVALID_INPUT", new Action() { public void run() { QuadrantPartition2D.generate(infinity); }});
        try {
            QuadrantPartition2D.class.getMethod("serialize");
            throw new AssertionError("serialize must not be public");
        } catch (NoSuchMethodException expected) { assertions++; }
    }

    private static long checksum(QuadrantPartition2D result) {
        long value = 0xcbf29ce484222325L;
        value = (value ^ result.replacements()) * 0x100000001b3L;
        value = (value ^ result.size()) * 0x100000001b3L;
        for (int i = 0; i < result.size(); i++) {
            double[] bound = result.boundsAt((long) i);
            for (int j = 0; j < 4; j++) value = (value ^ Double.doubleToRawLongBits(bound[j])) * 0x100000001b3L;
            value = (value ^ result.idAt((long) i)) * 0x100000001b3L;
        }
        return value;
    }

    private static String workload(int replacements, int warmups, int repetitions) {
        Map<String, Object> input = config(Integer.valueOf(replacements));
        for (int i = 0; i < warmups; i++) sink ^= QuadrantPartition2D.generate(input).size();
        long[] elapsed = new long[repetitions];
        long checksum = 0xcbf29ce484222325L;
        int retained = 0;
        for (int i = 0; i < repetitions; i++) {
            long start = System.nanoTime();
            QuadrantPartition2D result = QuadrantPartition2D.generate(input);
            elapsed[i] = System.nanoTime() - start;
            retained = result.size();
            checksum = (checksum ^ checksum(result)) * 0x100000001b3L; // deliberately outside the timed kernel
        }
        sink ^= checksum;
        StringBuilder samples = new StringBuilder("[");
        long total = 0L;
        for (int i = 0; i < elapsed.length; i++) { if (i > 0) samples.append(','); samples.append(elapsed[i]); total += elapsed[i]; }
        samples.append(']');
        return "{\"replacements\":" + replacements + ",\"warmup_reps\":" + warmups
                + ",\"timing_reps\":" + repetitions + ",\"timing_scope\":\"partition_kernel_only\",\"elapsed_nanos\":" + samples
                + ",\"average_nanos\":" + (total / repetitions) + ",\"retained_leaf_count_last_rep\":" + retained
                + ",\"retained_raw_payload_bytes_last_rep\":" + (36L * retained)
                + ",\"retained_payload_scope\":\"four binary64 endpoint arrays and one int identity array; excludes headers/spare capacity/transient growth\""
                + ",\"post_timing_checksum\":\"" + Long.toUnsignedString(checksum, 16) + "\"}";
    }

    public static void main(String[] args) {
        try {
            if (args.length != 0) throw new IllegalArgumentException("usage");
            ownershipAndAccess();
            String performance = "[" + workload(0, 3, 5) + "," + workload(1, 3, 5) + ","
                    + workload(100, 3, 5) + "," + workload(200, 3, 5) + ","
                    + workload(2000, 2, 4) + "," + workload(20000, 1, 3) + "]";
            System.out.println("{\"status\":\"passed\",\"assertions\":" + assertions
                    + ",\"native_ownership_access\":true,\"resource_failure_mechanism\":\"not executed; source inspection confirms host allocation failure is not converted to validation or partial success\",\"performance\":" + performance + "}");
        } catch (Throwable error) {
            System.out.println("{\"status\":\"failed\",\"assertions\":" + assertions + ",\"error\":\"" + escape(error.toString()) + "\"}");
            error.printStackTrace(System.err);
            System.exit(1);
        }
    }
    private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n"); }
}
