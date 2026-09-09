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
import org.procedurals.geometry.SegmentClip2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Native interaction probe for the candidate ClipMarks PDE. */
public final class ClipMarksProbe extends ClipMarks {
  private static final String[] IDS = {"baseline", "sparse", "spacing-restored", "shallow-notch",
    "notch-restored", "supplied-strokes", "recolored", "endpoints-hidden", "overlay", "reset"};
  private static final char[] KEYS = "hhnntcmo0s".toCharArray();
  private static final int[] BUILDS = {1,2,3,4,5,6,6,6,6,7};
  private Object previousSources;
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output, expectedJar;
  private int draws, keys;
  private SegmentClip2D previousClip;
  private String baselineGeometry, baselinePixels, previousPixels;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private ClipMarksProbe(File output, File expectedJar) {
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
    double[] segment = new double[4], interval = new double[2];
    for (int i=0; i<clipped.size(); i++) {
      clipped.segmentInto(i, segment, 0); clipped.intervalInto(i, interval, 0);
      for (double x:segment) putLong(digest, Double.doubleToRawLongBits(x));
      for (double x:interval) putLong(digest, Double.doubleToRawLongBits(x));
      putLong(digest, clipped.sourceIndexAt(i));
    }
    return hex(digest.digest());
  }

  @Override public void setup() {
    try {
      require(codeSource(SegmentClip2D.class).equals(expectedJar.getCanonicalPath()), "core origin");
      super.setup();
    } catch (Exception error) { throw new IllegalStateException(error); }
  }

  @Override public void draw() {
    try {
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      require(width == 640 && height == 640 && pixelDensity == 1
        && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"), "native environment");
      require(sparse == (state == 1) && shallow == (state == 3), "region/hatch controls");
      require(alternateSource == (state>=5 && state<=8), "source control");
      require(alternateColor == (state>=6 && state<=8), "color control");
      require(endpoints == !(state==7 || state==8) && overlay == (state==8), "appearance controls");
      require(clipCalls == BUILDS[state], "clip rebuild count");
      String geometry = geometryHash();
      if (state == 0) baselineGeometry = geometry;
      else if (state>=6 && state<=8) require(clipped == previousClip, "appearance replaced clipping");
      else require(clipped != previousClip, "geometry edit reused result");
      if (state==2 || state==4 || state==9) require(geometry.equals(baselineGeometry), "restored geometry");
      if (state==1 || state==3 || state==5) require(!geometry.equals(baselineGeometry), "ineffective geometry edit");
      if (state==3 || state==4) require(sources==previousSources, "region changed sources");
      if (state>=5 && state<=8) require(sources==suppliedStrokes && clipped.size()==8, "supplied stroke transfer");
      previousClip = clipped; previousSources=sources;
      super.draw(); loadPixels(); displayed.loadPixels();
      require(Arrays.equals(pixels, displayed.pixels), "cached framebuffer mismatch");
      String current = pixelHash(pixels);
      if (state == 0) baselinePixels = current;
      else if (state==2 || state==4 || state==9) require(current.equals(baselinePixels), "restored pixels mismatch");
      else require(!current.equals(baselinePixels), "edit made no visible change");
      if (state>0) require(!current.equals(previousPixels), "key made no visible change from prior state");
      previousPixels=current;
      if (state == 9) finalPixels = pixels.clone();
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"")
        .append(current).append("\",\"geometry_sha256\":\"").append(geometry)
        .append("\",\"polygon\":").append(polygon.toString())
        .append(",\"sources\":").append(sources.toString()).append("}");
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
      require(quiet >= 300 && draws == 10 && keys == 10 && clipCalls == 7, "save sequence");
      BufferedImage saved = ImageIO.read(new File(output, "clip-marks.png"));
      require(saved != null && saved.getWidth() == 640 && saved.getHeight() == 640, "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 640, 640, null, 0, 640)), "saved pixels");
      require(clipped == previousClip && geometryHash().equals(baselineGeometry), "save changed clipped geometry");
      String json = "{\"status\":\"passed\",\"frames\":10,\"keys\":\"hhnntcmo0s\","
        + "\"frame_records\":[" + records + "],\"clip_calls\":7,\"quiet_ms\":" + quiet
        + ",\"core_code_source\":\"" + escape(codeSource(SegmentClip2D.class))
        + "\",\"expected_jar\":\"" + escape(expectedJar.getCanonicalPath())
        + "\",\"renderer\":\"" + g.getClass().getName()
        + "\",\"density\":1,\"width\":640,\"height\":640}";
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
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "ClipMarksProbe"},
        new ClipMarksProbe(output, jar));
  }
}
