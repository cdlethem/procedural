import java.util.Arrays;
import org.procedurals.processing.ProcessingImageFilters;
import org.procedurals.raster.SeparableBlur2D;
import processing.core.PApplet;
import processing.core.PImage;

/** Focused real-PImage transport checks; independent numerical vectors belong to the core. */
public final class ProcessingImageFiltersNative {
    private static final PApplet PARENT = new PApplet();
    private static final double[] DELTA = {1};
    private static final double[] TRIANGLE = {1, 2, 1};
    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static PImage image(int format, int... pixels) {
        PImage result = new PImage(pixels.length, 1, format);
        result.loadPixels();
        System.arraycopy(pixels, 0, result.pixels, 0, pixels.length);
        result.updatePixels();
        return result;
    }
    private static void invalid(Runnable action) {
        try { action.run(); throw new AssertionError("Expected invalid transport"); }
        catch (IllegalArgumentException expected) { }
    }
    private static final class BadPixels extends PImage {
        BadPixels() { super(1, 1, PApplet.ARGB); }
        @Override public void loadPixels() { pixels = new int[0]; }
    }
    public static void main(String[] args) {
        int[] bits = {0x00ff0000, 0x800000ff, 0xff208040};
        PImage source = image(PApplet.ARGB, bits);
        double[] kernel = TRIANGLE.clone();
        PImage result = ProcessingImageFilters.separableBlur(PARENT, source, kernel, DELTA, 12);
        int[] expected = SeparableBlur2D.blur(3, 1, bits, TRIANGLE, DELTA, 12).pixels();
        result.loadPixels();
        require(Arrays.equals(result.pixels, expected), "ARGB/core parity");
        require(result.width == 3 && result.height == 1 && result.format == PApplet.ARGB
                && result.pixelDensity == 1, "output metadata");
        require(Arrays.equals(source.pixels, bits), "source changed during filter");
        source.pixels[0] = 0xffabcdef; kernel[0] = 999;
        require(Arrays.equals(result.pixels, expected), "result aliases inputs");
        result.pixels[0] = 0;
        require(source.pixels[0] == 0xffabcdef, "output mutation changed source");

        PImage rgb = image(PApplet.RGB, 0x00112233, 0x80445566);
        PImage opaque = ProcessingImageFilters.separableBlur(PARENT, rgb, DELTA, DELTA, 4);
        opaque.loadPixels();
        require(Arrays.equals(opaque.pixels, new int[] {0xff112233, 0xff445566}), "RGB opacity");
        require(Arrays.equals(rgb.pixels, new int[] {0x00112233, 0x80445566}), "RGB input changed");
        PImage hidden = image(PApplet.ARGB, 0x00123456);
        PImage identity = ProcessingImageFilters.separableBlur(PARENT, hidden, DELTA, DELTA, 2);
        identity.loadPixels();
        require(identity != hidden && identity.pixels != hidden.pixels
                && identity.pixels[0] == 0x00123456, "identity ownership and hidden RGB");

        invalid(() -> ProcessingImageFilters.separableBlur(null, hidden, DELTA, DELTA, 2));
        invalid(() -> ProcessingImageFilters.separableBlur(PARENT, null, DELTA, DELTA, 2));
        invalid(() -> ProcessingImageFilters.separableBlur(PARENT, image(PApplet.ALPHA, 0), DELTA, DELTA, 2));
        PImage dense = image(PApplet.ARGB, 0); dense.pixelDensity = 2;
        invalid(() -> ProcessingImageFilters.separableBlur(PARENT, dense, DELTA, DELTA, 2));
        PImage mismatch = image(PApplet.ARGB, 0); mismatch.pixelWidth = 2;
        invalid(() -> ProcessingImageFilters.separableBlur(PARENT, mismatch, DELTA, DELTA, 2));
        invalid(() -> ProcessingImageFilters.separableBlur(PARENT, new BadPixels(), DELTA, DELTA, 2));
        try {
            ProcessingImageFilters.separableBlur(PARENT, hidden, DELTA, DELTA, 1);
            throw new AssertionError("Missing delegated work limit");
        } catch (IllegalArgumentException expectedError) {
            require(expectedError.getMessage().equals("WORK_LIMIT"), "delegated error changed");
        }
        System.out.println("ProcessingImageFilters native transport passed: parity, ownership, RGB/ARGB, rejection and budget");
    }
}
