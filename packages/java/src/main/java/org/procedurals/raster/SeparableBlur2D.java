package org.procedurals.raster;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Owned normalized separable filtering of straight ARGB8 rasters.
 *
 * <p>The operation is independently specified project work motivated by active weighted
 * neighborhood filters in {@code survey/out/2015/Generativos/cityPink3d/notes.md} and
 * {@code survey/out/2020/generative/01_04/rgblur/notes.md}. It deliberately does not
 * reproduce their shader gain, vignette, scanlines, fractional taps, or mask modulation.
 * Working RGB is encoded and premultiplied for the specified arithmetic; it is not
 * linear-light filtering. Kernels are explicit caller data: no default or recommended
 * artistic kernel range is provided.</p>
 */
public strictfp final class SeparableBlur2D {
    public static final class SeparableBlurException extends IllegalArgumentException {
        public final String code;
        SeparableBlurException(String code) { super(code); this.code = code; }
    }

    private final int width;
    private final int height;
    private final int[] pixels;

    private SeparableBlur2D(int width, int height, int[] pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
    }

    /**
     * Filters the exact portable source, kernelX, kernelY, and maxSamples object record.
     * Kernels have no implicit default or recommended range.
     */
    public static SeparableBlur2D blur(Object input) {
        if (!(input instanceof Map)) invalid();
        Map<?, ?> root = (Map<?, ?>) input;
        exact(root, "source", "kernelX", "kernelY", "maxSamples");
        Raster source = objectRaster(root.get("source"));
        double[] kernelX = objectKernel(root.get("kernelX"));
        double[] kernelY = objectKernel(root.get("kernelY"));
        long maxSamples = maxSamples(root.get("maxSamples"));
        return validated(source.width, source.height, source.pixels, kernelX, kernelY, maxSamples);
    }

    /**
     * Typed packed-buffer form with the same ordered binary64 kernel. Inputs are never retained;
     * kernel choices remain explicit caller data with no recommended range.
     */
    public static SeparableBlur2D blur(int width, int height, int[] source, double[] kernelX,
            double[] kernelY, long maxSamples) {
        int pixelCount = count(width, height);
        if (source == null || source.length != pixelCount) invalid();
        validateKernel(kernelX);
        validateKernel(kernelY);
        if (maxSamples < 1 || maxSamples > 9007199254740991L) invalid();
        return validated(width, height, source, kernelX, kernelY, maxSamples);
    }

    private static SeparableBlur2D validated(int width, int height, int[] source,
            double[] kernelX, double[] kernelY, long maxSamples) {
        int pixelCount = count(width, height);
        long work = (long) pixelCount * ((long) kernelX.length + (long) kernelY.length);
        if (work > maxSamples) throw new SeparableBlurException("WORK_LIMIT");
        if (kernelX.length == 1 && kernelY.length == 1)
            return new SeparableBlur2D(width, height, source.clone());

        double[] normalizedX = normalize(kernelX);
        double[] normalizedY = normalize(kernelY);
        double[] alpha = new double[pixelCount];
        double[] red = new double[pixelCount];
        double[] green = new double[pixelCount];
        double[] blue = new double[pixelCount];
        horizontal(width, height, source, normalizedX, alpha, red, green, blue);
        int[] output = vertical(width, height, normalizedY, alpha, red, green, blue);
        return new SeparableBlur2D(width, height, output);
    }

    private static double[] normalize(double[] supplied) {
        double maximum = 0.0;
        for (int i = 0; i < supplied.length; i++) if (supplied[i] > maximum) maximum = supplied[i];
        double[] normalized = new double[supplied.length];
        double sum = 0.0;
        for (int i = 0; i < supplied.length; i++) {
            double scaled = supplied[i] / maximum;
            normalized[i] = scaled;
            sum += scaled;
        }
        for (int i = 0; i < normalized.length; i++) normalized[i] = normalized[i] / sum;
        return normalized;
    }

    private static void horizontal(int width, int height, int[] source, double[] weights,
            double[] alpha, double[] red, double[] green, double[] blue) {
        int half = weights.length / 2;
        for (int y = 0; y < height; y++) {
            int row = y * width;
            for (int x = 0; x < width; x++) {
                double a = 0.0, r = 0.0, g = 0.0, b = 0.0;
                for (int tap = 0; tap < weights.length; tap++) {
                    long coordinate = (long) x + (long) tap - (long) half;
                    int sampleX = clamp(coordinate, width);
                    int pixel = source[row + sampleX];
                    double sampleAlpha = (pixel >>> 24) / 255.0;
                    double weight = weights[tap];
                    a += sampleAlpha * weight;
                    double premultipliedRed = ((pixel >>> 16) & 255) * sampleAlpha;
                    r += premultipliedRed * weight;
                    double premultipliedGreen = ((pixel >>> 8) & 255) * sampleAlpha;
                    g += premultipliedGreen * weight;
                    double premultipliedBlue = (pixel & 255) * sampleAlpha;
                    b += premultipliedBlue * weight;
                }
                int index = row + x;
                alpha[index] = a;
                red[index] = r;
                green[index] = g;
                blue[index] = b;
            }
        }
    }

    private static int[] vertical(int width, int height, double[] weights, double[] alpha,
            double[] red, double[] green, double[] blue) {
        int[] output = new int[alpha.length];
        int half = weights.length / 2;
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                double a = 0.0, r = 0.0, g = 0.0, b = 0.0;
                for (int tap = 0; tap < weights.length; tap++) {
                    long coordinate = (long) y + (long) tap - (long) half;
                    int sampleY = clamp(coordinate, height);
                    int index = sampleY * width + x;
                    double weight = weights[tap];
                    a += alpha[index] * weight;
                    r += red[index] * weight;
                    g += green[index] * weight;
                    b += blue[index] * weight;
                }
                output[y * width + x] = pack(a, r, g, b);
            }
        }
        return output;
    }

    private static int clamp(long coordinate, int length) {
        if (coordinate < 0L) return 0;
        if (coordinate >= (long) length) return length - 1;
        return (int) coordinate;
    }

    private static int pack(double alpha, double red, double green, double blue) {
        if (alpha == 0.0) return 0;
        int outputAlpha = quantize(alpha * 255.0);
        if (outputAlpha == 0) return 0;
        int outputRed = quantize(red / alpha);
        int outputGreen = quantize(green / alpha);
        int outputBlue = quantize(blue / alpha);
        return outputAlpha << 24 | outputRed << 16 | outputGreen << 8 | outputBlue;
    }

    private static int quantize(double value) {
        double lowClamped = Math.max(0.0, value);
        double clamped = Math.min(255.0, lowClamped);
        return (int) Math.floor(clamped + 0.5);
    }

    public int width() { return width; }
    public int height() { return height; }
    /** Returns signed Java ARGB bits; nonidentity filtering canonicalizes alpha-zero pixels. */
    public int pixelAt(long value) { return pixels[index(value)]; }
    public int pixelAt(Object value) { return pixelAt(accessIndex(value)); }
    /** Returns a detached signed Java ARGB buffer. */
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
        Map<?, ?> source = (Map<?, ?>) value;
        exact(source, "width", "height", "pixels");
        int width = dimension(source.get("width"));
        int height = dimension(source.get("height"));
        int pixelCount = count(width, height);
        Object supplied = source.get("pixels");
        if (!(supplied instanceof List)) invalid();
        List<?> values = (List<?>) supplied;
        if (values.size() != pixelCount) invalid();
        int[] pixels = new int[pixelCount];
        int index = 0;
        for (Object pixel : values) pixels[index++] = unsigned(pixel);
        return new Raster(width, height, pixels);
    }

    private static double[] objectKernel(Object value) {
        if (!(value instanceof List)) invalid();
        List<?> values = (List<?>) value;
        if (values.isEmpty() || values.size() > Integer.MAX_VALUE || (values.size() & 1) == 0) invalid();
        double[] kernel = new double[values.size()];
        double maximum = 0.0;
        int index = 0;
        for (Object valueItem : values) {
            double weight = number(valueItem);
            if (!Double.isFinite(weight) || weight < 0.0) invalid();
            kernel[index++] = weight;
            if (weight > maximum) maximum = weight;
        }
        if (!(maximum > 0.0)) invalid();
        return kernel;
    }

    private static void validateKernel(double[] kernel) {
        if (kernel == null || kernel.length == 0 || (kernel.length & 1) == 0) invalid();
        double maximum = 0.0;
        for (int i = 0; i < kernel.length; i++) {
            double weight = kernel[i];
            if (!Double.isFinite(weight) || weight < 0.0) invalid();
            if (weight > maximum) maximum = weight;
        }
        if (!(maximum > 0.0)) invalid();
    }

    private int index(long value) {
        if (value < 0L || value > 9007199254740991L) throw new SeparableBlurException("INVALID_INDEX");
        if (value >= pixels.length) throw new SeparableBlurException("INDEX_OUT_OF_RANGE");
        return (int) value;
    }

    private static long accessIndex(Object value) {
        if (!carrier(value)) throw new SeparableBlurException("INVALID_INDEX");
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number < 0.0 || number != Math.floor(number)
                || number > 9007199254740991d) throw new SeparableBlurException("INVALID_INDEX");
        return (long) number;
    }

    private static int dimension(Object value) {
        double number = number(value);
        if (!Double.isFinite(number) || number < 1.0 || number != Math.floor(number)
                || number > Integer.MAX_VALUE) invalid();
        return (int) number;
    }

    private static int count(int width, int height) {
        if (width < 1 || height < 1 || (long) width * (long) height > Integer.MAX_VALUE) invalid();
        return width * height;
    }

    private static int unsigned(Object value) {
        double number = number(value);
        if (!Double.isFinite(number) || number < 0.0 || number > 4294967295d
                || number != Math.floor(number)) invalid();
        return (int) (long) number;
    }

    private static long maxSamples(Object value) {
        double number = number(value);
        if (!Double.isFinite(number) || number < 1.0 || number != Math.floor(number)
                || number > 9007199254740991d) invalid();
        return (long) number;
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

    private static void invalid() { throw new SeparableBlurException("INVALID_INPUT"); }

    private static final class Raster {
        final int width;
        final int height;
        final int[] pixels;
        Raster(int width, int height, int[] pixels) {
            this.width = width;
            this.height = height;
            this.pixels = pixels;
        }
    }
}
