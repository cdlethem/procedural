package org.procedurals.raster;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Owned ARGB8 pull remapping with clamped, straight-channel bilinear sampling.
 * Motivated by 2016/Generativos/colorRamp (active source-coordinate pull sampling);
 * coordinates and dimensions are caller data, with no evidenced encouraged range.
 * Stored channels are interpolated independently: hidden RGB can affect translucent
 * edges. This is neither premultiplied nor linear-light filtering.
 */
public strictfp final class RasterRemap2D {
    public static final class RasterRemapException extends IllegalArgumentException {
        public final String code;
        RasterRemapException(String code) { super(code); this.code = code; }
    }
    private final int width, height;
    private final int[] pixels;
    private RasterRemap2D(int width, int height, int[] pixels) { this.width = width; this.height = height; this.pixels = pixels; }

    /**
     * Remaps caller-supplied ARGB8 data. Provenance: survey/out/2016/Generativos/colorRamp/notes.md.
     * Dimensions, coordinates and pixels are caller data; no encouraged range is evidenced.
     */
    public static RasterRemap2D remap(Object input) {
        if (!(input instanceof Map)) invalid();
        Map<?,?> root = (Map<?,?>) input;
        exact(root, "source", "outputWidth", "outputHeight", "sourceCoordinates");
        Object sourceValue = root.get("source");
        if (!(sourceValue instanceof Map)) invalid();
        Map<?,?> source = (Map<?,?>) sourceValue;
        exact(source, "width", "height", "pixels");
        int sw = dimension(source.get("width"));
        int sh = dimension(source.get("height"));
        int sourceCount = sourceCount(sw, sh);
        Object pixelValue = source.get("pixels");
        if (!(pixelValue instanceof List)) invalid();
        List<?> suppliedPixels = (List<?>) pixelValue;
        if (suppliedPixels.size() != sourceCount) invalid();
        int[] sourcePixels = new int[sourceCount];
        int pixelIndex = 0;
        for (Object pixel : suppliedPixels) sourcePixels[pixelIndex++] = unsigned(pixel);
        int ow = dimension(root.get("outputWidth"));
        int oh = dimension(root.get("outputHeight"));
        int outputCount = outputCount(ow, oh);
        Object coordinateValue = root.get("sourceCoordinates");
        if (!(coordinateValue instanceof List)) invalid();
        List<?> suppliedCoordinates = (List<?>) coordinateValue;
        if (suppliedCoordinates.size() != outputCount) invalid();
        double[] xy = new double[outputCount * 2];
        int coordinateIndex = 0;
        for (Object pairValue : suppliedCoordinates) {
            if (!(pairValue instanceof List)) invalid();
            List<?> pair = (List<?>) pairValue;
            if (pair.size() != 2) invalid();
            xy[coordinateIndex++] = coordinate(pair.get(0));
            xy[coordinateIndex++] = coordinate(pair.get(1));
        }
        return validated(sw, sh, sourcePixels, ow, oh, xy);
    }

    /** Typed packed-buffer form with the same kernel; input arrays are never retained. */
    public static RasterRemap2D remap(int sourceWidth, int sourceHeight, int[] sourcePixels,
            int outputWidth, int outputHeight, double[] packedXY) {
        int sourceCount = sourceCount(sourceWidth, sourceHeight);
        if (sourcePixels == null || sourcePixels.length != sourceCount) invalid();
        int outputCount = outputCount(outputWidth, outputHeight);
        if (packedXY == null || packedXY.length != outputCount * 2) invalid();
        for (int i = 0; i < packedXY.length; i++) if (!Double.isFinite(packedXY[i])) invalid();
        return validated(sourceWidth, sourceHeight, sourcePixels, outputWidth, outputHeight, packedXY);
    }

    private static RasterRemap2D validated(int sw, int sh, int[] source, int ow, int oh, double[] xy) {
        int count = outputCount(ow, oh); // validation complete before this allocation
        int[] output = new int[count];
        for (int index = 0; index < count; index++) output[index] = sample(source, sw, sh, xy[index * 2], xy[index * 2 + 1]);
        return new RasterRemap2D(ow, oh, output);
    }

    private static int sample(int[] source, int width, int height, double x, double y) {
        x = Math.max(0.0, Math.min(x, width - 1.0)); y = Math.max(0.0, Math.min(y, height - 1.0));
        int x0 = (int) Math.floor(x), y0 = (int) Math.floor(y);
        int x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
        double fx = x - x0, fy = y - y0;
        int p00 = source[y0 * width + x0], p10 = source[y0 * width + x1], p01 = source[y1 * width + x0], p11 = source[y1 * width + x1];
        return channel(p00 >>> 24, p10 >>> 24, p01 >>> 24, p11 >>> 24, fx, fy) << 24
            | channel((p00 >>> 16) & 255, (p10 >>> 16) & 255, (p01 >>> 16) & 255, (p11 >>> 16) & 255, fx, fy) << 16
            | channel((p00 >>> 8) & 255, (p10 >>> 8) & 255, (p01 >>> 8) & 255, (p11 >>> 8) & 255, fx, fy) << 8
            | channel(p00 & 255, p10 & 255, p01 & 255, p11 & 255, fx, fy);
    }
    private static int channel(int a, int b, int c, int d, double fx, double fy) {
        double top = a + (b - a) * fx; double bottom = c + (d - c) * fx; double value = top + (bottom - top) * fy;
        value = Math.max(0.0, Math.min(255.0, value)); return (int) Math.floor(value + 0.5);
    }
    public int width() { return width; }
    public int height() { return height; }
    /** Returns signed Java ARGB bits; transparent pixels retain hidden RGB bits. */
    public int pixelAt(long index) { return pixels[index(index)]; }
    public int pixelAt(Object value) { return pixelAt(accessIndex(value)); }
    /** Returns detached signed Java ARGB bit patterns. */
    public int[] pixels() { return pixels.clone(); }
    /** Returns detached portable values with pixels as unsigned32 Long values. */
    public Map<String,Object> toValues() {
        List<Object> values = new ArrayList<Object>(pixels.length);
        for (int pixel : pixels) values.add(Long.valueOf(Integer.toUnsignedLong(pixel)));
        Map<String,Object> result = new LinkedHashMap<String,Object>(); result.put("width", Integer.valueOf(width)); result.put("height", Integer.valueOf(height)); result.put("pixels", values); return result;
    }
    private int index(long value) { if (value < 0 || value > 9007199254740991L) throw new RasterRemapException("INVALID_INDEX"); if (value >= pixels.length) throw new RasterRemapException("INDEX_OUT_OF_RANGE"); return (int) value; }
    private static long accessIndex(Object value) { if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long || value instanceof Float || value instanceof Double)) throw new RasterRemapException("INVALID_INDEX"); double n = ((Number)value).doubleValue(); if (!Double.isFinite(n) || n < 0 || n != Math.floor(n) || n > 9007199254740991d) throw new RasterRemapException("INVALID_INDEX"); return (long) n; }
    private static int dimension(Object value) { double n = number(value); if (!Double.isFinite(n) || n < 1 || n != Math.floor(n) || n > Integer.MAX_VALUE) invalid(); return (int)n; }
    private static int sourceCount(int w, int h) { if (w < 1 || h < 1 || (long)w * h > Integer.MAX_VALUE) invalid(); return w * h; }
    private static int outputCount(int w, int h) { if (w < 1 || h < 1 || (long)w * h > 1073741823L) invalid(); return w * h; }
    private static int unsigned(Object value) { double n = number(value); if (!Double.isFinite(n) || n < 0 || n > 4294967295d || n != Math.floor(n)) invalid(); return (int)(long)n; }
    private static double coordinate(Object value) { double n = number(value); if (!Double.isFinite(n)) invalid(); return n; }
    private static double number(Object value) { if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long || value instanceof Float || value instanceof Double)) invalid(); return ((Number)value).doubleValue(); }
    private static void exact(Map<?,?> record, String... keys) { if (record.size() != keys.length) invalid(); for (String key : keys) if (!record.containsKey(key)) invalid(); }
    private static void invalid() { throw new RasterRemapException("INVALID_INPUT"); }
}
