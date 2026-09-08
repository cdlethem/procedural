import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.core.PConstants;
import processing.event.KeyEvent;
import org.procedurals.examples.springmarks.SpringComposition;
import org.procedurals.motion.TargetSprings2D;
import org.procedurals.topology.Delaunay2D;

/**
 * Native instrumentation for the officially preprocessed SpringMarks PDE.
 * It deliberately subclasses that actual sketch: scheduled frames call super.draw(),
 * and every control is delivered as a Processing KeyEvent.
 */
public final class SpringMarksProbe extends SpringMarks {
  private static final char SPACE = ' ';
  private static final int NONE = 0, RINGS = 1, TRAILS_PHASE = 2, DOTS = 3, VELOCITY = 4, WIRE = 5, TARGET_GUIDES = 6;
  private final File output, expectedCore;
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final ArrayList<Plan> plan = new ArrayList<Plan>();
  private final StringBuilder records = new StringBuilder();
  private final Map<String, Map<Integer, Snapshot>> traces = new LinkedHashMap<String, Map<Integer, Snapshot>>();
  private int cursor, phase, rings, trailShapes, trailVertices, dots, velocityLines, wireLines, targetLines;
  private boolean permitDraw;
  private int[] baselinePixels;
  private String savedFilename;
  private Delaunay2D initialMesh;

  private static final class Plan {
    final String id, series;
    final char key;
    final long tick;
    final boolean png;
    Plan(String id, char key) { this.id = id; this.key = key; this.tick = -1L; this.png = false; this.series = null; }
    Plan(String id, long tick, boolean png, String series) {
      this.id = id; this.key = 0; this.tick = tick; this.png = png; this.series = series;
    }
    boolean isKey() { return key != 0; }
  }

  private static final class Snapshot {
    final long tick;
    final long[] body, targets, history;
    Snapshot(long tick, long[] body, long[] targets, long[] history) {
      this.tick = tick; this.body = body; this.targets = targets; this.history = history;
    }
    boolean exact(Snapshot other) {
      return tick == other.tick && Arrays.equals(body, other.body) && Arrays.equals(targets, other.targets)
          && Arrays.equals(history, other.history);
    }
  }

  private SpringMarksProbe(File output, File expectedCore) {
    this.output = output;
    this.expectedCore = expectedCore;
    buildPlan();
  }

  private static void require(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }

  private static void same(float actual, double expected, String message) {
    require(Float.floatToRawIntBits(actual) == Float.floatToRawIntBits((float) expected), message);
  }

  private static void sameFloat(float actual, float expected, String message) {
    require(Float.floatToRawIntBits(actual) == Float.floatToRawIntBits(expected), message);
  }

  private static int argb(int rgb, int alpha) { return (alpha << 24) | rgb; }

  private static String source(Class<?> type) {
    try { return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath(); }
    catch (Exception error) { throw new IllegalStateException(error); }
  }

