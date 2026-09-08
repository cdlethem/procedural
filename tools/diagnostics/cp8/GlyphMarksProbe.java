import java.awt.geom.AffineTransform;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PFont;
import processing.event.KeyEvent;
import org.procedurals.color.CyclicPalette;
import org.procedurals.examples.glyphmarks.GlyphComposition;
import org.procedurals.examples.glyphmarks.GlyphFont;
import org.procedurals.paths.GradientPath2D;

/**
 * Prepared, unexecuted native probe for the officially preprocessed GlyphMarks PDE.
 * The preprocessor supplies GlyphMarks in the default package before this class compiles.
 */
public final class GlyphMarksProbe extends GlyphMarks {
  private static final String[] IDS = {
      "baseline", "short", "reset-short", "sparse", "reset-sparse", "letters",
      "reset-letters", "dots", "reset-dots", "colour", "reset-colour", "distance",
      "reset-distance", "field-scale", "reset-field-scale", "new-seed", "reset-seed"};
  private static final char[] NEXT = {'n','0','d','0','g','0','m','0','c','0','v','0','f','0','r','0','s'};
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File expectedCore;
  private final StringBuilder records = new StringBuilder();
  private final double[] expectedPoint = new double[2];
  private int draws;
  private int keys;
  private int activeState = -1;
  private int observedStamps;
  private int observedText;
  private int observedEllipses;
  private int observedFills;
  private int preparedArgb;
  private int totalText;
  private int totalEllipses;
  private int totalFills;
  private MessageDigest stampDigest;
  private GlyphComposition baseline;
  private GlyphComposition previous;
  private int[] baselinePixels;
  private int[] previousPixels;
  private String fontPath;
  private String fontHash;
  private String fontJson;

  private GlyphMarksProbe(File expectedCore) {
    this.expectedCore = expectedCore;
  }

  private static void require(boolean value, String message) {
    if (!value) throw new AssertionError(message);
  }

  private static boolean bits(double left, double right) {
    return Double.doubleToRawLongBits(left) == Double.doubleToRawLongBits(right);
  }

  private static boolean floatBits(float left, float right) {
    return Float.floatToRawIntBits(left) == Float.floatToRawIntBits(right);
  }

