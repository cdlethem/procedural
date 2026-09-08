import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.procedurals.color.StopRamp;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Five-state native probe for the actual RampMarks PDE; no renderer mock. */
public final class RampMarksProbe extends RampMarks {
  private static final String[] IDS = {"baseline", "shifted", "recolored", "radial", "reset"};
  private static final char[] KEYS = {'t', 'c', 'f', '0', 's'};
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output, expectedJar;
  private volatile int draws, keys;
  private int circles;
  private StringBuilder geometry;
  private String baselineGeometry, baselinePixels;
  private int[] finalPixels;
  private StopRamp previous;
  private final StringBuilder records = new StringBuilder();

  private RampMarksProbe(File output, File jar) { this.output = output; expectedJar = jar; }
  private static void require(boolean value, String message) {
    if (!value) throw new AssertionError(message);
  }
  private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\""); }
  private static String source(Class<?> type) throws Exception {
    return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();
  }
  private static String hash(int[] pixels) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (int pixel : pixels) {
      digest.update((byte)(pixel >>> 24)); digest.update((byte)(pixel >>> 16));
      digest.update((byte)(pixel >>> 8)); digest.update((byte)pixel);
    }
    StringBuilder result = new StringBuilder();
    for (byte value : digest.digest()) result.append(String.format("%02x", value & 255));
    return result.toString();
  }
  @Override public void setup() {
    super.setup();
    try { require(source(StopRamp.class).equals(expectedJar.getCanonicalPath()), "wrong core JAR"); }
    catch (Exception error) { throw new IllegalStateException(error); }
  }
  @Override public void ellipse(float x, float y, float w, float h) {
    circles++;
    geometry.append(Float.toHexString(x)).append(',').append(Float.toHexString(y)).append(',')
      .append(Float.toHexString(w)).append(',').append(Float.toHexString(h)).append(';');
    super.ellipse(x, y, w, h);
  }
  @Override public void draw() {
    try {
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      require(width == 640 && height == 640 && pixelDensity == 1
        && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"), "native environment");
      require(shifted == (state >= 1 && state <= 3), "stop state");
      require(alternate == (state == 2 || state == 3) && radial == (state == 3), "color/field state");
      if (state > 0) require((ramp == previous) == (state == 3), "ramp ownership across edits");
      circles = 0; geometry = new StringBuilder();
      super.draw(); loadPixels(); displayedFrame.loadPixels();
      require(circles == 729, "circle count");
      require(Arrays.equals(pixels, displayedFrame.pixels), "cached/framebuffer pixels differ");
      int changed = 0;
      for (int pixel : pixels) {
        require((pixel >>> 24) == 255, "nonopaque framebuffer");
        if ((pixel & 0xffffff) != 0xf8f5ee) changed++;
      }
      require(changed > 0, "blank frame");
      String pixelHash = hash(pixels);
      if (state == 0) { baselineGeometry = geometry.toString(); baselinePixels = pixelHash; }
      require(geometry.toString().equals(baselineGeometry), "geometry changed with color edit");
      if (state == 4) require(pixelHash.equals(baselinePixels), "reset mismatch");
      if (state > 0 && state < 4) require(!pixelHash.equals(baselinePixels), "edit made no change");
      save(sketchPath(IDS[state] + ".png"));
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"")
        .append(pixelHash).append("\",\"circles\":").append(circles).append('}');
      previous = ramp;
      if (state == 4) finalPixels = pixels.clone();
      draws++;
      final char next = KEYS[state];
      events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(),
        KeyEvent.PRESS, 0, next, 0)), 180, TimeUnit.MILLISECONDS);
    } catch (Exception error) { throw new IllegalStateException(error); }
  }
  @Override public void keyPressed() {
    require(keys < KEYS.length && key == KEYS[keys], "key order");
    super.keyPressed(); keys++;
    if (key == 's') {
      final long savedAt = System.nanoTime();
      events.schedule(() -> finish(savedAt), 300, TimeUnit.MILLISECONDS);
    }
  }
  private void finish(long savedAt) {
    try {
      long quiet = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - savedAt);
      require(quiet >= 300 && draws == 5 && keys == 5, "save quiet/sequence");
      java.awt.image.BufferedImage saved = ImageIO.read(new File(output, "ramp-marks.png"));
      require(saved != null && saved.getWidth() == 640 && saved.getHeight() == 640, "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 640, 640, null, 0, 640)), "saved pixels differ");
      String json = "{\"status\":\"passed\",\"frames\":5,\"keys\":\"tcf0s\",\"frame_records\":["
        + records + "],\"quiet_ms\":" + quiet + ",\"geometry_unchanged\":true,\"circles_per_frame\":729,"
        + "\"core_code_source\":\"" + escape(source(StopRamp.class)) + "\",\"expected_jar\":\""
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
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "RampMarksProbe"},
      new RampMarksProbe(output, jar));
  }
}
