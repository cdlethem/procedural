package org.procedurals.android.internal;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Rect;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.procedurals.internal.DrawingFrameState;
import processing.a2d.PGraphicsAndroid2D;
import processing.core.PApplet;

/**
 * Actual ANDROID2D pixel probe groups 1--4 for drawing.fresh-raster-2d.
 *
 * <p>The caller invokes this on the sketch animation thread. Completed surfaces are
 * examined only in {@link AndroidFrameHost#consumeCompleted}; that callback releases
 * the lease before it returns. This class deliberately neither starts Android work nor
 * saves images.</p>
 */
public final class AndroidFramePixels {
    private static final double MIN_WIDTH = 1.0 / 256.0;

    private interface Checked { void run(); }
    private interface SurfaceCheck { void run(PGraphicsAndroid2D surface); }

    private AndroidFramePixels() { }

    private static Map<String,Object> map(Object... values) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        for (int index = 0; index < values.length; index += 2)
            result.put((String) values[index], values[index + 1]);
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
        return map("kind", "quad2", "vertices", list(list(x1, y1), list(x2, y2),
                list(x3, y3), list(x4, y4)), "rgb", rgb, "opacity8", opacity8);
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static Bitmap bitmap(PGraphicsAndroid2D surface) {
        Object nativeValue = surface.getNative();
        check(nativeValue instanceof Bitmap, "completed surface has no Bitmap native value");
        Bitmap value = (Bitmap) nativeValue;
        check(!value.isRecycled(), "completed surface bitmap is recycled");
        return value;
    }

    private static int pixel(PGraphicsAndroid2D surface, int x, int y) {
        return bitmap(surface).getPixel(x, y);
    }

    private static int[] pixels(PGraphicsAndroid2D surface) {
        Bitmap value = bitmap(surface);
        int[] result = new int[value.getWidth() * value.getHeight()];
        value.getPixels(result, 0, value.getWidth(), 0, 0, value.getWidth(), value.getHeight());
        return result;
    }

    private static int red(int pixel) { return (pixel >>> 16) & 255; }
    private static int green(int pixel) { return (pixel >>> 8) & 255; }
    private static int blue(int pixel) { return pixel & 255; }
    private static int alpha(int pixel) { return (pixel >>> 24) & 255; }
    private static boolean near(int actual, int expected, int tolerance) {
        return Math.abs(actual - expected) <= tolerance;
    }

    private static JSONArray array(int... values) {
        JSONArray result = new JSONArray();
        for (int value : values) result.put(value);
        return result;
    }

