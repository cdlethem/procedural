package org.procedurals.raster;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Focused carrier, ownership, validation, and checked-access tests for RasterCrossfade2D. */
public final class RasterCrossfadeNative {
    private static int assertions;
    private interface Action { void run(); }
    private static void check(boolean value, String message) { assertions++; if (!value) throw new AssertionError(message); }
    private static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
        return result;
    }
    private static Map<String, Object> raster(Object width, Object height, List<Object> pixels) {
        return map("width", width, "height", height, "pixels", pixels);
    }
    private static Map<String, Object> input(Object first, Object second, Object weights) {
        return map("first", first, "second", second, "weights", weights);
    }
    private static void invalid(Action action) {
        try { action.run(); throw new AssertionError("missing invalid"); }
        catch (RasterCrossfade2D.RasterCrossfadeException error) { check("INVALID_INPUT".equals(error.code), "invalid code"); }
    }
    private static void access(Action action, String code) {
        try { action.run(); throw new AssertionError("missing access"); }
        catch (RasterCrossfade2D.RasterCrossfadeException error) { check(code.equals(error.code), "access code"); }
    }

    private static void objectOwnership() {
        List<Object> firstPixels = list(0xffff0000L, 0x00001122L);
        List<Object> secondPixels = list(0xff0000ffL, 0x00334455L);
        List<Object> weights = list(0.5d, 1.0d);
        Map<String, Object> config = input(raster(2, 1, firstPixels), raster(2, 1, secondPixels), weights);
        RasterCrossfade2D result = RasterCrossfade2D.mix(config);
        Map<String, Object> values = result.toValues();
        firstPixels.set(0, 0L); secondPixels.set(0, 0L); weights.set(0, 0.0d); config.clear();
        check(result.toValues().equals(values), "object input detached");
        @SuppressWarnings("unchecked") List<Object> exported = (List<Object>) values.get("pixels");
        exported.set(0, 0L);
        check(!result.toValues().equals(values), "toValues deep detached");
        int[] pixels = result.pixels(); pixels[0] = 0;
        check(result.pixelAt(0L) != 0, "pixels detached");
    }

    private static void typedOwnershipAndParity() {
        int[] first = {0xffff0000, 0x00001122};
        int[] second = {0xff0000ff, 0x00334455};
        double[] weights = {0.5d, 1.0d};
        RasterCrossfade2D typed = RasterCrossfade2D.mix(2, 1, first, second, weights);
        RasterCrossfade2D object = RasterCrossfade2D.mix(input(
            raster(2, 1, list(0xffff0000L, 0x00001122L)),
            raster(2, 1, list(0xff0000ffL, 0x00334455L)), list(0.5d, 1.0d)));
        check(Arrays.equals(typed.pixels(), object.pixels()), "typed object parity");
        first[0] = 0; second[0] = 0; weights[0] = 0;
        check(typed.pixelAt(0L) == 0xff800080, "typed input detached");
    }

    private static void identityBranches() {
        RasterCrossfade2D zeroWeight = RasterCrossfade2D.mix(1, 1, new int[]{0x00123456}, new int[]{0xffffffff}, new double[]{-0.0d});
        RasterCrossfade2D oneWeight = RasterCrossfade2D.mix(1, 1, new int[]{0xffffffff}, new int[]{0x80445566}, new double[]{1.0d});
        check(zeroWeight.pixelAt(0L) == 0x00123456, "zero weight preserves first hidden RGB");
        check(oneWeight.pixelAt(0L) == 0x80445566, "one weight preserves second hidden RGB");
    }

    private static void indexes() {
        RasterCrossfade2D result = RasterCrossfade2D.mix(1, 1, new int[]{0}, new int[]{0}, new double[]{0});
        check(result.pixelAt(-0.0d) == 0, "negative zero index");
        access(new Action() { public void run() { result.pixelAt(Boolean.TRUE); } }, "INVALID_INDEX");
        access(new Action() { public void run() { result.pixelAt(-1L); } }, "INVALID_INDEX");
        access(new Action() { public void run() { result.pixelAt(9007199254740991L); } }, "INDEX_OUT_OF_RANGE");
        access(new Action() { public void run() { result.pixelAt(9007199254740992d); } }, "INVALID_INDEX");
        access(new Action() { public void run() { result.pixelAt(Long.MAX_VALUE); } }, "INVALID_INDEX");
    }

    private static void invalidInputs() {
        final Map<String, Object> valid = input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(0d));
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(null); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(map("first", valid.get("first"), "second", valid.get("second"), "weights", valid.get("weights"), "extra", 1)); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(input(raster(0, 1, list()), valid.get("second"), list())); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(input(raster(2147483647, 2, list()), valid.get("second"), list())); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(input(raster(1, 1, list(0L)), raster(2, 1, list(0L, 0L)), list(0d))); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(Double.NaN))); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(Double.NEGATIVE_INFINITY))); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(-0.1d))); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(1.1d))); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(input(raster(1, 1, list(new BigInteger("0"))), raster(1, 1, list(0L)), list(0d))); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(new BigDecimal("0")))); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(0, 1, new int[0], new int[0], new double[0]); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(2147483647, 2, new int[0], new int[0], new double[0]); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(1, 1, null, new int[1], new double[1]); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(1, 1, new int[1], null, new double[1]); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(1, 1, new int[1], new int[1], null); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(1, 1, new int[0], new int[1], new double[1]); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(1, 1, new int[1], new int[0], new double[1]); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(1, 1, new int[1], new int[1], new double[0]); } });
        invalid(new Action() { public void run() { RasterCrossfade2D.mix(1, 1, new int[1], new int[1], new double[]{Double.POSITIVE_INFINITY}); } });
    }

    public static void main(String[] args) {
        objectOwnership(); typedOwnershipAndParity(); identityBranches(); indexes(); invalidInputs();
        StringBuilder measurements = new StringBuilder();
        int[][] sizes = {{8, 8}, {720, 480}, {1024, 1024}};
        for (int[] size : sizes) {
            int count = size[0] * size[1];
            int[] first = new int[count], second = new int[count];
            double[] weights = new double[count];
            Arrays.fill(first, 0xffff0000); Arrays.fill(second, 0xff0000ff);
            Arrays.fill(weights, 0.5);
            for (int warmup = 0; warmup < 3; warmup++)
                RasterCrossfade2D.mix(size[0], size[1], first, second, weights);
            long start = System.nanoTime();
            long checksum = 0;
            for (int repeat = 0; repeat < 3; repeat++) {
                int[] output = RasterCrossfade2D.mix(size[0], size[1], first, second, weights).pixels();
                for (int pixel : output) checksum += Integer.toUnsignedLong(pixel);
            }
            long elapsed = System.nanoTime() - start;
            check(checksum == 3L * count * Integer.toUnsignedLong(0xff800080), "image-sized checksum");
            if (measurements.length() > 0) measurements.append(',');
            measurements.append("{\"width\":").append(size[0]).append(",\"height\":").append(size[1])
                .append(",\"warmup\":3,\"repetitions\":3,\"elapsed_ns\":").append(elapsed)
                .append(",\"checksum\":").append(checksum)
                .append(",\"input_output_export_buffer_bytes\":").append(24L * count).append('}');
        }
        System.out.println("{\"status\":\"passed\",\"assertions\":" + assertions
                + ",\"measurements\":[" + measurements + "]}");
    }
}
