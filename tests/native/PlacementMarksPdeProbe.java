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
import org.procedurals.examples.placementmarks.PlacementComposition;
import org.procedurals.sampling.CirclePlacements2D;

/** Exercise the actual generated PlacementMarks PDE through posted native key events. */
public final class PlacementMarksPdeProbe extends PlacementMarks {
    private static final String[] IDS = {
        "base", "motif", "motif-replay", "palette", "separation", "separation-reset",
        "minimum", "minimum-reset", "maximum", "maximum-reset", "budget", "budget-reset",
        "seed", "radial"
    };
    private static final char[] NEXT = {'m','m','c','g','g','i','i','o','o','n','n','r','x','s'};
    private static long[] expectedCounts;
    private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
    private volatile int draws;
    private volatile int keys;
    private PlacementComposition previous;
    private CirclePlacements2D baseline;
    private int[] baselinePixels;

    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static void exact(double left, double right, String message) {
        require(Double.doubleToRawLongBits(left) == Double.doubleToRawLongBits(right), message);
    }
    private static boolean sameGeometry(CirclePlacements2D left, CirclePlacements2D right) {
        if (left.size() != right.size() || left.attempts() != right.attempts()) return false;
        for (int i = 0; i < left.size(); i++) {
            double[] a = left.pointAt(i), b = right.pointAt(i);
            if (Double.doubleToRawLongBits(a[0]) != Double.doubleToRawLongBits(b[0])
                    || Double.doubleToRawLongBits(a[1]) != Double.doubleToRawLongBits(b[1])
                    || Double.doubleToRawLongBits(left.radiusAt(i)) != Double.doubleToRawLongBits(right.radiusAt(i))
                    || left.sourceIndexAt(i) != right.sourceIndexAt(i)) return false;
        }
        return true;
    }
    private void state(int index) {
        require(SEED == (index >= 12 ? 43L : 42L), "seed state " + index);
        require(ATTEMPTS == (index == 10 ? 10000 : 5000), "attempt state " + index);
        exact(MINIMUM, index == 6 ? 8.0d : 4.0d, "minimum state " + index);
        exact(MAXIMUM, index == 8 ? 32.0d : 64.0d, "maximum state " + index);
        exact(SEPARATION, index == 4 ? 1.2d : 1.0d, "separation state " + index);
        require(RADIAL == (index == 13), "radial state " + index);
        require(DIAMONDS == (index == 1), "motif state " + index);
        require(ALTERNATE == (index >= 3), "palette state " + index);
    }
    private void writeProgress(int state, CirclePlacements2D positions) throws Exception {
        String value = "{\"completed_compositions\":" + draws + ",\"last_state\":\"" + IDS[state]
            + "\",\"accepted\":" + positions.size() + ",\"attempts\":" + positions.attempts() + "}";
        Files.write(Paths.get(sketchPath("progress.json")), value.getBytes(StandardCharsets.UTF_8));
    }

    @Override public void draw() {
        int state = draws;
        require(state < IDS.length, "unexpected extra composition");
        require(width == 640 && height == 640 && pixelDensity == 1 && g instanceof PGraphicsJava2D, "environment");
        state(state);
        require(composition != null, "composition");
        CirclePlacements2D positions = composition.placements();
        if (expectedCounts[state] >= 0) require(positions.size() == expectedCounts[state], "accepted count " + state);
        if (state == 0) baseline = positions;
        if (state >= 1 && state <= 3) require(composition == previous, "style edit retained composition " + state);
        if (state >= 4) require(composition != previous, "geometric edit rebuilt composition " + state);
        if (state == 5 || state == 7 || state == 9 || state == 11)
            require(sameGeometry(baseline, positions), "baseline configuration replay " + state);
        if (state == 10) {
            require(positions.size() == 517, "budget count");
            for (int i = 0; i < baseline.size(); i++) {
                double[] a = baseline.pointAt(i), b = positions.pointAt(i);
                exact(a[0], b[0], "budget prefix x " + i);
                exact(a[1], b[1], "budget prefix y " + i);
                exact(baseline.radiusAt(i), positions.radiusAt(i), "budget prefix radius " + i);
                require(baseline.sourceIndexAt(i) == positions.sourceIndexAt(i), "budget prefix index " + i);
            }
        }
        if (state == 12) require(!sameGeometry(baseline, positions), "seed changes retained geometry");
        if (state == 13) require(positions.size() == 111 && !sameGeometry(baseline, positions), "radial transfer geometry");

        super.draw();
        draws++;
        loadPixels();
        int[] shown = pixels.clone();
        if (state == 0) baselinePixels = shown.clone();
        if (state == 1) require(!Arrays.equals(baselinePixels, shown), "motif pixels changed");
        if (state == 2) require(Arrays.equals(baselinePixels, shown), "motif replay pixels");
        if (state == 3) require(!Arrays.equals(baselinePixels, shown), "palette pixels changed");
        save(sketchPath(IDS[state] + ".png"));
        if (state == 13) save(sketchPath("displayed-final.png"));
        try { writeProgress(state, positions); }
        catch (Exception failure) { throw new RuntimeException(failure); }
        previous = composition;
        events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(), KeyEvent.PRESS,
            0, NEXT[state], 0)), 180, TimeUnit.MILLISECONDS);
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
                        require(paths.filter(path -> path.getFileName().toString().startsWith("placement-marks-")
                            && path.getFileName().toString().endsWith(".png")).count() == 1, "one native save");
                    }
                    String nativeJson = "{\"status\":\"passed\",\"compositions\":" + draws
                        + ",\"key_events\":" + keys + ",\"retained_style_edits\":true"
                        + ",\"baseline_replay_pixels\":true,\"palette_reuses_geometry\":true"
                        + ",\"budget_prefix\":true,\"radial_transfer\":true,\"save_quiet_ms\":" + quietMs + "}";
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
        if (args.length != IDS.length + 1) throw new IllegalArgumentException("output plus 14 accepted-count entries required");
        expectedCounts = new long[IDS.length];
        for (int i = 0; i < IDS.length; i++) expectedCounts[i] = Long.parseLong(args[i + 1]);
        Thread.setDefaultUncaughtExceptionHandler((thread, failure) -> { failure.printStackTrace(); System.exit(1); });
        PApplet.runSketch(new String[]{"--sketch-path=" + args[0], "PlacementMarksPdeProbe"}, new PlacementMarksPdeProbe());
    }
}
