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
import org.procedurals.paths.ClosedSpline2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Five-state native probe for the actual LoopMarks PDE and retained curves. */
public final class LoopMarksProbe extends LoopMarks {
  private static final String[] IDS = {"baseline", "moved", "recolored", "fans", "reset"};
  private static final char[] KEYS = {'t', 'c', 'm', '0', 's'};

  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output;
  private final File expectedJar;
  private volatile int draws;
  private volatile int keys;
  private ClosedSpline2D[] baselineCurves;
  private ClosedSpline2D[] movedCurves;
  private ClosedSpline2D[] movedIdentities;
  private String baselineGeometry;
  private String movedGeometry;
  private String baselinePixels;
  private String movedPixels;
  private String recoloredPixels;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private LoopMarksProbe(File output, File expectedJar) {
    this.output = output;
    this.expectedJar = expectedJar;
  }

  private static void require(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }

  private static String escape(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private static String codeSource(Class<?> type) throws Exception {
    return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI())
        .getCanonicalPath();
  }

  private static void putLong(MessageDigest digest, long value) {
    for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte) (value >>> shift));
  }

  private static String hex(byte[] bytes) {
    StringBuilder result = new StringBuilder();
    for (byte value : bytes) result.append(String.format("%02x", value & 255));
    return result.toString();
  }

  private static String curveHash(ClosedSpline2D[] curves) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    double[] sample = new double[4];
    for (ClosedSpline2D curve : curves) {
      digest.update(curve.serialize().toString().getBytes(StandardCharsets.UTF_8));
      digest.update((byte) 0);
      putLong(digest, Double.doubleToRawLongBits(curve.length()));
      putLong(digest, curve.controlCount());
      putLong(digest, curve.subdivisions());
      for (int i = 0; i < 256; i++) {
        curve.sampleParameter(i * curve.controlCount() / 256.0, sample);
        addSample(digest, sample);
      }
      for (int i = 0; i < 256; i++) {
        curve.sampleDistance(i * curve.length() / 256.0, sample);
        addSample(digest, sample);
      }
    }
    return hex(digest.digest());
  }

  private static void addSample(MessageDigest digest, double[] sample) {
    for (double value : sample) putLong(digest, Double.doubleToRawLongBits(value));
  }

  private static String pixelHash(int[] pixels) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (int value : pixels) putLong(digest, value & 0xffffffffL);
    return hex(digest.digest());
  }

  @Override public void setup() {
    super.setup();
    try {
      require(codeSource(ClosedSpline2D.class).equals(expectedJar.getCanonicalPath()),
          "wrong core JAR");
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  @Override public void draw() {
    try {
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      require(width == 640 && height == 640 && pixelDensity == 1
          && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"),
          "native environment");
      require(moved == (state >= 1 && state <= 3), "moved state");
      require(alternate == (state == 2 || state == 3), "palette state");
      require(fans == (state == 3), "fan state");
      ClosedSpline2D[] current = curves;
      require(current != null && current.length == 4, "four curves");
      for (ClosedSpline2D curve : current) {
        require(curve.controlCount() == 6 && curve.subdivisions() == 32,
            "curve descriptor");
        require(Double.isFinite(curve.length()), "finite curve length");
      }

      if (state == 0) {
        baselineCurves = current;
        baselineGeometry = curveHash(current);
      } else if (state == 1) {
        require(current != baselineCurves, "move did not rebuild array");
        for (int i = 0; i < current.length; i++) {
          require(current[i] != baselineCurves[i], "move retained curve identity");
        }
        movedCurves = current;
        movedIdentities = current.clone();
        movedGeometry = curveHash(current);
        require(!movedGeometry.equals(baselineGeometry), "move did not change geometry");
      } else if (state == 2 || state == 3) {
        require(current == movedCurves, "style edit replaced curve array");
        for (int i = 0; i < current.length; i++) {
          require(current[i] == movedIdentities[i], "style edit replaced curve");
        }
        require(curveHash(current).equals(movedGeometry), "style edit changed geometry");
      } else {
        require(current != baselineCurves && current != movedCurves,
            "reset reused curve array");
        for (int i = 0; i < current.length; i++) {
          require(current[i] != baselineCurves[i] && current[i] != movedIdentities[i],
              "reset reused curve identity");
        }
        require(curveHash(current).equals(baselineGeometry), "reset geometry mismatch");
      }

      super.draw();
      loadPixels();
      displayedFrame.loadPixels();
      require(Arrays.equals(pixels, displayedFrame.pixels), "cached/framebuffer mismatch");
      int changed = 0;
      for (int pixel : pixels) {
        require((pixel >>> 24) == 255, "nonopaque framebuffer");
        if ((pixel & 0xffffff) != 0xf5f0e6) changed++;
      }
      require(changed > 0, "blank frame");
      String currentPixels = pixelHash(pixels);
      if (state == 0) baselinePixels = currentPixels;
      if (state == 1) {
        movedPixels = currentPixels;
        require(!movedPixels.equals(baselinePixels), "move made no visible change");
      }
      if (state == 2) {
        recoloredPixels = currentPixels;
        require(!recoloredPixels.equals(movedPixels), "recolor made no visible change");
      }
      if (state == 3) require(!currentPixels.equals(recoloredPixels), "fans made no visible change");
      if (state == 4) {
        require(currentPixels.equals(baselinePixels), "reset pixels mismatch");
        finalPixels = pixels.clone();
      }
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state])
          .append("\",\"pixel_sha256\":\"").append(currentPixels)
          .append("\",\"curve_sha256\":\"").append(curveHash(current)).append("\"}");
      save(sketchPath(IDS[state] + ".png"));
      draws++;
      char next = KEYS[state];
      events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(),
          KeyEvent.PRESS, 0, next, 0)), 180, TimeUnit.MILLISECONDS);
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  @Override public void keyPressed() {
    require(keys < KEYS.length && key == KEYS[keys], "key order");
    super.keyPressed();
    keys++;
    if (key == 's') {
      long savedAt = System.nanoTime();
      events.schedule(() -> finish(savedAt), 300, TimeUnit.MILLISECONDS);
    }
  }

  private void finish(long savedAt) {
    try {
      long quiet = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - savedAt);
      require(quiet >= 300 && draws == 5 && keys == 5, "save quiet/sequence");
      File savedPath = new File(output, "loop-marks.png");
      BufferedImage saved = ImageIO.read(savedPath);
      require(saved != null && saved.getWidth() == 640 && saved.getHeight() == 640,
          "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 640, 640, null, 0, 640)),
          "saved pixels differ");
      String json = "{\"status\":\"passed\",\"frames\":5,\"keys\":\"tcm0s\","
          + "\"frame_records\":[" + records + "],\"quiet_ms\":" + quiet
          + ",\"core_code_source\":\"" + escape(codeSource(ClosedSpline2D.class))
          + "\",\"expected_jar\":\"" + escape(expectedJar.getCanonicalPath())
          + "\",\"renderer\":\"" + g.getClass().getName()
          + "\",\"density\":" + pixelDensity + "}";
      Files.write(new File(output, "native.json").toPath(),
          json.getBytes(StandardCharsets.UTF_8));
      events.shutdown();
      exit();
    } catch (Throwable error) {
      error.printStackTrace();
      System.exit(1);
    }
  }

  public static void main(String[] args) {
    if (args.length != 2) {
      throw new IllegalArgumentException("output directory and core JAR required");
    }
    File output = new File(args[0]);
    File jar = new File(args[1]);
    require(output.isDirectory() && jar.isFile(), "missing output/JAR");
    Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
      error.printStackTrace();
      System.exit(1);
    });
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "LoopMarksProbe"},
        new LoopMarksProbe(output, jar));
  }
}
