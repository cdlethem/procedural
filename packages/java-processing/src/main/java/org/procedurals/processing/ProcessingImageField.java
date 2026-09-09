package org.procedurals.processing;

import org.procedurals.raster.RasterRemap2D;
import processing.core.PApplet;
import processing.core.PImage;

/**
 * Owned image attributes sampled through the accepted straight-channel raster remapper.
 * Motivated by survey/out/2019/generativos/crb/notes.md: image brightness controls sizes
 * independently of positions. Fractional sampling is project design; no artistic range
 * or source-sketch recreation is claimed. Alpha and maximum-RGB brightness are separate.
 */
public final class ProcessingImageField {
    private final int width, height;
    private final int[] pixels;

    private ProcessingImageField(int width, int height, int[] pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
    }

    /** Captures a completed density-one RGB/ARGB image without retaining the host image. */
    public static ProcessingImageField snapshot(PImage image) {
        if (image == null || (image.format != PApplet.RGB && image.format != PApplet.ARGB)
                || image.width < 1 || image.height < 1 || image.pixelDensity != 1
                || image.pixelWidth != image.width || image.pixelHeight != image.height
                || (long) image.width * image.height > Integer.MAX_VALUE) {
            throw new IllegalArgumentException("Invalid image snapshot");
        }
        image.loadPixels();
        int count = image.width * image.height;
        if (image.pixels == null || image.pixels.length != count) {
            throw new IllegalArgumentException("Invalid image pixel count");
        }
        int[] owned = image.pixels.clone();
        if (image.format == PApplet.RGB) {
            for (int i = 0; i < count; i++) owned[i] |= 0xff000000;
        }
        return new ProcessingImageField(image.width, image.height, owned);
    }

    /** Source width in pixels. */
    public int width() { return width; }
    /** Source height in pixels. */
    public int height() { return height; }

    /**
     * Samples packed x,y pixel-center indices, clamped to image edges. Interpolation
     * preserves RasterRemap2D straight-channel semantics, including hidden RGB influence.
     * Empty coordinates return empty samples; inputs and previous results remain owned.
     */
    public Samples sample(double[] packedXY) {
        if (packedXY == null || packedXY.length % 2 != 0) {
            throw new IllegalArgumentException("Expected packed x,y pairs");
        }
        for (double value : packedXY) {
            if (!Double.isFinite(value)) throw new IllegalArgumentException("Nonfinite coordinate");
        }
        int count = packedXY.length / 2;
        if (count == 0) return new Samples(new int[0]);
        int[] sampled = RasterRemap2D.remap(width, height, pixels, count, 1, packedXY).pixels();
        return new Samples(sampled);
    }

    /** Immutable results; no internal arrays are exposed. */
    public static final class Samples {
        private final int[] pixels;
        private Samples(int[] pixels) { this.pixels = pixels; }
        /** Number of sampled positions. */
        public int size() { return pixels.length; }
        /** Packed straight ARGB8 at a zero-based query index. */
        public int argb(int index) {
            if (index < 0 || index >= pixels.length) throw new IndexOutOfBoundsException("Sample index");
            return pixels[index];
        }
        /** Sampled alpha divided by255, independent of RGB. */
        public double alpha01(int index) { return (argb(index) >>> 24) / 255.0; }
        /** Maximum sampled RGB channel divided by255; not luminance, and ignores alpha. */
        public double maxRgb01(int index) {
            int value = argb(index);
            return Math.max((value >>> 16) & 255, Math.max((value >>> 8) & 255, value & 255)) / 255.0;
        }
    }
}
