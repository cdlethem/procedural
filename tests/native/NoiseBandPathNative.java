package org.procedurals.paths;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Focused ownership/error checks and real attempted-work measurements, not rendering. */
public final class NoiseBandPathNative {
    private static int checks;
    private static void check(boolean value, String name) {
        checks++;
        if (!value) throw new AssertionError(name);
    }
    private static List<Object> list(Object... values) {
        return new ArrayList<Object>(Arrays.asList(values));
    }
    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
        return result;
    }
    private static Map<String, Object> input() {
        return map("field", map("seed", 177), "start", list(0.0, 0.0), "heading", 0.0,
                "seed", 7, "attempts", 4, "stepDistance", 0.0, "fieldScale", .006,
                "fieldOffset", list(7.3, 11.7), "tolerance", .002, "maxVertices", 5);
    }
    private static void error(String expected, Runnable action) {
        try { action.run(); }
        catch (NoiseBandPath2D.PathException failure) {
            check(expected.equals(failure.code), expected + ": " + failure.code);
            return;
        }
        throw new AssertionError("missing " + expected);
    }
    @SuppressWarnings("unchecked")
    private static void ownershipAndErrors() {
        Map<String, Object> source = input();
        NoiseBandPath2D path = NoiseBandPath2D.trace(source);
        check(path.size() == 5 && path.accepted() == 4 && path.rejected() == 0, "counts");
        ((List<Object>) source.get("start")).set(0, 999.0);
        ((Map<String, Object>) source.get("field")).put("seed", 999);
        check(path.pointAt(0)[0] == 0, "input ownership");
        check(((Number)((Map<?, ?>) path.serialize().get("field")).get("seed")).intValue() == 177,
                "nested input field ownership");
        double[] point = path.pointAt(0);
        point[0] = 999;
        check(path.pointAt(0)[0] == 0, "point detachment");
        Map<String, Object> config = path.serialize();
        ((List<Object>) config.get("start")).set(0, 88.0);
        ((List<Object>) config.get("fieldOffset")).set(0, 88.0);
        ((Map<String, Object>) config.get("field")).put("seed", 88);
        check(((Number)((List<?>) path.serialize().get("fieldOffset")).get(0)).doubleValue() == 7.3,
                "serialized offset detachment");
        check(((Number)((Map<?, ?>) path.serialize().get("field")).get("seed")).intValue() == 177,
                "serialized field detachment");
        Map<String, Object> values = path.toValues();
        ((List<Object>)((List<?>) values.get("positions")).get(0)).set(0, 77.0);
        ((List<Object>) values.get("headings")).set(0, 77.0);
        check(path.pointAt(0)[0] == 0 && path.headingAt(0) != 77, "value export detachment");
        check(NoiseBandPath2D.trace(path.serialize()).toValues().equals(path.toValues()), "round trip");

        for (Object bad : new Object[]{null, true, "0", Double.NaN, Double.POSITIVE_INFINITY,
                new BigInteger("0"), -1, .5, Long.MAX_VALUE}) {
            final Object index = bad;
            error("INVALID_INDEX", () -> path.pointAt(index));
            error("INVALID_INDEX", () -> path.headingAt(index));
            error("INVALID_INDEX", () -> path.pointInto(index, null, -1));
        }
        error("INDEX_OUT_OF_RANGE", () -> path.pointInto(5L, null, -1));
        error("INDEX_OUT_OF_RANGE", () -> path.headingAt(4L));
        double[] output = {8, 9, 10};
        error("INVALID_OUTPUT", () -> path.pointInto(0L, output, 2));
        check(Arrays.equals(output, new double[]{8, 9, 10}), "failed write atomicity");
        error("INVALID_OUTPUT", () -> path.pointInto(0L, output, Integer.MAX_VALUE));
        path.pointInto(0L, output, 1);
        check(Arrays.equals(output, new double[]{8, 0, 0}), "valid offset write");
        Map<String, Object> zero = input();
        zero.put("attempts", 0);
        for (String name : new String[]{"heading", "stepDistance", "fieldScale", "tolerance"}) zero.put(name, -0.0);
        zero.put("start", list(-0.0, -0.0));
        zero.put("fieldOffset", list(-0.0, -0.0));
        Map<String, Object> normalized = NoiseBandPath2D.trace(zero).serialize();
        for (String name : new String[]{"heading", "stepDistance", "fieldScale", "tolerance"})
            check(Double.doubleToRawLongBits(((Number) normalized.get(name)).doubleValue()) == 0, "zero " + name);
        for (String name : new String[]{"start", "fieldOffset"})
            for (Object value : (List<?>) normalized.get(name))
                check(Double.doubleToRawLongBits(((Number) value).doubleValue()) == 0, "pair zero " + name);
        Map<String, Object> tiny = input();
        tiny.put("attempts", 1); tiny.put("maxVertices", 2);
        check(NoiseBandPath2D.trace(tiny).size() == 2, "smallest accepted capacity");
    }
    private static String measure(int paths, int attempts) {
        long started = System.nanoTime(), accepted = 0, rejected = 0, peakPayload = 0;
        long checksum = 0xcbf29ce484222325L;
        double[] last = new double[2];
        for (int i = 0; i < paths; i++) {
            Map<String, Object> config = input();
            config.put("start", list(40.0 + 80.0 * (i % 8), 40.0 + 80.0 * ((i / 8) % 8)));
            config.put("seed", 1000 + i);
            config.put("attempts", attempts);
            config.put("maxVertices", attempts + 1);
            config.put("stepDistance", 1.0);
            NoiseBandPath2D path = NoiseBandPath2D.trace(config);
            accepted += path.accepted(); rejected += path.rejected();
            path.pointInto(path.size() - 1, last, 0);
            checksum = (checksum ^ Double.doubleToRawLongBits(last[0])) * 0x100000001b3L;
            checksum = (checksum ^ Double.doubleToRawLongBits(last[1])) * 0x100000001b3L;
            checksum = (checksum ^ path.accepted()) * 0x100000001b3L;
            peakPayload = Math.max(peakPayload, 16L + 24L * path.accepted());
        }
        long elapsed = System.nanoTime() - started;
        if (accepted + rejected != (long) paths * attempts) throw new AssertionError("work accounting");
        return "{\"paths\":" + paths + ",\"attempts_per_path\":" + attempts
            + ",\"attempts_executed\":" + (accepted + rejected) + ",\"accepted\":" + accepted
            + ",\"rejected\":" + rejected + ",\"generation_nanos\":" + elapsed
            + ",\"max_single_path_numeric_payload_bytes\":" + peakPayload
            + ",\"checksum\":\"" + Long.toUnsignedString(checksum, 16) + "\"}";
    }
    public static void main(String[] args) {
        ownershipAndErrors();
        measure(16, 256); // Explicit warmup; discard results, retain no path collection.
        String tiny = measure(1, 4), prototype = measure(96, 2048), source = measure(1000, 10000);
        System.out.println("{\"status\":\"passed\",\"checks\":" + checks
            + ",\"warmup\":{\"paths\":16,\"attempts_per_path\":256},\"measurements\":["
            + tiny + "," + prototype + "," + source + "]}");
    }
}
