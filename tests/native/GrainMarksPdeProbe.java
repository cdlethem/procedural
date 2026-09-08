import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.event.KeyEvent;
import org.procedurals.examples.grainmarks.GrainComposition;
import org.procedurals.sampling.TrianglePoints2D;

/** Exercise the installed GrainMarks PDE through real posted key events. */
public final class GrainMarksPdeProbe extends GrainMarks {
    private static final String[] IDS = {"base", "palette", "palette-strokes", "palette-dots",
        "style-reset", "denser", "density-reset", "vertex", "edge", "distribution-reset",
        "seed-43", "all-reset", "cells", "cells-palette", "cells-strokes"};
    private static final char[] NEXT = {'c','m','m','c','n','n','b','b','b','r','0','x','c','m','?','s'};
    private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
    private volatile int draws, keys;
    private GrainComposition base, previous;
    private String baseHash, previousHash;
    private int[] basePixels, previousPixels;
    private final StringBuilder states = new StringBuilder();

    private static void require(boolean value, String why) { if (!value) throw new AssertionError(why); }
    private static void updateLong(MessageDigest digest, long value) {
        for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte)(value >>> shift));
    }
    private static String geometryHash(GrainComposition value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            updateLong(digest, value.size());
            double[] pair = new double[2];
            for (int r = 0; r < value.size(); r++) {
                TrianglePoints2D region = value.regionAt(r);
                updateLong(digest, region.size());
                for (int i = 0; i < region.size(); i++) {
                    region.pointInto(i, pair, 0);
                    updateLong(digest, Double.doubleToRawLongBits(pair[0]));
                    updateLong(digest, Double.doubleToRawLongBits(pair[1]));
                }
            }
            StringBuilder hex = new StringBuilder();
            for (byte b : digest.digest()) hex.append(String.format("%02x", b & 255));
            return hex.toString();
        } catch (Exception failure) { throw new RuntimeException(failure); }
    }
    private static void requirePrefix(GrainComposition shorter, GrainComposition longer) {
        require(shorter.size() == longer.size(), "prefix region count");
        double[] a = new double[2], b = new double[2];
        for (int r = 0; r < shorter.size(); r++) {
            TrianglePoints2D first = shorter.regionAt(r), second = longer.regionAt(r);
            require(first.size() < second.size(), "strictly longer region");
            for (int i = 0; i < first.size(); i++) {
                first.pointInto(i, a, 0); second.pointInto(i, b, 0);
                for (int axis = 0; axis < 2; axis++)
                    require(Double.doubleToRawLongBits(a[axis]) == Double.doubleToRawLongBits(b[axis]), "density prefix");
            }
        }
    }
    private void post(char value) {
        events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(),
            KeyEvent.PRESS, 0, value, 0)), 150, TimeUnit.MILLISECONDS);
    }
    private void requireState(int state) {
        require(SEED == (state == 10 ? 43 : 42), "seed state");
        require(DENSITY == (state == 5 ? 0.2d : 0.1d), "density state");
        require(DISTRIBUTION == (state == 7 ? 1 : state == 8 ? 2 : 0), "distribution state");
        require(ALTERNATE == (state >= 1 && state <= 3 || state >= 13), "palette state");
        require(STROKES == (state == 2 || state == 14), "mark state");
        require(CELLS == (state >= 12), "cell state");
        require(composition.size() == (state >= 12 ? 26 : 1), "region count");
        require(composition.totalPoints() == (state >= 12 ? 40960 : state == 5 ? 31360 : 15680), "point count");
    }
    @Override public void draw() {
        int state = draws;
        require(state < IDS.length, "unexpected extra draw");
        require(width == 640 && height == 640 && pixelDensity == 1 && g instanceof PGraphicsJava2D, "environment");
        requireState(state);
        String hash = geometryHash(composition);
        if (state == 0) { base = composition; baseHash = hash; }
        boolean style = state >= 1 && state <= 4 || state == 13 || state == 14;
        if (style) require(composition == previous && hash.equals(previousHash), "style retained geometry");
        else if (state > 0) require(composition != previous, "geometry edit rebuilt composition");
        if (state == 4 || state == 6 || state == 9 || state == 11)
            require(hash.equals(baseHash), "reset geometry replay");
        if (state == 5) requirePrefix(base, composition);
        if (state == 7 || state == 8 || state == 10)
            require(!hash.equals(baseHash) && !hash.equals(previousHash), "distribution/seed changed geometry");
        super.draw();
        draws++;
        loadPixels(); int[] shown = pixels.clone();
        if (state == 0) basePixels = shown.clone();
        if (style) require(!Arrays.equals(shown, previousPixels), "visible style change");
        if (state == 4 || state == 6 || state == 9 || state == 11)
            require(Arrays.equals(shown, basePixels), "reset pixel replay");
        // Every registered state is captured, including reset states for an inspectable audit.
        save(sketchPath(IDS[state] + ".png"));
        if (state == 14) save(sketchPath("displayed-final.png"));
        if (states.length() > 0) states.append(',');
        states.append("{\"id\":\"").append(IDS[state]).append("\",\"points\":")
            .append(composition.totalPoints()).append(",\"regions\":").append(composition.size())
            .append(",\"geometry_sha256\":\"").append(hash).append("\"}");
        try {
            Files.write(Paths.get(sketchPath("progress.json")),
                ("{\"completed_compositions\":" + draws + ",\"key_events\":" + keys + "}").getBytes(StandardCharsets.UTF_8));
        } catch (Exception failure) { throw new RuntimeException(failure); }
        previous = composition; previousHash = hash; previousPixels = shown;
        post(NEXT[state]);
    }
    @Override public void keyPressed() {
        require(keys < NEXT.length && key == NEXT[keys], "key event sequence");
        GrainComposition before = composition;
        super.keyPressed(); keys++;
        if (key == '?') {
            require(composition == before, "unknown key rebuilt geometry");
            post('s');
        }
        if (key == 's') {
            require(composition == before, "save rebuilt geometry");
            long start = System.nanoTime();
            events.schedule(() -> {
                try {
                    long quiet = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
                    require(quiet >= 300 && draws == IDS.length && keys == NEXT.length, "save/unknown key caused draw");
                    try (java.util.stream.Stream<Path> paths = Files.list(Paths.get(sketchPath()))) {
                        require(paths.filter(p -> p.getFileName().toString().startsWith("grain-marks-")
                            && p.toString().endsWith(".png")).count() == 1, "one actual save");
                    }
                    String report = "{\"status\":\"passed\",\"compositions\":15,\"key_events\":16,"
                        + "\"retained_style_edits\":true,\"density_prefix\":true,\"reset_pixel_replay\":true,"
                        + "\"distribution_and_seed_change_geometry\":true,\"cell_transfer\":true,"
                        + "\"unknown_key_no_redraw\":true,\"save_quiet_ms\":" + quiet + ",\"states\":[" + states + "]}";
                    Files.write(Paths.get(sketchPath("native.json")), report.getBytes(StandardCharsets.UTF_8));
                    events.shutdown(); exit();
                } catch (Throwable failure) { failure.printStackTrace(); System.exit(1); }
            }, 300, TimeUnit.MILLISECONDS);
        }
    }
    public static void main(String[] args) {
        if (args.length != 1) throw new IllegalArgumentException("output path required");
        try {
            Path expected = Paths.get(System.getProperty("procedurals.expectedCore")).toRealPath();
            Path actual = Paths.get(TrianglePoints2D.class.getProtectionDomain().getCodeSource().getLocation().toURI()).toRealPath();
            require(actual.equals(expected), "sampling core did not load from installed JAR");
        } catch (Exception failure) { throw new RuntimeException(failure); }
        Thread.setDefaultUncaughtExceptionHandler((thread, failure) -> { failure.printStackTrace(); System.exit(1); });
        PApplet.runSketch(new String[]{"--sketch-path=" + args[0], "GrainMarksPdeProbe"}, new GrainMarksPdeProbe());
    }
}
