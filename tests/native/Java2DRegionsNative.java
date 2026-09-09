import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.procedurals.processing.Java2DRegions;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;

/** Actual density-one JAVA2D scenarios for Java2DRegions. */
public final class Java2DRegionsNative extends PApplet {
    private static void require(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private PImage destination;
    @Override public void settings() { size(720, 480, JAVA2D); pixelDensity(1); }
    @Override public void setup() {
        try { runCases(); System.out.println("{\"status\":\"passed\"}"); exit(); System.exit(0); }
        catch (Throwable error) { error.printStackTrace(); exit(); System.exit(1); }
    }
    private void runCases() {
        require(g instanceof PGraphicsJava2D && pixelDensity == 1, "JAVA2D density one");
        destination = createImage(64, 64, ARGB); destination.loadPixels(); Arrays.fill(destination.pixels, 0xff0000ff); destination.updatePixels();
        Java2DRegions.Region region = new Java2DRegions.Region(1, 8, 8, 24, 24);
        List<Java2DRegions.Region> one = Arrays.asList(region);
        final List<Long> order = new ArrayList<Long>();
        PImage local = Java2DRegions.render(this, destination, one, Java2DRegions.Space.LOCAL, 0, (target, value) -> {
            order.add(Long.valueOf(value.id)); target.noStroke(); target.fill(255, 0, 0); target.rect(0, 0, 16, 16);
        });
        local.loadPixels(); require(order.equals(Arrays.asList(1L)), "local once/order"); require(local.pixels[8 * 64 + 8] == 0xffff0000 && local.pixels[0] == 0xff0000ff, "local hard mask");
        PImage canvas = Java2DRegions.render(this, destination, one, Java2DRegions.Space.CANVAS, 0, (target, value) -> { target.noStroke(); target.fill(0, 255, 0); target.rect(8, 8, 16, 16); });
        canvas.loadPixels(); require(canvas.pixels[8 * 64 + 8] == 0xff00ff00, "canvas origin");
        PImage feather = Java2DRegions.render(this, destination, one, Java2DRegions.Space.LOCAL, 4, (target, value) -> { target.noStroke(); target.fill(255, 0, 0); target.rect(0, 0, 16, 16); });
        feather.loadPixels(); require(feather.pixels[8 * 64 + 8] == 0xff2000df, "pixel-center feather");
        PImage snippet = createImage(4, 4, ARGB); snippet.loadPixels(); Arrays.fill(snippet.pixels, 0xffffff00); snippet.updatePixels();
        PImage image = Java2DRegions.render(this, destination, one, Java2DRegions.Space.LOCAL, 0, (target, value) -> target.image(snippet, 2, 2));
        image.loadPixels(); require(image.pixels[10 * 64 + 10] == 0xffffff00, "image transfer");
        Java2DRegions.Region off = new Java2DRegions.Region(2, -20, -20, -1, -1); order.clear();
        Java2DRegions.render(this, destination, Arrays.asList(region, off), Java2DRegions.Space.CANVAS, 0, (target, value) -> order.add(Long.valueOf(value.id)));
        require(order.equals(Arrays.asList(1L, 2L)), "offcanvas once/order");
        PImage empty = Java2DRegions.render(this, destination, new ArrayList<Java2DRegions.Region>(), Java2DRegions.Space.CANVAS, 0, (target, value) -> { });
        empty.loadPixels(); require(Arrays.equals(empty.pixels, destination.pixels) && empty != destination, "empty detached");
        int[] before = destination.pixels.clone(); final int[] calls = {0};
        try { Java2DRegions.render(this, destination, Arrays.asList(region, region), Java2DRegions.Space.CANVAS, 0, (target, value) -> calls[0]++); throw new AssertionError("duplicate accepted"); }
        catch (IllegalArgumentException expected) { require(calls[0] == 0, "duplicate before callback"); }
        try { Java2DRegions.render(this, destination, one, Java2DRegions.Space.CANVAS, Double.NaN, (target, value) -> calls[0]++); throw new AssertionError("nan accepted"); }
        catch (IllegalArgumentException expected) { require(calls[0] == 0, "invalid before callback"); }
        try { Java2DRegions.render(this, destination, one, Java2DRegions.Space.CANVAS, 0, (target, value) -> { throw new IllegalStateException("boom"); }); throw new AssertionError("callback swallowed"); }
        catch (IllegalStateException expected) { require("boom".equals(expected.getMessage()), "callback identity"); }
        require(Arrays.equals(before, destination.pixels), "failure/source immutability");
        PImage recovery = Java2DRegions.render(this, destination, one, Java2DRegions.Space.LOCAL, 0, (target, value) -> { target.noStroke(); target.fill(255, 0, 0); target.rect(0, 0, 16, 16); });
        recovery.loadPixels(); require(Arrays.equals(local.pixels, recovery.pixels), "recovery equality");
        measure();
        PImage rgb = createImage(1, 1, RGB);
        rgb.loadPixels(); rgb.pixels[0] = 0x00ff0000; rgb.updatePixels();
        PImage normalized = Java2DRegions.render(this, rgb, new ArrayList<Java2DRegions.Region>(),
                Java2DRegions.Space.CANVAS, 0, (target, value) -> { });
        normalized.loadPixels();
        require(normalized.pixels[0] == 0xffff0000 && rgb.pixels[0] == 0x00ff0000,
                "RGB destination opaque without input mutation");
    }
    private void measure() {
        PImage large = createImage(720, 480, ARGB); large.loadPixels(); Arrays.fill(large.pixels, 0xff102030); large.updatePixels();
        List<Java2DRegions.Region> four = Arrays.asList(new Java2DRegions.Region(10, 0, 0, 360, 240), new Java2DRegions.Region(11, 360, 0, 720, 240), new Java2DRegions.Region(12, 0, 240, 360, 480), new Java2DRegions.Region(13, 360, 240, 720, 480));
        Java2DRegions.Content fill = (target, region) -> { target.noStroke(); target.fill(255, 80, 20); target.rect((float) region.left, (float) region.top, (float) (region.right - region.left), (float) (region.bottom - region.top)); };
        for (int i = 0; i < 2; i++) Java2DRegions.render(this, large, four, Java2DRegions.Space.CANVAS, 0, fill);
        long start = System.nanoTime(); PImage result = Java2DRegions.render(this, large, four, Java2DRegions.Space.CANVAS, 0, fill); long elapsed = System.nanoTime() - start;
        result.loadPixels(); long checksum = 0; for (int pixel : result.pixels) {
            require(pixel == 0xffff5014, "four-region exact coverage");
            checksum = checksum * 31 + Integer.toUnsignedLong(pixel);
        }
        require(checksum != 0 && elapsed >= 0, "four-region measurement");
        System.out.println("{\"measurement\":{\"regions\":4,\"width\":720,\"height\":480,\"warmups\":2,\"repetitions\":1,\"elapsed_ns\":" + elapsed + ",\"checksum\":\"" + Long.toUnsignedString(checksum) + "\"}}");
    }
    public static void main(String[] args) { PApplet.runSketch(new String[] { Java2DRegionsNative.class.getName() }, new Java2DRegionsNative()); }
}
