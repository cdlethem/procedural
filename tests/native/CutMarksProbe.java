import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.procedurals.layout.RetainedRectangles2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Prepared native-only callback probe for the CutMarks draft. */
public final class CutMarksProbe extends CutMarks {
    private static final String[] IDS = {"baseline", "selected-x", "decorated", "deleted", "reset"};
    private static final char[] KEYS = {'x', 'd', CODED, '0', 's'};
    private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
    private final File output, expectedJar;
    private volatile int draws, keys;
    private String coreCodeSource, baselinePixels;
    private int[] finalPixels;
    private RetainedRectangles2D baselineModel;
    private RetainedRectangles2D.Leaf selectedBefore, unrelated;
    private RetainedRectangles2D.Leaf selectedAfterCut;
    private long unrelatedId, deletedId;
    private double selectedMidpoint;
    private java.util.Map<String, Object> baselineValues;
    private final StringBuilder records = new StringBuilder();

    private CutMarksProbe(File output, File jar) { this.output = output; expectedJar = jar; }
    private static void require(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
    private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\""); }
    private static String pixels(int[] values) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (int value : values) for (int shift = 56; shift >= 0; shift -= 8)
            digest.update((byte)(((long)value & 0xffffffffL) >>> shift));
        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) result.append(String.format("%02x", value & 255));
        return result.toString();
    }

    @Override public void setup() {
        super.setup();
        try {
            coreCodeSource = new File(RetainedRectangles2D.class.getProtectionDomain()
                .getCodeSource().getLocation().toURI()).getCanonicalPath();
            require(coreCodeSource.equals(expectedJar.getCanonicalPath()), "wrong core JAR");
        } catch (Exception error) { throw new IllegalStateException(error); }
    }

    @Override public void draw() {
        try {
            require(draws < IDS.length, "unexpected draw");
            require(width == 512 && height == 512 && pixelDensity == 1
                && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"), "native environment");
            if (draws == 0) checkBaseline();
            else if (draws == 1) checkSelectedCut();
            else if (draws == 2) checkDecoration();
            else if (draws == 3) checkDeletion();
            else checkReset();
            super.draw();
            loadPixels(); displayedFrame.loadPixels();
            require(Arrays.equals(pixels, displayedFrame.pixels), "cached framebuffer mismatch");
            String current = pixels(pixels);
            if (draws == 0) baselinePixels = current;
            else if (draws == 4) { require(current.equals(baselinePixels), "reset pixels"); finalPixels = pixels.clone(); }
            else require(!current.equals(previousPixels()), "state visually unchanged");
            if (draws > 0) records.append(',');
            records.append("{\"id\":\"").append(IDS[draws]).append("\",\"pixel_sha256\":\"")
                .append(current).append("\",\"retained_count\":").append(model.size()).append('}');
            save(new File(output, IDS[draws] + ".png").getAbsolutePath());
            draws++;
            char next = KEYS[draws - 1];
            events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(),
                KeyEvent.PRESS, 0, next, next == CODED ? DELETE : 0)), 180, TimeUnit.MILLISECONDS);
        } catch (Throwable error) { error.printStackTrace(); System.exit(1); }
    }

    private String previousPixels() throws Exception {
        if (draws == 1) return baselinePixels;
        return pixels(previousFrame);
    }

    private int[] previousFrame;

    private void checkBaseline() {
        require(model.size() == 37 && !decoration && selectedId == -1L, "baseline state");
        baselineModel = model;
        selectedBefore = model.leaves().get(0);
        unrelated = model.leaves().get(1);
        unrelatedId = unrelated.id;
        selectedMidpoint = selectedBefore.left + (selectedBefore.right - selectedBefore.left) * 0.5d;
        baselineValues = model.toValues();
    }

    private void selectForLocalCut() {
        mouseX = (int)((selectedBefore.left + selectedBefore.right) * 0.5d);
        mouseY = (int)((selectedBefore.top + selectedBefore.bottom) * 0.5d);
        super.mousePressed();
        require(selectedId == selectedBefore.id, "mouse callback selection");
    }

    private void checkSelectedCut() {
        require(model == baselineModel && model.size() == 38 && !decoration, "selected cut state");
        require(model.leaf(unrelatedId) == unrelated, "unrelated leaf replaced by cut");
        try { model.leaf(selectedBefore.id); throw new AssertionError("parent remains live"); }
        catch (RetainedRectangles2D.EditException expected) { require("UNKNOWN_ID".equals(expected.code), "parent error"); }
        selectedAfterCut = model.leaf(selectedId);
        require(Double.doubleToRawLongBits(selectedAfterCut.left) == Double.doubleToRawLongBits(selectedBefore.left)
            && Double.doubleToRawLongBits(selectedAfterCut.top) == Double.doubleToRawLongBits(selectedBefore.top)
            && Double.doubleToRawLongBits(selectedAfterCut.right) == Double.doubleToRawLongBits(selectedMidpoint)
            && Double.doubleToRawLongBits(selectedAfterCut.bottom) == Double.doubleToRawLongBits(selectedBefore.bottom),
            "selected low child bounds");
        deletedId = selectedId;
    }

    private void checkDecoration() {
        require(model == baselineModel && model.size() == 38 && decoration, "decoration state");
        require(model.leaf(unrelatedId) == unrelated, "decoration changed unrelated leaf");
        require(model.leaf(deletedId) == selectedAfterCut, "decoration changed selected leaf");
    }

    private void checkDeletion() {
        require(model == baselineModel && model.size() == 37 && decoration && selectedId == -1L, "deletion state");
        require(model.leaf(unrelatedId) == unrelated, "deletion changed unrelated leaf");
        try { model.leaf(deletedId); throw new AssertionError("deleted leaf remains live"); }
        catch (RetainedRectangles2D.EditException expected) { require("UNKNOWN_ID".equals(expected.code), "delete error"); }
    }

    private void checkReset() {
        require(model != baselineModel && model.size() == 37 && !decoration && selectedId == -1L, "reset state");
        require(model.toValues().equals(baselineValues), "reset snapshot");
    }

    @Override public void keyPressed() {
        require(keys < KEYS.length && key == KEYS[keys], "key order");
        if (keys == 0 && key == 'x') selectForLocalCut();
        super.keyPressed();
        keys++;
        if (key == 's') events.schedule(this::finish, 300, TimeUnit.MILLISECONDS);
    }

    @Override public void save(String path) {
        super.save(path);
        loadPixels();
        previousFrame = pixels.clone();
    }

    private void finish() {
        try {
            require(draws == 5 && keys == 5 && finalPixels != null, "incomplete event sequence");
            File savedPath = new File(output, "cut-marks.png");
            BufferedImage saved = ImageIO.read(savedPath);
            require(saved != null && saved.getWidth() == 512 && saved.getHeight() == 512, "saved dimensions");
            require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 512, 512, null, 0, 512)), "saved pixels");
            String json = "{\"status\":\"passed\",\"frames\":5,\"keys\":\"xdDELETE0s\",\"frame_records\":["
                + records + "],\"core_code_source\":\"" + escape(coreCodeSource) + "\",\"expected_jar\":\""
                + escape(expectedJar.getCanonicalPath()) + "\",\"renderer\":\"" + g.getClass().getName()
                + "\",\"density\":" + pixelDensity + "}";
            Files.write(new File(output, "native.json").toPath(), json.getBytes(StandardCharsets.UTF_8));
            events.shutdown(); exit();
        } catch (Throwable error) { error.printStackTrace(); System.exit(1); }
    }

    public static void main(String[] args) {
        if (args.length != 2) throw new IllegalArgumentException("output directory and core JAR required");
        File output = new File(args[0]), jar = new File(args[1]);
        require(output.isDirectory() && jar.isFile(), "missing output/JAR");
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> { error.printStackTrace(); System.exit(1); });
        PApplet.runSketch(new String[] {"--sketch-path=" + output.getAbsolutePath(), "CutMarksProbe"},
            new CutMarksProbe(output, jar));
    }
}
