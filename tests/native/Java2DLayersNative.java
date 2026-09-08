import java.util.Arrays;
import org.procedurals.processing.Java2DLayers;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;

/** Actual JAVA2D focused alpha transport and composition probe. */
public final class Java2DLayersNative extends PApplet {
    private static void ok(boolean value, String message) { if (!value) throw new AssertionError(message); }
    @Override public void settings() { size(720, 480, JAVA2D); pixelDensity(1); }
    @Override public void setup() { try { cases(); System.out.println("{\"status\":\"passed\"}"); exit(); System.exit(0); } catch (Throwable error) { error.printStackTrace(); exit(); System.exit(1); } }
    private PImage solid(int width, int height, int value) { PImage image = createImage(width, height, ARGB); image.loadPixels(); Arrays.fill(image.pixels, value); image.updatePixels(); return image; }
    private void cases() {
        ok(g instanceof PGraphicsJava2D && pixelDensity == 1, "environment");
        final int[] calls = {0}; PImage content = Java2DLayers.render(this, 8, 8, target -> { calls[0]++; target.noStroke(); target.fill(255, 0, 0); target.rect(0, 0, 8, 8); }); content.loadPixels(); ok(calls[0] == 1 && content.pixels[0] == 0xffff0000, "render once");
        PImage alpha = solid(3, 1, 0); alpha.loadPixels(); alpha.pixels[0] = 0x00000000; alpha.pixels[1] = 0x80000000; alpha.pixels[2] = 0xffffffff; alpha.updatePixels(); double[] values = Java2DLayers.alphaMask(alpha); ok(values[0] == 0 && values[1] == 128 / 255.0 && values[2] == 1, "explicit alpha"); values[1] = 0; ok(Java2DLayers.alphaMask(alpha)[1] == 128 / 255.0, "alpha array detached");
        PImage ellipse = Java2DLayers.render(this, 32, 32, target -> { target.noStroke(); target.fill(255); target.ellipse(16, 16, 20, 20); });
        double[] ellipseMask = Java2DLayers.alphaMask(ellipse); boolean ellipseEdge = false; for (double value : ellipseMask) if (value > 0 && value < 1) ellipseEdge = true; ok(ellipseMask[16 * 32 + 16] == 1 && ellipseMask[0] == 0 && ellipseEdge, "ellipse alpha transport");
        PImage triangle = Java2DLayers.render(this, 32, 32, target -> { target.noStroke(); target.fill(255, 0, 0, 128); target.triangle(4, 28, 28, 28, 16, 4); });
        double[] triangleMask = Java2DLayers.alphaMask(triangle); boolean triangleEdge = false; for (double value : triangleMask) if (value > 0 && value < 128 / 255.0) triangleEdge = true; ok(triangleMask[20 * 32 + 16] == 128 / 255.0 && triangleMask[0] == 0 && triangleEdge, "half alpha triangle transport");
        PImage black = solid(1, 1, 0xff000000), white = solid(1, 1, 0xffffffff); ok(Java2DLayers.alphaMask(black)[0] == 1 && Java2DLayers.alphaMask(white)[0] == 1, "rgb ignored");
        PImage blue = solid(1, 1, 0xff0000ff), red = solid(1, 1, 0xffff0000); double[] shared = {.5}; PImage composite = Java2DLayers.composite(this, red, blue, shared); PImage fade = Java2DLayers.crossfade(this, blue, red, shared); composite.loadPixels(); fade.loadPixels(); ok(composite.pixels[0] == 0xff800080 && fade.pixels[0] == 0xff800080, "shared transport/arithmetic"); composite.pixels[0] = 0; composite.updatePixels(); ok(red.pixels[0] == 0xffff0000 && blue.pixels[0] == 0xff0000ff, "result detached from inputs");
        int blueRaw = blue.pixels[0]; final IllegalStateException sentinel = new IllegalStateException("boom"); try { Java2DLayers.render(this, 1, 1, target -> { throw sentinel; }); throw new AssertionError("error swallowed"); } catch (IllegalStateException expected) { ok(expected == sentinel, "error identity"); } PImage recovered = Java2DLayers.composite(this, red, blue, new double[] {0}); recovered.loadPixels(); ok(recovered.pixels[0] == 0xff0000ff && blue.pixels[0] == blueRaw, "input immutable/recovery");
        PImage rgb = createImage(1, 1, RGB); rgb.loadPixels(); rgb.pixels[0] = 0x00ff0000; rgb.updatePixels(); PImage transparent = solid(1, 1, 0x00ff0000); ok(Java2DLayers.alphaMask(rgb)[0] == 1 && Java2DLayers.alphaMask(transparent)[0] == 0, "RGB alpha normalization"); PImage rgbMix = Java2DLayers.composite(this, rgb, blue, new double[] {1}); rgbMix.loadPixels(); ok(rgbMix.pixels[0] == 0xffff0000 && rgb.pixels[0] == 0x00ff0000, "RGB opaque detached transport");
        try { Java2DLayers.render(this, 0, 1, target -> calls[0]++); throw new AssertionError("invalid render"); } catch (IllegalArgumentException expected) { ok(calls[0] == 1, "invalid before callback"); }
        try { Java2DLayers.composite(this, red, solid(2, 1, 0), new double[] {0}); throw new AssertionError("dimension mismatch"); } catch (IllegalArgumentException expected) { }
        try { Java2DLayers.composite(this, red, blue, new double[] {}); throw new AssertionError("mask count"); } catch (IllegalArgumentException expected) { }
        try { Java2DLayers.crossfade(this, red, blue, new double[] {Double.NaN}); throw new AssertionError("nonfinite"); } catch (IllegalArgumentException expected) { }
        PImage density = solid(1, 1, 0); density.pixelDensity = 2; try { Java2DLayers.alphaMask(density); throw new AssertionError("density two"); } catch (IllegalArgumentException expected) { }
        measure();
    }
    private void measure() { PImage a = solid(720,480,0xffff0000), b = solid(720,480,0xff0000ff); double[] weights = new double[720*480]; Arrays.fill(weights,.5); for(int i=0;i<2;i++) Java2DLayers.crossfade(this,a,b,weights); long t=System.nanoTime(); PImage result=null; for(int i=0;i<2;i++) result=Java2DLayers.crossfade(this,a,b,weights); long elapsed=System.nanoTime()-t; result.loadPixels(); long sum=0; for(int pixel:result.pixels){ok(pixel==0xff800080,"image-sized expected pixel");sum=sum*31+Integer.toUnsignedLong(pixel);} System.out.println("{\"measurement\":{\"width\":720,\"height\":480,\"warmups\":2,\"repetitions\":2,\"elapsed_ns\":"+elapsed+",\"checksum\":\""+Long.toUnsignedString(sum)+"\"}}"); }
    public static void main(String[] args) { PApplet.runSketch(new String[] {Java2DLayersNative.class.getName()}, new Java2DLayersNative()); }
}
