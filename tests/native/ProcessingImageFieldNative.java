import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.layout.RegularGrid;
import org.procedurals.processing.ProcessingImageField;
import org.procedurals.raster.RasterRemap2D;
import processing.core.PApplet;
import processing.core.PImage;

/** Focused native PImage scenarios for ProcessingImageField. */
public final class ProcessingImageFieldNative {
    private interface Action { void run(); }
    private static final class MalformedPixelsImage extends PImage {
        MalformedPixelsImage() { super(1, 1, PApplet.ARGB); }
        @Override public void loadPixels() { pixels = new int[0]; }
    }
    private static void require(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static void invalid(Action action) {
        try { action.run(); throw new AssertionError("missing invalid input"); }
        catch (IllegalArgumentException expected) { }
    }
    private static void index(Action action) {
        try { action.run(); throw new AssertionError("missing bad index"); }
        catch (IndexOutOfBoundsException expected) { }
    }
    private static PImage image(int width, int height, int format, int... pixels) {
        PImage result = new PImage(width, height, format);
        result.loadPixels(); System.arraycopy(pixels, 0, result.pixels, 0, pixels.length); result.updatePixels();
        return result;
    }
    private static void asymmetricClamp() {
        PImage source = image(2, 2, PApplet.ARGB, 0x10203040, 0x50607080, 0x90a0b0c0, 0xd0e0f000);
        ProcessingImageField field = ProcessingImageField.snapshot(source);
        ProcessingImageField.Samples samples = field.sample(new double[] {0, 0, 1, 0, 0, 1, 1, 1, -5, 4, 8, -9});
        int[] expected = {0x10203040, 0x50607080, 0x90a0b0c0, 0xd0e0f000, 0x90a0b0c0, 0x50607080};
        require(field.width() == 2 && field.height() == 2 && samples.size() == expected.length, "asymmetric dimensions/count");
        for (int i = 0; i < expected.length; i++) require(samples.argb(i) == expected[i], "asymmetric/clamp sample " + i);
    }
    private static void fractionalParityAndScalars() {
        int[] varied = {0x20ff0000, 0x8000ff00, 0xc00000ff, 0x40ffffff};
        double[] queries = {.25, .75, .5, .5, 1.25, -.5};
        ProcessingImageField.Samples samples = ProcessingImageField.snapshot(image(2, 2, PApplet.ARGB, varied)).sample(queries);
        int[] remapped = RasterRemap2D.remap(2, 2, varied, 3, 1, queries).pixels();
        for (int i = 0; i < remapped.length; i++) require(samples.argb(i) == remapped[i], "fractional remap parity " + i);
        ProcessingImageField.Samples midpoint = ProcessingImageField.snapshot(image(2, 1, PApplet.ARGB, 0xffff0000, 0xff00ff00)).sample(new double[] {.5, 0});
        require(midpoint.argb(0) == 0xff808000, "red green midpoint quantization");
        require(midpoint.maxRgb01(0) == 128.0 / 255.0, "max of interpolated channels");
        ProcessingImageField.Samples transparentWhite = ProcessingImageField.snapshot(image(1, 1, PApplet.ARGB, 0x00ffffff)).sample(new double[] {0, 0});
        require(transparentWhite.alpha01(0) == 0.0 && transparentWhite.maxRgb01(0) == 1.0, "hidden white scalar separation");
        ProcessingImageField.Samples rgb = ProcessingImageField.snapshot(image(1, 1, PApplet.RGB, 0x00112233)).sample(new double[] {0, 0});
        require(rgb.argb(0) == 0xff112233 && rgb.alpha01(0) == 1.0, "RGB becomes opaque");
    }
    private static void ownershipAndReuse() {
        PImage source = image(2, 1, PApplet.ARGB, 0xff102030, 0xffa0b0c0);
        ProcessingImageField field = ProcessingImageField.snapshot(source);
        double[] firstQuery = {0, 0}; ProcessingImageField.Samples first = field.sample(firstQuery);
        source.loadPixels(); source.pixels[0] = 0xff000000; source.updatePixels(); firstQuery[0] = 1;
        ProcessingImageField.Samples second = field.sample(new double[] {1, 0});
        require(first.argb(0) == 0xff102030 && second.argb(0) == 0xffa0b0c0, "source/query ownership");
        require(first.argb(0) == 0xff102030, "previous samples survive later batch");
    }
    private static void invalidFormsAndIndexes() {
        invalid(() -> ProcessingImageField.snapshot(null));
        invalid(() -> ProcessingImageField.snapshot(image(1, 1, PApplet.ALPHA, 0)));
        PImage zeroWidth = image(1, 1, PApplet.ARGB, 0); zeroWidth.width = 0; invalid(() -> ProcessingImageField.snapshot(zeroWidth));
        PImage zeroHeight = image(1, 1, PApplet.ARGB, 0); zeroHeight.height = 0; invalid(() -> ProcessingImageField.snapshot(zeroHeight));
        PImage density = image(1, 1, PApplet.ARGB, 0); density.pixelDensity = 2; invalid(() -> ProcessingImageField.snapshot(density));
        PImage dimensions = image(1, 1, PApplet.ARGB, 0); dimensions.pixelWidth = 2; invalid(() -> ProcessingImageField.snapshot(dimensions));
        PImage pixelHeight = image(1, 1, PApplet.ARGB, 0); pixelHeight.pixelHeight = 2; invalid(() -> ProcessingImageField.snapshot(pixelHeight));
        PImage oversized = image(1, 1, PApplet.ARGB, 0); oversized.width = oversized.height = oversized.pixelWidth = oversized.pixelHeight = 50000; invalid(() -> ProcessingImageField.snapshot(oversized));
        invalid(() -> ProcessingImageField.snapshot(new MalformedPixelsImage()));
        ProcessingImageField field = ProcessingImageField.snapshot(image(1, 1, PApplet.ARGB, 0xff000000));
        invalid(() -> field.sample(null)); invalid(() -> field.sample(new double[] {0}));
        invalid(() -> field.sample(new double[] {Double.NaN, 0})); invalid(() -> field.sample(new double[] {0, Double.POSITIVE_INFINITY}));
        ProcessingImageField.Samples empty = field.sample(new double[0]); require(empty.size() == 0, "empty sample");
        ProcessingImageField.Samples one = field.sample(new double[] {0, 0}); index(() -> one.argb(-1)); index(() -> one.alpha01(1)); index(() -> one.maxRgb01(1));
    }
    private static void gridConsumers() {
        PImage source = image(3, 2, PApplet.ARGB,
            0xff000000, 0xff800000, 0x00ffffff,
            0xff00ff00, 0xff0000ff, 0xff202020);
        Map<String, Object> input = new LinkedHashMap<String, Object>();
        input.put("origin", Arrays.<Object>asList(0.0, 0.0)); input.put("spacing", Arrays.<Object>asList(1.0, 1.0)); input.put("columns", 3); input.put("rows", 2);
        RegularGrid grid = RegularGrid.create(input); double[] positions = new double[(int) grid.size() * 2];
        for (long i = 0; i < grid.size(); i++) grid.pointInto(i, positions, (int) i * 2);
        ProcessingImageField.Samples samples = ProcessingImageField.snapshot(source).sample(positions);
        double[] sizes = new double[samples.size()]; boolean[] visible = new boolean[samples.size()];
        for (int i = 0; i < samples.size(); i++) { sizes[i] = 2.0 + 8.0 * samples.maxRgb01(i); visible[i] = samples.alpha01(i) > 0.0; }
        require(Arrays.equals(positions, new double[] {0,0,1,0,2,0,0,1,1,1,2,1}), "RegularGrid source positions");
        require(Arrays.equals(sizes, new double[] {2, 2 + 8 * (128.0 / 255.0), 10, 10, 10, 2 + 8 * (32.0 / 255.0)}), "grid maxRgb size consumer");
        require(Arrays.equals(visible, new boolean[] {true, true, false, true, true, true}), "grid alpha visibility consumer");
    }
    public static void main(String[] args) {
        asymmetricClamp(); fractionalParityAndScalars(); ownershipAndReuse(); invalidFormsAndIndexes(); gridConsumers();
        System.out.println("{\"status\":\"passed\",\"scenarios\":[\"asymmetric-clamp\",\"fractional-remap-parity\",\"scalar-separation\",\"ownership-reuse\",\"invalid-and-indexes\",\"regular-grid-consumers\"]}");
    }
}
