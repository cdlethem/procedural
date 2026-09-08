import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.event.KeyEvent;
import org.procedurals.examples.regionmarks.RegionComposition;

/** Exercise the actual generated RegionMarks PDE through posted native key events. */
public final class RegionMarksPdeProbe extends RegionMarks {
    private static final String[] IDS = {
        "base", "grid", "grid-reset", "palette", "count-200", "count-reset",
        "full-selection", "fraction-reset", "seed-43", "seed-43-grid", "authored-grid"
    };
    private static final char[] NEXT = {'m', 'm', 'c', 'n', 'n', 'g', 'g', 'r', 'm', 'x', 's'};
    private static final int[] EXPECTED_COUNTS = {301, 301, 301, 301, 601, 301, 301, 301, 301, 301, 11};
    private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
    private volatile int draws, keys;
    private RegionComposition previous, base;
    private int[] basePixels;

    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static boolean sameGeometry(RegionComposition left, RegionComposition right) {
        if (left.size() != right.size()) return false;
        double[] a = new double[4], b = new double[4];
        for (int index = 0; index < left.size(); index++) {
            if (left.idAt(index) != right.idAt(index)) return false;
            left.boundsInto(index, a);
            right.boundsInto(index, b);
            for (int coordinate = 0; coordinate < 4; coordinate++)
                if (Double.doubleToRawLongBits(a[coordinate]) != Double.doubleToRawLongBits(b[coordinate])) return false;
        }
        return true;
    }
    /** A longer final live-list is intentionally not a raw prefix of the shorter result. */
    private static boolean finalOutputIsPrefix(RegionComposition shortValue, RegionComposition longValue) {
        if (shortValue.size() > longValue.size()) return false;
        double[] a = new double[4], b = new double[4];
        for (int index = 0; index < shortValue.size(); index++) {
            if (shortValue.idAt(index) != longValue.idAt(index)) return false;
            shortValue.boundsInto(index, a);
            longValue.boundsInto(index, b);
            for (int coordinate = 0; coordinate < 4; coordinate++)
                if (Double.doubleToRawLongBits(a[coordinate]) != Double.doubleToRawLongBits(b[coordinate])) return false;
        }
        return true;
    }
    private static void requireGridContent(RegionComposition value) {
        double[] bounds = new double[4], point = new double[2];
        for (int cell = 0; cell < value.size(); cell++) {
            value.boundsInto(cell, bounds);
            for (int mark = 0; mark < 9; mark++) {
                value.markInto(mark, bounds, point);
                require(bounds[0] < point[0] && point[0] < bounds[2]
                        && bounds[1] < point[1] && point[1] < bounds[3], "ordinary grid mark outside cell");
            }
        }
    }
    private void requireState(int state) {
        require(SEED == (state >= 8 ? 43L : 42L), "seed state " + state);
        require(REPLACEMENTS == (state == 4 ? 200 : 100), "replacement state " + state);
        require(Double.doubleToRawLongBits(FRACTION) == Double.doubleToRawLongBits(state == 6 ? 1.0d : 0.5d), "fraction state " + state);
        require(GRID_MARKS == (state == 1 || state == 9 || state == 10), "motif state " + state);
        require(ALTERNATE == (state >= 3), "palette state " + state);
        require(AUTHORED == (state == 10), "authored state " + state);
    }
    private void writeProgress(int state) throws Exception {
        String value = "{\"completed_compositions\":" + draws + ",\"last_state\":\"" + IDS[state]
                + "\",\"cells\":" + composition.size() + ",\"key_events\":" + keys + "}";
        Files.write(Paths.get(sketchPath("progress.json")), value.getBytes(StandardCharsets.UTF_8));
    }

