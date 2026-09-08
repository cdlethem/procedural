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
import org.procedurals.geometry.RadialPull2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Six-state native probe for the actual PullMarks PDE and retained input and transformed geometry. */
public final class PullMarksProbe extends PullMarks {
  private static final String[] IDS = {"baseline", "wider", "falloff", "recolored", "contours", "reset"};
  private static final char[] KEYS = {'r', 'p', 'c', 'm', '0', 's'};

  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output;
  private final File expectedJar;
  private volatile int draws;
  private volatile int keys;
  private RadialPull2D previousField;
  private double[][][] originalGrid, originalContours, previousGrid, previousContours;
  private org.procedurals.paths.ClosedSpline2D[] originalLoops;
  private String inputHash, baselineGeometry, previousGeometry;
  private String baselinePixels;
  private String previousPixels;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private PullMarksProbe(File output, File expectedJar) {
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

  private static String geometryHash(double[][][]... sets) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (double[][][] set : sets) {
      putLong(digest, set.length);
      for (double[][] line : set) {
        putLong(digest, line.length);
        for (double[] point : line) for (double value : point)
          putLong(digest, Double.doubleToRawLongBits(value));
      }
    }
    return hex(digest.digest());
  }

  private void checkTransform(double[][][] input, double[][][] result) {
    require(input.length == result.length, "line count");
    double[] expected = new double[2];
    for (int i=0;i<input.length;i++) {
      require(input[i].length == result[i].length, "sample count");
      for (int j=0;j<input[i].length;j++) {
        field.transform(input[i][j][0],input[i][j][1],expected);
        require(Arrays.equals(expected,result[i][j]), "not current field output");
      }
    }
  }

  private static String pixelHash(int[] pixels) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (int value : pixels) putLong(digest, value & 0xffffffffL);
    return hex(digest.digest());
  }

  @Override public void setup() {
    super.setup();
    try {
      require(codeSource(RadialPull2D.class).equals(expectedJar.getCanonicalPath()),
          "wrong core JAR");
      require(codeSource(org.procedurals.paths.ClosedSpline2D.class).equals(expectedJar.getCanonicalPath()), "wrong spline JAR");
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  @Override public void draw() {
    try {
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      require(width == 512 && height == 512 && pixelDensity == 1
          && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"),
          "native environment");
      require(radius == (state >= 1 && state <= 4 ? 180 : 120), "radius state");
      require(power == (state >= 2 && state <= 4 ? .5 : 2), "power state");
      require(alternate == (state == 3 || state == 4), "palette state");
      require(contoursMode == (state == 4), "mode state");
      require(field != null && field.influenceCount()==2, "field");
      require(gridInputs.length==62 && contourInputs.length==3 && loops.length==3, "input collections");
      java.util.List<?> rows=(java.util.List<?>)field.serialize().get("influences");
      double[][] wanted={{200,240,radius,power},{350,320,radius,power}};
      for(int i=0;i<2;i++)for(int j=0;j<4;j++)
        require(((Number)((java.util.List<?>)rows.get(i)).get(j)).doubleValue()==wanted[i][j],"field descriptor");
      checkTransform(gridInputs,gridOutput);checkTransform(contourInputs,contourOutput);
      String geometry = geometryHash(gridOutput,contourOutput);
      String inputs = geometryHash(gridInputs,contourInputs);
      if (state == 0) {
        originalGrid=gridInputs; originalContours=contourInputs; originalLoops=loops;
        inputHash=inputs;baselineGeometry=geometry;
      } else {
        require(gridInputs==originalGrid && contourInputs==originalContours && loops==originalLoops,
            "input geometry replaced");
        require(inputHash.equals(inputs),"input samples changed");
        if(state==1 || state==2 || state==5) {
          require(field!=previousField && gridOutput!=previousGrid && contourOutput!=previousContours,
              "field edit failed to replace computed outputs");
          if(state==5)require(geometry.equals(baselineGeometry),"reset geometry mismatch");
          else require(!geometry.equals(previousGeometry),"field edit unchanged");
        } else {
          require(field==previousField && gridOutput==previousGrid && contourOutput==previousContours,
              "style/transfer recomputed geometry");
          require(geometry.equals(previousGeometry),"style/transfer changed geometry");
        }
      }
      previousField=field;previousGrid=gridOutput;previousContours=contourOutput;
      previousGeometry=geometry;

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
      else if (state < 5) require(!currentPixels.equals(previousPixels), "edit made no visible change");
      else {
        require(currentPixels.equals(baselinePixels), "reset pixels mismatch");
        finalPixels = pixels.clone();
      }
      previousPixels = currentPixels;
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state])
          .append("\",\"pixel_sha256\":\"").append(currentPixels)
          .append("\",\"geometry_sha256\":\"").append(geometry).append("\"}");
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
      File savedPath = new File(output, "pull-marks.png");
      BufferedImage saved = ImageIO.read(savedPath);
      require(saved != null && saved.getWidth() == 512 && saved.getHeight() == 512,
          "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 512, 512, null, 0, 512)),
          "saved pixels differ");
      String json = "{\"status\":\"passed\",\"frames\":6,\"keys\":\"rpcm0s\","
          + "\"frame_records\":[" + records + "],\"quiet_ms\":" + quiet
          + ",\"core_code_source\":\"" + escape(codeSource(RadialPull2D.class))
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
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "PullMarksProbe"},
        new PullMarksProbe(output, jar));
  }
}
