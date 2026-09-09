package org.procedurals.raster;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Owned straight-ARGB8 crossfading with caller-supplied second-input weights.
 * Provenance: 2017/Generativos/Eyes/eyes002 image stamps; spatial weighting and this
 * portable pixel operation are independently specified project composition work.
 * Working RGB is encoded and premultiplied only for the stated weighted arithmetic.
 */
public strictfp final class RasterCrossfade2D {
    public static final class RasterCrossfadeException extends IllegalArgumentException {
        public final String code;
        RasterCrossfadeException(String code) { super(code); this.code = code; }
    }

    private final int width;
    private final int height;
    private final int[] pixels;

    private RasterCrossfade2D(int width, int height, int[] pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
    }

    /** Crossfades exact portable first, second, and weights records. */
    public static RasterCrossfade2D mix(Object input) {
        if (!(input instanceof Map)) invalid();
        Map<?, ?> root = (Map<?, ?>) input;
        exact(root, "first", "second", "weights");

        Raster first = objectRaster(root.get("first"));
        Object secondValue = root.get("second");
        if (!(secondValue instanceof Map)) invalid();
        Map<?, ?> secondRecord = (Map<?, ?>) secondValue;
        exact(secondRecord, "width", "height", "pixels");
        int secondWidth = dimension(secondRecord.get("width"));
        int secondHeight = dimension(secondRecord.get("height"));
        int secondCount = count(secondWidth, secondHeight);
        if (first.width != secondWidth || first.height != secondHeight) invalid();
        int[] second = objectPixels(secondRecord.get("pixels"), secondCount);

        Object weightValue = root.get("weights");
        if (!(weightValue instanceof List)) invalid();
        List<?> suppliedWeights = (List<?>) weightValue;
        if (suppliedWeights.size() != first.pixels.length) invalid();
        double[] weight = new double[first.pixels.length];
        int weightIndex = 0;
        for (Object value : suppliedWeights) weight[weightIndex++] = weight(value);
        return validated(first.width, first.height, first.pixels, second, weight);
    }

    /** Typed packed-buffer form with the same kernel; supplied buffers are never retained. */
    public static RasterCrossfade2D mix(int width, int height, int[] first, int[] second, double[] weight) {
        int pixelCount = count(width, height);
        if (first == null || first.length != pixelCount) invalid();
        if (second == null || second.length != pixelCount) invalid();
        if (weight == null || weight.length != pixelCount) invalid();
        for (int i = 0; i < weight.length; i++) weight(weight[i]);
        return validated(width, height, first, second, weight);
    }

    private static RasterCrossfade2D validated(int width, int height, int[] first, int[] second, double[] weight) {
        int pixelCount = count(width, height);
        int[] output = new int[pixelCount];
        for (int i = 0; i < pixelCount; i++) output[i] = composite(first[i], second[i], weight[i]);
        return new RasterCrossfade2D(width, height, output);
    }

    private static int composite(int first, int second, double weight) {
        if (weight == 0.0) return first;
        if (weight == 1.0) return second;
        double t = 1.0 - weight;
        int firstAlpha = first >>> 24;
        double af = firstAlpha / 255.0;
        int secondAlpha = second >>> 24;
        double as = secondAlpha / 255.0;
        double u = af * t;
        double v = as * weight;
        double a = u + v;
        if (a == 0.0) return 0;
        int alpha = quantize(a * 255.0);
        if (alpha == 0) return 0;
        int red = channel((first >>> 16) & 255, (second >>> 16) & 255, u, v, a);
        int green = channel((first >>> 8) & 255, (second >>> 8) & 255, u, v, a);
        int blue = channel(first & 255, second & 255, u, v, a);
        return alpha << 24 | red << 16 | green << 8 | blue;
    }

    private static int channel(int first, int second, double u, double v, double a) {
        double p = first * u;
        double q = second * v;
        double sum = p + q;
        double color = sum / a;
        return quantize(color);
    }

    private static int quantize(double value) {
        double clampedLow = Math.max(0.0, value);
        double clamped = Math.min(255.0, clampedLow);
        return (int) Math.floor(clamped + 0.5);
    }

    public int width() { return width; }
    public int height() { return height; }

    /** Returns signed Java ARGB bits, including endpoint-preserved hidden RGB. */
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
        if (value < 0 || value > 9007199254740991L) throw new RasterCrossfadeException("INVALID_INDEX");
        if (value >= pixels.length) throw new RasterCrossfadeException("INDEX_OUT_OF_RANGE");
        return (int) value;
    }

    private static long accessIndex(Object value) {
        if (!carrier(value)) throw new RasterCrossfadeException("INVALID_INDEX");
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number < 0 || number != Math.floor(number) || number > 9007199254740991d) throw new RasterCrossfadeException("INVALID_INDEX");
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

    private static double weight(Object value) {
        double number = number(value);
        if (!Double.isFinite(number) || number < 0.0 || number > 1.0) invalid();
        return number;
    }

    private static double weight(double value) {
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

    private static void invalid() { throw new RasterCrossfadeException("INVALID_INPUT"); }

    private static final class Raster {
        final int width;
        final int height;
        final int[] pixels;
        Raster(int width, int height, int[] pixels) { this.width = width; this.height = height; this.pixels = pixels; }
    }
}