    @Override public void draw() {
        int state = draws;
        require(state < IDS.length, "unexpected extra composition");
        require(width == 640 && height == 640 && pixelDensity == 1 && g instanceof PGraphicsJava2D, "environment");
        requireState(state);
        require(composition != null && composition.size() == EXPECTED_COUNTS[state], "composition count " + state);
        if (state == 0) base = composition;
        if (state == 1 || state == 2 || state == 3 || state == 9)
            require(composition == previous, "style edit did not retain composition " + state);
        if (state == 4 || state == 5 || state == 6 || state == 7 || state == 8 || state == 10)
            require(composition != previous, "geometry edit did not rebuild composition " + state);
        if (state >= 1 && state <= 3) require(sameGeometry(base, composition), "style geometry changed " + state);
        if (state == 4) {
            require(composition.size() == 601, "count edit cells");
            require(!finalOutputIsPrefix(base, composition), "count edit wrongly claims final output prefix");
        }
        if (state == 5 || state == 7) require(sameGeometry(base, composition), "reset did not replay base geometry " + state);
        if (state == 6 || state == 8) require(!sameGeometry(base, composition), "seed/fraction edit did not change geometry " + state);
        if (state == 9) require(!sameGeometry(base, composition), "seed grid unexpectedly matches base");
        if (state == 10) {
            require(composition.size() == 11, "authored transfer cells");
            requireGridContent(composition);
        }

        super.draw();
        draws++;
        loadPixels();
        int[] shown = pixels.clone();
        if (state == 0) basePixels = shown.clone();
        if (state == 1 || state == 3) require(!Arrays.equals(basePixels, shown), "visible style edit did not change pixels " + state);
        if (state == 2) require(Arrays.equals(basePixels, shown), "grid reset did not replay base pixels");
        if (state == 0 || state == 1 || state == 10) save(sketchPath(IDS[state] + ".png"));
        if (state == 10) save(sketchPath("displayed-final.png"));
        try { writeProgress(state); }
        catch (Exception failure) { throw new RuntimeException(failure); }
        previous = composition;
        events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(), KeyEvent.PRESS,
            0, NEXT[state], 0)), 150, TimeUnit.MILLISECONDS);
    }

    @Override public void keyPressed() {
        require(keys < NEXT.length && key == NEXT[keys], "key event order");
        super.keyPressed();
        keys++;
        if (key == 's') {
            final long savedAt = System.nanoTime();
            events.schedule(() -> {
                try {
                    long quietMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - savedAt);
                    require(quietMs >= 300, "short save observation");
                    require(draws == IDS.length && keys == NEXT.length, "save recomposed or missed event");
                    try (java.util.stream.Stream<Path> paths = Files.list(Paths.get(sketchPath()))) {
                        require(paths.filter(path -> path.getFileName().toString().startsWith("region-marks-")
                            && path.getFileName().toString().endsWith(".png")).count() == 1, "one native save");
                    }
                    String nativeJson = "{\"status\":\"passed\",\"compositions\":11,\"key_events\":11"
                        + ",\"retained_style_edits\":true,\"reset_pixel_replay\":true"
                        + ",\"count_final_not_prefix\":true,\"seed_and_fraction_change_geometry\":true"
                        + ",\"authored_grid_transfer\":true,\"save_quiet_ms\":" + quietMs + "}";
                    Files.write(Paths.get(sketchPath("native.json")), nativeJson.getBytes(StandardCharsets.UTF_8));
                    events.shutdown();
                    exit();
                } catch (Throwable failure) {
                    failure.printStackTrace();
                    System.exit(1);
                }
            }, 300, TimeUnit.MILLISECONDS);
        }
    }

    public static void main(String[] args) {
        if (args.length != 1) throw new IllegalArgumentException("output path required");
        Thread.setDefaultUncaughtExceptionHandler((thread, failure) -> { failure.printStackTrace(); System.exit(1); });
        PApplet.runSketch(new String[]{"--sketch-path=" + args[0], "RegionMarksPdeProbe"}, new RegionMarksPdeProbe());
    }
}
