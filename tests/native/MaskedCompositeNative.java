package org.procedurals.raster;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Focused carrier, ownership, validation, and checked-access tests for MaskedComposite2D. */
public final class MaskedCompositeNative {
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
    private static Map<String, Object> input(Object source, Object destination, Object mask) {
        return map("source", source, "destination", destination, "mask", mask);
    }
    private static void invalid(Action action) {
        try { action.run(); throw new AssertionError("missing invalid"); }
        catch (MaskedComposite2D.MaskedCompositeException error) { check("INVALID_INPUT".equals(error.code), "invalid code"); }
    }
    private static void access(Action action, String code) {
        try { action.run(); throw new AssertionError("missing access"); }
        catch (MaskedComposite2D.MaskedCompositeException error) { check(code.equals(error.code), "access code"); }
    }

    private static void objectOwnership() {
        List<Object> sourcePixels = list(0xffff0000L, 0x00001122L);
        List<Object> destinationPixels = list(0xff0000ffL, 0x00334455L);
        List<Object> mask = list(0.5d, 1.0d);
        Map<String, Object> config = input(raster(2, 1, sourcePixels), raster(2, 1, destinationPixels), mask);
        MaskedComposite2D result = MaskedComposite2D.compose(config);
        Map<String, Object> values = result.toValues();
        sourcePixels.set(0, 0L); destinationPixels.set(0, 0L); mask.set(0, 0.0d); config.clear();
        check(result.toValues().equals(values), "object input detached");
        @SuppressWarnings("unchecked") List<Object> exported = (List<Object>) values.get("pixels");
        exported.set(0, 0L);
        check(!result.toValues().equals(values), "toValues deep detached");
        int[] pixels = result.pixels(); pixels[0] = 0;
        check(result.pixelAt(0L) != 0, "pixels detached");
    }

    private static void typedOwnershipAndParity() {
        int[] source = {0xffff0000, 0x00001122};
        int[] destination = {0xff0000ff, 0x00334455};
        double[] mask = {0.5d, 1.0d};
        MaskedComposite2D typed = MaskedComposite2D.compose(2, 1, source, destination, mask);
        MaskedComposite2D object = MaskedComposite2D.compose(input(
            raster(2, 1, list(0xffff0000L, 0x00001122L)),
            raster(2, 1, list(0xff0000ffL, 0x00334455L)), list(0.5d, 1.0d)));
        check(Arrays.equals(typed.pixels(), object.pixels()), "typed object parity");
        source[0] = 0; destination[0] = 0; mask[0] = 0;
        check(typed.pixelAt(0L) == 0xff800080, "typed input detached");
    }

    private static void identityBranches() {
        MaskedComposite2D zeroMask = MaskedComposite2D.compose(1, 1, new int[]{0xffffffff}, new int[]{0x00123456}, new double[]{-0.0d});
        MaskedComposite2D transparentSource = MaskedComposite2D.compose(1, 1, new int[]{0x00ff0000}, new int[]{0x80445566}, new double[]{1.0d});
        check(zeroMask.pixelAt(0L) == 0x00123456, "zero mask preserves hidden RGB");
        check(transparentSource.pixelAt(0L) == 0x80445566, "transparent source preserves destination bits");
    }

    private static void indexes() {
        MaskedComposite2D result = MaskedComposite2D.compose(1, 1, new int[]{0}, new int[]{0}, new double[]{0});
        check(result.pixelAt(-0.0d) == 0, "negative zero index");
        access(new Action() { public void run() { result.pixelAt(Boolean.TRUE); } }, "INVALID_INDEX");
        access(new Action() { public void run() { result.pixelAt(-1L); } }, "INVALID_INDEX");
        access(new Action() { public void run() { result.pixelAt(9007199254740991L); } }, "INDEX_OUT_OF_RANGE");
        access(new Action() { public void run() { result.pixelAt(9007199254740992d); } }, "INVALID_INDEX");
        access(new Action() { public void run() { result.pixelAt(Long.MAX_VALUE); } }, "INVALID_INDEX");
    }

    private static void invalidInputs() {
        final Map<String, Object> valid = input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(0d));
        invalid(new Action() { public void run() { MaskedComposite2D.compose(null); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(map("source", valid.get("source"), "destination", valid.get("destination"), "mask", valid.get("mask"), "extra", 1)); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(input(raster(0, 1, list()), valid.get("destination"), list())); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(input(raster(2147483647, 2, list()), valid.get("destination"), list())); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(input(raster(1, 1, list(0L)), raster(2, 1, list(0L, 0L)), list(0d))); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(Double.NaN))); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(Double.NEGATIVE_INFINITY))); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(-0.1d))); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(1.1d))); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(input(raster(1, 1, list(new BigInteger("0"))), raster(1, 1, list(0L)), list(0d))); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(input(raster(1, 1, list(0L)), raster(1, 1, list(0L)), list(new BigDecimal("0")))); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(0, 1, new int[0], new int[0], new double[0]); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(2147483647, 2, new int[0], new int[0], new double[0]); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(1, 1, null, new int[1], new double[1]); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(1, 1, new int[1], null, new double[1]); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(1, 1, new int[1], new int[1], null); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(1, 1, new int[0], new int[1], new double[1]); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(1, 1, new int[1], new int[0], new double[1]); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(1, 1, new int[1], new int[1], new double[0]); } });
        invalid(new Action() { public void run() { MaskedComposite2D.compose(1, 1, new int[1], new int[1], new double[]{Double.POSITIVE_INFINITY}); } });
    }

    public static void main(String[] args) {
        objectOwnership(); typedOwnershipAndParity(); identityBranches(); indexes(); invalidInputs();
        StringBuilder measurements = new StringBuilder();
        int[][] sizes = {{8, 8}, {720, 480}, {1024, 1024}};
        for (int[] size : sizes) {
            int count = size[0] * size[1];
            int[] source = new int[count], destination = new int[count];
            double[] mask = new double[count];
            Arrays.fill(source, 0xffff0000); Arrays.fill(destination, 0xff0000ff);
            Arrays.fill(mask, 0.5);
            for (int warmup = 0; warmup < 3; warmup++)
                MaskedComposite2D.compose(size[0], size[1], source, destination, mask);
            long start = System.nanoTime();
            long checksum = 0;
            for (int repeat = 0; repeat < 3; repeat++) {
                int[] output = MaskedComposite2D.compose(size[0], size[1], source, destination, mask).pixels();
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
