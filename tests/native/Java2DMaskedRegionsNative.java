import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.procedurals.processing.Java2DRegions;
import org.procedurals.processing.Java2DRegions.MaskedRegion;
import org.procedurals.processing.Java2DRegions.Region;
import org.procedurals.processing.Java2DRegions.Space;
import processing.core.PApplet;
import processing.core.PImage;

/** Root-authored actual-runtime tests; no acceptance claim from compilation alone. */
public final class Java2DMaskedRegionsNative extends PApplet {
    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    private static void invalid(Runnable action) {
        try { action.run(); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("Invalid input accepted");
    }
    @Override public void settings() { size(64, 64, JAVA2D); pixelDensity(1); }
    @Override public void setup() {
        try { cases(); System.out.println("{\"status\":\"passed\"}"); exit(); System.exit(0); }
        catch (Throwable error) { error.printStackTrace(); exit(); System.exit(1); }
    }
    private PImage blue(int w, int h) {
        PImage image = createImage(w, h, ARGB); image.loadPixels();
        Arrays.fill(image.pixels, 0xff0000ff); image.updatePixels(); return image;
    }
    private void cases() {
        PImage destination = blue(8, 8);
        int[] original = destination.pixels.clone();
        Region frame = new Region(7, 2, 2, 4, 4);
        double[] mask = new double[64];
        mask[0] = 1; mask[18] = 1; mask[27] = 0.25; mask[63] = 1;
        MaskedRegion captured = new MaskedRegion(frame, 8, 8, mask);
        Arrays.fill(mask, Double.NaN);
        Java2DRegions.Content red = (target, region) -> target.background(255, 0, 0);
        PImage result = Java2DRegions.renderMasked(this, destination, Arrays.asList(captured), Space.CANVAS, red);
        result.loadPixels();
        for (int i = 0; i < 64; i++) {
            int expected = i == 0 || i == 18 || i == 63 ? 0xffff0000 : i == 27 ? 0xff4000bf : 0xff0000ff;
            require(result.pixels[i] == expected, "captured disconnected mask/hole/quarter/frame " + i);
        }
        require(Arrays.equals(original, destination.pixels), "destination unchanged");
        double[] solid = new double[64]; Arrays.fill(solid, 1);
        MaskedRegion all = new MaskedRegion(frame, 8, 8, solid);
        Java2DRegions.Content square = (target, region) -> {
            require(region == frame, "same immutable frame");
            target.noStroke(); target.fill(0, 255, 0); target.rect(0, 0, 1, 1);
        };
        PImage local = Java2DRegions.renderMasked(this, destination, Arrays.asList(all), Space.LOCAL, square);
        PImage canvas = Java2DRegions.renderMasked(this, destination, Arrays.asList(all), Space.CANVAS, square);
        local.loadPixels(); canvas.loadPixels();
        require(local.pixels[18] == 0xff00ff00 && local.pixels[0] == 0xff0000ff, "local origin");
        require(canvas.pixels[0] == 0xff00ff00 && canvas.pixels[18] == 0xff0000ff, "canvas origin");
        double[] quarter = new double[64]; Arrays.fill(quarter, 0.25);
        MaskedRegion second = new MaskedRegion(new Region(8, -20, -20, -1, -1), 8, 8, quarter);
        MaskedRegion zero = new MaskedRegion(new Region(9, 0, 0, 1, 1), 8, 8, new double[64]);
        final List<Long> calls = new ArrayList<Long>();
        final List<MaskedRegion> order = new ArrayList<MaskedRegion>(Arrays.asList(all, second, zero));
        PImage overlap = Java2DRegions.renderMasked(this, destination, order, Space.CANVAS, (target, region) -> {
            calls.add(region.id); order.clear();
            if (region.id == 7) target.background(255, 0, 0); else target.background(0, 255, 0);
        });
        overlap.loadPixels();
        require(calls.equals(Arrays.asList(7L, 8L, 9L)), "list snapshot/order/zero callback");
        for (int pixel : overlap.pixels) require(pixel == 0xffbf4000, "ordered source over");
        final int[] invalidCalls = {0};
        Java2DRegions.Content count = (target, region) -> invalidCalls[0]++;
        invalid(() -> Java2DRegions.renderMasked(this, destination, Arrays.asList(all, all), Space.CANVAS, count));
        invalid(() -> Java2DRegions.renderMasked(this, destination, Arrays.asList(all, null), Space.CANVAS, count));
        MaskedRegion wrongShape = new MaskedRegion(new Region(10, 0, 0, 1, 1), 4, 16, solid);
        invalid(() -> Java2DRegions.renderMasked(this, destination, Arrays.asList(all, wrongShape), Space.CANVAS, count));
        MaskedRegion distant = new MaskedRegion(new Region(11, 1e100, 0, 2e100, 1), 8, 8, solid);
        invalid(() -> Java2DRegions.renderMasked(this, destination, Arrays.asList(all, distant), Space.LOCAL, count));
        require(invalidCalls[0] == 0, "all preflight before callbacks");
        invalid(() -> new MaskedRegion(null, 8, 8, solid));
        invalid(() -> new MaskedRegion(frame, 0, 8, solid));
        invalid(() -> new MaskedRegion(frame, Integer.MAX_VALUE, 2, solid));
        invalid(() -> new MaskedRegion(frame, 8, 8, new double[63]));
        invalid(() -> new MaskedRegion(frame, 8, 8, null));
        for (double value : new double[] {Double.NaN, Double.POSITIVE_INFINITY, -0.01, 1.01}) {
            double[] bad = solid.clone(); bad[63] = value;
            invalid(() -> new MaskedRegion(frame, 8, 8, bad));
        }
        final IllegalStateException boom = new IllegalStateException("callback sentinel");
        try {
            Java2DRegions.renderMasked(this, destination, Arrays.asList(all, second), Space.CANVAS,
                (target, region) -> { if (region.id == 8) throw boom; target.background(255); });
            throw new AssertionError("swallowed callback");
        } catch (IllegalStateException actual) { require(actual == boom, "exception identity"); }
        PImage recovery = Java2DRegions.renderMasked(this, destination, Arrays.asList(captured), Space.CANVAS, red);
        recovery.loadPixels(); require(Arrays.equals(result.pixels, recovery.pixels), "recovery");
        require(Arrays.equals(original, destination.pixels), "failure destination unchanged");
        PImage rgb = createImage(1, 1, RGB); rgb.loadPixels(); rgb.pixels[0] = 0x00123456; rgb.updatePixels();
        PImage empty = Java2DRegions.renderMasked(this, rgb, new ArrayList<MaskedRegion>(), Space.CANVAS, count);
        empty.loadPixels(); require(empty != rgb && empty.pixels[0] == 0xff123456 && rgb.pixels[0] == 0x00123456, "RGB empty detached");
        measure(8, 8, 1); measure(720, 480, 4); measure(720, 480, 12);
    }
    private void measure(int w, int h, int n) {
        PImage destination = blue(w, h);
        List<MaskedRegion> regions = new ArrayList<MaskedRegion>();
        for (int k = 0; k < n; k++) {
            double[] coverage = new double[w*h]; Arrays.fill(coverage, 1);
            regions.add(new MaskedRegion(new Region(k, 0, 0, w, h), w, h, coverage));
        }
        Java2DRegions.Content fill = (target, region) -> target.background(255, 80, 20);
        for (int i = 0; i < 2; i++) Java2DRegions.renderMasked(this, destination, regions, Space.CANVAS, fill);
        long total = 0, checksum = 0;
        for (int i = 0; i < 3; i++) {
            long start = System.nanoTime();
            PImage image = Java2DRegions.renderMasked(this, destination, regions, Space.CANVAS, fill);
            total += System.nanoTime() - start; image.loadPixels(); checksum = 0;
            for (int pixel : image.pixels) { require(pixel == 0xffff5014, "measurement pixels"); checksum = checksum * 31 + Integer.toUnsignedLong(pixel); }
        }
        System.out.println("{\"measurement\":{\"width\":" + w + ",\"height\":" + h + ",\"regions\":" + n
            + ",\"warmups\":2,\"repetitions\":3,\"total_ns\":" + total + ",\"retained_mask_payload_bytes\":" + (8L*w*h*n)
            + ",\"checksum\":\"" + Long.toUnsignedString(checksum) + "\"}}");
    }
    public static void main(String[] args) { PApplet.runSketch(new String[] {Java2DMaskedRegionsNative.class.getName()}, new Java2DMaskedRegionsNative()); }
}
