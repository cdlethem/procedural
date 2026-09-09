package org.procedurals.processing;

import processing.core.PApplet;
import processing.core.PImage;

/**
 * Pinned JAVA2D image placement convenience. Provenance: survey/out/2017/Generativos/Eyes/
 * eyes002/notes.md and survey/out/2017/Generativos/terrainCollage/notes.md; crop fitting is
 * project design, not source recreation or portable resampling semantics.
 */
public final class Java2DImagePlacement {
    private Java2DImagePlacement() { }
    /** Maps the explicit crop to the explicit frame. */
    public enum Fit { CONTAIN, COVER, STRETCH }
    public static final class Crop {
        public final int x, y, width, height;
        public Crop(int x, int y, int width, int height) {
            if (x < 0 || y < 0 || width < 1 || height < 1) throw new IllegalArgumentException("Invalid crop");
            this.x = x; this.y = y; this.width = width; this.height = height;
        }
    }
    public static final class Frame {
        public final int x, y, width, height;
        public Frame(int x, int y, int width, int height) {
            if (width < 1 || height < 1) throw new IllegalArgumentException("Invalid frame");
            this.x = x; this.y = y; this.width = width; this.height = height;
        }
    }
    public static PImage render(PApplet parent, PImage source, Crop crop, int canvasWidth, int canvasHeight, Frame frame, Fit fit, double alignX, double alignY) {
        if (parent == null || source == null || crop == null || frame == null || fit == null || canvasWidth < 1 || canvasHeight < 1 || (long)canvasWidth*canvasHeight > Integer.MAX_VALUE || !finite(alignX) || !finite(alignY) || alignX < 0 || alignX > 1 || alignY < 0 || alignY > 1) throw new IllegalArgumentException("Invalid placement input");
        int count = sourceCount(source); if ((long)crop.x+crop.width > source.width || (long)crop.y+crop.height > source.height) throw new IllegalArgumentException("Crop outside source");
        source.loadPixels(); if (source.pixels == null || source.pixels.length != count) throw new IllegalArgumentException("Invalid source pixels");
        PImage isolated = parent.createImage(crop.width, crop.height, PApplet.ARGB); isolated.loadPixels();
        for (int row = 0; row < crop.height; row++) for (int col = 0; col < crop.width; col++) {
            int value = source.pixels[(crop.y + row) * source.width + crop.x + col];
            isolated.pixels[row * crop.width + col] = source.format == PApplet.RGB ? value | 0xff000000 : value;
        }
        isolated.updatePixels();
        double w = frame.width, h = frame.height;
        if (fit != Fit.STRETCH) { double sx = (double) frame.width / crop.width, sy = (double) frame.height / crop.height; double s = fit == Fit.CONTAIN ? Math.min(sx, sy) : Math.max(sx, sy); w = crop.width * s; h = crop.height * s; }
        final float dx=(float)(frame.x+(frame.width-w)*alignX),dy=(float)(frame.y+(frame.height-h)*alignY),dw=(float)w,dh=(float)h;
        return Java2DLayers.render(parent,canvasWidth,canvasHeight,target->{target.imageMode(PApplet.CORNER);target.clip(frame.x,frame.y,frame.width,frame.height);target.image(isolated,dx,dy,dw,dh);});
    }
    private static int sourceCount(PImage source){if((source.format!=PApplet.RGB&&source.format!=PApplet.ARGB)||source.width<1||source.height<1||source.pixelDensity!=1||source.pixelWidth!=source.width||source.pixelHeight!=source.height||(long)source.width*source.height>Integer.MAX_VALUE)throw new IllegalArgumentException("Invalid source");return source.width*source.height;}
    private static boolean finite(double value){return !Double.isNaN(value)&&!Double.isInfinite(value);}
}
