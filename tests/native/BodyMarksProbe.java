import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.procedurals.color.CyclicPalette;
import org.procedurals.fields.GradientNoise2D01;
import org.procedurals.layout.RegularGrid;
import org.procedurals.paths.GradientPath2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Prepared native-only retained-spine, tick, and cached-save probe for BodyMarks. */
public final class BodyMarksProbe extends BodyMarks {
    private static final String[] IDS = {"baseline", "tapered", "centerlines", "body-restored", "advanced", "reset"};
    private static final char[] KEYS = {'w', 'm', 'm', '.', '0', 's'};
    private static final int ADVANCE_REPLAY_TICKS = 24;
    private static final int PATH_STEPS_PER_TICK = 12 * (1 + 24);
    private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
    private final File output, expectedJar;
    private int phase, keys, meaningfulRenders, rendersAtSave;
    private String pathOrigin, noiseOrigin, paletteOrigin, gridOrigin;
    private String baselinePixels, taperedPixels;
    private int[] finalPixels;
    private double baselineInteriorWidth;
    private double[] retainedHeads;
    private GradientPath2D[] retainedSpines, retainedSpineArray;
    private Snapshot baseline;
    private long replayElapsedNanos;
    private final StringBuilder records = new StringBuilder();

    private BodyMarksProbe(File output, File expectedJar) { this.output = output; this.expectedJar = expectedJar; }
    private static void require(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\""); }
    private static String pixels(int[] values) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (int value : values) for (int shift = 56; shift >= 0; shift -= 8)
            digest.update((byte)(((long)value & 0xffffffffL) >>> shift));
        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) result.append(String.format("%02x", value & 255));
        return result.toString();
    }
    private static String origin(Class<?> type) throws Exception {
        return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();
    }

    @Override public void setup() {
        super.setup();
        try {
            pathOrigin = origin(GradientPath2D.class);
            noiseOrigin = origin(GradientNoise2D01.class);
            paletteOrigin = origin(CyclicPalette.class);
            gridOrigin = origin(RegularGrid.class);
            String expected = expectedJar.getCanonicalPath();
            require(expected.equals(pathOrigin) && expected.equals(noiseOrigin)
                && expected.equals(paletteOrigin) && expected.equals(gridOrigin), "wrong candidate core JAR");
            verifyAdvanceReplay();
        } catch (Exception error) { throw new IllegalStateException(error); }
    }

    @Override public void draw() {
        if (!running && !dirty) return;
        try {
            require(width == 640 && height == 640 && pixelDensity == 1
                && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"), "native environment");
            if (phase == 0) baseline();
            else if (phase == 1) tapered();
            else if (phase == 2) centerlines();
            else if (phase == 3) bodyRestored();
            else if (phase == 4) advanced();
            else reset();
        } catch (Throwable error) { error.printStackTrace(); System.exit(1); }
    }

    private void baseline() throws Exception {
        require(!running && tick == 0L && !centerlines && taperExponent == 0.7d, "baseline state");
        retainedHeads = heads;
        retainedSpineArray = spines;
        retainedSpines = spines.clone();
        baseline = snapshot();
        baselineInteriorWidth = halfWidth(12);
        renderAndRecord(0);
        baselinePixels = lastPixels;
        phase = 1;
        post('w');
    }

    private void tapered() throws Exception {
        checkRetained("taper change");
        require(!centerlines && halfWidth(12) != baselineInteriorWidth, "interior width unchanged");
        renderAndRecord(1);
        taperedPixels = lastPixels;
        require(!taperedPixels.equals(baselinePixels), "taper pixels unchanged");
        phase = 2;
        post('m');
    }

    private void centerlines() throws Exception {
        checkRetained("centerline transfer");
        require(centerlines, "centerlines not selected");
        renderAndRecord(2);
        require(!lastPixels.equals(taperedPixels), "centerline pixels unchanged");
        phase = 3;
        post('m');
    }

    private void bodyRestored() throws Exception {
        checkRetained("body restore");
        require(!centerlines, "body not restored");
        renderAndRecord(3);
        require(lastPixels.equals(taperedPixels), "restored body pixels");
        phase = 4;
        post('.');
    }

    private void advanced() throws Exception {
        require(!running && tick == 1L && heads != retainedHeads, "one logical tick");
        boolean moved = false;
        for (int head = 0; head < HEAD_COUNT; head++) {
            require(spines[head] != retainedSpines[head], "spine not replaced");
            spines[head].pointInto(0L, point, 0);
            require(Double.doubleToRawLongBits(point[0]) == Double.doubleToRawLongBits(heads[head * 2])
                && Double.doubleToRawLongBits(point[1]) == Double.doubleToRawLongBits(heads[head * 2 + 1]),
                "spine starts at current head");
            if (Double.doubleToRawLongBits(heads[head * 2]) != Double.doubleToRawLongBits(retainedHeads[head * 2])
                || Double.doubleToRawLongBits(heads[head * 2 + 1]) != Double.doubleToRawLongBits(retainedHeads[head * 2 + 1])) moved = true;
        }
        require(moved, "all heads unchanged");
        renderAndRecord(4);
        phase = 5;
        post('0');
    }

    private void reset() throws Exception {
        require(!running && tick == 0L && !centerlines && taperExponent == 0.7d && snapshot().equals(baseline), "reset state");
        renderAndRecord(5);
        require(lastPixels.equals(baselinePixels), "reset pixels");
        finalPixels = pixels.clone();
        rendersAtSave = meaningfulRenders;
        post('s');
    }

    private String lastPixels;

    private void renderAndRecord(int id) throws Exception {
        super.draw();
        meaningfulRenders++;
        loadPixels(); displayedFrame.loadPixels();
        require(Arrays.equals(pixels, displayedFrame.pixels), "cached framebuffer mismatch");
        lastPixels = pixels(pixels);
        if (records.length() > 0) records.append(',');
        records.append("{\"id\":\"").append(IDS[id]).append("\",\"pixel_sha256\":\"")
            .append(lastPixels).append("\",\"tick\":").append(tick).append('}');
        save(new File(output, IDS[id] + ".png").getAbsolutePath());
    }

    private void checkRetained(String stage) {
        require(heads == retainedHeads && spines == retainedSpineArray && snapshot().equals(baseline), stage + " state");
        for (int head = 0; head < HEAD_COUNT; head++)
            require(spines[head] == retainedSpines[head] && spines[head].toValues().equals(baseline.spines[head]),
                stage + " spine identity");
    }

    private void verifyAdvanceReplay() {
        resetState();
        long started = System.nanoTime();
        for (int index = 0; index < ADVANCE_REPLAY_TICKS; index++) advanceTick();
        replayElapsedNanos = System.nanoTime() - started;
        Snapshot first = snapshot();
        resetState();
        for (int index = 0; index < ADVANCE_REPLAY_TICKS; index++) advanceTick();
        require(snapshot().equals(first), "advance replay");
        resetState();
    }

    @Override public void keyPressed() {
        require(keys < KEYS.length && key == KEYS[keys], "posted key order");
        super.keyPressed();
        keys++;
        if (key == 's') events.schedule(this::finish, 300, TimeUnit.MILLISECONDS);
    }

    private void post(char key) {
        events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(), KeyEvent.PRESS, 0, key, 0)),
            180, TimeUnit.MILLISECONDS);
    }

    private void finish() {
        try {
            require(keys == KEYS.length && meaningfulRenders == rendersAtSave && finalPixels != null, "save caused render");
            File savedPath = new File(output, "body-marks.png");
            BufferedImage saved = ImageIO.read(savedPath);
            require(saved != null && saved.getWidth() == 640 && saved.getHeight() == 640, "saved dimensions");
            require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 640, 640, null, 0, 640)), "saved pixels");
            String json = "{\"status\":\"passed\",\"frames\":6,\"keys\":\"wmm.0s\",\"frame_records\":["
                + records + "],\"advance_replay_ticks\":" + ADVANCE_REPLAY_TICKS + ",\"path_steps_per_tick\":"
                + PATH_STEPS_PER_TICK + ",\"advance_elapsed_nanos\":" + replayElapsedNanos + ",\"core_code_source\":\""
                + escape(pathOrigin) + "\",\"path_code_source\":\"" + escape(pathOrigin) + "\",\"noise_code_source\":\""
                + escape(noiseOrigin) + "\",\"palette_code_source\":\"" + escape(paletteOrigin)
                + "\",\"grid_code_source\":\"" + escape(gridOrigin) + "\",\"expected_jar\":\""
                + escape(expectedJar.getCanonicalPath()) + "\",\"renderer\":\"" + g.getClass().getName()
                + "\",\"density\":" + pixelDensity + "}";
            Files.write(new File(output, "native.json").toPath(), json.getBytes(StandardCharsets.UTF_8));
            events.shutdown(); exit();
        } catch (Throwable error) { error.printStackTrace(); System.exit(1); }
    }

    private Snapshot snapshot() { return new Snapshot(heads, spines, tick); }

    private static final class Snapshot {
        private final double[] heads;
        private final Map<String, Object>[] spines;
        private final long tick;
        @SuppressWarnings("unchecked") Snapshot(double[] heads, GradientPath2D[] paths, long tick) {
            this.heads = heads.clone(); this.spines = new Map[paths.length]; this.tick = tick;
            for (int index = 0; index < paths.length; index++) spines[index] = paths[index].toValues();
        }
        @Override public boolean equals(Object supplied) {
            if (!(supplied instanceof Snapshot)) return false;
            Snapshot other = (Snapshot)supplied;
            return tick == other.tick && Arrays.equals(heads, other.heads) && Arrays.equals(spines, other.spines);
        }
    }

    public static void main(String[] args) {
        if (args.length != 2) throw new IllegalArgumentException("output directory and core JAR required");
        File output = new File(args[0]), jar = new File(args[1]);
        require(output.isDirectory() && jar.isFile(), "missing output/JAR");
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> { error.printStackTrace(); System.exit(1); });
        PApplet.runSketch(new String[] {"--sketch-path=" + output.getAbsolutePath(), "BodyMarksProbe"},
            new BodyMarksProbe(output, jar));
    }
}
