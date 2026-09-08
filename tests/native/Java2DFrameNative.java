import java.awt.geom.AffineTransform;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.StringJoiner;

import org.procedurals.internal.DrawingFrameState;
import org.procedurals.processing.internal.Java2DFrame;

import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;

/**
 * Registered JAVA2D probe groups 1-4 for drawing.fresh-raster-2d v0.1.0.
 * This runs real Processing JAVA2D adapter calls. It is deliberately not the
 * lifecycle fault-injection group, CP1 route, or a full-profile support claim.
 */
public final class Java2DFrameNative {
    private static Path imageDirectory;
    private static int imagesWritten;
    private static int minimumWidthCoveragePixels = -1;

    private interface Checked { void run() throws Exception; }

    private static Map<String,Object> map(Object... values) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        for (int index = 0; index < values.length; index += 2) result.put((String) values[index], values[index + 1]);
        return result;
    }

    private static List<Object> list(Object... values) {
        return new ArrayList<Object>(Arrays.asList(values));
    }

    private static Map<String,Object> environment(int width, int height, int background) {
        return map("width", width, "height", height, "density", 1, "background", background);
    }

    private static Map<String,Object> segment(double x1, double y1, double x2, double y2,
                                               int rgb, int opacity8, double width) {
        return map("kind", "segment2", "from", list(x1, y1), "to", list(x2, y2),
                   "rgb", rgb, "opacity8", opacity8, "width", width, "cap", "round");
    }

    private static Map<String,Object> quad(double x1, double y1, double x2, double y2,
                                            double x3, double y3, double x4, double y4,
                                            int rgb, int opacity8) {
        return map("kind", "quad2", "vertices", list(list(x1, y1), list(x2, y2), list(x3, y3), list(x4, y4)),
                   "rgb", rgb, "opacity8", opacity8);
    }

    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    private static PGraphicsJava2D render(PApplet parent, Map<String,Object> environment,
                                           List<Object> commands) {
        Java2DFrame frame = new Java2DFrame(parent);
        frame.begin(environment);
        frame.batch(commands);
        return frame.end();
    }

    private static void releaseTransferred(PGraphicsJava2D surface) {
        if (surface != null) Java2DFrame.releaseCompleted(surface);
    }

    private static void maybeSave(PGraphicsJava2D surface, String name) throws Exception {
        if (imageDirectory == null) return;
        Files.createDirectories(imageDirectory);
        Path destination = imageDirectory.resolve(name + ".png");
        check(surface.save(destination.toString()), "could not save " + destination);
        imagesWritten += 1;
    }

    private static int pixel(PGraphicsJava2D surface, int x, int y) {
        surface.loadPixels();
        return surface.pixels[y * surface.width + x];
    }

    private static int red(int pixel) { return (pixel >>> 16) & 255; }
    private static int green(int pixel) { return (pixel >>> 8) & 255; }
    private static int blue(int pixel) { return pixel & 255; }
    private static int alpha(int pixel) { return (pixel >>> 24) & 255; }
    private static boolean near(int actual, int expected, int tolerance) {
        return Math.abs(actual - expected) <= tolerance;
    }

    private static void expectFrameError(String code, Long commandIndex, Checked operation) throws Exception {
        try {
            operation.run();
            throw new AssertionError("expected " + code);
        } catch (DrawingFrameState.FrameError error) {
            check(code.equals(error.code), "error code " + error.code + " != " + code);
            check(commandIndex == null ? error.commandIndex == null : commandIndex.equals(error.commandIndex),
                  "command index mismatch");
        }
    }

    private static void groupBackgroundSizes() throws Exception {
        int background = 0x123456;
        int[][] sizes = { {1,1}, {640,640}, {1920,1080}, {2048,1}, {1,2048}, {2048,2048} };
        for (int[] size : sizes) {
            PGraphicsJava2D surface = render(new PApplet(), environment(size[0], size[1], background), list());
            try {
                check(surface.width == size[0] && surface.height == size[1], "logical dimensions");
                check(surface.pixelDensity == 1 && surface.pixelWidth == size[0] && surface.pixelHeight == size[1], "density/backing dimensions");
                check(surface.image != null && surface.image.getWidth(null) == size[0] && surface.image.getHeight(null) == size[1], "backing image");
                surface.loadPixels();
                check(surface.pixels.length == size[0] * size[1], "pixel count");
                int expected = 0xff000000 | background;
                for (int value : surface.pixels) check(value == expected, "background pixel");
            } finally { releaseTransferred(surface); }
        }
    }

    private static double previousFloat(double value) {
        return Float.intBitsToFloat(Float.floatToRawIntBits((float) value) - 1);
    }

    private static double nextFloat(double value) {
        return Float.intBitsToFloat(Float.floatToRawIntBits((float) value) + 1);
    }

    private static double moreNegativeFloat(double value) {
        return Float.intBitsToFloat(Float.floatToRawIntBits((float) value) + 1);
    }

    private static void groupBoundsClippingWidths() throws Exception {
        Map<String,Object> env = environment(64, 64, 0);
        List<Object> valid = list(
            segment(-64, 4, 128, 4, 0xffffff, 255, 1.0 / 256.0),
            segment(0, -64, 0, 128, 0xffffff, 255, 1),
            segment(previousFloat(-64), 8, previousFloat(128), 8, 0xffffff, 255, nextFloat(1.0 / 256.0)),
            segment(8, previousFloat(-64), 8, previousFloat(128), 0xffffff, 255, previousFloat(64)),
            quad(-64, 0, 0, -64, 128, 0, 0, 128, 0xffffff, 255),
            segment(32, 32, 33, 32, 0xffffff, 255, 64)
        );
        PGraphicsJava2D surface = render(new PApplet(), env, valid);
        try {
            check(pixel(surface, 32, 32) != 0xff000000, "maximum-width valid command changed interior");
        } finally { releaseTransferred(surface); }

        PGraphicsJava2D offscreen = render(new PApplet(), env,
            list(segment(-64, -64, -63, -63, 0xffffff, 255, 1)));
        try {
            offscreen.loadPixels();
            for (int value : offscreen.pixels) check(value == 0xff000000, "offscreen valid command changed background");
        } finally { releaseTransferred(offscreen); }

        PGraphicsJava2D crossing = render(new PApplet(), env,
            list(segment(0, 32, 64, 32, 0x00ff00, 255, 4)));
        try {
            check(pixel(crossing, 32, 32) != 0xff000000, "central crossing did not cover centre");
        } finally { releaseTransferred(crossing); }

        PGraphicsJava2D minimum = render(new PApplet(), env,
            list(segment(8, 16, 56, 16, 0xffffff, 255, 1.0 / 256.0)));
        try {
            minimum.loadPixels();
            int covered = 0;
            for (int value : minimum.pixels) if (value != 0xff000000) covered += 1;
            minimumWidthCoveragePixels = covered;
        } finally { releaseTransferred(minimum); }

        for (final Map<String,Object> invalid : Arrays.asList(
                segment(0, 0, nextFloat(128), 1, 0xffffff, 255, 1),
                segment(0, 0, moreNegativeFloat(-64), 1, 0xffffff, 255, 1),
                segment(0, 0, 1, nextFloat(128), 0xffffff, 255, 1),
                segment(0, 0, 1, moreNegativeFloat(-64), 0xffffff, 255, 1),
                segment(0, 0, 1, 1, 0xffffff, 255, previousFloat(1.0 / 256.0)),
                segment(0, 0, 1, 1, 0xffffff, 255, nextFloat(64)),
                quad(0, 0, nextFloat(128), 0, nextFloat(128), 1, 0, 1, 0xffffff, 255),
                quad(0, 0, 1, moreNegativeFloat(-64), 1, 0, 0, 1, 0xffffff, 255))) {
            final Java2DFrame frame = new Java2DFrame(new PApplet());
            frame.begin(env);
            expectFrameError("INVALID_COMMAND", Long.valueOf(0), new Checked() {
                public void run() { frame.batch(list(invalid)); }
            });
            check("aborted".equals(frame.state()), "invalid batch did not abort");
        }

        final Java2DFrame atomic = new Java2DFrame(new PApplet());
        atomic.begin(env);
        expectFrameError("INVALID_COMMAND", Long.valueOf(1), new Checked() {
            public void run() {
                atomic.batch(list(segment(0, 32, 64, 32, 0xff0000, 255, 4),
                                  segment(0, 0, 0, 0, 0xffffff, 255, 1)));
            }
        });
        check(atomic.count() == 0 && "aborted".equals(atomic.state()), "invalid batch committed or stayed active");
    }

    private static int renderOverlap(boolean reverse) throws Exception {
        Map<String,Object> red = quad(8, 8, 40, 8, 40, 40, 8, 40, 0xff0000, 128);
        Map<String,Object> blue = quad(24, 8, 56, 8, 56, 40, 24, 40, 0x0000ff, 128);
        PGraphicsJava2D surface = render(new PApplet(), environment(64, 64, 0), reverse ? list(blue, red) : list(red, blue));
        try { return pixel(surface, 30, 24); }
        finally { releaseTransferred(surface); }
    }

    private static int[] pixelsForQuad(boolean reverseWinding) throws Exception {
        Map<String,Object> command = reverseWinding ?
            quad(8, 56, 56, 56, 56, 8, 8, 8, 0x336699, 173) :
            quad(8, 8, 56, 8, 56, 56, 8, 56, 0x336699, 173);
        PGraphicsJava2D surface = render(new PApplet(), environment(64, 64, 0), list(command));
        try { surface.loadPixels(); return surface.pixels.clone(); }
        finally { releaseTransferred(surface); }
    }

    private static void groupAlphaWindingOrder() throws Exception {
        int forward = renderOverlap(false);
        int reverse = renderOverlap(true);
        check(alpha(forward) == 255 && blue(forward) > red(forward), "blue-over-red order");
        check(alpha(reverse) == 255 && red(reverse) > blue(reverse), "red-over-blue reverse order");
        // 128/255 source-over values over black: later source is ~128, earlier contribution ~64.
        check(near(blue(forward), 128, 2) && near(red(forward), 64, 2), "forward source-over channels");
        check(near(red(reverse), 128, 2) && near(blue(reverse), 64, 2), "reverse source-over channels");

        PGraphicsJava2D opaque = render(new PApplet(), environment(64, 64, 0),
            list(quad(8, 8, 56, 8, 56, 56, 8, 56, 0x123456, 255)));
        try { check(pixel(opaque, 32, 32) == 0xff123456, "opaque fill is not exact"); }
        finally { releaseTransferred(opaque); }

        PGraphicsJava2D transparent = render(new PApplet(), environment(64, 64, 0),
            list(quad(8, 8, 56, 8, 56, 56, 8, 56, 0xffffff, 0)));
        try { check(pixel(transparent, 32, 32) == 0xff000000, "zero-alpha fill changed interior"); }
        finally { releaseTransferred(transparent); }

        check(Arrays.equals(pixelsForQuad(false), pixelsForQuad(true)), "quad winding differs");

        PGraphicsJava2D seam = render(new PApplet(), environment(64, 64, 0),
            list(quad(8, 8, 56, 8, 56, 56, 8, 56, 0x663399, 128)));
        try {
            seam.loadPixels();
            int interior = seam.pixels[32 * seam.width + 32];
            for (int y = 10; y <= 54; y++) for (int x = 10; x <= 54; x++)
                check(seam.pixels[y * seam.width + x] == interior, "translucent quad interior/seam at " + x + "," + y);
            maybeSave(seam, "java2d-group3-alpha-panel");
        } finally { releaseTransferred(seam); }
    }

    private static void groupStyleCapsParentIsolation() throws Exception {
        PApplet parent = new PApplet();
        PGraphicsJava2D parentSurface = new PGraphicsJava2D();
        parentSurface.setParent(parent);
        parentSurface.setSize(32, 32);
        parentSurface.beginDraw();
        parentSurface.background(0x112233);
        parentSurface.translate(3, 5);
        parentSurface.fill(17, 34, 51, 255);
        parentSurface.stroke(68, 85, 102, 255);
        parentSurface.loadPixels();
        int[] parentPixels = parentSurface.pixels.clone();
        AffineTransform parentTransform = new AffineTransform(parentSurface.g2.getTransform());
        int parentFill = parentSurface.fillColor;
        int parentStroke = parentSurface.strokeColor;
        parent.g = parentSurface;

        PGraphicsJava2D surface = render(parent, environment(64, 64, 0), list(
            segment(16, 32, 48, 32, 0xff0000, 255, 8),
            quad(20, 12, 44, 12, 44, 24, 20, 24, 0x00ff00, 255),
            segment(8, 8, 56, 8, 0x0000ff, 255, 2)
        ));
        try {
            check(pixel(surface, 13, 32) == 0xffff0000, "round cap did not extend to x=13");
            check(pixel(surface, 10, 32) == 0xff000000, "round cap extended to x=10");
            check(pixel(surface, 32, 18) == 0xff00ff00, "quad inherited prior segment stroke/fill state");
            check(pixel(surface, 32, 10) == 0xff000000, "quad inherited stroke outside its fill");
            maybeSave(surface, "java2d-group4-style-caps");
        } finally { releaseTransferred(surface); }

        parentSurface.loadPixels();
        check(Arrays.equals(parentPixels, parentSurface.pixels), "parent pixels changed");
        check(parentTransform.equals(parentSurface.g2.getTransform()), "parent transform changed");
        check(parentFill == parentSurface.fillColor && parentStroke == parentSurface.strokeColor, "parent style changed");
        parentSurface.endDraw();
        Java2DFrame.releaseCompleted(parentSurface);
    }

    private static Map<String,Object> group(String id, Checked check) {
        try {
            check.run();
            return map("id", id, "passed", true);
        } catch (Throwable failure) {
            return map("id", id, "passed", false, "failure", failure.getClass().getSimpleName() + ": " + failure.getMessage());
        }
    }

    private static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof String) return "\"" + ((String) value).replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        StringJoiner joined = new StringJoiner(",", value instanceof Map ? "{" : "[", value instanceof Map ? "}" : "]");
        if (value instanceof Map) for (Object raw : ((Map<?,?>) value).entrySet()) {
            Map.Entry<?,?> entry = (Map.Entry<?,?>) raw;
            joined.add(json(entry.getKey()) + ":" + json(entry.getValue()));
        } else for (Object item : (Iterable<?>) value) joined.add(json(item));
        return joined.toString();
    }

    public static void main(String[] args) {
        if (args.length > 1) throw new IllegalArgumentException("optional image output directory only");
        if (args.length == 1) imageDirectory = Paths.get(args[0]);
        List<Object> groups = new ArrayList<Object>();
        groups.add(group("1-background-sizes", new Checked() { public void run() throws Exception { groupBackgroundSizes(); } }));
        groups.add(group("2-bounds-clipping-widths", new Checked() { public void run() throws Exception { groupBoundsClippingWidths(); } }));
        groups.add(group("3-alpha-winding-order", new Checked() { public void run() throws Exception { groupAlphaWindingOrder(); } }));
        groups.add(group("4-style-caps-parent-isolation", new Checked() { public void run() throws Exception { groupStyleCapsParentIsolation(); } }));
        int failures = 0;
        for (Object raw : groups) if (!Boolean.TRUE.equals(((Map<?,?>) raw).get("passed"))) failures += 1;
        System.out.println(json(map(
            "profile", "drawing.fresh-raster-2d", "adapter", "Processing JAVA2D Java2DFrame",
            "scope", "registered native probe groups 1-4 only; no lifecycle fault injection, CP1 route, or full-profile support claim",
            "runtime_requirement", "Processing 4.5.6 core with JDK 17",
            "images_written", imagesWritten, "observations", map(
                "minimum_width_coverage_pixels", minimumWidthCoveragePixels,
                "minimum_width_visible_pixel_guarantee", "none; count is recorded native observation only"
            ), "failures", failures, "groups", groups
        )));
        if (failures != 0) System.exit(1);
    }
}
