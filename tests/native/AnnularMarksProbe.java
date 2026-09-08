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
import org.procedurals.mesh.AnnularMesh3D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Native interaction probe for the candidate AnnularMarks PDE. */
public final class AnnularMarksProbe extends AnnularMarks {
  private static final String[] IDS = {"baseline", "wide", "width-restored", "deep",
    "depth-restored", "facets", "facets-restored", "recolored", "colors-restored", "arrangement", "reset"};
  private static final char[] KEYS = "wwddffccm0s".toCharArray();
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output, expectedJar;
  private int draws, keys;
  private AnnularMesh3D previousMesh;
  private String baselineGeometry, baselinePixels;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private AnnularMarksProbe(File output, File expectedJar) {
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
    double[] triple = new double[3]; int[] indices = new int[3];
    for (long vertex = 0; vertex < mesh.vertexCount(); vertex++) {
      mesh.vertexInto(vertex, triple, 0);
      for (double x : triple) putLong(digest, Double.doubleToRawLongBits(x));
    }
    for (long face = 0; face < mesh.faceCount(); face++) {
      mesh.triangleInto(face, indices, 0);
      for (int x : indices) putLong(digest, x);
      mesh.normalInto(face, triple, 0);
      for (double x : triple) putLong(digest, Double.doubleToRawLongBits(x));
      putLong(digest, mesh.cellAt(face));
      digest.update(mesh.faceKindAt(face).getBytes(StandardCharsets.UTF_8));
    }
    return hex(digest.digest());
  }

  @Override public void setup() {
    try {
      require(codeSource(AnnularMesh3D.class).equals(expectedJar.getCanonicalPath()), "core origin");
      super.setup();
    } catch (Exception error) { throw new IllegalStateException(error); }
  }

  @Override public void draw() {
    try {
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      require(width == 640 && height == 640 && pixelDensity == 1
        && g.getClass().getName().equals("processing.opengl.PGraphics3D"), "native environment");
      require(wide == (state == 1) && deep == (state == 3) && coarse == (state == 5), "geometry controls");
      require(alternate == (state == 7) && arrangement == (state == 9), "appearance controls");
      require(meshBuilds == 1 + Math.min(state, 6), "mesh rebuild count");
      String geometry = geometryHash();
      if (state == 0) baselineGeometry = geometry;
      else if (state <= 6) require(mesh != previousMesh, "geometry edit reused old mesh");
      else require(mesh == previousMesh, "appearance edit replaced mesh");
      if (state == 1 || state == 3 || state == 5) require(!geometry.equals(baselineGeometry), "geometry edit ineffective");
      else require(geometry.equals(baselineGeometry), "retained/restored geometry mismatch");
      previousMesh = mesh;
      super.draw(); loadPixels(); displayedFrame.loadPixels();
      require(Arrays.equals(pixels, displayedFrame.pixels), "cached framebuffer mismatch");
      String current = pixelHash(pixels);
      if (state == 0) baselinePixels = current;
      else if (state == 1 || state == 3 || state == 5 || state == 7 || state == 9)
        require(!current.equals(baselinePixels), "edit made no visible change");
      else require(current.equals(baselinePixels), "restored pixels mismatch");
      if (state == 10) finalPixels = pixels.clone();
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"")
        .append(current).append("\",\"geometry_sha256\":\"").append(geometry).append("\"}");
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
      require(quiet >= 300 && draws == 11 && keys == 11 && meshBuilds == 7, "save sequence");
      BufferedImage saved = ImageIO.read(new File(output, "annular-marks.png"));
      require(saved != null && saved.getWidth() == 640 && saved.getHeight() == 640, "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 640, 640, null, 0, 640)), "saved pixels");
      require(mesh == previousMesh && geometryHash().equals(baselineGeometry), "save changed mesh");
      String json = "{\"status\":\"passed\",\"frames\":11,\"keys\":\"wwddffccm0s\","
        + "\"frame_records\":[" + records + "],\"mesh_builds\":7,\"quiet_ms\":" + quiet
        + ",\"core_code_source\":\"" + escape(codeSource(AnnularMesh3D.class))
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
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "AnnularMarksProbe"},
        new AnnularMarksProbe(output, jar));
  }
}
