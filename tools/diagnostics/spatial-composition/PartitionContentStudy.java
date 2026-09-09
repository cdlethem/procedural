import java.util.List;
import org.procedurals.layout.RetainedRectangles2D;
import org.procedurals.raster.MaskedComposite2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;

/** Private composition experiment, not a packaged adapter or accepted public API.
 * Each callback receives an isolated full-size transparent JAVA2D surface. Local mode
 * translates its origin to the leaf origin; global mode preserves canvas coordinates.
 * Inputs are unchanged on failure; completed output is an independently owned buffer.
 * This allocation-heavy reference study establishes semantics before optimization.
 */
final class PartitionContentStudy {
    interface Content {
        void draw(PGraphicsJava2D target, RetainedRectangles2D.Leaf region);
    }

    static int[] render(PApplet parent, int width, int height, int[] background,
                        List<RetainedRectangles2D.Leaf> regions, boolean local,
                        double feather, Content content) {
        if (parent == null || content == null || regions == null || width <= 0 || height <= 0
                || (long) width * height > Integer.MAX_VALUE || background == null
                || background.length != (long) width * height
                || !Double.isFinite(feather) || feather < 0)
            throw new IllegalArgumentException("Invalid study input");
        for (RetainedRectangles2D.Leaf region : regions) {
            if (region == null) throw new IllegalArgumentException("Null region");
        }
        // Snapshot order before calling artist code; no repeated evaluation or hidden RNG.
        RetainedRectangles2D.Leaf[] order = regions.toArray(new RetainedRectangles2D.Leaf[0]);
        int[] result = background.clone();
        double[] mask = new double[result.length];
        for (RetainedRectangles2D.Leaf region : order) {
            PGraphicsJava2D target = new PGraphicsJava2D();
            Throwable primary = null;
            try {
                target.setParent(parent);
                target.setPrimary(false);
                target.pixelDensity = 1;
                target.setSize(width, height);
                target.beginDraw();
                target.clear();
                if (local) target.translate((float) region.left, (float) region.top);
                content.draw(target, region);
                target.endDraw();
                target.loadPixels();
                for (int y = 0, i = 0; y < height; y++) {
                    for (int x = 0; x < width; x++, i++) {
                        double px = x + 0.5, py = y + 0.5;
                        if (px < region.left || px >= region.right
                                || py < region.top || py >= region.bottom) {
                            mask[i] = 0;
                        } else if (feather == 0) {
                            mask[i] = 1;
                        } else {
                            double distance = Math.min(Math.min(px - region.left, region.right - px),
                                    Math.min(py - region.top, region.bottom - py));
                            mask[i] = Math.min(1, distance / feather);
                        }
                    }
                }
                result = MaskedComposite2D.compose(width, height, target.pixels, result, mask).pixels();
            } catch (RuntimeException | Error failure) {
                primary = failure;
                throw failure;
            } finally {
                // Owned scratch only. Callback must neither dispose nor retain its borrowed target.
                Throwable cleanup = null;
                try { if (target.g2 != null) target.g2.dispose(); }
                catch (RuntimeException | Error failure) { cleanup = failure; }
                try { if (target.image != null) target.image.flush(); }
                catch (RuntimeException | Error failure) {
                    if (cleanup == null) cleanup = failure; else cleanup.addSuppressed(failure);
                }
                target.g2 = null;
                target.image = null;
                target.pixels = null;
                try { target.dispose(); }
                catch (RuntimeException | Error failure) {
                    if (cleanup == null) cleanup = failure; else cleanup.addSuppressed(failure);
                }
                if (cleanup != null) {
                    if (primary != null) primary.addSuppressed(cleanup);
                    else if (cleanup instanceof RuntimeException) throw (RuntimeException) cleanup;
                    else throw (Error) cleanup;
                }
            }
        }
        return result;
    }
}
