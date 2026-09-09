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
import org.procedurals.paths.GradientPath2D;
import org.procedurals.processing.Java2DRegions;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Native interaction probe for the candidate MaskedPartitionMarks PDE. */
public final class MaskedPartitionMarksProbe extends MaskedPartitionMarks {
  private static final String[] IDS = {"baseline", "shifted", "restored", "local", "crop", "reset"};
  private static final char[] KEYS = "nnmm0s".toCharArray();
  private static final int[] BUILDS = {1,2,3,3,3,3};
  private Object retainedSource, retainedGlobal, retainedPaths;
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output, expectedJar;
  private int draws, keys;
  private Object previousMasks;
  private String baselineGeometry, baselinePixels, previousPixels;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private MaskedPartitionMarksProbe(File output, File expectedJar) {
    this.output = output; this.expectedJar = expectedJar;
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

  private static String pixelHash(int[] pixels) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (int value : pixels) putLong(digest, value & 0xffffffffL);
    return hex(digest.digest());
  }


  private String geometryHash() throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (GradientPath2D path : paths) for (int step=0;step<=PATH_STEPS;step++)
      for (double value : path.pointAt(step)) putLong(digest, Double.doubleToRawLongBits(value));
    sourceImage.loadPixels(); globalImage.loadPixels();
    for (int value : sourceImage.pixels) putLong(digest, value & 0xffffffffL);
    for (int value : globalImage.pixels) putLong(digest, value & 0xffffffffL);
    return hex(digest.digest());
  }

  @Override public void setup() {
    try {
      require(codeSource(GradientPath2D.class).equals(expectedJar.getCanonicalPath()), "core origin");
      require(codeSource(org.procedurals.paths.GradientPath2D.class).equals(expectedJar.getCanonicalPath()), "path core origin");
      super.setup();
    } catch (Exception error) { throw new IllegalStateException(error); }
  }

  @Override public void draw() {
    try {
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      require(width == 720 && height == 480 && pixelDensity == 1
        && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"), "native environment");
      require(alternateLayout == (state == 1), "layout control");
      require(mode == (state == 3 ? 1 : state == 4 ? 2 : 0), "content control");
      require(sourceBuilds == 1 && maskBuilds == BUILDS[state]
        && displayBuilds == state + 1, "retained stage counts");
      require(paths.length == 24 && masks.size() == 4, "source and mask inventory");
      if (state == 0) {
        retainedSource=sourceImage; retainedGlobal=globalImage; retainedPaths=paths;
      }
      require(sourceImage==retainedSource && globalImage==retainedGlobal && paths==retainedPaths,
        "source replacement");
      String geometry = geometryHash();
      if (state==0) baselineGeometry=geometry;
      else require(geometry.equals(baselineGeometry), "retained content mutation");
      if (state>=3) require(masks==previousMasks, "content edit replaced masks");
      else if (state>0) require(masks!=previousMasks, "layout edit did not replace masks");
      previousMasks=masks;
      super.draw(); loadPixels(); displayed.loadPixels();
      require(Arrays.equals(pixels, displayed.pixels), "cached framebuffer mismatch");
      ground.loadPixels();
      for (int y=0; y<height; y++) for (int x=0; x<width; x++) {
        boolean possiblyCovered=false;
        for (Java2DRegions.MaskedRegion mask : masks) {
          Java2DRegions.Region r=mask.region;
          if (x>=r.left+6 && x<r.right-6 && y>=r.top+6 && y<r.bottom-6) possiblyCovered=true;
        }
        if (!possiblyCovered) require(pixels[y*width+x]==ground.pixels[y*width+x], "outside changed");
      }
      String current = pixelHash(pixels);
      if (state == 0) baselinePixels = current;
      else if (state==2 || state==5) require(current.equals(baselinePixels), "restored pixels mismatch");
      else require(!current.equals(baselinePixels), "edit made no visible change");
      if (state>0) require(!current.equals(previousPixels), "key made no visible change from prior state");
      previousPixels=current;
      if (state == 5) finalPixels = pixels.clone();
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"")
        .append(current).append("\",\"geometry_sha256\":\"").append(geometry)
        .append("\"}");
      save(sketchPath(IDS[state] + ".png"));
      draws++;
      events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(),
        KeyEvent.PRESS, 0, KEYS[state], 0)), 180, TimeUnit.MILLISECONDS);
    } catch (Exception error) { throw new IllegalStateException(error); }
  }

  @Override public void keyPressed() {
    require(keys < KEYS.length && key == KEYS[keys], "key order");
    super.keyPressed(); keys++;
    if (key == 's') {
      long savedAt = System.nanoTime();
      events.schedule(() -> finish(savedAt), 300, TimeUnit.MILLISECONDS);
    }
  }

  private void finish(long savedAt) {
    try {
      long quiet = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - savedAt);
      require(quiet >= 300 && draws == 6 && keys == 6 && maskBuilds == 3 && sourceBuilds == 1 && displayBuilds == 6, "save sequence");
      BufferedImage saved = ImageIO.read(new File(output, "masked-partition-marks.png"));
      require(saved != null && saved.getWidth() == 720 && saved.getHeight() == 480, "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 720, 480, null, 0, 720)), "saved pixels");
      require(masks == previousMasks && geometryHash().equals(baselineGeometry), "save changed retained content");
      String json = "{\"status\":\"passed\",\"frames\":6,\"keys\":\"nnmm0s\","
        + "\"frame_records\":[" + records + "],\"mask_builds\":3,\"quiet_ms\":" + quiet
        + ",\"core_code_source\":\"" + escape(codeSource(GradientPath2D.class))
        + "\",\"expected_jar\":\"" + escape(expectedJar.getCanonicalPath())
        + "\",\"renderer\":\"" + g.getClass().getName()
        + "\",\"density\":1,\"width\":720,\"height\":480}";
      Files.write(new File(output, "native.json").toPath(), json.getBytes(StandardCharsets.UTF_8));
      events.shutdown(); exit();
    } catch (Throwable error) { error.printStackTrace(); System.exit(1); }
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
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "MaskedPartitionMarksProbe"},
        new MaskedPartitionMarksProbe(output, jar));
  }
}
