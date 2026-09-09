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
import org.procedurals.processing.Java2DRegions;
import org.procedurals.raster.MaskedComposite2D;
import org.procedurals.raster.RasterCrossfade2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Bounded native lifecycle probe for the candidate LayerMarks PDE. */
public final class LayerMarksProbe extends LayerMarks {
  private static final String[] IDS = {"baseline", "local", "feather", "crossfade", "restored"};
  private static final char[] KEYS = {'m', 'm', 'm', 'm', 's'};
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output, expectedJar, expectedAdapterJar;
  private int draws, keys;
  private long saveAt;
  private PImageIdentity source, background;
  private String baselinePixels;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private LayerMarksProbe(File output, File expectedJar, File expectedAdapterJar) {
    this.output = output; this.expectedJar = expectedJar; this.expectedAdapterJar = expectedAdapterJar;
  }
  private static final class PImageIdentity {
    final processing.core.PImage image; final String hash;
    PImageIdentity(processing.core.PImage image) { this.image = image; image.loadPixels(); this.hash = hash(image.pixels); }
    void requireUnchanged(String name) { image.loadPixels(); require(hash.equals(hash(image.pixels)), name + " pixels changed"); }
  }
  private static void require(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
  private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\""); }
  private static String codeSource(Class<?> type) throws Exception {
    return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();
  }
  private static String hash(int[] pixels) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      for (int pixel : pixels) for (int shift = 24; shift >= 0; shift -= 8) digest.update((byte) (pixel >>> shift));
      StringBuilder result = new StringBuilder();
      for (byte value : digest.digest()) result.append(String.format("%02x", value & 255));
      return result.toString();
    } catch (Exception error) { throw new IllegalStateException(error); }
  }
  private void fail(Throwable error) {
    events.shutdownNow(); error.printStackTrace(); exit(); System.exit(1);
  }

  @Override public void setup() {
    try {
      super.setup();
      require(codeSource(MaskedComposite2D.class).equals(expectedJar.getCanonicalPath()), "compositor not from candidate JAR");
      require(codeSource(RasterCrossfade2D.class).equals(expectedJar.getCanonicalPath()), "crossfade not from candidate JAR");
      require(codeSource(Java2DRegions.class).equals(expectedAdapterJar.getCanonicalPath()), "adapter not from expected JAR");
      source = new PImageIdentity(sourceImage); background = new PImageIdentity(ground);
    } catch (Throwable error) { fail(error); }
  }

  @Override public void draw() {
    try {
      if (!dirty) { super.draw(); return; }
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      super.draw();
      loadPixels(); displayed.loadPixels(); ground.loadPixels();
      require(width == 720 && height == 480 && pixelDensity == 1 && g instanceof PGraphicsJava2D,
          "JAVA2D density one");
      require(Arrays.equals(pixels, displayed.pixels), "cached/framebuffer mismatch");
      require(mode == (state < 4 ? state : 0), "mode state");
      require(sourceImage == source.image && ground == background.image, "retained source/ground identity");
      source.requireUnchanged("sourceImage"); background.requireUnchanged("ground");
      int changed = 0;
      for (int y = 0, index = 0; y < height; y++) for (int x = 0; x < width; x++, index++) {
        if (x < 36 || x >= 684 || y < 36 || y >= 444)
          require(pixels[index] == ground.pixels[index], "outside layout changed");
        else if (pixels[index] != ground.pixels[index]) changed++;
      }
      require(changed > 0, "blank composition");
      String pixelsHash = hash(pixels);
      if (state == 0) baselinePixels = pixelsHash;
      else if (state == 4) { require(pixelsHash.equals(baselinePixels), "mode wrap did not restore baseline"); finalPixels = pixels.clone(); }
      else require(!pixelsHash.equals(baselinePixels), "composition mode unchanged");
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"").append(pixelsHash).append("\"}");
      save(sketchPath(IDS[state] + ".png"));
      draws++;
      char next = KEYS[state];
      events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(), KeyEvent.PRESS, 0, next, 0)),
          180, TimeUnit.MILLISECONDS);
    } catch (Throwable error) { fail(error); }
  }

  @Override public void keyPressed() {
    try {
      require(keys < KEYS.length && key == KEYS[keys], "key order");
      super.keyPressed(); keys++;
      if (key == 's') { saveAt = System.nanoTime(); events.schedule(this::finish, 300, TimeUnit.MILLISECONDS); }
    } catch (Throwable error) { fail(error); }
  }

  private void finish() {
    try {
      long quiet = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - saveAt);
      require(quiet >= 300 && draws == IDS.length && keys == KEYS.length, "save quiet/incomplete sequence");
      File savedPath = new File(output, "layer-marks.png");
      BufferedImage saved = ImageIO.read(savedPath);
      require(saved != null && saved.getWidth() == 720 && saved.getHeight() == 480, "saved PNG dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 720, 480, null, 0, 720)), "saved PNG differs from cached frame");
      String sources = "{\"compositor\":\"" + escape(codeSource(MaskedComposite2D.class))
          + "\",\"crossfade\":\"" + escape(codeSource(RasterCrossfade2D.class))
          + "\",\"adapter\":\"" + escape(codeSource(Java2DRegions.class)) + "\"}";
      String json = "{\"status\":\"passed\",\"frames\":" + draws + ",\"keys\":\"" + new String(KEYS)
          + "\",\"frame_records\":[" + records + "],\"saved_png\":\"" + escape(savedPath.toString())
          + "\",\"core_code_source\":\"" + escape(codeSource(MaskedComposite2D.class))
          + "\",\"expected_jar\":\"" + escape(expectedJar.getCanonicalPath())
          + "\",\"expected_adapter_jar\":\"" + escape(expectedAdapterJar.getCanonicalPath())
          + "\",\"code_sources\":" + sources
          + ",\"quiet_ms\":" + quiet + ",\"renderer\":\"" + escape(g.getClass().getName())
          + "\",\"density\":" + pixelDensity + "}";
      Files.write(new File(output, "native.json").toPath(), (json + "\n").getBytes(StandardCharsets.UTF_8));
      events.shutdown(); exit(); System.exit(0);
    } catch (Throwable error) { fail(error); }
  }

  public static void main(String[] args) {
    if (args.length != 2 && args.length != 3)
      throw new IllegalArgumentException("output directory, core JAR, and optional adapter JAR required");
    File output = new File(args[0]), jar = new File(args[1]);
    File adapterJar = args.length == 3 ? new File(args[2]) : jar;
    require(output.isDirectory() && jar.isFile() && adapterJar.isFile(), "missing output/JAR");
    Thread.setDefaultUncaughtExceptionHandler((thread, error) -> { error.printStackTrace(); System.exit(1); });
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "LayerMarksProbe"}, new LayerMarksProbe(output, jar, adapterJar));
  }
}
