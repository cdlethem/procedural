import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.event.KeyEvent;
import org.procedurals.examples.facetmarks.FacetComposition;
import org.procedurals.sampling.TrianglePoints2D;
import org.procedurals.topology.Delaunay2D;
import org.procedurals.color.CyclicPalette;

/** Root-owned instrumentation of the actual officially preprocessed FacetMarks PDE. */
public final class FacetMarksProbe extends FacetMarks {
  private static final String[] IDS = {"baseline", "wire", "grain", "reset-mode", "colour", "reset-colour",
      "sites", "reset-sites", "fine", "reset-fine", "new-seed", "reset-seed", "cells", "cells-wire",
      "cells-grain", "cells-fine", "cells-colour", "final-reset"};
  private static final char[] NEXT = "mm0c0p0n0r0xmmnc0s".toCharArray();
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File expectedCore;
  private final StringBuilder records = new StringBuilder();
  private int draws, keys, triangles, lines, points, ellipses, grainFace, grainPoint;
  private boolean observing;
  private FacetComposition previous, baseline;
  private Delaunay2D retainedMesh;
  private TrianglePoints2D[] retainedGrain;
  private int[] baselinePixels, previousPixels;
  private PImage savedFrame;
  private FacetMarksProbe(File expectedCore) { this.expectedCore = expectedCore; }
  private static void require(boolean value, String why) { if (!value) throw new AssertionError(why); }
  private static void f(float actual, double expected, String why) {
    require(Float.floatToRawIntBits(actual) == Float.floatToRawIntBits((float) expected), why);
  }
  private static String source(Class<?> type) {
    try { return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath(); }
    catch (Exception error) { throw new IllegalStateException(error); }
  }
  private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\""); }
  private static boolean reset(int i) { return i == 3 || i == 5 || i == 7 || i == 9 || i == 11 || i == 17; }
  private static boolean style(int i) { return i == 1 || i == 2 || i == 4 || i == 6 || i == 13 || i == 14 || i == 16; }
  private static boolean sameValues(FacetComposition left, FacetComposition right) {
    if (!left.mesh().toValues().equals(right.mesh().toValues()) || left.grainCount() != right.grainCount()) return false;
    for (int face = 0; face < left.mesh().faceCount(); face++)
      if (!left.grainAt(face).toValues().equals(right.grainAt(face).toValues())) return false;
    return true;
  }
  private void state(int i) {
    require(SEED == (i == 10 ? 43L : 42L), "seed " + i);
    require(FINE == (i == 8 || i == 15 || i == 16), "fine " + i);
    require(CELLS == (i >= 12 && i <= 16), "cells " + i);
    require(MODE == (i == 1 || i == 13 ? 1 : i == 2 || i >= 14 && i <= 16 ? 2 : 0), "mode " + i);
    require(ALTERNATE == (i == 4 || i == 16), "palette " + i);
    require(SITES == (i == 6), "sites " + i);
    require(composition.mesh().inputCount() == (CELLS ? FINE ? 511 : 127 : FINE ? 512 : 128), "site count " + i);
    if (i == 0) baseline = composition;
    else if (style(i)) {
      require(composition == previous && composition.mesh() == retainedMesh, "style retained mesh " + i);
      for (int face = 0; face < retainedGrain.length; face++)
        require(composition.grainAt(face) == retainedGrain[face], "style retained grain " + face);
    } else {
      require(composition != previous && composition.mesh() != retainedMesh, "rebuild " + i);
      if (reset(i)) require(sameValues(baseline, composition), "complete reset values " + i);
      else require(!composition.mesh().toValues().equals(previous.mesh().toValues()), "geometry changed " + i);
    }
  }
  private int argb(int face, int alpha) {
    int rgb = (ALTERNATE ? otherPalette : palette).sample(face * 0.173d);
    return (alpha << 24) | rgb;
  }
  private void common() {
    require(g.colorMode == RGB && g.colorModeX == 255 && g.colorModeY == 255 && g.colorModeZ == 255
        && g.colorModeA == 255, "RGB255");
    require(((PGraphicsJava2D) g).g2.getTransform().isIdentity(), "untransformed coordinates");
  }
  private void consumed(int expected) {
    require(((PGraphicsJava2D) g).g2.getColor().getRGB() == expected, "JAVA2D consumed colour");
  }
  @Override public void triangle(float x1, float y1, float x2, float y2, float x3, float y3) {
    int color = 0;
    if (observing) {
      require(MODE == 0 && triangles < composition.mesh().faceCount(), "unexpected triangle");
      int[] ids = composition.mesh().triangleAt(triangles);
      double[] a = composition.mesh().pointAt(ids[0]), b = composition.mesh().pointAt(ids[1]), c = composition.mesh().pointAt(ids[2]);
      f(x1,a[0],"triangle ax"); f(y1,a[1],"triangle ay"); f(x2,b[0],"triangle bx"); f(y2,b[1],"triangle by");
      f(x3,c[0],"triangle cx"); f(y3,c[1],"triangle cy"); common(); color = argb(triangles,255);
      require(g.fill && !g.stroke && g.fillColor == color, "face fill style"); triangles++;
    }
    super.triangle(x1,y1,x2,y2,x3,y3);
    if (observing) consumed(color);
  }
  @Override public void line(float x1, float y1, float x2, float y2) {
    int color = 0;
    if (observing) {
      require(MODE == 1 && lines < composition.mesh().edgeCount(), "unexpected edge");
      int[] ids = composition.mesh().edgeAt(lines);
      double[] a = composition.mesh().pointAt(ids[0]), b = composition.mesh().pointAt(ids[1]);
      f(x1,a[0],"edge ax"); f(y1,a[1],"edge ay"); f(x2,b[0],"edge bx"); f(y2,b[1],"edge by");
      color = argb(composition.mesh().edgeFacesAt(lines)[0],255); common();
      require(!g.fill && g.stroke && g.strokeColor == color, "edge style"); f(g.strokeWeight,1.1f,"edge weight"); lines++;
    }
    super.line(x1,y1,x2,y2);
    if (observing) consumed(color);
  }
  @Override public void point(float x, float y) {
    int color = 0;
    if (observing) {
      require(MODE == 2 && points < composition.grainCount(), "unexpected grain");
      while (grainFace < composition.mesh().faceCount() && grainPoint == composition.grainAt(grainFace).size()) {
        grainFace++; grainPoint = 0;
      }
      require(grainFace < composition.mesh().faceCount(), "grain face membership");
      double[] p = composition.grainAt(grainFace).pointAt(grainPoint);
      f(x,p[0],"grain x"); f(y,p[1],"grain y"); color = argb(grainFace,170); common();
      require(!g.fill && g.stroke && g.strokeColor == color, "grain style"); f(g.strokeWeight,1,"grain weight");
      grainPoint++; points++;
    }
    super.point(x,y);
    if (observing) consumed(color);
  }
  @Override public void ellipse(float x, float y, float w, float h) {
    if (observing) {
      require(SITES && ellipses < composition.mesh().vertexCount(), "unexpected site marker");
      double[] p = composition.mesh().pointAt(ellipses);
      f(x,p[0],"site x"); f(y,p[1],"site y"); f(w,4,"site width"); f(h,4,"site height"); common();
      require(g.fill && !g.stroke && g.fillColor == 0xff1e2328 && g.ellipseMode == CENTER, "site style"); ellipses++;
    }
    super.ellipse(x,y,w,h);
    if (observing) consumed(0xff1e2328);
  }
  @Override public void setup() {
    super.setup();
    require(width == 640 && height == 640 && pixelDensity == 1 && g instanceof PGraphicsJava2D, "environment");
    try {
      for (Class<?> type : new Class<?>[]{Delaunay2D.class, TrianglePoints2D.class, CyclicPalette.class})
        require(source(type).equals(expectedCore.getCanonicalPath()), "candidate JAR origin " + type);
    } catch (Exception error) { throw new IllegalStateException(error); }
  }
  @Override public void draw() {
    int i = draws; require(i < IDS.length, "extra draw"); state(i);
    triangles = lines = points = ellipses = grainFace = grainPoint = 0;
    observing = true; super.draw(); observing = false;
    Delaunay2D mesh = composition.mesh();
    require(triangles == (MODE == 0 ? mesh.faceCount() : 0), "triangle count");
    require(lines == (MODE == 1 ? mesh.edgeCount() : 0), "unique edge count");
    require(points == (MODE == 2 ? composition.grainCount() : 0), "grain count");
    require(ellipses == (SITES ? mesh.vertexCount() : 0), "site count");
    loadPixels(); int[] shown = pixels.clone();
    displayedFrame.loadPixels(); require(Arrays.equals(shown,displayedFrame.pixels), "cached completed frame");
    if (i == 0) baselinePixels = shown.clone();
    else if (reset(i)) require(Arrays.equals(baselinePixels,shown), "reset pixels " + i);
    else require(!Arrays.equals(previousPixels,shown), "edit visibly changes output " + i);
    save(sketchPath(IDS[i] + ".png"));
    if (records.length() > 0) records.append(',');
    records.append("{\"id\":\"").append(IDS[i]).append("\",\"triangles\":").append(triangles)
        .append(",\"lines\":").append(lines).append(",\"points\":").append(points)
        .append(",\"ellipses\":").append(ellipses).append(",\"vertices\":").append(mesh.vertexCount())
        .append(",\"faces\":").append(mesh.faceCount()).append(",\"edges\":").append(mesh.edgeCount())
        .append(",\"grain\":").append(composition.grainCount()).append(",\"retained\":").append(composition == previous).append('}');
    previous = composition; retainedMesh = mesh; previousPixels = shown;
    retainedGrain = new TrianglePoints2D[mesh.faceCount()];
    for (int face = 0; face < retainedGrain.length; face++) retainedGrain[face] = composition.grainAt(face);
    draws++;
    events.schedule(() -> postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,NEXT[i],0)),150,TimeUnit.MILLISECONDS);
  }
  @Override public void keyPressed() {
    require(keys < NEXT.length && key == NEXT[keys], "key order");
    FacetComposition before = composition; PImage cached = displayedFrame;
    super.keyPressed(); keys++;
    if (key == 's') {
      require(composition == before && displayedFrame == cached, "save retains geometry/cache");
      savedFrame = cached; long at = System.nanoTime();
      events.schedule(() -> finish(at),300,TimeUnit.MILLISECONDS);
    }
  }
  private void finish(long at) {
    try {
      long quiet = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - at);
      require(quiet >= 300 && draws == IDS.length && keys == NEXT.length, "save quiet");
      require(displayedFrame == savedFrame && composition == previous, "save retained state after quiet");
      try (java.util.stream.Stream<Path> paths = Files.list(Paths.get(sketchPath()))) {
        require(paths.filter(p -> p.getFileName().toString().startsWith("facet-marks-") && p.toString().endsWith(".png")).count() == 1, "one actual save");
      }
      String report = "{\"status\":\"passed\",\"frames\":" + draws + ",\"key_events\":" + keys
          + ",\"keys\":\"" + new String(NEXT) + "\",\"save_quiet_ms\":" + quiet
          + ",\"renderer_class\":\"" + g.getClass().getName() + "\",\"core_code_source\":\"" + escape(source(Delaunay2D.class))
          + "\",\"composition_code_source\":\"" + escape(source(FacetComposition.class)) + "\",\"states\":[" + records + "]}";
      Files.write(Paths.get(sketchPath("native.json")),report.getBytes(StandardCharsets.UTF_8));
      events.shutdown(); exit();
    } catch (Throwable error) { error.printStackTrace(); System.exit(1); }
  }
  public static void main(String[] args) {
    if (args.length != 2) throw new IllegalArgumentException("output directory and expected core JAR required");
    File output = new File(args[0]), core = new File(args[1]);
    require(output.isAbsolute() && output.isDirectory() && core.isFile(), "existing absolute output and core required");
    Thread.setDefaultUncaughtExceptionHandler((thread,error) -> {error.printStackTrace(); System.exit(1);});
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(),"FacetMarksProbe"},new FacetMarksProbe(core));
  }
}
