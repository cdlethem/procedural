package org.procedurals.processing;

import org.procedurals.raster.MaskedComposite2D;
import org.procedurals.raster.RasterCrossfade2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PGraphics;
import processing.core.PImage;

/**
 * JAVA2D layer and alpha-mask transport. Provenance is eyes002 image/draw callbacks and
 * circuloss native mask construction; alpha interpretation is project design. No opacity,
 * feather, or shape-count range is recommended.
 */
public final class Java2DLayers {
    private Java2DLayers() { }
    /** Draws once into a borrowed active density-one JAVA2D target. */
    public interface Content { void draw(PGraphics target); }

    /** Renders content once to an independently owned transparent ARGB image. */
    public static PImage render(PApplet parent, int width, int height, Content content) {
        if (parent == null || content == null || width < 1 || height < 1 || (long) width * height > Integer.MAX_VALUE) throw new IllegalArgumentException("Invalid layer render input");
        PGraphicsJava2D target = new PGraphicsJava2D(); Throwable primary = null;
        try {
            target.setParent(parent); target.setPrimary(false); target.pixelDensity = 1; target.setSize(width, height); target.beginDraw();
            target.colorMode(PApplet.RGB, 255); target.noTint(); target.blendMode(PApplet.BLEND); target.resetMatrix(); target.noClip(); target.clear();
            content.draw(target); target.endDraw(); target.loadPixels();
            PImage result = parent.createImage(width, height, PApplet.ARGB); result.loadPixels(); System.arraycopy(target.pixels, 0, result.pixels, 0, width * height); result.updatePixels(); return result;
        } catch (RuntimeException | Error error) { primary = error; throw error; }
        finally { release(target, primary); }
    }

    /** Returns detached alpha/255 values; opaque black and white both yield one. */
    public static double[] alphaMask(PImage image) {
        int[] pixels = pixels(image); double[] result = new double[pixels.length]; for (int i = 0; i < pixels.length; i++) result[i] = (pixels[i] >>> 24) / 255.0; return result;
    }

    /** Applies accepted MaskedComposite2D arithmetic to completed density-one images. */
    public static PImage composite(PApplet parent, PImage source, PImage destination, double[] mask) {
        if (parent == null) throw new IllegalArgumentException("Null parent"); int count = matching(source, destination); int[] sourcePixels = pixels(source), destinationPixels = pixels(destination);
        return image(parent, source.width, source.height, MaskedComposite2D.compose(source.width, source.height, sourcePixels, destinationPixels, mask).pixels(), count);
    }

    /** Applies accepted RasterCrossfade2D arithmetic to completed density-one images. */
    public static PImage crossfade(PApplet parent, PImage first, PImage second, double[] weights) {
        if (parent == null) throw new IllegalArgumentException("Null parent"); int count = matching(first, second); int[] firstPixels = pixels(first), secondPixels = pixels(second);
        return image(parent, first.width, first.height, RasterCrossfade2D.mix(first.width, first.height, firstPixels, secondPixels, weights).pixels(), count);
    }

    private static int matching(PImage first, PImage second) { int count = imageCount(first); if (imageCount(second) != count || first.width != second.width || first.height != second.height) throw new IllegalArgumentException("Mismatched images"); return count; }
    private static int imageCount(PImage image) { if (image == null || (image.format != PApplet.RGB && image.format != PApplet.ARGB) || image.width < 1 || image.height < 1 || image.pixelDensity != 1 || image.pixelWidth != image.width || image.pixelHeight != image.height || (long) image.width * image.height > Integer.MAX_VALUE) throw new IllegalArgumentException("Invalid image"); return image.width * image.height; }
    private static int[] pixels(PImage image) { int count = imageCount(image); image.loadPixels(); if (image.pixels == null || image.pixels.length != count) throw new IllegalArgumentException("Invalid image pixels"); int[] result = image.pixels.clone(); if (image.format == PApplet.RGB) for (int i = 0; i < count; i++) result[i] |= 0xff000000; return result; }
    private static PImage image(PApplet parent, int width, int height, int[] pixels, int count) { PImage result = parent.createImage(width, height, PApplet.ARGB); result.loadPixels(); System.arraycopy(pixels, 0, result.pixels, 0, count); result.updatePixels(); return result; }
    private static void release(PGraphicsJava2D target, Throwable primary) { Throwable cleanup = null; try { if (target.g2 != null) target.g2.dispose(); } catch (RuntimeException | Error error) { cleanup = error; } try { if (target.image != null) target.image.flush(); } catch (RuntimeException | Error error) { if (cleanup == null) cleanup = error; else cleanup.addSuppressed(error); } target.g2 = null; target.image = null; target.pixels = null; try { target.dispose(); } catch (RuntimeException | Error error) { if (cleanup == null) cleanup = error; else cleanup.addSuppressed(error); } if (cleanup != null) { if (primary != null) primary.addSuppressed(cleanup); else if (cleanup instanceof RuntimeException) throw (RuntimeException) cleanup; else throw (Error) cleanup; } }
}
