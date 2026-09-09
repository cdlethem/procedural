import java.util.Arrays;
import org.procedurals.raster.MaskedComposite2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PGraphics;

/** Private mask-boundary experiment, not a packaged/public API. Native alpha coverage
 * is deliberately distinct from analytic pixel-center shape membership. */
public final class MaskContentStudy {
    interface Drawing { void draw(PGraphics graphics); }

    static double[] alphaMask(PApplet parent, int width, int height, Drawing drawing) {
        PGraphicsJava2D graphics = new PGraphicsJava2D();
        try {
            graphics.setParent(parent);
            graphics.setPrimary(false);
            graphics.pixelDensity = 1;
            graphics.setSize(width, height);
            graphics.beginDraw();
            graphics.clear();
            drawing.draw(graphics);
            graphics.endDraw();
            graphics.loadPixels();
            double[] values = new double[width * height];
            for (int i = 0; i < values.length; i++) values[i] = (graphics.pixels[i] >>> 24) / 255.0;
            return values;
        } finally {
            if (graphics.g2 != null) graphics.g2.dispose();
            if (graphics.image != null) graphics.image.flush();
            graphics.g2 = null;
            graphics.image = null;
            graphics.pixels = null;
            graphics.dispose();
        }
    }

    public static void main(String[] args) {
        PApplet parent = new PApplet();
        int width = 32, height = 32;
        double[] ellipse = alphaMask(parent, width, height, g -> {
            g.noStroke(); g.fill(255); g.ellipse(16, 16, 20, 12);
        });
        double[] triangle = alphaMask(parent, width, height, g -> {
            g.noStroke(); g.fill(0, 128); g.triangle(4, 4, 28, 4, 16, 28);
        });
        // Alpha is visibility. Opaque black masks reveal, just as opaque white masks do.
        if (ellipse[16 * width + 16] != 1 || ellipse[0] != 0)
            throw new AssertionError("ellipse interior/exterior");
        if (triangle[10 * width + 16] != 128 / 255.0 || triangle[0] != 0)
            throw new AssertionError("triangle alpha rather than luminance");
        int[] source = new int[width * height], destination = new int[source.length];
        Arrays.fill(source, 0xffff0000); Arrays.fill(destination, 0xff0000ff);
        int[] output = MaskedComposite2D.compose(width, height, source, destination, triangle).pixels();
        if (output[10 * width + 16] != 0xff80007f || output[0] != 0xff0000ff)
            throw new AssertionError("mask/compositor interoperability");
        int fractional = 0;
        for (double value : ellipse) if (value > 0 && value < 1) fractional++;
        System.out.println("{\"status\":\"passed\",\"ellipse_fractional_coverage_pixels\":"
            + fractional + ",\"scope\":\"private native alpha mask, not analytic geometry membership\"}");
    }
}
