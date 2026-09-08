package org.procedurals.examples.fieldmarks;

import android.graphics.Bitmap;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.android.internal.Android2DFrame;
import org.procedurals.android.internal.AndroidFrameHost;
import org.procedurals.color.CyclicPalette;
import processing.a2d.PGraphicsAndroid2D;
import processing.core.PApplet;

/**
 * Example-owned Android renderer for the editable field-marks composition.
 *
 * <p>The retained field and its fixed 640 square output are composition choices;
 * neither is a library operation or a recommended parameter range.</p>
 */
public final class FieldMarksRenderer {
    private static final int SIZE = 640;
    private static final int BACKGROUND = 0xece7da;
    private static final int OPACITY = 180;
    private static final int BATCH_SIZE = 4096;

    private FieldMarksRenderer() { }

    /** Immutable successful render statistics and a detached PNG snapshot. */
    public static final class Result {
        public final String modelHash;
        public final String geometryHash;
        public final String colorHash;
        public final long commands;
        private final byte[] png;

        private Result(String modelHash, String geometryHash, String colorHash,
                               long commands, byte[] png) {
            this.modelHash = modelHash;
            this.geometryHash = geometryHash;
            this.colorHash = colorHash;
            this.commands = commands;
            this.png = png.clone();
        }

        public byte[] pngBytes() { return png.clone(); }
    }

    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        for (int index = 0; index < pairs.length; index += 2)
            result.put((String) pairs[index], pairs[index + 1]);
        return result;
    }

    private static List<Double> point(double x, double y) { return Arrays.asList(x, y); }

    private static String hex(byte[] values) {
        StringBuilder result = new StringBuilder();
        for (byte value : values) result.append(String.format("%02x", value & 255));
        return result.toString();
    }

    private static MessageDigest digest() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException error) { throw new IllegalStateException("SHA-256 is unavailable", error); }
    }

    private static String modelHash(MarkField marks) {
        MessageDigest hash = digest();
        ByteBuffer values = ByteBuffer.allocate(40);
        for (int index = 0; index < marks.x.length; index++) {
            values.clear();
            values.putDouble(marks.x[index]).putDouble(marks.y[index]).putDouble(marks.heading[index]);
            values.putDouble(marks.lengthFactor[index]).putDouble(marks.colourCycles[index]);
            hash.update(values.array());
        }
        return hex(hash.digest());
    }

    private static void addSuppressed(Throwable primary, Throwable cleanup) {
        if (primary != cleanup) primary.addSuppressed(cleanup);
    }

    /**
     * Draws one explicit editable composition option and returns a detached PNG snapshot.
     * This must run from the host animation thread while the host is accepting frames.
     */
    public static Result render(final PApplet parent, final AndroidFrameHost host,
                                        final MarkField retained, double maxLength,
                                        Integer[] colors, boolean bars) {
        if (parent == null || host == null || retained == null || colors == null)
            throw new IllegalArgumentException("parent, host, retained field, and colors are required");
        if (retained.x.length != retained.y.length || retained.x.length != retained.heading.length ||
            retained.x.length != retained.lengthFactor.length || retained.x.length != retained.colourCycles.length)
            throw new IllegalArgumentException("retained field arrays must have equal lengths");

        final String before = modelHash(retained);
        final CyclicPalette palette = CyclicPalette.create(
            Collections.singletonMap("colors", Arrays.asList(colors)));
        final MessageDigest geometry = digest();
        final MessageDigest color = digest();
        final ByteBuffer bits = ByteBuffer.allocate(4);
        final byte[][] png = new byte[1][];
        final Android2DFrame frame = new Android2DFrame(host);
        PGraphicsAndroid2D completed = null;
        boolean consumed = false;
        Throwable primary = null;
        try {
            frame.begin(map("width", SIZE, "height", SIZE, "density", 1, "background", BACKGROUND));
            List<Object> batch = new ArrayList<Object>(BATCH_SIZE);
            int omitted = 0;
            for (int index = 0; index < retained.x.length; index++) {
                double x = retained.x[index], y = retained.y[index];
                double cosine = Math.cos(retained.heading[index]), sine = Math.sin(retained.heading[index]);
                double length = maxLength * retained.lengthFactor[index];
                double dx = .5 * length * cosine, dy = .5 * length * sine;
                if (length == 0) {
                    omitted++;
                    continue;
                }
                int rgb = palette.sample(retained.colourCycles[index]);
                List<List<Double>> points;
                Map<String,Object> command;
                if (bars) {
                    double nx = -sine * 1.25, ny = cosine * 1.25;
                    points = Arrays.asList(point(x - dx - nx, y - dy - ny), point(x + dx - nx, y + dy - ny),
                        point(x + dx + nx, y + dy + ny), point(x - dx + nx, y - dy + ny));
                    command = map("kind", "quad2", "vertices", points, "rgb", rgb, "opacity8", OPACITY);
                } else {
                    points = Arrays.asList(point(x - dx, y - dy), point(x + dx, y + dy));
                    command = map("kind", "segment2", "from", points.get(0), "to", points.get(1),
                        "rgb", rgb, "opacity8", OPACITY, "width", 1, "cap", "round");
                }
                for (List<Double> location : points) for (double value : location) {
                    bits.clear();
                    bits.putFloat((float) value);
                    geometry.update(bits.array());
                }
                bits.clear();
                bits.putInt((OPACITY << 24) | rgb);
                color.update(bits.array());
                batch.add(command);
                if (batch.size() == BATCH_SIZE) {
                    frame.batch(batch);
                    batch.clear();
                }
            }
            frame.batch(batch);
            if (frame.count() != retained.x.length - omitted || !before.equals(modelHash(retained)))
                throw new AssertionError("command count or retained field changed");
            completed = frame.end();
            final PGraphicsAndroid2D output = completed;
            host.consumeCompleted(output, new AndroidFrameHost.SurfaceConsumer() {
                @Override public void accept(PGraphicsAndroid2D surface) {
                    Object nativeValue = surface.getNative();
                    if (!(nativeValue instanceof Bitmap) || ((Bitmap) nativeValue).isRecycled())
                        throw new IllegalStateException("completed Android bitmap is unavailable");
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    if (!((Bitmap) nativeValue).compress(Bitmap.CompressFormat.PNG, 100, bytes))
                        throw new IllegalStateException("Android PNG compression failed");
                    png[0] = bytes.toByteArray();
                    parent.image(surface, 0, 0, parent.width, parent.height);
                }
            });
            consumed = true;
            if (png[0] == null || png[0].length == 0)
                throw new IllegalStateException("Android PNG output is empty");
            return new Result(before, hex(geometry.digest()), hex(color.digest()), frame.count(), png[0]);
        } catch (RuntimeException | Error failure) {
            primary = failure;
            throw failure;
        } finally {
            if (completed != null && !consumed) {
                try { host.releaseCompleted(completed); }
                catch (RuntimeException | Error cleanup) {
                    if (primary != null) addSuppressed(primary, cleanup);
                    else throw cleanup;
                }
            }
            if (completed == null && !"completed".equals(frame.state())) {
                try { frame.abort(); }
                catch (RuntimeException | Error cleanup) {
                    if (primary != null) addSuppressed(primary, cleanup);
                    else throw cleanup;
                }
            }
        }
    }
}
