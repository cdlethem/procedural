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
import org.procedurals.layout.BinaryCellPartition2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Six-state native probe for the actual PanelMarks PDE and retained cell layout. */
public final class PanelMarksProbe extends PanelMarks {
  private static final String[] IDS = {"baseline", "denser", "random_axis", "recolored", "panels", "reset"};
  private static final char[] KEYS = {'a', 'p', 'c', 'm', '0', 's'};

  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output;
  private final File expectedJar;
  private volatile int draws;
  private volatile int keys;
  private BinaryCellPartition2D baselineLayout;
  private BinaryCellPartition2D changedLayout;
  private String baselineGeometry;
  private String changedGeometry;
  private String baselinePixels;
  private String previousPixels;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private PanelMarksProbe(File output, File expectedJar) {
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

  private static String layoutHash(BinaryCellPartition2D layout) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    putLong(digest, layout.splits());
    int[] bounds = new int[4];
    for (int i = 0; i < layout.size(); i++) {
      layout.boundsInto(i, bounds);
      for (int value : bounds) putLong(digest, value);
    }
    return hex(digest.digest());
  }

  private static String pixelHash(int[] pixels) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (int value : pixels) putLong(digest, value & 0xffffffffL);
    return hex(digest.digest());
  }

  @Override public void setup() {
    super.setup();
    try {
      require(codeSource(BinaryCellPartition2D.class).equals(expectedJar.getCanonicalPath()),
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
      require(attempts == (state >= 1 && state <= 4 ? 240 : 80), "attempt-count state");
      require(randomAxis == (state >= 2 && state <= 4), "axis state");
      require(alternate == (state == 3 || state == 4), "palette state");
      require(solidPanels == (state == 4), "decoration state");
      BinaryCellPartition2D current = layout;
      require(current != null && current.size() > 1, "retained layout");
      String geometry = layoutHash(current);
      if (state == 0) {
        baselineLayout = current;
        baselineGeometry = geometry;
      } else if (state == 1 || state == 2) {
        require(current != baselineLayout && current != changedLayout, "structural edit did not rebuild");
        require(!geometry.equals(state == 1 ? baselineGeometry : changedGeometry), "structural edit unchanged");
        changedLayout = current;
        changedGeometry = geometry;
      } else if (state == 3 || state == 4) {
        require(current == changedLayout, "style edit replaced layout");
        require(geometry.equals(changedGeometry), "style edit changed bounds");
      } else {
        require(current != baselineLayout && current != changedLayout, "reset did not rebuild");
        require(geometry.equals(baselineGeometry), "reset geometry mismatch");
      }

      super.draw();
      loadPixels();
      displayedFrame.loadPixels();
      require(Arrays.equals(pixels, displayedFrame.pixels), "cached/framebuffer mismatch");
      int changed = 0;
      for (int pixel : pixels) {
        require((pixel >>> 24) == 255, "nonopaque framebuffer");
        if ((pixel & 0xffffff) != 0xf5f2eb) changed++;
      }
      require(changed > 0, "blank frame");
      String currentPixels = pixelHash(pixels);
      if (state == 0) baselinePixels = currentPixels;
      else if (state < 5) require(!currentPixels.equals(previousPixels), "edit made no visible change");
      else {
        require(currentPixels.equals(baselinePixels), "reset pixels mismatch");
        finalPixels = pixels.clone();
      }
      previousPixels = currentPixels;
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state])
          .append("\",\"pixel_sha256\":\"").append(currentPixels)
          .append("\",\"layout_sha256\":\"").append(layoutHash(current)).append("\"}");
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
      require(quiet >= 300 && draws == 6 && keys == 6, "save quiet/sequence");
      File savedPath = new File(output, "panel-marks.png");
      BufferedImage saved = ImageIO.read(savedPath);
      require(saved != null && saved.getWidth() == 640 && saved.getHeight() == 640,
          "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 640, 640, null, 0, 640)),
          "saved pixels differ");
      String json = "{\"status\":\"passed\",\"frames\":6,\"keys\":\"apcm0s\","
          + "\"frame_records\":[" + records + "],\"quiet_ms\":" + quiet
          + ",\"core_code_source\":\"" + escape(codeSource(BinaryCellPartition2D.class))
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
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "PanelMarksProbe"},
        new PanelMarksProbe(output, jar));
  }
}
