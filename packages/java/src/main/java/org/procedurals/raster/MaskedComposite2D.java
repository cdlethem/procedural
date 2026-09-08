package org.procedurals.raster;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Owned straight-ARGB8 source-over compositing with a caller-supplied visibility mask.
 * Provenance: 2017/Generativos/Eyes/eyes002 image stamps; spatial masking and this
 * portable pixel operation are independently specified project composition work.
 * Working RGB is encoded and premultiplied only for the stated source-over arithmetic.
 */
public strictfp final class MaskedComposite2D {
    public static final class MaskedCompositeException extends IllegalArgumentException {
        public final String code;
        MaskedCompositeException(String code) { super(code); this.code = code; }
    }

    private final int width;
    private final int height;
    private final int[] pixels;

    private MaskedComposite2D(int width, int height, int[] pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
    }

    /** Composites exact portable source, destination, and mask records. */
    public static MaskedComposite2D compose(Object input) {
        if (!(input instanceof Map)) invalid();
        Map<?, ?> root = (Map<?, ?>) input;
        exact(root, "source", "destination", "mask");

        Raster source = objectRaster(root.get("source"));
        Object destinationValue = root.get("destination");
        if (!(destinationValue instanceof Map)) invalid();
        Map<?, ?> destinationRecord = (Map<?, ?>) destinationValue;
        exact(destinationRecord, "width", "height", "pixels");
        int destinationWidth = dimension(destinationRecord.get("width"));
        int destinationHeight = dimension(destinationRecord.get("height"));
        int destinationCount = count(destinationWidth, destinationHeight);
        if (source.width != destinationWidth || source.height != destinationHeight) invalid();
        int[] destination = objectPixels(destinationRecord.get("pixels"), destinationCount);

        Object maskValue = root.get("mask");
        if (!(maskValue instanceof List)) invalid();
        List<?> suppliedMask = (List<?>) maskValue;
        if (suppliedMask.size() != source.pixels.length) invalid();
        double[] mask = new double[source.pixels.length];
        int maskIndex = 0;
        for (Object value : suppliedMask) mask[maskIndex++] = mask(value);
        return validated(source.width, source.height, source.pixels, destination, mask);
    }

    /** Typed packed-buffer form with the same kernel; supplied buffers are never retained. */
    public static MaskedComposite2D compose(int width, int height, int[] source, int[] destination, double[] mask) {
        int pixelCount = count(width, height);
        if (source == null || source.length != pixelCount) invalid();
        if (destination == null || destination.length != pixelCount) invalid();
        if (mask == null || mask.length != pixelCount) invalid();
        for (int i = 0; i < mask.length; i++) mask(mask[i]);
        return validated(width, height, source, destination, mask);
    }

    private static MaskedComposite2D validated(int width, int height, int[] source, int[] destination, double[] mask) {
        int pixelCount = count(width, height);
        int[] output = new int[pixelCount];
        for (int i = 0; i < pixelCount; i++) output[i] = composite(source[i], destination[i], mask[i]);
        return new MaskedComposite2D(width, height, output);
    }

    private static int composite(int source, int destination, double mask) {
        int sourceAlpha = source >>> 24;
        if (mask == 0.0 || sourceAlpha == 0) return destination;
        double sourceAlphaUnit = sourceAlpha / 255.0;
        double a = sourceAlphaUnit * mask;
        int destinationAlpha = destination >>> 24;
        double b = destinationAlpha / 255.0;
        double t = 1.0 - a;
        double u = b * t;
        double v = a + u;
        if (v == 0.0) return 0;
        int alpha = quantize(v * 255.0);
        if (alpha == 0) return 0;
        int red = channel((source >>> 16) & 255, (destination >>> 16) & 255, a, u, v);
        int green = channel((source >>> 8) & 255, (destination >>> 8) & 255, a, u, v);
        int blue = channel(source & 255, destination & 255, a, u, v);
        return alpha << 24 | red << 16 | green << 8 | blue;
    }

    private static int channel(int source, int destination, double a, double u, double v) {
        double p = source * a;
        double q = destination * u;
        double sum = p + q;
        double color = sum / v;
        return quantize(color);
    }

    private static int quantize(double value) {
        double clampedLow = Math.max(0.0, value);
        double clamped = Math.min(255.0, clampedLow);
        return (int) Math.floor(clamped + 0.5);
    }

    public int width() { return width; }
    public int height() { return height; }

    /** Returns signed Java ARGB bits, including any preserved hidden destination RGB. */
    public int pixelAt(long value) { return pixels[index(value)]; }
    public int pixelAt(Object value) { return pixelAt(accessIndex(value)); }

    /** Returns a detached Java ARGB buffer. */
    public int[] pixels() { return pixels.clone(); }

    /** Returns detached portable dimensions and unsigned32 pixel values. */
    public Map<String, Object> toValues() {
        List<Object> values = new ArrayList<Object>(pixels.length);
        for (int pixel : pixels) values.add(Long.valueOf(Integer.toUnsignedLong(pixel)));
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("width", Integer.valueOf(width));
        result.put("height", Integer.valueOf(height));
        result.put("pixels", values);
        return result;
    }

    private static Raster objectRaster(Object value) {
        if (!(value instanceof Map)) invalid();
        Map<?, ?> record = (Map<?, ?>) value;
        exact(record, "width", "height", "pixels");
        int width = dimension(record.get("width"));
        int height = dimension(record.get("height"));
        int pixelCount = count(width, height);
        return new Raster(width, height, objectPixels(record.get("pixels"), pixelCount));
    }

    private static int[] objectPixels(Object value, int pixelCount) {
        if (!(value instanceof List)) invalid();
        List<?> supplied = (List<?>) value;
        if (supplied.size() != pixelCount) invalid();
        int[] pixels = new int[pixelCount];
        int pixelIndex = 0;
        for (Object pixel : supplied) pixels[pixelIndex++] = unsigned(pixel);
        return pixels;
    }

    private int index(long value) {
        if (value < 0 || value > 9007199254740991L) throw new MaskedCompositeException("INVALID_INDEX");
        if (value >= pixels.length) throw new MaskedCompositeException("INDEX_OUT_OF_RANGE");
        return (int) value;
    }

    private static long accessIndex(Object value) {
        if (!carrier(value)) throw new MaskedCompositeException("INVALID_INDEX");
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number < 0 || number != Math.floor(number) || number > 9007199254740991d) throw new MaskedCompositeException("INVALID_INDEX");
        return (long) number;
    }

    private static int dimension(Object value) {
        double number = number(value);
        if (!Double.isFinite(number) || number < 1 || number != Math.floor(number) || number > Integer.MAX_VALUE) invalid();
        return (int) number;
    }

    private static int count(int width, int height) {
        if (width < 1 || height < 1 || (long) width * height > Integer.MAX_VALUE) invalid();
        return width * height;
    }

    private static int unsigned(Object value) {
        double number = number(value);
        if (!Double.isFinite(number) || number < 0 || number > 4294967295d || number != Math.floor(number)) invalid();
        return (int) (long) number;
    }

    private static double mask(Object value) {
        double number = number(value);
        if (!Double.isFinite(number) || number < 0.0 || number > 1.0) invalid();
        return number;
    }

    private static double mask(double value) {
        if (!Double.isFinite(value) || value < 0.0 || value > 1.0) invalid();
        return value;
    }

    private static double number(Object value) {
        if (!carrier(value)) invalid();
        return ((Number) value).doubleValue();
    }

    private static boolean carrier(Object value) {
        return value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
            || value instanceof Float || value instanceof Double;
    }

    private static void exact(Map<?, ?> record, String... keys) {
        if (record.size() != keys.length) invalid();
        for (String key : keys) if (!record.containsKey(key)) invalid();
    }

    private static void invalid() { throw new MaskedCompositeException("INVALID_INPUT"); }

    private static final class Raster {
        final int width;
        final int height;
        final int[] pixels;
        Raster(int width, int height, int[] pixels) { this.width = width; this.height = height; this.pixels = pixels; }
    }
}
