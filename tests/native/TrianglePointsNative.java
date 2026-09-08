package org.procedurals.sampling;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Native Java ownership, access-order, and bounded-work checks for CP5 triangle points. */
public final class TrianglePointsNative {
    private static int assertions;
    private static volatile long sink;

    private TrianglePointsNative() { }
    private interface Action { void run(); }
    private static final class OddNumber extends Number {
        public int intValue() { return 1; } public long longValue() { return 1L; }
        public float floatValue() { return 1.0f; } public double doubleValue() { return 1.0; }
    }

    private static void check(boolean condition, String detail) {
        assertions++;
        if (!condition) throw new AssertionError(detail);
    }
    private static boolean raw(double left, double right) {
        return Double.doubleToRawLongBits(left) == Double.doubleToRawLongBits(right);
    }
    private static List<Object> pair(Object x, Object y) {
        return new ArrayList<Object>(Arrays.asList(x, y));
    }
    private static List<Object> ordinaryTriangle() {
        return new ArrayList<Object>(Arrays.asList(
                pair(Double.valueOf(0.0), Double.valueOf(0.0)),
                pair(Double.valueOf(16.0), Double.valueOf(0.0)),
                pair(Double.valueOf(0.0), Double.valueOf(8.0))));
    }
    private static Map<String,Object> seeded(Object count) {
        Map<String,Object> value = new LinkedHashMap<String,Object>();
        value.put("seed", Long.valueOf(42));
        value.put("count", count);
        value.put("triangle", ordinaryTriangle());
        return value;
    }
    private static Map<String,Object> mapped(List<Object> units) {
        Map<String,Object> value = new LinkedHashMap<String,Object>();
        value.put("triangle", ordinaryTriangle());
        value.put("unitCoordinates", units);
        return value;
    }
    private static void expect(String code, Action action) {
        try {
            action.run();
            throw new AssertionError("expected " + code);
        } catch (TrianglePoints2D.TrianglePointsException error) {
            check(code.equals(error.code), "wrong code " + error.code);
        }
    }

