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
import org.procedurals.processing.Java2DLayers;
import org.procedurals.raster.MaskedComposite2D;
import org.procedurals.raster.RasterCrossfade2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.event.KeyEvent;

/** Bounded native lifecycle probe for the candidate MaskMarks PDE. */
public final class MaskMarksProbe extends MaskMarks {
  private static final String[] IDS = {"baseline", "image", "crossfade", "mask-view", "crossfade-restored", "baseline-restored"};
  private static final char[] KEYS = {'m', 'm', 'v', 'v', 'm', 's'};
  private static final int CLEAR_X = 700, CLEAR_Y = 0, OPAQUE_X = 245, OPAQUE_Y = 240, HALF_X = 600, HALF_Y = 350;
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output, expectedJar, expectedAdapterJar;
  private int draws, keys;
  private long saveAt;
  private ImageIdentity groundIdentity, sourceIdentity, marksIdentity, maskIdentity;
  private double[] retainedCoverage;
  private String coverageHash, baselineHash, crossfadeHash;
  private PImage finalDisplayed;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private MaskMarksProbe(File output, File expectedJar, File expectedAdapterJar) {
    this.output = output; this.expectedJar = expectedJar; this.expectedAdapterJar = expectedAdapterJar;
  }
  private static final class ImageIdentity {
    final PImage image; final String pixelsHash;
    ImageIdentity(PImage image) { this.image = image; image.loadPixels(); pixelsHash = hash(image.pixels); }
    void requireUnchanged(String name) { image.loadPixels(); require(pixelsHash.equals(hash(image.pixels)), name + " pixels changed"); }
  }
  private static void require(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
  private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\""); }
  private static String codeSource(Class<?> type) throws Exception { return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath(); }
  private static String hash(int[] pixels) {
    try { MessageDigest d = MessageDigest.getInstance("SHA-256"); for (int pixel : pixels) for (int shift = 24; shift >= 0; shift -= 8) d.update((byte) (pixel >>> shift)); return hex(d.digest()); }
    catch (Exception error) { throw new IllegalStateException(error); }
  }
  private static String hash(double[] values) {
    try { MessageDigest d = MessageDigest.getInstance("SHA-256"); for (double value : values) { long bits = Double.doubleToLongBits(value); for (int shift = 56; shift >= 0; shift -= 8) d.update((byte) (bits >>> shift)); } return hex(d.digest()); }
    catch (Exception error) { throw new IllegalStateException(error); }
  }
  private static String hex(byte[] values) { StringBuilder result = new StringBuilder(); for (byte value : values) result.append(String.format("%02x", value & 255)); return result.toString(); }
  private static int index(int x, int y) { return y * 720 + x; }
  private void fail(Throwable error) { events.shutdownNow(); error.printStackTrace(); exit(); System.exit(1); }

  @Override public void setup() {
    try {
      super.setup();
      require(codeSource(MaskedComposite2D.class).equals(expectedJar.getCanonicalPath()), "compositor not from expected core JAR");
      require(codeSource(RasterCrossfade2D.class).equals(expectedJar.getCanonicalPath()), "crossfade not from expected core JAR");
      require(codeSource(Java2DLayers.class).equals(expectedAdapterJar.getCanonicalPath()), "adapter not from expected adapter JAR");
      groundIdentity = new ImageIdentity(ground); sourceIdentity = new ImageIdentity(source);
      marksIdentity = new ImageIdentity(marks); maskIdentity = new ImageIdentity(maskImage);
      retainedCoverage = coverage; coverageHash = hash(coverage);
      require(coverage[index(CLEAR_X, CLEAR_Y)] == 0.0d, "known clear mask coverage");
      require(coverage[index(OPAQUE_X, OPAQUE_Y)] == 1.0d, "known opaque mask coverage");
      require(coverage[index(HALF_X, HALF_Y)] == 128.0d / 255.0d, "half-alpha triangle coverage");
    } catch (Throwable error) { fail(error); }
  }

  private void requireRetainedInputs() {
    require(ground == groundIdentity.image && source == sourceIdentity.image && marks == marksIdentity.image && maskImage == maskIdentity.image,
        "retained PImage identity");
    require(coverage == retainedCoverage && coverageHash.equals(hash(coverage)), "retained coverage");
    groundIdentity.requireUnchanged("ground"); sourceIdentity.requireUnchanged("source");
    marksIdentity.requireUnchanged("marks"); maskIdentity.requireUnchanged("maskImage");
  }

  @Override public void draw() {
    try {
      if (!dirty) { super.draw(); return; }
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      super.draw(); loadPixels(); displayed.loadPixels();
      require(width == 720 && height == 480 && pixelDensity == 1 && g instanceof PGraphicsJava2D, "JAVA2D density one");
      requireRetainedInputs();
      require(mode == (state == 0 || state == 5 ? 0 : state == 1 ? 1 : 2), "mode state");
      require(showMask == (state == 3), "mask-view state");
      String pixelsHash = hash(pixels);
      if (state == 3) {
        require(!Arrays.equals(pixels, displayed.pixels), "mask-view framebuffer unexpectedly equals raw ARGB");
        require(maskImage.pixels[index(CLEAR_X, CLEAR_Y)] == 0, "mask view clear raw pixel");
        require(pixels[index(CLEAR_X, CLEAR_Y)] == 0xff6e6e6e, "mask view clear pixel background");
      } else {
        require(Arrays.equals(pixels, displayed.pixels), "cached/framebuffer mismatch");
        for (int pixel : pixels) require((pixel >>> 24) == 255, "nonopaque result framebuffer");
        if (state == 0 || state == 1 || state == 5)
          require(displayed.pixels[index(CLEAR_X, CLEAR_Y)] == ground.pixels[index(CLEAR_X, CLEAR_Y)], "zero-mask composite differs from ground");
        if (state == 2 || state == 4) {
          require(displayed.pixels[index(CLEAR_X, CLEAR_Y)] == marks.pixels[index(CLEAR_X, CLEAR_Y)], "crossfade weight zero differs from marks");
          require(displayed.pixels[index(OPAQUE_X, OPAQUE_Y)] == source.pixels[index(OPAQUE_X, OPAQUE_Y)], "crossfade weight one differs from source");
        }
      }
      if (state == 0) baselineHash = pixelsHash;
      else if (state == 2) crossfadeHash = pixelsHash;
      else if (state == 4) require(pixelsHash.equals(crossfadeHash), "crossfade did not restore");
      else if (state == 5) { require(pixelsHash.equals(baselineHash), "baseline did not restore"); finalDisplayed = displayed; finalPixels = pixels.clone(); }
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"").append(pixelsHash).append("\"}");
      save(sketchPath(IDS[state] + ".png")); draws++;
      char next = KEYS[state];
      events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(), KeyEvent.PRESS, 0, next, 0)), 180, TimeUnit.MILLISECONDS);
    } catch (Throwable error) { fail(error); }
  }

  @Override public void keyPressed() {
    try {
      require(keys < KEYS.length && key == KEYS[keys], "key order"); super.keyPressed(); keys++;
      if (key == 's') { require(displayed == finalDisplayed && !dirty, "save rebuilt cached display"); saveAt = System.nanoTime(); events.schedule(this::finish, 300, TimeUnit.MILLISECONDS); }
    } catch (Throwable error) { fail(error); }
  }

  private void finish() {
    try {
      long quiet = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - saveAt);
      require(quiet >= 300 && draws == IDS.length && keys == KEYS.length && !dirty, "save quiet/incomplete sequence");
      File savedPath = new File(output, "mask-marks.png"); BufferedImage saved = ImageIO.read(savedPath);
      require(saved != null && saved.getWidth() == 720 && saved.getHeight() == 480, "saved PNG dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 720, 480, null, 0, 720)), "saved PNG differs from cached frame");
      String sources = "{\"compositor\":\"" + escape(codeSource(MaskedComposite2D.class)) + "\",\"crossfade\":\"" + escape(codeSource(RasterCrossfade2D.class)) + "\",\"adapter\":\"" + escape(codeSource(Java2DLayers.class)) + "\"}";
      String json = "{\"status\":\"passed\",\"frames\":" + draws + ",\"keys\":\"" + new String(KEYS) + "\",\"frame_records\":[" + records + "],\"saved_png\":\"" + escape(savedPath.toString()) + "\",\"core_code_source\":\"" + escape(codeSource(MaskedComposite2D.class)) + "\",\"expected_jar\":\"" + escape(expectedJar.getCanonicalPath()) + "\",\"expected_adapter_jar\":\"" + escape(expectedAdapterJar.getCanonicalPath()) + "\",\"code_sources\":" + sources + ",\"quiet_ms\":" + quiet + ",\"renderer\":\"" + escape(g.getClass().getName()) + "\",\"density\":" + pixelDensity + "}";
      Files.write(new File(output, "native.json").toPath(), (json + "\n").getBytes(StandardCharsets.UTF_8)); events.shutdown(); exit(); System.exit(0);
    } catch (Throwable error) { fail(error); }
  }

  public static void main(String[] args) {
    if (args.length != 2 && args.length != 3) throw new IllegalArgumentException("output directory, core JAR, and optional adapter JAR required");
    File output = new File(args[0]), coreJar = new File(args[1]), adapterJar = args.length == 3 ? new File(args[2]) : coreJar;
    require(output.isDirectory() && coreJar.isFile() && adapterJar.isFile(), "missing output/JAR");
    Thread.setDefaultUncaughtExceptionHandler((thread, error) -> { error.printStackTrace(); System.exit(1); });
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "MaskMarksProbe"}, new MaskMarksProbe(output, coreJar, adapterJar));
  }
}
