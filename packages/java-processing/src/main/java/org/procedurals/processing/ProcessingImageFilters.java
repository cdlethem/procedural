package org.procedurals.processing;

import org.procedurals.raster.SeparableBlur2D;
import processing.core.PApplet;
import processing.core.PImage;

/**
 * Transports completed density-one Processing images through portable filters.
 * Motivated by survey/out/2015/Generativos/cityPink3d/notes.md and
 * survey/out/2020/generative/01_04/rgblur/notes.md. Normalized alpha-safe filtering
 * is an independent project specification, not either complete source shader.
 * No measured artistic kernel range or default is recommended.
 */
public final class ProcessingImageFilters {
    private ProcessingImageFilters() { }

    /**
     * Filters a completed RGB or ARGB image and returns an independently owned ARGB image.
     * RGB source pixels are interpreted as opaque. Kernels and tap budget are explicit
     * caller data governed by SeparableBlur2D; its validation failures propagate unchanged.
     * End drawing before passing a PGraphics and keep all inputs stable during this call.
     *
     * @param parent parent used to allocate the returned image
     * @param source completed density-one RGB or ARGB source
     * @param kernelX odd nonnegative horizontal weights with a positive maximum
     * @param kernelY odd nonnegative vertical weights with a positive maximum
     * @param maxSamples maximum declared pixel-times-tap work, including zero taps
     * @return detached same-sized ARGB image
     * @throws IllegalArgumentException for invalid image transport
     */
    public static PImage separableBlur(PApplet parent, PImage source,
            double[] kernelX, double[] kernelY, long maxSamples) {
        if (parent == null || source == null
                || (source.format != PApplet.RGB && source.format != PApplet.ARGB)
                || source.width < 1 || source.height < 1
                || source.pixelDensity != 1
                || source.pixelWidth != source.width || source.pixelHeight != source.height
                || (long) source.width * source.height > Integer.MAX_VALUE) {
            throw new IllegalArgumentException("Invalid filter image");
        }
        int count = source.width * source.height;
        source.loadPixels();
        if (source.pixels == null || source.pixels.length != count) {
            throw new IllegalArgumentException("Invalid filter image pixels");
        }
        int[] input = source.pixels;
        if (source.format == PApplet.RGB) {
            input = input.clone();
            for (int i = 0; i < count; i++) input[i] |= 0xff000000;
        }
        int[] filtered = SeparableBlur2D.blur(source.width, source.height,
                input, kernelX, kernelY, maxSamples).pixels();
        PImage result = parent.createImage(source.width, source.height, PApplet.ARGB);
        result.loadPixels();
        System.arraycopy(filtered, 0, result.pixels, 0, count);
        result.updatePixels();
        return result;
    }
}