    private static void ownershipAndAccess() {
        List<Object> units = new ArrayList<Object>(Arrays.asList(
                pair(Double.valueOf(0.25), Double.valueOf(0.5)),
                pair(Double.valueOf(0.75), Double.valueOf(0.25))));
        Map<String,Object> mappedInput = mapped(units);
        TrianglePoints2D mappedResult = TrianglePoints2D.map(mappedInput);
        double[] mappedFirst = mappedResult.pointAt(0L);
        @SuppressWarnings("unchecked") List<Object> triangle = (List<Object>) mappedInput.get("triangle");
        @SuppressWarnings("unchecked") List<Object> firstVertex = (List<Object>) triangle.get(0);
        firstVertex.set(0, Double.valueOf(99.0));
        triangle.set(1, pair(Double.valueOf(99.0), Double.valueOf(99.0)));
        @SuppressWarnings("unchecked") List<Object> firstUnit = (List<Object>) units.get(0);
        firstUnit.set(0, Double.valueOf(1.0));
        units.set(1, pair(Double.valueOf(1.0), Double.valueOf(1.0)));
        check(raw(mappedResult.pointAt(0L)[0], mappedFirst[0]) && raw(mappedResult.pointAt(0L)[1], mappedFirst[1]), "mapped input detachment");

        Map<String,Object> seededInput = seeded(Integer.valueOf(2));
        TrianglePoints2D seededResult = TrianglePoints2D.seeded(seededInput);
        double[] seededFirst = seededResult.pointAt(0L);
        @SuppressWarnings("unchecked") List<Object> seededTriangle = (List<Object>) seededInput.get("triangle");
        ((List<Object>) seededTriangle.get(0)).set(0, Double.valueOf(77.0));
        seededTriangle.set(2, pair(Double.valueOf(77.0), Double.valueOf(77.0)));
        seededInput.put("seed", Long.valueOf(9));
        seededInput.put("count", Integer.valueOf(1));
        check(raw(seededResult.pointAt(0L)[0], seededFirst[0]) && raw(seededResult.pointAt(0L)[1], seededFirst[1]), "seeded input detachment");

        double[] point = mappedResult.pointAt(0L);
        point[0] = 123.0;
        check(raw(mappedResult.pointAt(0L)[0], mappedFirst[0]), "pointAt detachment");
        Map<String,Object> values = mappedResult.toValues();
        @SuppressWarnings("unchecked") List<Object> points = (List<Object>) values.get("points");
        @SuppressWarnings("unchecked") List<Object> exportedFirst = (List<Object>) points.get(0);
        exportedFirst.set(0, Double.valueOf(88.0));
        points.remove(1);
        values.clear();
        check(raw(mappedResult.pointAt(0L)[0], mappedFirst[0]) && mappedResult.size() == 2, "toValues detachment");

        double[] output = {9.0, 9.0, 9.0, 9.0};
        mappedResult.pointInto(Long.valueOf(1), output, 1);
        double[] second = mappedResult.pointAt(1L);
        check(raw(output[0], 9.0) && raw(output[1], second[0]) && raw(output[2], second[1]) && raw(output[3], 9.0), "pointInto slots");
        double[] unchanged = output.clone();
        expect("INVALID_INDEX", new Action() { public void run() { mappedResult.pointInto(Double.valueOf(Double.NaN), null, -1); }});
        expect("INVALID_INDEX", new Action() { public void run() { mappedResult.pointInto(Double.valueOf(Double.NaN), output, -1); }});
        check(Arrays.equals(output, unchanged), "invalid index must not write");
        expect("INDEX_OUT_OF_RANGE", new Action() { public void run() { mappedResult.pointInto(Long.valueOf(mappedResult.size()), null, -1); }});
        expect("INDEX_OUT_OF_RANGE", new Action() { public void run() { mappedResult.pointInto(Long.valueOf(mappedResult.size()), output, -1); }});
        check(Arrays.equals(output, unchanged), "out-of-range must not write");
        expect("INVALID_OUTPUT", new Action() { public void run() { mappedResult.pointInto(Long.valueOf(0), null, 0); }});
        expect("INVALID_OUTPUT", new Action() { public void run() { mappedResult.pointInto(Long.valueOf(0), output, -1); }});
        expect("INVALID_OUTPUT", new Action() { public void run() { mappedResult.pointInto(Long.valueOf(0), output, 3); }});
        expect("INVALID_OUTPUT", new Action() { public void run() { mappedResult.pointInto(Long.valueOf(0), output, Integer.MAX_VALUE); }});
        check(Arrays.equals(output, unchanged), "invalid destination must not write");

        check(raw(mappedResult.pointAt(Float.valueOf(1.0f))[0], second[0]), "integral float index");
        expect("INVALID_INDEX", new Action() { public void run() { mappedResult.pointAt(new BigInteger("1")); }});
        expect("INVALID_INDEX", new Action() { public void run() { mappedResult.pointAt(new BigDecimal("1")); }});
        expect("INVALID_INDEX", new Action() { public void run() { mappedResult.pointAt(new OddNumber()); }});
        expect("INVALID_INDEX", new Action() { public void run() { mappedResult.pointAt(Boolean.TRUE); }});
        expect("INVALID_INDEX", new Action() { public void run() { mappedResult.pointAt(Double.valueOf(0.5)); }});
        expect("INVALID_INDEX", new Action() { public void run() { mappedResult.pointAt(Double.valueOf(-1.0)); }});
        expect("INVALID_INDEX", new Action() { public void run() { mappedResult.pointAt(Double.valueOf(9007199254740992.0)); }});
        expect("INDEX_OUT_OF_RANGE", new Action() { public void run() { mappedResult.pointAt(Long.valueOf(mappedResult.size())); }});

        for (Object carrier : new Object[] {Byte.valueOf((byte) 2), Short.valueOf((short) 2), Integer.valueOf(2), Long.valueOf(2), Float.valueOf(2.0f), Double.valueOf(2.0)}) {
            Map<String,Object> valid = seeded(carrier);
            valid.put("seed", carrier);
            TrianglePoints2D.seeded(valid);
        }
        Map<String,Object> bigSeed = seeded(Integer.valueOf(1)); bigSeed.put("seed", new BigInteger("1"));
        expect("INVALID_INPUT", new Action() { public void run() { TrianglePoints2D.seeded(bigSeed); }});
        Map<String,Object> decimalCount = seeded(new BigDecimal("1"));
        expect("INVALID_INPUT", new Action() { public void run() { TrianglePoints2D.seeded(decimalCount); }});
        Map<String,Object> customCoordinate = seeded(Integer.valueOf(1));
        ((List<Object>) ((List<Object>) customCoordinate.get("triangle")).get(0)).set(0, new OddNumber());
        expect("INVALID_INPUT", new Action() { public void run() { TrianglePoints2D.seeded(customCoordinate); }});
        Map<String,Object> nan = seeded(Integer.valueOf(1)); nan.put("seed", Double.valueOf(Double.NaN));
        expect("INVALID_INPUT", new Action() { public void run() { TrianglePoints2D.seeded(nan); }});
        Map<String,Object> infinity = seeded(Integer.valueOf(1));
        ((List<Object>) ((List<Object>) infinity.get("triangle")).get(1)).set(1, Double.valueOf(Double.POSITIVE_INFINITY));
        expect("INVALID_INPUT", new Action() { public void run() { TrianglePoints2D.seeded(infinity); }});
        Map<String,Object> mapNan = mapped(new ArrayList<Object>(Arrays.asList(pair(Double.valueOf(Double.NaN), Double.valueOf(0.0)))));
        expect("INVALID_INPUT", new Action() { public void run() { TrianglePoints2D.map(mapNan); }});
        Map<String,Object> mapInfinity = mapped(new ArrayList<Object>(Arrays.asList(pair(Double.valueOf(0.0), Double.valueOf(Double.NEGATIVE_INFINITY)))));
        expect("INVALID_INPUT", new Action() { public void run() { TrianglePoints2D.map(mapInfinity); }});

        TrianglePoints2D emptySeeded = TrianglePoints2D.seeded(seeded(Integer.valueOf(0)));
        TrianglePoints2D emptyMapped = TrianglePoints2D.map(mapped(new ArrayList<Object>()));
        check(emptySeeded.size() == 0 && emptyMapped.size() == 0, "empty valid results");
        Map<String,Object> invalidEmptySeeded = seeded(Integer.valueOf(0));
        ((List<Object>) ((List<Object>) invalidEmptySeeded.get("triangle")).get(0)).set(0, Boolean.TRUE);
        expect("INVALID_INPUT", new Action() { public void run() { TrianglePoints2D.seeded(invalidEmptySeeded); }});
        Map<String,Object> invalidEmptyMapped = mapped(new ArrayList<Object>());
        ((List<Object>) ((List<Object>) invalidEmptyMapped.get("triangle")).get(0)).set(0, Boolean.TRUE);
        expect("INVALID_INPUT", new Action() { public void run() { TrianglePoints2D.map(invalidEmptyMapped); }});
        expect("INVALID_INPUT", new Action() { public void run() { TrianglePoints2D.seeded(seeded(Long.valueOf(1073741824L))); }});
    }

