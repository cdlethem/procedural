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

/** Native interaction probe for the candidate PathClipMarks PDE. */
public final class PathClipMarksProbe extends PathClipMarks {
  private static final String[] IDS = {"baseline", "shallow-notch", "notch-restored", "recolored", "overlay", "reset"};
  private static final char[] KEYS = "nnco0s".toCharArray();
  private static final int[] BUILDS = {1,2,3,3,3,3};
  private Object retainedSources, retainedTraces, retainedPathIds, retainedStepIds;
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output, expectedJar;
  private int draws, keys;
  private SegmentClip2D previousClip;
  private String baselineGeometry, baselinePixels, previousPixels;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private PathClipMarksProbe(File output, File expectedJar) {
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
      require(codeSource(org.procedurals.paths.GradientPath2D.class).equals(expectedJar.getCanonicalPath()), "path core origin");
      super.setup();
    } catch (Exception error) { throw new IllegalStateException(error); }
  }

  @Override public void draw() {
    try {
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      require(width == 640 && height == 640 && pixelDensity == 1
        && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"), "native environment");
      require(shallowNotch == (state == 1), "notch control");
      require(alternateColors == (state == 3 || state == 4), "color control");
      require(showUnclipped == (state == 4), "overlay control");
      require(traceBuilds == 6 && sourceBuilds == 1 && clipBuilds == BUILDS[state]
        && displayBuilds == state + 1, "retained stage build counts");
      require(sources.size() == 960 && sourceToPath.length == 960 && sourceToStep.length == 960,
        "source inventory");
      if (state == 0) {
        retainedSources=sources; retainedTraces=traces;
        retainedPathIds=sourceToPath; retainedStepIds=sourceToStep;
      }
      require(sources==retainedSources && traces==retainedTraces
        && sourceToPath==retainedPathIds && sourceToStep==retainedStepIds, "replaced retained input");
      for (int source=0;source<sources.size();source++) {
        int path=sourceToPath[source], step=sourceToStep[source];
        require(path==source/160 && step==source%160, "source identity mapping");
        double[] a=traces[path].pointAt(step), b=traces[path].pointAt(step+1);
        double[] expected={a[0],a[1],b[0],b[1]};
        for(int axis=0;axis<4;axis++) require(Double.doubleToRawLongBits(expected[axis])
          ==Double.doubleToRawLongBits(sources.get(source).get(axis)), "source/path point mismatch");
      }
      String geometry = geometryHash();
      if (state==0) baselineGeometry=geometry;
      else if (state>=3) require(clipped==previousClip, "appearance replaced clipping");
      else require(clipped!=previousClip, "notch edit did not reclip");
      if (state>=2) require(geometry.equals(baselineGeometry), "restored/appearance geometry changed");
      if (state==1) require(!geometry.equals(baselineGeometry), "notch edit ineffective");
      for(int piece=0;piece<clipped.size();piece++) {
        int source=clipped.sourceIndexAt(piece);
        require(source>=0 && source<960 && sourceToPath[source]>=0 && sourceToPath[source]<6,
          "clipped source identity");
      }
      previousClip=clipped;
      super.draw(); loadPixels(); displayed.loadPixels();
      require(Arrays.equals(pixels, displayed.pixels), "cached framebuffer mismatch");
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
      require(quiet >= 300 && draws == 6 && keys == 6 && clipBuilds == 3 && traceBuilds == 6 && sourceBuilds == 1 && displayBuilds == 6, "save sequence");
      BufferedImage saved = ImageIO.read(new File(output, "path-clip-marks.png"));
      require(saved != null && saved.getWidth() == 640 && saved.getHeight() == 640, "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 640, 640, null, 0, 640)), "saved pixels");
      require(clipped == previousClip && geometryHash().equals(baselineGeometry), "save changed clipped geometry");
      String json = "{\"status\":\"passed\",\"frames\":6,\"keys\":\"nnco0s\","
        + "\"frame_records\":[" + records + "],\"clip_calls\":3,\"quiet_ms\":" + quiet
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
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "PathClipMarksProbe"},
        new PathClipMarksProbe(output, jar));
  }
}