    /** Executes the callback inside the host's lease and never exposes a retained bitmap. */
    private static void render(AndroidFrameHost host, Map<String,Object> environment,
                               List<Object> commands, final SurfaceCheck check) {
        Android2DFrame frame = new Android2DFrame(host);
        PGraphicsAndroid2D completed = null;
        boolean consumed = false;
        try {
            frame.begin(environment);
            frame.batch(commands);
            completed = frame.end();
            final PGraphicsAndroid2D output = completed;
            host.consumeCompleted(output, new AndroidFrameHost.SurfaceConsumer() {
                @Override public void accept(PGraphicsAndroid2D surface) { check.run(surface); }
            });
            consumed = true;
        } finally {
            // consumeCompleted releases in finally. This covers admission failure before
            // consumption and is idempotent when the callback itself failed.
            if (completed != null && !consumed) host.releaseCompleted(completed);
            if (completed == null && !"completed".equals(frame.state())) {
                try { frame.abort(); }
                catch (RuntimeException ignored) { }
            }
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

    private static void expectFrameError(String code, Long index, Checked action) {
        try {
            action.run();
            throw new AssertionError("expected " + code);
        } catch (DrawingFrameState.FrameError error) {
            check(code.equals(error.code), "error code " + error.code + " != " + code);
            check(index == null ? error.commandIndex == null : index.equals(error.commandIndex),
                "command index mismatch");
        }
    }

    private static void groupBackgroundSizes(final AndroidFrameHost host, final JSONObject observations) {
        final int background = 0x123456;
        int[][] sizes = { {1, 1}, {640, 640}, {1920, 1080}, {2048, 1}, {1, 2048}, {2048, 2048} };
        JSONArray checked = new JSONArray();
        for (int[] size : sizes) {
            final int width = size[0];
            final int height = size[1];
            render(host, environment(width, height, background), list(), new SurfaceCheck() {
                @Override public void run(PGraphicsAndroid2D surface) {
                    Bitmap backing = bitmap(surface);
                    check(surface.width == width && surface.height == height, "logical dimensions");
                    check(surface.pixelDensity == 1 && surface.pixelWidth == width &&
                        surface.pixelHeight == height, "density/backing dimensions");
                    check(backing.isMutable() && backing.getConfig() == Bitmap.Config.ARGB_8888 &&
                        backing.getWidth() == width && backing.getHeight() == height, "backing bitmap");
                    int[] raw = pixels(surface);
                    check(raw.length == width * height, "pixel count");
                    int expected = 0xff000000 | background;
                    for (int value : raw) check(value == expected, "background RGB/alpha");
                }
            });
            JSONObject item = new JSONObject();
            put(item, "width", width); put(item, "height", height); put(item, "pixels", width * height);
            checked.put(item);
        }
        put(observations, "background_sizes", checked);
    }

    private static void groupBoundsClippingWidths(final AndroidFrameHost host, final JSONObject observations) {
        final Map<String,Object> env = environment(64, 64, 0);
        List<Object> valid = list(
            segment(-64, 4, 128, 4, 0xffffff, 255, MIN_WIDTH),
            segment(0, -64, 0, 128, 0xffffff, 255, 1),
            segment(previousFloat(-64), 8, previousFloat(128), 8, 0xffffff, 255, nextFloat(MIN_WIDTH)),
            segment(8, previousFloat(-64), 8, previousFloat(128), 0xffffff, 255, previousFloat(64)),
            quad(-64, 0, 0, -64, 128, 0, 0, 128, 0xffffff, 255),
            segment(32, 32, 33, 32, 0xffffff, 255, 64));
        render(host, env, valid, new SurfaceCheck() {
            @Override public void run(PGraphicsAndroid2D surface) {
                check(pixel(surface, 32, 32) != 0xff000000, "maximum-width valid command changed interior");
            }
        });
        render(host, env, list(segment(-64, -64, -63, -63, 0xffffff, 255, 1)), new SurfaceCheck() {
            @Override public void run(PGraphicsAndroid2D surface) {
                for (int value : pixels(surface)) check(value == 0xff000000, "offscreen clipping");
            }
        });
        render(host, env, list(segment(0, 32, 64, 32, 0x00ff00, 255, 4)), new SurfaceCheck() {
            @Override public void run(PGraphicsAndroid2D surface) {
                check(pixel(surface, 32, 32) != 0xff000000, "central crossing");
            }
        });
        final int[] minimumCoverage = new int[1];
        render(host, env, list(segment(8, 16, 56, 16, 0xffffff, 255, MIN_WIDTH)), new SurfaceCheck() {
            @Override public void run(PGraphicsAndroid2D surface) {
                for (int value : pixels(surface)) if (value != 0xff000000) minimumCoverage[0] += 1;
            }
        });

        for (final Map<String,Object> invalid : Arrays.asList(
                segment(0, 0, nextFloat(128), 1, 0xffffff, 255, 1),
                segment(0, 0, moreNegativeFloat(-64), 1, 0xffffff, 255, 1),
                segment(0, 0, 1, nextFloat(128), 0xffffff, 255, 1),
                segment(0, 0, 1, moreNegativeFloat(-64), 0xffffff, 255, 1),
                segment(0, 0, 1, 1, 0xffffff, 255, previousFloat(MIN_WIDTH)),
                segment(0, 0, 1, 1, 0xffffff, 255, nextFloat(64)),
                quad(0, 0, nextFloat(128), 0, nextFloat(128), 1, 0, 1, 0xffffff, 255),
                quad(0, 0, 1, moreNegativeFloat(-64), 1, 0, 0, 1, 0xffffff, 255))) {
            final Android2DFrame frame = new Android2DFrame(host);
            frame.begin(env);
            expectFrameError("INVALID_COMMAND", Long.valueOf(0), new Checked() {
                @Override public void run() { frame.batch(list(invalid)); }
            });
            check("aborted".equals(frame.state()), "invalid batch did not abort");
        }
        final Android2DFrame atomic = new Android2DFrame(host);
        atomic.begin(env);
        expectFrameError("INVALID_COMMAND", Long.valueOf(1), new Checked() {
            @Override public void run() {
                atomic.batch(list(segment(0, 32, 64, 32, 0xff0000, 255, 4),
                    segment(0, 0, 0, 0, 0xffffff, 255, 1)));
            }
        });
        check(atomic.count() == 0 && "aborted".equals(atomic.state()), "invalid batch atomicity");
        put(observations, "minimum_width_coverage_pixels", minimumCoverage[0]);
        put(observations, "minimum_width_visible_pixel_guarantee",
            "none; count is recorded native observation only");
    }

    private static int overlap(final AndroidFrameHost host, boolean reverse) {
        Map<String,Object> red = quad(8, 8, 40, 8, 40, 40, 8, 40, 0xff0000, 128);
        Map<String,Object> blue = quad(24, 8, 56, 8, 56, 40, 24, 40, 0x0000ff, 128);
        final int[] value = new int[1];
        render(host, environment(64, 64, 0), reverse ? list(blue, red) : list(red, blue), new SurfaceCheck() {
            @Override public void run(PGraphicsAndroid2D surface) { value[0] = pixel(surface, 30, 24); }
        });
        return value[0];
    }

    private static int[] quadPixels(final AndroidFrameHost host, boolean reverse) {
        Map<String,Object> command = reverse ?
            quad(8, 56, 56, 56, 56, 8, 8, 8, 0x336699, 173) :
            quad(8, 8, 56, 8, 56, 56, 8, 56, 0x336699, 173);
        final int[][] values = new int[1][];
        render(host, environment(64, 64, 0), list(command), new SurfaceCheck() {
            @Override public void run(PGraphicsAndroid2D surface) { values[0] = pixels(surface); }
        });
        return values[0];
    }

    private static void groupAlphaWindingOrder(final AndroidFrameHost host, final JSONObject observations) {
        int forward = overlap(host, false);
        int reverse = overlap(host, true);
        check(alpha(forward) == 255 && blue(forward) > red(forward), "blue-over-red order");
        check(alpha(reverse) == 255 && red(reverse) > blue(reverse), "red-over-blue order");
        check(near(blue(forward), 128, 2) && near(red(forward), 64, 2), "forward source-over");
        check(near(red(reverse), 128, 2) && near(blue(reverse), 64, 2), "reverse source-over");
        render(host, environment(64, 64, 0),
            list(quad(8, 8, 56, 8, 56, 56, 8, 56, 0x123456, 255)), new SurfaceCheck() {
                @Override public void run(PGraphicsAndroid2D surface) {
                    check(pixel(surface, 32, 32) == 0xff123456, "opaque fill");
                }
            });
        render(host, environment(64, 64, 0),
            list(quad(8, 8, 56, 8, 56, 56, 8, 56, 0xffffff, 0)), new SurfaceCheck() {
                @Override public void run(PGraphicsAndroid2D surface) {
                    check(pixel(surface, 32, 32) == 0xff000000, "zero-alpha fill changed interior");
                }
            });
        check(Arrays.equals(quadPixels(host, false), quadPixels(host, true)), "quad winding differs");
        render(host, environment(64, 64, 0),
            list(quad(8, 8, 56, 8, 56, 56, 8, 56, 0x663399, 128)), new SurfaceCheck() {
                @Override public void run(PGraphicsAndroid2D surface) {
                    int[] values = pixels(surface);
                    int interior = values[32 * surface.width + 32];
                    for (int y = 10; y <= 54; y++) for (int x = 10; x <= 54; x++)
                        check(values[y * surface.width + x] == interior, "quad seam at " + x + "," + y);
                }
            });
        put(observations, "overlap_forward_channels_argb",
            array(alpha(forward), red(forward), green(forward), blue(forward)));
        put(observations, "overlap_reverse_channels_argb",
            array(alpha(reverse), red(reverse), green(reverse), blue(reverse)));
    }

    private static float[] matrix(Canvas canvas) {
        Matrix matrix = new Matrix();
        canvas.getMatrix(matrix);
        float[] values = new float[9];
        matrix.getValues(values);
        return values;
    }

    private static void groupStyleCapsParentIsolation(final PApplet parent, final AndroidFrameHost host,
                                                       final JSONObject observations) {
        check(parent.g instanceof PGraphicsAndroid2D, "parent is not PGraphicsAndroid2D");
        PGraphicsAndroid2D parentSurface = (PGraphicsAndroid2D) parent.g;
        check(parentSurface.canvas != null, "parent Android canvas is unavailable");
        parentSurface.background(0x112233);
        parentSurface.translate(3, 5);
        parentSurface.clip(0, 0, 20, 20);
        parentSurface.fill(17, 34, 51, 255);
        parentSurface.stroke(68, 85, 102, 255);
        int[] parentPixels = pixels(parentSurface);
        float[] parentMatrix = matrix(parentSurface.canvas);
        Rect parentClip = new Rect();
        boolean hasParentClip = parentSurface.canvas.getClipBounds(parentClip);
        int parentFill = parentSurface.fillColor;
        int parentStroke = parentSurface.strokeColor;

        render(host, environment(64, 64, 0), list(
            segment(16, 32, 48, 32, 0xff0000, 255, 8),
            quad(20, 12, 44, 12, 44, 24, 20, 24, 0x00ff00, 255),
            segment(8, 8, 56, 8, 0x0000ff, 255, 2)), new SurfaceCheck() {
                @Override public void run(PGraphicsAndroid2D surface) {
                    check(pixel(surface, 13, 32) == 0xffff0000, "round cap did not extend to x=13");
                    check(pixel(surface, 10, 32) == 0xff000000, "round cap extended to x=10");
                    check(pixel(surface, 32, 18) == 0xff00ff00, "quad fill transition");
                    check(pixel(surface, 32, 10) == 0xff000000, "quad stroke inheritance");
                }
            });

        check(Arrays.equals(parentPixels, pixels(parentSurface)), "parent pixels changed");
        check(Arrays.equals(parentMatrix, matrix(parentSurface.canvas)), "parent transform changed");
        Rect afterClip = new Rect();
        check(hasParentClip == parentSurface.canvas.getClipBounds(afterClip) &&
            (!hasParentClip || parentClip.equals(afterClip)), "parent clip changed");
        check(parentFill == parentSurface.fillColor && parentStroke == parentSurface.strokeColor,
            "parent style changed");
        put(observations, "parent_density", parentSurface.pixelDensity);
    }

    private static void put(JSONObject object, String key, Object value) {
        try { object.put(key, value); }
        catch (JSONException error) { throw new IllegalStateException("Cannot construct probe JSON", error); }
    }

    private static JSONObject group(String id, Checked action) {
        JSONObject result = new JSONObject();
        put(result, "id", id);
        try {
            action.run();
            put(result, "passed", true);
        } catch (Throwable failure) {
            put(result, "passed", false);
            put(result, "failure", failure.getClass().getName() + ": " + failure.getMessage());
            StringWriter trace = new StringWriter();
            failure.printStackTrace(new PrintWriter(trace));
            put(result, "trace", trace.toString());
        }
        return result;
    }

    /** Runs registered groups 1--4 against the actual supplied ANDROID2D host. */
    public static JSONObject run(final PApplet parent, final AndroidFrameHost host) {
        if (parent == null || host == null) throw new IllegalArgumentException("parent and host are required");
        if (host.parent != parent) throw new IllegalArgumentException("host must belong to parent");
        final JSONObject observations = new JSONObject();
        JSONArray groups = new JSONArray();
        groups.put(group("1-background-sizes", new Checked() {
            @Override public void run() { groupBackgroundSizes(host, observations); }
        }));
        groups.put(group("2-bounds-clipping-widths", new Checked() {
            @Override public void run() { groupBoundsClippingWidths(host, observations); }
        }));
        groups.put(group("3-alpha-winding-order", new Checked() {
            @Override public void run() { groupAlphaWindingOrder(host, observations); }
        }));
        groups.put(group("4-style-caps-parent-isolation", new Checked() {
            @Override public void run() { groupStyleCapsParentIsolation(parent, host, observations); }
        }));
        int failures = 0;
        for (int index = 0; index < groups.length(); index++) {
            try { if (!groups.getJSONObject(index).optBoolean("passed")) failures += 1; }
            catch (JSONException error) { throw new IllegalStateException("Cannot read probe JSON", error); }
        }
        JSONObject result = new JSONObject();
        put(result, "passed", failures == 0);
        put(result, "profile", "drawing.fresh-raster-2d");
        put(result, "adapter", "Processing Android ANDROID2D Android2DFrame");
        put(result, "scope", "registered native probe groups 1-4 only; no lifecycle fault injection, CP1 route, or full-profile support claim");
        put(result, "failures", failures);
        put(result, "groups", groups);
        put(result, "observations", observations);
        return result;
    }
}
