import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.procedurals.geometry.NearestSegmentContact2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Native lifecycle probe for the candidate ContactMarks PDE. */
public final class ContactMarksProbe extends ContactMarks {
  private static final String[] IDS = {"baseline", "shifted", "restored", "recolored", "reset"};
  private static final char[] KEYS = "nnc0s".toCharArray();
  private static final int[] CONTACT_BUILDS = {1, 2, 3, 3, 3};
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output, expectedJar;
  private int draws, keys;
  private Object retainedQueries;
  private String retainedQueryData, baselinePixels, previousPixels;
  private NearestSegmentContact2D previousContacts;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private ContactMarksProbe(File output, File expectedJar) {
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

  private static String pixelHash(int[] pixels) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (int value : pixels) putLong(digest, value & 0xffffffffL);
    return hex(digest.digest());
  }

  private static String json(Object value) {
    if (value == null) return "null";
    if (value instanceof String) return "\"" + escape((String) value) + "\"";
    if (value instanceof Number || value instanceof Boolean) return value.toString();
    if (value instanceof List) {
      StringBuilder result = new StringBuilder("[");
      List<?> values = (List<?>) value;
      for (int index = 0; index < values.size(); index++) {
        if (index != 0) result.append(',');
        result.append(json(values.get(index)));
      }
      return result.append(']').toString();
    }
    if (value instanceof Map) {
      StringBuilder result = new StringBuilder("{");
      boolean first = true;
      for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
        if (!first) result.append(',');
        first = false;
        result.append(json(String.valueOf(entry.getKey()))).append(':').append(json(entry.getValue()));
      }
      return result.append('}').toString();
    }
    throw new IllegalArgumentException("unsupported JSON value");
  }

  @Override public void setup() {
    try {
      require(codeSource(NearestSegmentContact2D.class).equals(expectedJar.getCanonicalPath()), "core origin");
      super.setup();
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  @Override public void draw() {
    try {
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      require(width == 640 && height == 640 && pixelDensity == 1
          && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"), "native environment");
      require(shifted == (state == 1), "obstacle control");
      require(alternateColors == (state == 3), "palette control");
      require(sourceBuilds == 1 && contactBuilds == CONTACT_BUILDS[state]
          && displayBuilds == state + 1, "retained stage counts");
      require(queries.size() == 10 && obstacles.size() == 4 && contacts.size() == 10,
          "contact inventory");
      if (state == 0) {
        retainedQueries = queries;
        retainedQueryData = json(queries);
      }
      require(queries == retainedQueries && json(queries).equals(retainedQueryData),
          "retained query replacement or mutation");
      if (state == 0) {
        previousContacts = contacts;
      } else if (state == 1 || state == 2) {
        require(contacts != previousContacts, "obstacle edit did not replace contacts");
        previousContacts = contacts;
      } else {
        require(contacts == previousContacts, "appearance edit replaced contacts");
      }
      super.draw();
      loadPixels();
      displayed.loadPixels();
      require(Arrays.equals(pixels, displayed.pixels), "cached framebuffer mismatch");
      String pixelsHash = pixelHash(pixels);
      if (state == 0) baselinePixels = pixelsHash;
      else if (state == 2 || state == 4) require(pixelsHash.equals(baselinePixels), "restored pixels mismatch");
      else require(!pixelsHash.equals(baselinePixels), "edit made no visible change");
      if (state > 0) require(!pixelsHash.equals(previousPixels), "key made no visible change from prior state");
      previousPixels = pixelsHash;
      if (state == 4) finalPixels = pixels.clone();
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"")
          .append(pixelsHash).append("\",\"queries\":").append(json(queries))
          .append(",\"obstacles\":").append(json(obstacles)).append(",\"hits\":")
          .append(json(contacts.toValues())).append('}');
      save(sketchPath(IDS[state] + ".png"));
      draws++;
      events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(),
          KeyEvent.PRESS, 0, KEYS[state], 0)), 180, TimeUnit.MILLISECONDS);
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
      require(quiet >= 300 && draws == 5 && keys == 5 && sourceBuilds == 1
          && contactBuilds == 3 && displayBuilds == 5, "save sequence");
      BufferedImage saved = ImageIO.read(new File(output, "contact-marks.png"));
      require(saved != null && saved.getWidth() == 640 && saved.getHeight() == 640, "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 640, 640, null, 0, 640)), "saved pixels");
      require(contacts == previousContacts && queries == retainedQueries, "save changed retained objects");
      String result = "{\"status\":\"passed\",\"frames\":5,\"keys\":\"nnc0s\","
          + "\"frame_records\":[" + records + "],\"contact_builds\":3,\"quiet_ms\":" + quiet
          + ",\"core_code_source\":\"" + escape(codeSource(NearestSegmentContact2D.class))
          + "\",\"expected_jar\":\"" + escape(expectedJar.getCanonicalPath())
          + "\",\"renderer\":\"" + g.getClass().getName()
          + "\",\"density\":1,\"width\":640,\"height\":640}";
      Files.write(new File(output, "native.json").toPath(), result.getBytes(StandardCharsets.UTF_8));
      events.shutdown();
      exit();
    } catch (Throwable error) {
      error.printStackTrace();
      System.exit(1);
    }
  }

  public static void main(String[] args) {
    if (args.length != 2) throw new IllegalArgumentException("output directory and core JAR required");
    File output = new File(args[0]);
    File jar = new File(args[1]);
    require(output.isDirectory() && jar.isFile(), "missing output/JAR");
    Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
      error.printStackTrace();
      System.exit(1);
    });
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "ContactMarksProbe"},
        new ContactMarksProbe(output, jar));
  }
}