    private static long checksum(TrianglePoints2D result) {
        long value = 0xcbf29ce484222325L;
        double[] point = new double[2];
        value = (value ^ result.size()) * 0x100000001b3L;
        for (int i = 0; i < result.size(); i++) {
            result.pointInto((long) i, point, 0);
            value = (value ^ Double.doubleToRawLongBits(point[0])) * 0x100000001b3L;
            value = (value ^ Double.doubleToRawLongBits(point[1])) * 0x100000001b3L;
        }
        return value;
    }

    private static String seededWorkload(int count, int warmups, int repetitions) {
        Map<String,Object> input = seeded(Integer.valueOf(count));
        for (int i = 0; i < warmups; i++) sink ^= TrianglePoints2D.seeded(input).size();
        long[] elapsed = new long[repetitions];
        long checksum = 0xcbf29ce484222325L;
        int retained = 0;
        for (int i = 0; i < repetitions; i++) {
            long start = System.nanoTime();
            TrianglePoints2D result = TrianglePoints2D.seeded(input);
            elapsed[i] = System.nanoTime() - start;
            retained = result.size();
            checksum = (checksum ^ checksum(result)) * 0x100000001b3L; // outside timed kernel
        }
        sink ^= checksum;
        StringBuilder samples = new StringBuilder("[");
        long total = 0L;
        for (int i = 0; i < elapsed.length; i++) { if (i > 0) samples.append(','); samples.append(elapsed[i]); total += elapsed[i]; }
        samples.append(']');
        return "{\"kind\":\"seeded\",\"count\":" + count + ",\"warmup_reps\":" + warmups + ",\"timing_reps\":" + repetitions
                + ",\"timing_scope\":\"seeded_retained_kernel_only\",\"elapsed_nanos\":" + samples
                + ",\"average_nanos\":" + (total / repetitions) + ",\"retained_count_last_rep\":" + retained
                + ",\"retained_raw_payload_bytes_last_rep\":" + (16L * retained)
                + ",\"retained_payload_scope\":\"final packed 2*N binary64 scalar slots; excludes array header and temporary work\""
                + ",\"post_timing_checksum\":\"" + Long.toUnsignedString(checksum, 16) + "\"}";
    }