  private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\""); }

  /* This is intentionally explicit and exported by --describe for root's registered plan. */
  private void buildPlan() {
    frame("baseline-000", 0, true, null);
    for (int i = 1; i <= 20; i++) frame("paused-" + two(i), 0, false, null);
    key('d'); key('t'); frame("disturbed-000-targets", 0, true, "primary");
    key('.'); frame("period-001", 1, true, "primary");
    key(SPACE);
    for (int tick = 2; tick <= 120; tick++) {
      frame("primary-" + three(tick), tick, contains(new int[] {1, 10, 30, 60, 120}, tick), "primary");
      // S is delivered after the completed running tick30 frame and before tick31.
      if (tick == 30) key('s');
    }
    key(SPACE);

    key('0'); key('d'); key('t'); frame("replay-000", 0, false, "replay");
    key('.'); frame("replay-001", 1, true, "replay");
    key(SPACE); run("replay", 2, 120, new int[] {10, 30, 60, 120}); key(SPACE);

    key('0'); key('d'); key(SPACE); run("styles-pre", 1, 30, new int[] {30}); key(SPACE);
    key('m'); frame("style-velocity-030", 30, true, null);
    key('m'); frame("style-wire-030", 30, true, null);
    key('c'); frame("style-palette-030", 30, true, null);
    key('h'); frame("style-no-trails-030", 30, true, null);
    key('t'); frame("style-targets-030", 30, true, null);

    key('0'); key('d'); key(SPACE); run("response-k-pre", 1, 30, new int[] {30}); key(SPACE);
    key('k'); frame("response-strength-030", 30, true, null);
    key(SPACE); frame("response-strength-031", 31, true, null); key(SPACE);
    key('0'); key('d'); key(SPACE); run("response-v-pre", 1, 30, new int[] {30}); key(SPACE);
    key('v'); frame("response-retention-030", 30, true, null);
    key(SPACE); frame("response-retention-031", 31, true, null); key(SPACE);

    key('0'); key('d'); key('k'); key(SPACE); run("strength-005", 1, 120, new int[] {1, 10, 30, 60, 120}); key(SPACE);
    key('0'); key('d'); key('v'); key(SPACE); run("retention-09", 1, 120, new int[] {1, 10, 30, 60, 120}); key(SPACE);

    longRun("long-primary", false);
    longRun("long-replay", true);
  }

  private void longRun(String series, boolean replay) {
    key('0'); key('d'); frame(series + "-000", 0, false, series); key(SPACE);
    for (int tick = 1; tick <= 260; tick++) {
      if (tick == 141) key('d');
      boolean capture = tick == 120 || tick == 121 || tick == 140 || tick == 141 || tick == 260;
      frame(series + "-" + three(tick), tick, capture, series);
    }
    key(SPACE);
    if (!replay) { key('m'); key('m'); frame("long-primary-wire-260", 260, true, null); }
  }

  private void run(String series, int first, int last, int[] captures) {
    for (int tick = first; tick <= last; tick++) frame(series + "-" + three(tick), tick, contains(captures, tick), series);
  }
  private static boolean contains(int[] values, int value) { for (int item : values) if (item == value) return true; return false; }
  private void key(char value) { plan.add(new Plan("key-" + printable(value) + "-" + plan.size(), value)); }
  private void frame(String id, long tick, boolean png, String series) { plan.add(new Plan(id, tick, png, series)); }
  private static String two(int n) { return String.format(Locale.ROOT, "%02d", n); }
  private static String three(int n) { return String.format(Locale.ROOT, "%03d", n); }
  private static String printable(char key) { return key == SPACE ? "space" : String.valueOf(key); }

  public static String describeSchedule() {
    SpringMarksProbe probe = new SpringMarksProbe(new File("/unused"), new File("/unused"));
    StringBuilder out = new StringBuilder("{\"frame_ids\":[");
    boolean first = true;
    for (Plan item : probe.plan) if (!item.isKey()) {
      if (!first) out.append(','); first = false;
      out.append("{\"id\":\"").append(item.id).append("\",\"tick\":").append(item.tick)
          .append(",\"png\":").append(item.png).append(",\"series\":")
          .append(item.series == null ? "null" : "\"" + item.series + "\"").append('}');
    }
    out.append("],\"key_events\":["); first = true;
    for (Plan item : probe.plan) if (item.isKey()) {
      if (!first) out.append(','); first = false;
      out.append("\"").append(printable(item.key)).append("\"");
    }
    return out.append("]}").toString();
  }

  @Override public void settings() { super.settings(); }

  @Override public void setup() {
    super.setup();
    require(width == 640 && height == 640 && pixelDensity == 1 && g instanceof PGraphicsJava2D, "640 JAVA2D density1");
    require(g.colorMode == RGB && g.colorModeX == 255 && g.colorModeY == 255 && g.colorModeZ == 255 && g.colorModeA == 255,
        "RGB255");
    try {
      require(source(TargetSprings2D.class).equals(expectedCore.getCanonicalPath()), "TargetSprings2D staged core origin");
      require(source(SpringComposition.class).equals(source(SpringMarks.class)), "SpringComposition staged build origin");
    } catch (Exception error) { throw new IllegalStateException(error); }
    scheduleNext();
  }

  @Override public void draw() {
    if (!permitDraw) return;
    permitDraw = false;
    Plan item = current();
    require(!item.isKey(), "frame expected");
    boolean wasRunning = RUNNING, wasDirty = DIRTY;
    Snapshot before = snapshot();
    PImage beforeCache = displayedFrame;
    resetGeometry();
    super.draw();
    Snapshot after = snapshot();
    require(after.tick == item.tick, item.id + " tick");
    if (!wasRunning && !wasDirty) {
      require(before.exact(after) && beforeCache == displayedFrame, "paused clean draw retained state/cache");
    } else {
      checkCachedFrame();
      validateGeometry();
    }
    if (item.series != null) track(item.series, after);
    if (item.png) saveCapture(item.id);
    appendRecord(item, after);
    cursor++;
    scheduleNext();
  }

  @Override public void keyPressed() {
    Plan item = current();
    require(item.isKey() && key == item.key, "scheduled native key " + (item.isKey() ? printable(item.key) : "frame"));
    Snapshot before = snapshot();
    Delaunay2D beforeMesh = composition.mesh();
    PImage cache = displayedFrame;
    long tick = composition.tick();
    super.keyPressed();
    Snapshot after = snapshot();
    if (initialMesh == null) initialMesh = beforeMesh;
    require(composition.mesh() == beforeMesh && composition.mesh() == initialMesh, "all SpringMarks edits retain initial mesh identity");
    if (key == 'd') {
      require(after.tick == tick && Arrays.equals(before.body, after.body) && !Arrays.equals(before.targets, after.targets), "D targets only");
    } else if (key == '.') {
      if (!RUNNING) require(after.tick == tick + 1, "period exactly one paused step");
    } else if (key == 'k' || key == 'v') {
      require(after.tick == tick && Arrays.equals(before.targets, after.targets) && Arrays.equals(before.history, after.history), "response retention");
      for (int body = 0; body < composition.motion().size(); body++) {
        require(before.body[body * 6] == after.body[body * 6] && before.body[body * 6 + 1] == after.body[body * 6 + 1]
            && before.body[body * 6 + 2] == after.body[body * 6 + 2] && before.body[body * 6 + 3] == after.body[body * 6 + 3],
            "response pos/vel preserved");
      }
    } else if (key == 's') {
      require(before.exact(after) && cache == displayedFrame, "save no state/cache change");
      savedFilename = findSaved();
      checkSavedPixels(savedFilename);
    } else if (key != '0') {
      require(before.exact(after), "style/space key did not directly step");
    }
    cursor++;
    scheduleNext();
  }

  private Plan current() { require(cursor < plan.size(), "schedule exhausted"); return plan.get(cursor); }
  private void scheduleNext() {
    if (cursor == plan.size()) { events.schedule(new Runnable() { public void run() { finish(); } }, 80, TimeUnit.MILLISECONDS); return; }
    Plan item = current();
    if (item.isKey()) events.schedule(new Runnable() {
      public void run() { postEvent(new KeyEvent(null, System.currentTimeMillis(), KeyEvent.PRESS, 0, current().key, 0)); }
    }, 35, TimeUnit.MILLISECONDS);
    else permitDraw = true;
  }

  private Snapshot snapshot() {
    TargetSprings2D motion = composition.motion();
    int bodies = motion.size(), samples = composition.sampleCount();
    long[] body = new long[bodies * 6], targets = new long[bodies * 2], history = new long[samples * bodies * 2];
    double[] pair = new double[2];
    for (int i = 0; i < bodies; i++) {
      motion.positionInto((long)i, pair, 0); body[i * 6] = Double.doubleToRawLongBits(pair[0]); body[i * 6 + 1] = Double.doubleToRawLongBits(pair[1]);
      motion.velocityInto((long)i, pair, 0); body[i * 6 + 2] = Double.doubleToRawLongBits(pair[0]); body[i * 6 + 3] = Double.doubleToRawLongBits(pair[1]);
      body[i * 6 + 4] = Double.doubleToRawLongBits(motion.strengthAt((long)i)); body[i * 6 + 5] = Double.doubleToRawLongBits(motion.retentionAt((long)i));
      composition.targetInto(i, pair, 0); targets[i * 2] = Double.doubleToRawLongBits(pair[0]); targets[i * 2 + 1] = Double.doubleToRawLongBits(pair[1]);
    }
    for (int sample = 0, at = 0; sample < samples; sample++) for (int bodyIndex = 0; bodyIndex < bodies; bodyIndex++) {
      composition.historyInto(sample, bodyIndex, pair, 0); history[at++] = Double.doubleToRawLongBits(pair[0]); history[at++] = Double.doubleToRawLongBits(pair[1]);
    }
    return new Snapshot(composition.tick(), body, targets, history);
  }

  private void track(String series, Snapshot value) {
    Map<Integer, Snapshot> values = traces.get(series);
    if (values == null) { values = new LinkedHashMap<Integer, Snapshot>(); traces.put(series, values); }
    values.put(Integer.valueOf((int)value.tick), value);
    if ("replay".equals(series)) exactTrace("primary", values, value.tick);
    if ("long-replay".equals(series)) exactTrace("long-primary", values, value.tick);
  }

  private void exactTrace(String base, Map<Integer, Snapshot> observed, long tick) {
    Map<Integer, Snapshot> expected = traces.get(base);
    require(expected != null && expected.containsKey(Integer.valueOf((int)tick)), "reference trace " + base + " tick " + tick);
    require(expected.get(Integer.valueOf((int)tick)).exact(observed.get(Integer.valueOf((int)tick))), "exact replay " + base + " tick " + tick);
  }

  private void resetGeometry() { phase = NONE; rings = trailShapes = trailVertices = dots = velocityLines = wireLines = targetLines = 0; }
  private int rgb(int index) { int[] colors = ALTERNATE ? OTHER_COLORS : COLORS; return colors[index % colors.length]; }
  private void style(int color, float weight, boolean fill, boolean stroke, String message) {
    require(g.fill == fill && g.stroke == stroke && (!fill || g.fillColor == color) && (!stroke || g.strokeColor == color), message + " color state");
    if (stroke) same(g.strokeWeight, weight, message + " weight");
  }

  @Override public void drawInitialRings() { phase = RINGS; super.drawInitialRings(); require(rings == composition.motion().size(), "initial ring count"); phase = NONE; }
  @Override public void drawTrails() { phase = TRAILS_PHASE; super.drawTrails(); require(trailShapes == composition.motion().size(), "trail shape count"); require(trailVertices == composition.motion().size() * composition.sampleCount(), "trail vertex count"); phase = NONE; }
  @Override public void drawDots() { phase = DOTS; super.drawDots(); require(dots == composition.motion().size(), "dot count"); phase = NONE; }
  @Override public void drawVelocity() { phase = VELOCITY; super.drawVelocity(); require(velocityLines == composition.motion().size(), "velocity count"); phase = NONE; }
  @Override public void drawFixedWire() { phase = WIRE; super.drawFixedWire(); require(wireLines == composition.mesh().edgeCount(), "unique fixed wire count"); phase = NONE; }
  @Override public void drawTargetGuides() { phase = TARGET_GUIDES; super.drawTargetGuides(); require(targetLines == composition.motion().size() * 3, "target guide count"); phase = NONE; }

  @Override public void ellipse(float x, float y, float w, float h) {
    int color = 0;
    if (phase == RINGS) {
      composition.initialInto(rings, initial, 0); same(x, initial[0], "ring x"); same(y, initial[1], "ring y"); same(w, 9, "ring width"); same(h, 9, "ring height");
      color = 0x4b2d3237; style(color, 1f, false, true, "ring"); rings++;
    } else if (phase == DOTS) {
      composition.motion().positionInto((long)dots, position, 0); same(x, position[0], "dot x"); same(y, position[1], "dot y"); same(w, 8, "dot width"); same(h, 8, "dot height");
      color = argb(rgb(dots), 230); style(color, 0f, true, false, "dot"); dots++;
    }
    super.ellipse(x, y, w, h);
    if (phase == RINGS || phase == DOTS) consumed(color);
  }

  @Override public void beginShape() {
    if (phase == TRAILS_PHASE) { require(trailShapes < composition.motion().size(), "extra trail shape"); trailShapes++; }
    super.beginShape();
  }
  @Override public void vertex(float x, float y) {
    if (phase == TRAILS_PHASE) {
      int body = trailShapes - 1, sample = (trailVertices / composition.motion().size());
      int expectedBody = trailVertices % composition.motion().size();
      // Shapes are emitted body-major; calculate that order directly, not from an implicit join.
      body = trailVertices / composition.sampleCount(); sample = trailVertices % composition.sampleCount();
      composition.historyInto(sample, body, position, 0); same(x, position[0], "trail x"); same(y, position[1], "trail y");
      style(argb(rgb(body), 105), 1f, false, true, "trail"); trailVertices++;
    }
    super.vertex(x, y);
  }
  @Override public void endShape() { if (phase == TRAILS_PHASE) require(trailVertices % composition.sampleCount() == 0, "open trail completed"); super.endShape(); }
  @Override public void endShape(int mode) {
    if (phase == TRAILS_PHASE) require(mode == PConstants.OPEN, "trail must remain OPEN, never CLOSE");
    super.endShape(mode);
  }

  @Override public void line(float x1, float y1, float x2, float y2) {
    int color = 0;
    if (phase == VELOCITY) {
      composition.motion().positionInto((long)velocityLines, position, 0); composition.motion().velocityInto((long)velocityLines, velocity, 0);
      same(x1, position[0], "velocity x1"); same(y1, position[1], "velocity y1"); same(x2, position[0] + velocity[0] * 24d, "velocity x2"); same(y2, position[1] + velocity[1] * 24d, "velocity y2");
      color = argb(rgb(velocityLines), 220); style(color, 1.5f, false, true, "velocity"); velocityLines++;
    } else if (phase == WIRE) {
      composition.mesh().edgeInto((long)wireLines, edge, 0); int first = composition.bodyForVertex(edge[0]), second = composition.bodyForVertex(edge[1]);
      composition.motion().positionInto((long)first, position, 0); composition.motion().positionInto((long)second, otherPosition, 0);
      same(x1, position[0], "wire x1"); same(y1, position[1], "wire y1"); same(x2, otherPosition[0], "wire x2"); same(y2, otherPosition[1], "wire y2");
      color = argb(rgb(wireLines), 185); style(color, 1.1f, false, true, "wire"); wireLines++;
    } else if (phase == TARGET_GUIDES) {
      int body = targetLines / 3, part = targetLines % 3; composition.motion().positionInto((long)body, position, 0); composition.targetInto(body, target, 0);
      if (part == 0) { same(x1, position[0], "target x1"); same(y1, position[1], "target y1"); same(x2, target[0], "target x2"); same(y2, target[1], "target y2"); color = argb(rgb(body), 120); }
      else if (part == 1) { sameFloat(x1, (float)target[0] - 4f, "cross h1"); same(y1, target[1], "cross hy1"); sameFloat(x2, (float)target[0] + 4f, "cross h2"); same(y2, target[1], "cross hy2"); color = argb(rgb(body), 220); }
      else { same(x1, target[0], "cross v1"); sameFloat(y1, (float)target[1] - 4f, "cross vx1"); same(x2, target[0], "cross v2"); sameFloat(y2, (float)target[1] + 4f, "cross vx2"); color = argb(rgb(body), 220); }
      style(color, 1f, false, true, "target"); targetLines++;
    }
    super.line(x1, y1, x2, y2);
    if (phase == VELOCITY || phase == WIRE || phase == TARGET_GUIDES) consumed(color);
  }

  private void validateGeometry() {
    require(phase == NONE, "all phase wrappers returned");
    require(rings == composition.motion().size(), "rings after render");
    require(!TRAILS || trailShapes == composition.motion().size(), "trails after render");
    require(MODE != 0 || dots == composition.motion().size(), "dots after render");
    require(MODE != 1 || velocityLines == composition.motion().size(), "velocity after render");
    require(MODE != 2 || wireLines == composition.mesh().edgeCount(), "wire after render");
    require(!TARGETS || targetLines == composition.motion().size() * 3, "targets after render");
  }
  private void consumed(int color) { require(((PGraphicsJava2D)g).g2.getColor().getRGB() == color, "JAVA2D consumed color"); }

  private void checkCachedFrame() {
    loadPixels(); displayedFrame.loadPixels(); require(Arrays.equals(pixels, displayedFrame.pixels), "cached completed frame pixels");
  }
  private void saveCapture(String id) { save(sketchPath(id + ".png")); }
  private String findSaved() {
    File[] files = output.listFiles(); require(files != null, "output listing");
    String found = null;
    for (File file : files) if (file.getName().startsWith("spring-marks-") && file.getName().endsWith(".png")) { require(found == null, "one saved image"); found = file.getName(); }
    require(found != null, "cached save created"); return found;
  }
  private void checkSavedPixels(String name) {
    try {
      BufferedImage saved = ImageIO.read(new File(output, name)); displayedFrame.loadPixels();
      require(saved != null && saved.getWidth() == width && saved.getHeight() == height, "saved dimensions");
      int[] data = saved.getRGB(0, 0, width, height, null, 0, width); require(Arrays.equals(data, displayedFrame.pixels), "saved cached pixels");
    } catch (Exception error) { throw new IllegalStateException(error); }
  }

  private static String hash(long[] values) {
    try { MessageDigest digest = MessageDigest.getInstance("SHA-256"); for (long value : values) for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte)(value >>> shift)); return hex(digest.digest()); }
    catch (Exception error) { throw new IllegalStateException(error); }
  }
  private static String hex(byte[] bytes) { StringBuilder out = new StringBuilder(); for (byte value : bytes) out.append(String.format(Locale.ROOT, "%02x", value & 255)); return out.toString(); }
  private void appendRecord(Plan item, Snapshot state) {
    if (records.length() > 0) records.append(',');
    records.append("{\"id\":\"").append(item.id).append("\",\"tick\":").append(state.tick).append(",\"mode\":").append(MODE)
        .append(",\"running\":").append(RUNNING).append(",\"state_sha256\":\"").append(hash(state.body)).append("\",\"targets_sha256\":\"")
        .append(hash(state.targets)).append("\",\"history_sha256\":\"").append(hash(state.history)).append("\",\"rings\":").append(rings)
        .append(",\"trail_shapes\":").append(trailShapes).append(",\"trail_vertices\":").append(trailVertices).append(",\"dots\":").append(dots)
        .append(",\"velocity_lines\":").append(velocityLines).append(",\"wire_lines\":").append(wireLines).append(",\"target_lines\":").append(targetLines).append('}');
  }

  private void finish() {
    try {
      require(traces.get("primary").size() == 121 && traces.get("replay").size() == 121, "121-state primary replay");
      require(traces.get("long-primary").size() == 261 && traces.get("long-replay").size() == 261, "261-state long replay");
      String report = "{\"status\":\"passed\",\"renderer_class\":\"" + escape(g.getClass().getName()) + "\",\"core_code_source\":\""
          + escape(source(TargetSprings2D.class)) + "\",\"composition_code_source\":\"" + escape(source(SpringComposition.class))
          + "\",\"saved_filename\":\"" + escape(savedFilename) + "\",\"states\":[" + records + "]}";
      Files.write(Paths.get(sketchPath("native.json")), report.getBytes(StandardCharsets.UTF_8));
      events.shutdown(); exit();
    } catch (Throwable error) { error.printStackTrace(); System.exit(1); }
  }

  public static void main(String[] args) {
    if (args.length == 1 && "--describe".equals(args[0])) { System.out.println(describeSchedule()); return; }
    if (args.length != 2) throw new IllegalArgumentException("output directory and expected core JAR required");
    File output = new File(args[0]), core = new File(args[1]);
    require(output.isAbsolute() && output.isDirectory() && core.isFile(), "existing absolute output and core required");
    Thread.setDefaultUncaughtExceptionHandler((thread, error) -> { error.printStackTrace(); System.exit(1); });
    PApplet.runSketch(new String[] {"--sketch-path=" + output.getAbsolutePath(), "SpringMarksProbe"}, new SpringMarksProbe(output, core));
  }
}
