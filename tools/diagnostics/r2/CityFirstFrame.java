import java.nio.file.Files;
import java.nio.file.Path;
import processing.core.PApplet;

/** One actual source-density frame; performance admission, not full acceptance. */
public final class CityFirstFrame extends CityMarks {
    private static Path output;
    private long boxes;
    @Override public void box(float w, float d, float h) {
        if (!Float.isFinite(w) || !Float.isFinite(h) || w <= 0 || h <= 0 || d != .1f)
            throw new AssertionError("Invalid window box");
        boxes++;
        super.box(w, d, h);
    }
    @Override public void draw() {
        super.draw();
        try {
            if (composition.leafCount() != 301 || boxes != composition.windowCount()
                || boxes != drawnWindows || width != 960 || height != 960
                || !g.getClass().getName().equals("processing.opengl.PGraphics3D"))
                throw new AssertionError("Incomplete native frame");
            displayedFrame.save(output.resolve("baseline.png").toString());
            String report = "{\"status\":\"passed\",\"scope\":\"one-frame cost only\","
                + "\"leaves\":301,\"faces\":" + composition.mesh().faceCount()
                + ",\"boxes\":" + boxes + ",\"draw_nanos\":" + drawNanos + "}\n";
            Files.writeString(output.resolve("native.json"), report);
        } catch (Exception e) { throw new RuntimeException(e); }
        exit();
    }
    public static void main(String[] args) {
        output = Path.of(args[0]);
        PApplet.runSketch(new String[]{"CityFirstFrame"}, new CityFirstFrame());
    }
}
