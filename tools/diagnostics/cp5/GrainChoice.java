import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import org.procedurals.layout.QuadrantPartition2D;

/**
 * Private CP5 grain walkthrough diagnostic. It compares a specified uniform triangle map
 * with the two distinct active source expressions in puntis and puntis3. It is not a public
 * operation, API proposal, source reconstruction, or portable stream contract.
 *
 * <p>All random streams here are separately seeded {@link java.util.Random} instances. That
 * is an investigation choice: it deliberately does not reproduce Processing random streams,
 * source mesh/palette preludes, or source pixels. The puntis3 profile consumes its seven
 * documented per-dot draws even though its source brightness is not used for this rendering.</p>
 */
public strictfp final class GrainChoice {
  private static final int WIDTH = 640;
  private static final int HEIGHT = 640;
  private static final long SEED = 42L;
  private static final double DENSITY = 0.1d;
  private static final double DENSER_DENSITY = 0.2d;
  private static final int DARK_TEAL = 0x173F5F;
  private static final int CORAL = 0xED553B;
  private static final int BACKGROUND = 0xF5F1E8;
  private static final int[] TRANSFER_PALETTE = {0x173F5F, 0x20639B, 0x3CAEA3, 0xF6D55C, 0xED553B};
  private static final String[] IDS = {
      "uniform", "vertex-biased", "edge-biased", "denser", "recolored", "strokes", "region-transfer"
  };

  private GrainChoice() { }

  private static final class Triangle {
    final double ax, ay, bx, by, cx, cy;
    Triangle(double ax, double ay, double bx, double by, double cx, double cy) {
      this.ax = ax; this.ay = ay; this.bx = bx; this.by = by; this.cx = cx; this.cy = cy;
    }
    double area() {
      return Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) * 0.5d;
    }
  }

  /** Packed centres deliberately avoid an object allocation per sample. */
  private static final class Points {
    final double[] xy;
    final int count;
    Points(int count) { this.xy = new double[count * 2]; this.count = count; }
    void set(int index, double x, double y) { xy[index * 2] = canonicalZero(x); xy[index * 2 + 1] = canonicalZero(y); }
    double x(int index) { return xy[index * 2]; }
    double y(int index) { return xy[index * 2 + 1]; }
  }

  private static final class Profile {
    final String id;
    final Points points;
    final int randomDraws;
    final int triangleCount;
    final String sampling;
    final int[] triangleOffsets;
    final Triangle[] triangles;
    Profile(String id, Points points, int randomDraws, int triangleCount, String sampling,
        int[] triangleOffsets, Triangle[] triangles) {
      this.id = id; this.points = points; this.randomDraws = randomDraws; this.triangleCount = triangleCount;
      this.sampling = sampling; this.triangleOffsets = triangleOffsets; this.triangles = triangles;
    }
  }

  private static final class Suite {
    final LinkedHashMap<String, Profile> profiles;
    Suite(LinkedHashMap<String, Profile> profiles) { this.profiles = profiles; }
  }

  private static final class Digest {
    private final MessageDigest digest;
    Digest() {
      try { digest = MessageDigest.getInstance("SHA-256"); }
      catch (NoSuchAlgorithmException error) { throw new AssertionError(error); }
    }
    void text(String value) { digest.update(value.getBytes(StandardCharsets.UTF_8)); digest.update((byte) 0); }
    void integer(int value) {
      digest.update((byte) (value >>> 24)); digest.update((byte) (value >>> 16));
      digest.update((byte) (value >>> 8)); digest.update((byte) value);
    }
    void bits(double value) {
      long bits = Double.doubleToRawLongBits(canonicalZero(value));
      for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte) (bits >>> shift));
    }
    String finish() {
      StringBuilder out = new StringBuilder(64);
      for (byte value : digest.digest()) out.append(String.format("%02x", Integer.valueOf(value & 255)));
      return out.toString();
    }
  }

  private interface Sampler { int sample(Random random, Triangle triangle, Points destination, int offset); }

  private static final Sampler UNIFORM = new Sampler() {
    public int sample(Random random, Triangle triangle, Points destination, int offset) {
      double r1 = random.nextFloat();
      double r2 = random.nextFloat();
      putMapped(triangle, r1, r2, destination, offset);
      return 2;
    }
  };
  /** Active puntis draw pattern: sqrt(nextFloat * nextFloat), then nextFloat; not binary32 source reproduction. */
  private static final Sampler PUNTIS_VERTEX_BIAS = new Sampler() {
    public int sample(Random random, Triangle triangle, Points destination, int offset) {
      double r1 = (double) random.nextFloat() * (double) random.nextFloat();
      double r2 = random.nextFloat();
      putMapped(triangle, r1, r2, destination, offset);
      return 3;
    }
  };
  /** Documented active puntis3 draw pattern; the first brightness product is intentionally discarded, not pixel-reproduced. */
  private static final Sampler PUNTIS3_EDGE_BIAS = new Sampler() {
    public int sample(Random random, Triangle triangle, Points destination, int offset) {
      double brightness = range(random, 0.1d, 1.0d) * random.nextFloat() * range(random, 0.5d, 1.0d);
      int dd = (int) range(random, 0.0d, 2.0d);
      double r2 = range(random, dd * 0.8d, 1.0d) * range(random, 0.4d, 1.0d);
      // The source uses brightness for stroke colour, then overwrites r1 for coordinates.
      if (!Double.isFinite(brightness)) throw new AssertionError("finite documented brightness draw");
      double r1 = random.nextFloat();
      putMapped(triangle, r1, r2, destination, offset);
      return 7;
    }
  };

  private static double range(Random random, double low, double high) {
    return low + (high - low) * (double) random.nextFloat();
  }

  /**
   * The private uniform coordinate map stated by the walkthrough: w0=1-sqrt(r1),
   * w1=(1-r2)*sqrt(r1), w2=r2*sqrt(r1), evaluated in this separate binary64 order.
   */
  private static void putMapped(Triangle triangle, double r1, double r2, Points destination, int offset) {
    double root = Math.sqrt(r1);
    double w0 = 1.0d - root;
    double w1 = (1.0d - r2) * root;
    double w2 = r2 * root;
    if (!(w0 >= 0.0d && w1 >= 0.0d && w2 >= 0.0d) || !Double.isFinite(w0 + w1 + w2))
      throw new AssertionError("invalid barycentric weights");
    double x = triangle.ax * w0 + triangle.bx * w1 + triangle.cx * w2;
    double y = triangle.ay * w0 + triangle.by * w1 + triangle.cy * w2;
    destination.set(offset, x, y);
  }

  private static int countFor(Triangle triangle, double density) {
    double value = triangle.area() * density;
    if (!(value >= 0.0d) || !Double.isFinite(value) || value > Integer.MAX_VALUE)
      throw new AssertionError("private walkthrough count");
    return (int) Math.ceil(value);
  }

  private static Profile singleTriangle(String id, Triangle triangle, double density, Sampler sampler, String sampling) {
    int count = countFor(triangle, density);
    Points points = new Points(count);
    Random random = new Random(SEED);
    int draws = 0;
    for (int index = 0; index < count; index++) draws += sampler.sample(random, triangle, points, index);
    return new Profile(id, points, draws, 1, sampling, new int[] {0, count}, new Triangle[] {triangle});
  }

  private static Profile transferred() {
    Map<String, Object> input = new LinkedHashMap<String, Object>();
    input.put("seed", Long.valueOf(42L));
    input.put("replacements", Integer.valueOf(4));
    input.put("origin", Arrays.<Object>asList(Double.valueOf(0.0d), Double.valueOf(0.0d)));
    input.put("extent", Arrays.<Object>asList(Double.valueOf(640.0d), Double.valueOf(640.0d)));
    input.put("selectionFraction", Double.valueOf(0.5d));
    QuadrantPartition2D partition = QuadrantPartition2D.generate(input);
    int triangleCount = partition.size() * 2;
    Triangle[] triangles = new Triangle[triangleCount];
    int[] counts = new int[triangleCount];
    int total = 0;
    for (int cell = 0; cell < partition.size(); cell++) {
      double[] b = partition.boundsAt(cell);
      int ordinal = cell * 2;
      triangles[ordinal] = new Triangle(b[0], b[1], b[2], b[1], b[2], b[3]); // TL, TR, BR
      triangles[ordinal + 1] = new Triangle(b[0], b[1], b[2], b[3], b[0], b[3]); // TL, BR, BL
      counts[ordinal] = countFor(triangles[ordinal], DENSITY);
      counts[ordinal + 1] = countFor(triangles[ordinal + 1], DENSITY);
      total += counts[ordinal] + counts[ordinal + 1];
    }
    Points points = new Points(total);
    int[] offsets = new int[triangleCount + 1];
    int cursor = 0;
    int draws = 0;
    for (int ordinal = 0; ordinal < triangleCount; ordinal++) {
      offsets[ordinal] = cursor;
      Random random = new Random(SEED + ordinal);
      for (int index = 0; index < counts[ordinal]; index++) {
        draws += UNIFORM.sample(random, triangles[ordinal], points, cursor++);
      }
    }
    offsets[triangleCount] = cursor;
    return new Profile("region-transfer", points, draws, triangleCount,
        "uniform private map; separate java.util.Random(42 + triangleOrdinal)", offsets, triangles);
  }

  private static Suite suite() {
    Triangle triangle = new Triangle(40.0d, 600.0d, 320.0d, 40.0d, 600.0d, 600.0d);
    Profile uniform = singleTriangle("uniform", triangle, DENSITY, UNIFORM, "uniform two-unit square-root barycentric map");
    Profile vertex = singleTriangle("vertex-biased", triangle, DENSITY, PUNTIS_VERTEX_BIAS,
        "active puntis first-coordinate product before square root");
    Profile edge = singleTriangle("edge-biased", triangle, DENSITY, PUNTIS3_EDGE_BIAS,
        "active puntis3 r2 product and consumed/overwritten brightness draws");
    Profile denser = singleTriangle("denser", triangle, DENSER_DENSITY, UNIFORM, "uniform two-unit square-root barycentric map");
    Profile recolored = new Profile("recolored", uniform.points, 0, 1, "same retained uniform points; style only",
        uniform.triangleOffsets, uniform.triangles);
    Profile strokes = new Profile("strokes", uniform.points, 0, 1,
        "same retained uniform centres; horizontal length-4 strokes may cross triangle edges", uniform.triangleOffsets, uniform.triangles);
    LinkedHashMap<String, Profile> values = new LinkedHashMap<String, Profile>();
    for (Profile profile : new Profile[] {uniform, vertex, edge, denser, recolored, strokes, transferred()}) values.put(profile.id, profile);
    return new Suite(values);
  }

  private static String hash(Points points) {
    Digest digest = new Digest();
    digest.text("cp5-grain-packed-points-v1"); digest.integer(points.count);
    for (int index = 0; index < points.count; index++) { digest.bits(points.x(index)); digest.bits(points.y(index)); }
    return digest.finish();
  }

  private static boolean samePrefix(Points prefix, Points whole) {
    if (prefix.count > whole.count) return false;
    for (int index = 0; index < prefix.count * 2; index++)
      if (Double.doubleToRawLongBits(prefix.xy[index]) != Double.doubleToRawLongBits(whole.xy[index])) return false;
    return true;
  }

  private static boolean insideTriangle(Points points, int from, int to, Triangle triangle) {
    double minX = Math.min(triangle.ax, Math.min(triangle.bx, triangle.cx));
    double maxX = Math.max(triangle.ax, Math.max(triangle.bx, triangle.cx));
    double minY = Math.min(triangle.ay, Math.min(triangle.by, triangle.cy));
    double maxY = Math.max(triangle.ay, Math.max(triangle.by, triangle.cy));
    double magnitude = Math.max(1.0d, Math.max(Math.abs(maxX - minX), Math.abs(maxY - minY)));
    double tolerance = Math.ulp(magnitude * magnitude) * 32.0d;
    double orientation = cross(triangle.ax, triangle.ay, triangle.bx, triangle.by, triangle.cx, triangle.cy);
    for (int index = from; index < to; index++) {
      double x = points.x(index), y = points.y(index);
      if (!Double.isFinite(x) || !Double.isFinite(y) || x < minX || x > maxX || y < minY || y > maxY) return false;
      double ab = cross(triangle.ax, triangle.ay, triangle.bx, triangle.by, x, y);
      double bc = cross(triangle.bx, triangle.by, triangle.cx, triangle.cy, x, y);
      double ca = cross(triangle.cx, triangle.cy, triangle.ax, triangle.ay, x, y);
      if (orientation > 0.0d ? (ab < -tolerance || bc < -tolerance || ca < -tolerance)
          : (ab > tolerance || bc > tolerance || ca > tolerance)) return false;
    }
    return true;
  }

  private static double cross(double ax, double ay, double bx, double by, double cx, double cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  }

  private static void require(boolean condition, String message) { if (!condition) throw new AssertionError(message); }

  private static void verify(Suite suite) {
    Profile uniform = suite.profiles.get("uniform");
    Profile vertex = suite.profiles.get("vertex-biased");
    Profile edge = suite.profiles.get("edge-biased");
    Profile denser = suite.profiles.get("denser");
    Profile recolored = suite.profiles.get("recolored");
    Profile strokes = suite.profiles.get("strokes");
    Profile transfer = suite.profiles.get("region-transfer");
    require(uniform.points.count == 15680, "uniform triangle count");
    require(vertex.points.count == uniform.points.count && edge.points.count == uniform.points.count, "same distribution counts");
    require(denser.points.count == 31360, "denser triangle count");
    require(uniform.randomDraws == 31360 && vertex.randomDraws == 47040 && edge.randomDraws == 109760,
        "documented source draw counts");
    require(recolored.points == uniform.points && strokes.points == uniform.points, "style profiles must retain identity");
    require(hash(uniform.points).equals(hash(recolored.points)) && hash(uniform.points).equals(hash(strokes.points)), "style geometry hash");
    require(samePrefix(uniform.points, denser.points), "denser uniform prefix");
    for (Profile profile : suite.profiles.values()) {
      require(profile.triangleOffsets.length == profile.triangleCount + 1, profile.id + " offsets");
      for (int triangle = 0; triangle < profile.triangleCount; triangle++) {
        require(profile.triangleOffsets[triangle] <= profile.triangleOffsets[triangle + 1], profile.id + " ordered offsets");
        require(insideTriangle(profile.points, profile.triangleOffsets[triangle], profile.triangleOffsets[triangle + 1], profile.triangles[triangle]),
            profile.id + " triangle containment");
      }
    }
    int total = 0;
    for (Profile profile : suite.profiles.values()) total += profile.points.count;
    require(total <= 160000, "registered mark budget");
    require(transfer.triangleCount == 26 && transfer.points.count > 0 && transfer.randomDraws == transfer.points.count * 2,
        "region transfer schedule");
  }

  private static String profileJson(Profile profile) {
    String pointsHash = hash(profile.points);
    return "{\"count\":" + profile.points.count + ",\"geometry_sha256\":" + quote(pointsHash)
        + ",\"raw_points_sha256\":" + quote(pointsHash) + ",\"centres_inside_input_triangles\":true"
        + ",\"random_draws\":" + profile.randomDraws + ",\"triangle_count\":" + profile.triangleCount
        + ",\"sampling\":" + quote(profile.sampling) + "}";
  }

  private static String report(String status, Suite suite, String outputDirectory) {
    StringBuilder profiles = new StringBuilder();
    int total = 0;
    for (String id : IDS) {
      Profile profile = suite.profiles.get(id);
      if (profiles.length() > 0) profiles.append(',');
      profiles.append(quote(id)).append(':').append(profileJson(profile));
      total += profile.points.count;
    }
    return "{\"status\":" + quote(status) + ",\"experiment\":\"cp5-grain\",\"private_only\":true"
        + ",\"canvas\":[640,640],\"renderer\":\"JAVA2D\",\"density\":1"
        + ",\"streams\":{\"class\":\"java.util.Random\",\"seed\":42,\"status\":\"private investigation compatibility stream; not public or Processing reproduction\",\"mapping_arithmetic\":\"java.util.Random nextFloat inputs followed by binary64 mapping; not Processing binary32 or pixel identity\"}"
        + ",\"checks\":{\"same_distribution_count\":true,\"documented_draw_consumption\":true,\"retained_style_identity\":true,\"denser_uniform_prefix\":true,\"centre_triangle_containment\":true,\"region_transfer_two_triangles_per_cell\":true,\"strokes_centres_only\":true,\"mark_budget_at_most_160000\":true}"
        + ",\"containment_tolerance\":\"orientation-aware 32 ulps of fixed <=640-coordinate squared magnitude\""
        + ",\"total_marks\":" + total + ",\"profiles\":{" + profiles + "}"
        + (outputDirectory == null ? "" : ",\"output_directory\":" + quote(outputDirectory)) + "}";
  }

  private static void draw(PGraphicsJava2D graphics, Profile profile) {
    graphics.background((BACKGROUND >>> 16) & 255, (BACKGROUND >>> 8) & 255, BACKGROUND & 255);
    if ("strokes".equals(profile.id)) {
      graphics.stroke((DARK_TEAL >>> 16) & 255, (DARK_TEAL >>> 8) & 255, DARK_TEAL & 255, 90);
      graphics.strokeWeight(1.0f);
      for (int index = 0; index < profile.points.count; index++) {
        float x = (float) profile.points.x(index), y = (float) profile.points.y(index);
        graphics.line(x - 2.0f, y, x + 2.0f, y);
      }
      return;
    }
    if ("region-transfer".equals(profile.id)) {
      graphics.strokeWeight(1.0f);
      for (int triangle = 0; triangle < profile.triangleCount; triangle++) {
        int colour = TRANSFER_PALETTE[triangle % TRANSFER_PALETTE.length];
        graphics.stroke((colour >>> 16) & 255, (colour >>> 8) & 255, colour & 255, 90);
        for (int index = profile.triangleOffsets[triangle]; index < profile.triangleOffsets[triangle + 1]; index++)
          graphics.point((float) profile.points.x(index), (float) profile.points.y(index));
      }
      return;
    }
    int colour = "recolored".equals(profile.id) ? CORAL : DARK_TEAL;
    int alpha = "recolored".equals(profile.id) ? 150 : 90;
    graphics.stroke((colour >>> 16) & 255, (colour >>> 8) & 255, colour & 255, alpha);
    graphics.strokeWeight(1.0f);
    for (int index = 0; index < profile.points.count; index++)
      graphics.point((float) profile.points.x(index), (float) profile.points.y(index));
  }

  private static void renderAll(File directory, Suite suite) {
    if (!directory.isAbsolute()) throw new IllegalArgumentException("output directory must be absolute");
    if (!directory.exists() && !directory.mkdirs()) throw new IllegalArgumentException("cannot create output directory");
    PApplet parent = new PApplet(); parent.noLoop();
    PGraphicsJava2D graphics = new PGraphicsJava2D();
    graphics.setParent(parent); graphics.setPrimary(false); graphics.pixelDensity = 1; graphics.setSize(WIDTH, HEIGHT);
    ArrayList<String> completed = new ArrayList<String>();
    try {
      for (String id : IDS) {
        Profile profile = suite.profiles.get(id);
        String before = hash(profile.points);
        File output = new File(directory, id + ".png");
        graphics.beginDraw(); draw(graphics, profile); graphics.endDraw();
        if (!graphics.save(output.getAbsolutePath())) throw new AssertionError("save failed: " + output);
        require(before.equals(hash(profile.points)), "drawing changed retained points: " + id);
        completed.add(id);
        writeProgress(directory, completed);
      }
    } finally { graphics.dispose(); }
  }

  private static void writeProgress(File directory, List<String> completed) {
    StringBuilder values = new StringBuilder();
    for (String id : completed) { if (values.length() > 0) values.append(','); values.append(quote(id)); }
    String json = "{\"experiment\":\"cp5-grain\",\"completed\":[" + values + "],\"expected\":[\"uniform\",\"vertex-biased\",\"edge-biased\",\"denser\",\"recolored\",\"strokes\",\"region-transfer\"]}";
    try { Files.write(new File(directory, "progress.json").toPath(), json.getBytes(StandardCharsets.UTF_8)); }
    catch (IOException error) { throw new IllegalStateException("cannot write progress", error); }
  }

  private static String quote(String value) { return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  private static double canonicalZero(double value) { return value == 0.0d ? 0.0d : value; }

  public static void main(String[] args) {
    Suite suite = suite();
    verify(suite);
    if (args.length == 1 && "--numeric".equals(args[0])) { System.out.println(report("passed", suite, null)); return; }
    if (args.length == 2 && "--render".equals(args[0])) {
      File directory = new File(args[1]); renderAll(directory, suite); System.out.println(report("rendered", suite, directory.getAbsolutePath())); return;
    }
    throw new IllegalArgumentException("usage: GrainChoice --numeric | GrainChoice --render <absolute-output-directory>");
  }
}