    private static Map<String,Object> mappingInput(int count) {
        List<Object> units = new ArrayList<Object>(count);
        for (int index = 0; index < count; index++) {
            double u = ((double) index) / ((double) count);
            double v = ((double) ((index * 17) % count)) / ((double) count);
            units.add(pair(Double.valueOf(u), Double.valueOf(v)));
        }
        return mapped(units);
    }

    private static String mappedWorkload(int count, int warmups, int repetitions) {
        for (int i = 0; i < warmups; i++) sink ^= TrianglePoints2D.map(mappingInput(count)).size();
        long[] construction = new long[repetitions];
        long[] mapping = new long[repetitions];
        long checksum = 0xcbf29ce484222325L;
        int retained = 0;
        for (int i = 0; i < repetitions; i++) {
            long start = System.nanoTime();
            Map<String,Object> input = mappingInput(count);
            construction[i] = System.nanoTime() - start;
            start = System.nanoTime();
            TrianglePoints2D result = TrianglePoints2D.map(input);
            mapping[i] = System.nanoTime() - start;
            retained = result.size();
            checksum = (checksum ^ checksum(result)) * 0x100000001b3L; // outside both timed scopes
        }
        sink ^= checksum;
        StringBuilder constructionSamples = new StringBuilder("[");
        StringBuilder mappingSamples = new StringBuilder("[");
        long constructionTotal = 0L;
        long mappingTotal = 0L;
        for (int i = 0; i < repetitions; i++) {
            if (i > 0) { constructionSamples.append(','); mappingSamples.append(','); }
            constructionSamples.append(construction[i]); mappingSamples.append(mapping[i]);
            constructionTotal += construction[i]; mappingTotal += mapping[i];
        }
        constructionSamples.append(']'); mappingSamples.append(']');
        return "{\"kind\":\"explicit-map\",\"count\":" + count + ",\"warmup_reps\":" + warmups + ",\"timing_reps\":" + repetitions
                + ",\"input_construction_elapsed_nanos\":" + constructionSamples + ",\"input_construction_average_nanos\":" + (constructionTotal / repetitions)
                + ",\"map_elapsed_nanos\":" + mappingSamples + ",\"map_average_nanos\":" + (mappingTotal / repetitions)
                + ",\"map_timing_scope\":\"TrianglePoints2D.map validation plus retained-output construction; excludes caller passive input construction\""
                + ",\"input_construction_scope\":\"caller builds one map, triangle lists, one unit-coordinate list, and N unit pair lists before map timing\""
                + ",\"unit_coordinate_pair_lists\":" + count + ",\"unit_coordinate_boxed_binary64_coordinates\":" + (2L * count)
                + ",\"input_object_count_note\":\"carrier counts only, not a heap-byte measurement; triangle/map carrier objects and their six vertex coordinates are additional fixed input objects\""
                + ",\"retained_count_last_rep\":" + retained + ",\"retained_raw_payload_bytes_last_rep\":" + (16L * retained)
                + ",\"retained_payload_scope\":\"final packed 2*N binary64 scalar slots; excludes array header and temporary work\""
                + ",\"post_timing_checksum\":\"" + Long.toUnsignedString(checksum, 16) + "\"}";
    }

    public static void main(String[] args) {
        try {
            if (args.length != 0) throw new IllegalArgumentException("usage");
            ownershipAndAccess();
            String performance = "[" + seededWorkload(0, 2, 3) + "," + seededWorkload(1, 2, 3) + ","
                    + seededWorkload(15680, 2, 3) + "," + seededWorkload(40960, 2, 3) + ","
                    + seededWorkload(100000, 1, 2) + "," + mappedWorkload(15680, 2, 3) + ","
                    + mappedWorkload(40960, 2, 3) + "]";
            System.out.println("{\"status\":\"passed\",\"assertions\":" + assertions
                    + ",\"native_ownership_access\":true,\"resource_failure_mechanism\":\"not executed; no allocation-failure claim is made\",\"performance\":" + performance + "}");
        } catch (Throwable error) {
            System.out.println("{\"status\":\"failed\",\"assertions\":" + assertions + ",\"error\":\"" + escape(error.toString()) + "\"}");
            error.printStackTrace(System.err);
            System.exit(1);
        }
    }
    private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n"); }
}
