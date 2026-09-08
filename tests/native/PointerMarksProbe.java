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
import org.procedurals.layout.RegularGrid;
import org.procedurals.motion.TargetSprings2D;
import org.procedurals.topology.Delaunay2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Prepared native-only deterministic-replay and lifecycle probe for PointerMarks. */
public final class PointerMarksProbe extends PointerMarks {
    private static final String[] IDS = {"baseline", "held-dots", "held-wire", "released-dots",
        "reset", "replay-held-dots", "replay-released-dots", "lifecycle-paused"};
    private static final char[] KEYS = {'m', 'm', '0', ' ', ' ', 's'};
    private static final double INPUT_X = 400.0d, INPUT_Y = 320.0d;
    private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
    private final File output, expectedJar;
    private int phase, keys, callbacks, runningDraws, drawsAtSave;
    private long tickAtPause;
    private boolean pausePosted;
    private String gridOrigin, springsOrigin, meshOrigin;
    private String baselinePixels, heldPixels, releasedPixels;
    private int[] finalPixels;
    private Delaunay2D fixedMesh;
    private Snapshot baseline, held, released;
    private final StringBuilder records = new StringBuilder();

    private PointerMarksProbe(File output, File expectedJar) { this.output = output; this.expectedJar = expectedJar; }
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
            gridOrigin = origin(RegularGrid.class);
            springsOrigin = origin(TargetSprings2D.class);
            meshOrigin = origin(Delaunay2D.class);
            String expected = expectedJar.getCanonicalPath();
            require(expected.equals(gridOrigin) && expected.equals(springsOrigin) && expected.equals(meshOrigin),
                "wrong candidate core JAR");
        } catch (Exception error) { throw new IllegalStateException(error); }
    }

    @Override public void draw() {
        callbacks++;
        try {
            require(width == 640 && height == 640 && pixelDensity == 1
                && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"), "native environment");
            if (phase == 0) baseline();
            else if (phase == 1) heldDots();
            else if (phase == 2) heldWire();
            else if (phase == 3) releasedDots();
            else if (phase == 4) reset();
            else if (phase == 5) replayHeldDots();
            else if (phase == 6) replayReleasedDots();
            else lifecycle();
        } catch (Throwable error) { error.printStackTrace(); System.exit(1); }
    }

    private void baseline() throws Exception {
        require(!running && tick == 0L && !pointerHeld && !wire, "paused baseline");
        fixedMesh = initialMesh;
        checkMeshMapping();
        baseline = snapshot();
        renderAndRecord(0);
        mouseX = (int)INPUT_X; mouseY = (int)INPUT_Y;
        super.mousePressed(); // Direct pointer callback; the later key controls are posted.
        require(pointerHeld && pointerX == INPUT_X && pointerY == INPUT_Y, "captured pointer");
        replay(true, 24);
        require(tick == 24L, "held tick count");
        dirty = true;
        phase = 1;
        requestNextFrame();
    }

    private void heldDots() throws Exception {
        require(!running && !wire && pointerHeld && tick == 24L && initialMesh == fixedMesh, "held dots state");
        held = snapshot();
        renderAndRecord(1);
        heldPixels = lastPixels;
        require(!heldPixels.equals(baselinePixels), "held pixels unchanged");
        phase = 2;
        post('m');
    }

    private void heldWire() throws Exception {
        require(!running && wire && initialMesh == fixedMesh && snapshot().equals(held), "wire changed state");
        checkMeshMapping();
        renderAndRecord(2);
        require(!lastPixels.equals(heldPixels), "wire pixels unchanged");
        post('m');
    }

    private void releasedDots() throws Exception {
        require(!running && !wire && !pointerHeld && tick == 48L && initialMesh == fixedMesh, "released dots state");
        released = snapshot();
        renderAndRecord(3);
        releasedPixels = lastPixels;
        require(!releasedPixels.equals(heldPixels), "released pixels unchanged");
        post('0');
    }

    private void reset() throws Exception {
        require(!running && !pointerHeld && !wire && tick == 0L && initialMesh == fixedMesh, "reset state");
        require(snapshot().equals(baseline), "reset snapshot");
        renderAndRecord(4);
        require(lastPixels.equals(baselinePixels), "reset pixels");
        replay(true, 24);
        dirty = true;
        phase = 5;
        requestNextFrame();
    }

    private void replayHeldDots() throws Exception {
        require(!running && !wire && tick == 24L && snapshot().equals(held), "held replay snapshot");
        renderAndRecord(5);
        require(lastPixels.equals(heldPixels), "held replay pixels");
        replay(false, 24);
        dirty = true;
        phase = 6;
        requestNextFrame();
    }

    private void replayReleasedDots() throws Exception {
        require(!running && !wire && tick == 48L && snapshot().equals(released), "released replay snapshot");
        renderAndRecord(6);
        require(lastPixels.equals(releasedPixels), "released replay pixels");
        phase = 7;
        post(' ');
    }

    private void lifecycle() throws Exception {
        if (running) {
            long before = tick;
            super.draw();
            require(tick == before + 1L, "one logical step per running draw");
            runningDraws++;
            if (runningDraws >= 3 && !pausePosted) { pausePosted = true; post(' '); }
            return;
        }
        require(pausePosted && runningDraws >= 3 && tick == tickAtPause, "paused lifecycle state");
        renderAndRecord(7);
        finalPixels = pixels.clone();
        drawsAtSave = callbacks;
        post('s');
    }

    private String lastPixels;

    private void renderAndRecord(int id) throws Exception {
        super.draw();
        loadPixels(); displayedFrame.loadPixels();
        require(Arrays.equals(pixels, displayedFrame.pixels), "cached framebuffer mismatch");
        lastPixels = pixels(pixels);
        if (id == 0) baselinePixels = lastPixels;
        if (records.length() > 0) records.append(',');
        records.append("{\"id\":\"").append(IDS[id]).append("\",\"pixel_sha256\":\"")
            .append(lastPixels).append("\",\"tick\":").append(tick).append('}');
        save(new File(output, IDS[id] + ".png").getAbsolutePath());
    }

    private void replay(boolean heldInput, int count) {
        for (int index = 0; index < count; index++) stepWithInput(heldInput, INPUT_X, INPUT_Y);
    }

    private void checkMeshMapping() {
        require(initialMesh == fixedMesh && initialMesh.inputCount() == 49, "fixed mesh identity");
        for (int vertex = 0; vertex < initialMesh.vertexCount(); vertex++) {
            int source = initialMesh.sourceIndexAt((long)vertex);
            require(source >= 0 && source < motion.size() && initialMesh.inputVertexAt((long)source) == vertex,
                "vertex/source mapping");
        }
        for (int index = 0; index < initialMesh.edgeCount(); index++) {
            initialMesh.edgeInto((long)index, edge, 0);
            require(initialMesh.sourceIndexAt((long)edge[0]) >= 0 && initialMesh.sourceIndexAt((long)edge[1]) >= 0,
                "edge source mapping");
        }
    }

    @Override public void keyPressed() {
        require(keys < KEYS.length && key == KEYS[keys], "posted key order");
        boolean pausing = key == ' ' && running;
        super.keyPressed();
        keys++;
        if (key == 'm' && phase == 2 && !wire) {
            // Direct release callback, followed by the fixed released-input replay.
            super.mouseReleased();
            require(!pointerHeld, "released pointer");
            replay(false, 24);
            dirty = true;
            phase = 3;
        } else if (key == '0') {
            phase = 4;
        } else if (key == ' ' && pausing) {
            tickAtPause = tick;
        } else if (key == 's') {
            events.schedule(this::finish, 300, TimeUnit.MILLISECONDS);
        }
    }

    private void post(char key) {
        events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(), KeyEvent.PRESS, 0, key, 0)),
            180, TimeUnit.MILLISECONDS);
    }

    private void requestNextFrame() {
        events.schedule(this::redraw, 180, TimeUnit.MILLISECONDS);
    }

    private void finish() {
        try {
            require(keys == KEYS.length && callbacks == drawsAtSave && finalPixels != null, "save caused draw");
            File savedPath = new File(output, "pointer-marks.png");
            BufferedImage saved = ImageIO.read(savedPath);
            require(saved != null && saved.getWidth() == 640 && saved.getHeight() == 640, "saved dimensions");
            require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 640, 640, null, 0, 640)), "saved pixels");
            String json = "{\"status\":\"passed\",\"frames\":8,\"keys\":\"mm0SPACESPACEs\",\"frame_records\":["
                + records + "],\"running_draws\":" + runningDraws + ",\"core_code_source\":\""
                + escape(springsOrigin) + "\",\"grid_code_source\":\"" + escape(gridOrigin)
                + "\",\"springs_code_source\":\"" + escape(springsOrigin) + "\",\"mesh_code_source\":\""
                + escape(meshOrigin) + "\",\"expected_jar\":\"" + escape(expectedJar.getCanonicalPath())
                + "\",\"renderer\":\"" + g.getClass().getName() + "\",\"density\":" + pixelDensity + "}";
            Files.write(new File(output, "native.json").toPath(), json.getBytes(StandardCharsets.UTF_8));
            events.shutdown(); exit();
        } catch (Throwable error) { error.printStackTrace(); System.exit(1); }
    }

    private Snapshot snapshot() { return new Snapshot(targets, motion.toValues(), tick); }

    private static final class Snapshot {
        private final double[] targets;
        private final Map<String, Object> motion;
        private final long tick;
        Snapshot(double[] targets, Map<String, Object> motion, long tick) {
            this.targets = targets.clone(); this.motion = motion; this.tick = tick;
        }
        @Override public boolean equals(Object supplied) {
            if (!(supplied instanceof Snapshot)) return false;
            Snapshot other = (Snapshot)supplied;
            return tick == other.tick && Arrays.equals(targets, other.targets) && motion.equals(other.motion);
        }
    }

    public static void main(String[] args) {
        if (args.length != 2) throw new IllegalArgumentException("output directory and core JAR required");
        File output = new File(args[0]), jar = new File(args[1]);
        require(output.isDirectory() && jar.isFile(), "missing output/JAR");
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> { error.printStackTrace(); System.exit(1); });
        PApplet.runSketch(new String[] {"--sketch-path=" + output.getAbsolutePath(), "PointerMarksProbe"},
            new PointerMarksProbe(output, jar));
    }
}