  private static String escape(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private static String source(Class<?> type) {
    try {
      return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();
    } catch (Exception error) {
      throw new IllegalStateException("cannot identify code source for " + type.getName(), error);
    }
  }

  private static void updateLong(MessageDigest digest, long value) {
    for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte) (value >>> shift));
  }

  private static String hex(MessageDigest digest) {
    StringBuilder result = new StringBuilder();
    for (byte value : digest.digest()) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
    return result.toString();
  }

  private static String fileHash(String path) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] bytes = Files.readAllBytes(Paths.get(path));
      digest.update(bytes);
      return hex(digest);
    } catch (Exception error) {
      throw new IllegalStateException("cannot hash " + path, error);
    }
  }

  private static String compositionHash(GlyphComposition value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      double[] point = new double[2];
      updateLong(digest, value.pathCount());
      for (int pathIndex = 0; pathIndex < value.pathCount(); pathIndex++) {
        GradientPath2D path = value.pathAt(pathIndex);
        updateLong(digest, Double.doubleToRawLongBits(value.sizeAt(pathIndex)));
        updateLong(digest, value.symbolIndexAt(pathIndex));
        updateLong(digest, path.steps());
        for (int pointIndex = 0; pointIndex <= path.steps(); pointIndex++) {
          path.pointInto(pointIndex, point, 0);
          updateLong(digest, Double.doubleToRawLongBits(point[0]));
          updateLong(digest, Double.doubleToRawLongBits(point[1]));
          if (pointIndex < path.steps()) updateLong(digest,
              Double.doubleToRawLongBits(path.headingAt(pointIndex)));
        }
      }
      return hex(digest);
    } catch (Exception error) {
      throw new IllegalStateException("cannot hash retained paths", error);
    }
  }

  private static boolean samePathObjects(GlyphComposition left, GlyphComposition right) {
    if (left.pathCount() != right.pathCount()) return false;
    for (int index = 0; index < left.pathCount(); index++) if (left.pathAt(index) != right.pathAt(index)) return false;
    return true;
  }

  private static boolean sameStartsAndMetadata(GlyphComposition left, GlyphComposition right) {
    if (left.pathCount() != right.pathCount()) return false;
    double[] a = new double[2], b = new double[2];
    for (int index = 0; index < left.pathCount(); index++) {
      if (!bits(left.sizeAt(index), right.sizeAt(index)) || left.symbolIndexAt(index) != right.symbolIndexAt(index)) return false;
      left.pathAt(index).pointInto(0, a, 0);
      right.pathAt(index).pointInto(0, b, 0);
      if (!bits(a[0], b[0]) || !bits(a[1], b[1])) return false;
    }
    return true;
  }

  private static boolean sameValues(GlyphComposition left, GlyphComposition right) {
    if (!sameStartsAndMetadata(left, right)) return false;
    double[] a = new double[2], b = new double[2];
    for (int pathIndex = 0; pathIndex < left.pathCount(); pathIndex++) {
      GradientPath2D first = left.pathAt(pathIndex), second = right.pathAt(pathIndex);
      if (first.steps() != second.steps()) return false;
      for (int index = 0; index <= first.steps(); index++) {
        first.pointInto(index, a, 0); second.pointInto(index, b, 0);
        if (!bits(a[0], b[0]) || !bits(a[1], b[1])) return false;
        if (index < first.steps() && !bits(first.headingAt(index), second.headingAt(index))) return false;
      }
    }
    return true;
  }

  private static boolean hasLaterDifference(GlyphComposition left, GlyphComposition right) {
    double[] a = new double[2], b = new double[2];
    for (int pathIndex = 0; pathIndex < left.pathCount(); pathIndex++) {
      GradientPath2D first = left.pathAt(pathIndex), second = right.pathAt(pathIndex);
      int count = Math.min(first.steps(), second.steps());
      for (int index = 1; index <= count; index++) {
        first.pointInto(index, a, 0); second.pointInto(index, b, 0);
        if (!bits(a[0], b[0]) || !bits(a[1], b[1])) return true;
      }
    }
    return false;
  }

  private static boolean hasMetadataDifference(GlyphComposition left, GlyphComposition right) {
    for (int index = 0; index < left.pathCount(); index++) {
      if (!bits(left.sizeAt(index), right.sizeAt(index)) || left.symbolIndexAt(index) != right.symbolIndexAt(index)) return true;
    }
    return false;
  }

  private int visibleSteps() { return SHORT ? 80 : 160; }
  private int stride() { return SPARSE ? 4 : 1; }
  private int expectedStamps() { return composition.pathCount() * ((visibleSteps() + stride() - 1) / stride()); }

  private void requireState(int state) {
    require(SEED == (state == 15 ? 43L : 42L), "seed state " + state);
    require(SHORT == (state == 1), "short state " + state);
    require(SPARSE == (state == 3), "sparse state " + state);
    require(LETTERS == (state == 5), "letters state " + state);
    require(DOTS == (state == 7), "dots state " + state);
    require(COLOURED == (state == 9), "colour state " + state);
    require(FASTER == (state == 11), "distance state " + state);
    require(FINER == (state == 13), "field-scale state " + state);
    require(composition != null && composition.pathCount() == 48, "composition state " + state);
    if (state == 0) baseline = composition;
    if (state == 1 || state == 3 || state == 5 || state == 7 || state == 9) {
      require(composition == previous && samePathObjects(composition, previous), "style retained composition/paths " + state);
    }
    if (state == 2 || state == 4 || state == 6 || state == 8 || state == 10 || state == 12 || state == 14 || state == 16) {
      require(composition != previous, "reset rebuilt composition " + state);
      require(sameValues(baseline, composition), "reset replay paths/metadata " + state);
    }
    if (state == 11 || state == 13) {
      require(composition != previous, "integration edit rebuilt composition " + state);
      require(sameStartsAndMetadata(baseline, composition), "integration edit retained starts/metadata " + state);
      require(hasLaterDifference(baseline, composition), "integration edit changed later path geometry " + state);
    }
    if (state == 15) {
      require(composition != previous, "seed edit rebuilt composition");
      require(hasMetadataDifference(baseline, composition), "seed edit changed metadata");
      require(hasLaterDifference(baseline, composition), "seed edit changed geometry");
    }
  }

  private void expectedLocation(int stamp) {
    int each = (visibleSteps() + stride() - 1) / stride();
    int pathIndex = stamp / each;
    int pointIndex = (stamp % each) * stride();
    require(pathIndex >= 0 && pathIndex < composition.pathCount(), "actual stamp exceeds public paths");
    composition.pathAt(pathIndex).pointInto(pointIndex, expectedPoint, 0);
  }

  private void verifyFill(int ordinal, float a, float b, float c, float alpha, boolean rgb) {
    require(ordinal < expectedStamps(), "extra fill");
    int each = (visibleSteps() + stride() - 1) / stride();
    int pointIndex = (ordinal % each) * stride();
    double phase = pointIndex / (double) visibleSteps();
    if (COLOURED) {
      require(rgb, "colour state must call RGBA fill");
      int value = palette.sample(phase);
      require(floatBits(a, (float) ((value >>> 16) & 255)) && floatBits(b, (float) ((value >>> 8) & 255))
          && floatBits(c, (float) (value & 255)) && floatBits(alpha, 50f), "colour fill arguments");
    } else {
      require(!rgb && floatBits(a, (float) (230.0d - 200.0d * phase)) && floatBits(alpha, 50f),
          "gray fill arguments");
    }
    int red = processingByte(a);
    int green = rgb ? processingByte(b) : red;
    int blue = rgb ? processingByte(c) : red;
    preparedArgb = (processingByte(alpha) << 24) | (red << 16) | (green << 8) | blue;
    require(g.colorMode == RGB && floatBits(g.colorModeX, 255f) && floatBits(g.colorModeY, 255f)
        && floatBits(g.colorModeZ, 255f) && floatBits(g.colorModeA, 255f), "RGB255 color state");
    require(g.fillColor == preparedArgb, "Processing packed ARGB fill state");
  }

  /** Mirrors Processing 4.5.6 PGraphics.colorCalc float clamping and f2i truncation in RGB/255 mode. */
  private static int processingByte(float value) {
    if (value < 0f) value = 0f;
    if (value > 255f) value = 255f;
    return (int) ((value / 255f) * 255f);
  }

  @Override public void fill(float gray, float alpha) {
    super.fill(gray, alpha);
    if (activeState >= 0) {
      verifyFill(observedFills, gray, 0f, 0f, alpha, false);
      observedFills++; totalFills++;
    }
  }

  @Override public void fill(float red, float green, float blue, float alpha) {
    super.fill(red, green, blue, alpha);
    if (activeState >= 0) {
      verifyFill(observedFills, red, green, blue, alpha, true);
      observedFills++; totalFills++;
    }
  }

  private void verifyCommonStamp(int ordinal, float x, float y, float markSize) {
    require(observedFills == ordinal + 1, "stamp did not use its immediately prepared fill");
    expectedLocation(ordinal);
    require(floatBits(x, (float) expectedPoint[0]) && floatBits(y, (float) expectedPoint[1]),
        "pre-advance public path anchor " + ordinal);
    int each = (visibleSteps() + stride() - 1) / stride();
    int pathIndex = ordinal / each;
    require(floatBits(markSize, (float) composition.sizeAt(pathIndex)), "actual mark size " + ordinal);
    require(g.textFont == glyphFont && g.textAlign == CENTER && g.textAlignY == CENTER && g.ellipseMode == CENTER,
        "actual font/alignment/ellipse state");
    require(g.fill && !g.stroke && g.fillColor == preparedArgb, "actual fill/noStroke state");
    AffineTransform transform = ((PGraphicsJava2D) g).g2.getTransform();
    require(transform.isIdentity(), "stamp transform must be upright identity");
  }

  /** PGraphicsJava2D applies fillColorObject to Graphics2D inside textLineImpl/fillShape, not at fill(). */
  private void requireJava2DConsumedFill() {
    require(((PGraphicsJava2D) g).g2.getColor().getRGB() == preparedArgb,
        "actual JAVA2D color after native mark drawing");
  }

  private void updateStamp(int kind, char glyph, float x, float y, float first, float second) {
    updateLong(stampDigest, kind);
    updateLong(stampDigest, glyph);
    updateLong(stampDigest, Float.floatToRawIntBits(x));
    updateLong(stampDigest, Float.floatToRawIntBits(y));
    updateLong(stampDigest, Float.floatToRawIntBits(first));
    updateLong(stampDigest, Float.floatToRawIntBits(second));
    updateLong(stampDigest, g.fillColor);
  }

  @Override public void text(char glyph, float x, float y) {
    if (activeState >= 0) {
      verifyCommonStamp(observedStamps, x, y, g.textSize);
      int each = (visibleSteps() + stride() - 1) / stride();
      int pathIndex = observedStamps / each;
      String symbols = LETTERS ? ALPHABET : DIGITS;
      require(glyph == symbols.charAt(composition.symbolIndexAt(pathIndex)), "actual selected glyph");
      updateStamp(1, glyph, x, y, g.textSize, 0f);
      observedStamps++; observedText++; totalText++;
    }
    super.text(glyph, x, y);
    if (activeState >= 0) requireJava2DConsumedFill();
  }

  @Override public void ellipse(float x, float y, float width, float height) {
    if (activeState >= 0) {
      verifyCommonStamp(observedStamps, x, y, (float) composition.sizeAt(observedStamps
          / ((visibleSteps() + stride() - 1) / stride())));
      float expected = (float) composition.sizeAt(observedStamps / ((visibleSteps() + stride() - 1) / stride())) / 5f;
      require(floatBits(width, expected) && floatBits(height, expected), "actual dot dimensions");
      updateStamp(2, (char) 0, x, y, width, height);
      observedStamps++; observedEllipses++; totalEllipses++;
    }
    super.ellipse(x, y, width, height);
    if (activeState >= 0) requireJava2DConsumedFill();
  }

  private void recordFont() {
    fontPath = dataPath("GlyphMarks.ttf");
    fontHash = fileHash(fontPath);
    PFont nativePFont = glyphFont;
    require(nativePFont != null && nativePFont.getFont() != null, "loaded native font");
    String required = DIGITS + ALPHABET;
    require(nativePFont.getFont().canDisplayUpTo(required) == -1, "native font coverage after setup");
    for (int index = 0; index < required.length(); index++) require(nativePFont.getGlyph(required.charAt(index)) != null,
        "loaded PFont glyph " + index);
    fontJson = "{\"path\":\"" + escape(new File(fontPath).getAbsolutePath()) + "\",\"sha256\":\"" + fontHash
        + "\",\"pfont_name\":\"" + escape(nativePFont.getName()) + "\",\"postscript_name\":\""
        + escape(nativePFont.getPostScriptName()) + "\",\"awt_family\":\""
        + escape(nativePFont.getFont().getFamily()) + "\",\"awt_name\":\""
        + escape(nativePFont.getFont().getFontName()) + "\",\"required_glyphs\":\"" + required + "\"}";
  }

  @Override public void setup() {
    super.setup();
    recordFont();
    require(width == 640 && height == 640 && pixelDensity == 1 && g instanceof PGraphicsJava2D, "JAVA2D environment");
    try {
      require(source(GradientPath2D.class).equals(expectedCore.getCanonicalPath()),
          "GradientPath2D did not load from the expected staged core JAR");
    } catch (Exception error) {
      throw new IllegalStateException("cannot verify staged core JAR", error);
    }
  }

  @Override public void draw() {
    int state = draws;
    require(state < IDS.length, "unexpected extra draw");
    requireState(state);
    activeState = state;
    observedStamps = observedText = observedEllipses = observedFills = 0;
    try { stampDigest = MessageDigest.getInstance("SHA-256"); }
    catch (Exception error) { throw new IllegalStateException(error); }
    super.draw();
    activeState = -1;
    int expected = expectedStamps();
    require(observedStamps == expected && observedFills == expected, "actual stamp/fill count " + state);
    require(DOTS ? observedEllipses == expected && observedText == 0 : observedText == expected && observedEllipses == 0,
        "actual mark callback kind/count " + state);
    String compositionHash = compositionHash(composition);
    String stampHash = hex(stampDigest);
    loadPixels();
    int[] shown = pixels.clone();
    if (state == 0) baselinePixels = shown.clone();
    if (state == 2 || state == 4 || state == 6 || state == 8 || state == 10 || state == 12 || state == 14 || state == 16)
      require(Arrays.equals(baselinePixels, shown), "reset pixel replay " + state);
    if (state == 1 || state == 3 || state == 5 || state == 7 || state == 9) require(!Arrays.equals(previousPixels, shown),
        "style/prefix edit changed visible output " + state);
    save(sketchPath(IDS[state] + ".png"));
    if (records.length() > 0) records.append(',');
    records.append("{\"id\":\"").append(IDS[state]).append("\",\"stamps\":").append(observedStamps)
        .append(",\"text_calls\":").append(observedText).append(",\"ellipse_calls\":").append(observedEllipses)
        .append(",\"fill_calls\":").append(observedFills).append(",\"composition_sha256\":\"")
        .append(compositionHash).append("\",\"actual_stamp_sha256\":\"").append(stampHash)
        .append("\",\"same_composition_as_previous\":").append(composition == previous).append('}');
    previous = composition;
    previousPixels = shown;
    draws++;
    events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(), KeyEvent.PRESS, 0,
        NEXT[state], 0)), 150, TimeUnit.MILLISECONDS);
  }

  @Override public void keyPressed() {
    require(keys < NEXT.length && key == NEXT[keys], "native key sequence");
    GlyphComposition before = composition;
    super.keyPressed();
    keys++;
    if (key == 's') {
      require(composition == before, "save must not rebuild composition");
      final long saved = System.nanoTime();
      events.schedule(() -> finish(saved), 300, TimeUnit.MILLISECONDS);
    }
  }

  private void finish(long saved) {
    try {
      long quiet = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - saved);
      require(quiet >= 300 && draws == IDS.length && keys == NEXT.length, "save quiet interval");
      Path sketch = Paths.get(sketchPath());
      try (java.util.stream.Stream<Path> paths = Files.list(sketch)) {
        require(paths.filter(path -> path.getFileName().toString().startsWith("glyph-marks-")
            && path.getFileName().toString().endsWith(".png")).count() == 1, "one actual S save");
      }
      String report = "{\"status\":\"passed\",\"frames\":" + draws + ",\"key_events\":" + keys
          + ",\"keys\":\"" + new String(NEXT) + "\",\"total_text_calls\":" + totalText
          + ",\"total_ellipse_calls\":" + totalEllipses + ",\"total_fill_calls\":" + totalFills
          + ",\"font\":" + fontJson + ",\"renderer_class\":\"" + escape(g.getClass().getName())
          + "\",\"expected_core_jar\":\"" + escape(expectedCore.getAbsolutePath())
          + "\",\"core_code_source\":\"" + escape(source(GradientPath2D.class))
          + "\",\"palette_code_source\":\"" + escape(source(CyclicPalette.class))
          + "\",\"composition_code_source\":\"" + escape(source(GlyphComposition.class))
          + "\",\"font_loader_code_source\":\"" + escape(source(GlyphFont.class))
          + "\",\"save_quiet_ms\":" + quiet + ",\"states\":[" + records + "]}";
      Files.write(Paths.get(sketchPath("native.json")), report.getBytes(StandardCharsets.UTF_8));
      events.shutdown();
      exit();
    } catch (Throwable error) {
      error.printStackTrace();
      System.exit(1);
    }
  }

  public static void main(String[] args) {
    if (args.length != 2) throw new IllegalArgumentException("output directory and expected staged core JAR required");
    File output = new File(args[0]);
    File core = new File(args[1]);
    if (!output.isAbsolute() || !output.isDirectory() || !core.isFile())
      throw new IllegalArgumentException("absolute existing output directory and staged core JAR required");
    Thread.setDefaultUncaughtExceptionHandler((thread, error) -> { error.printStackTrace(); System.exit(1); });
    PApplet.runSketch(new String[] {"--sketch-path=" + output.getAbsolutePath(), "GlyphMarksProbe"}, new GlyphMarksProbe(core));
  }
}
