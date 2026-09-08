import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Shape;
import java.awt.geom.AffineTransform;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Path2D;
import java.awt.geom.Rectangle2D;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.procedurals.paths.GradientPath2D;
import processing.awt.PGraphicsJava2D;

// Private spatial-composition study. Mode 0: global windows; 1: placed local paths;
// 2: placed local point motifs; 3: parent-only control. Path values are retained.
final int PATH_COUNT = 48;
final int PATH_STEPS = 120;
final double STEP_DISTANCE = 4.0d;
final double FIELD_SCALE = 0.004d;
final Rectangle2D LEFT_REGION = new Rectangle2D.Double(30.0d, 80.0d, 220.0d, 320.0d);
final Ellipse2D RIGHT_REGION = new Ellipse2D.Double(400.0d, 80.0d, 260.0d, 320.0d);
final double LOCAL_WIDTH = 220.0d, LOCAL_HEIGHT = 300.0d;

long seed = 42L;
int mode = 0;
GradientPath2D[] globalPaths;
GradientPath2D[] localPaths;
PImage displayedFrame;
double[] point = new double[2];

void settings() { size(720, 480, JAVA2D); pixelDensity(1); }

// Optional private renderer hook: exactly {mode:0|1|2|3}. It must run before setup because
// setup intentionally caches every retained path once for this study.
void configureRender(long suppliedSeed, Map<String, Double> parameters) {
  if (parameters == null || parameters.size() != 1 || !parameters.containsKey("mode"))
    throw new IllegalArgumentException("exact mode required");
  Double suppliedMode = parameters.get("mode");
  if (suppliedMode == null || !Double.isFinite(suppliedMode)
      || suppliedMode != Math.floor(suppliedMode) || suppliedMode < 0.0d || suppliedMode > 3.0d)
    throw new IllegalArgumentException("mode must be 0, 1, 2, or 3");
  seed = suppliedSeed;
  mode = (int)(double)suppliedMode;
}

void setup() {
  globalPaths = buildGlobalPaths(seed);
  localPaths = buildLocalPaths(seed);
  noLoop();
}

GradientPath2D[] buildGlobalPaths(long sourceSeed) {
  GradientPath2D[] paths = new GradientPath2D[PATH_COUNT];
  Random locations = new Random(sourceSeed);
  for (int index = 0; index < paths.length; index++) {
    // These authored world coordinates intentionally extend beyond the canvas.
    double x = -80.0d + locations.nextDouble() * 880.0d;
    double y = -60.0d + locations.nextDouble() * 600.0d;
    paths[index] = trace(sourceSeed, x, y);
  }
  return paths;
}

GradientPath2D[] buildLocalPaths(long sourceSeed) {
  GradientPath2D[] paths = new GradientPath2D[PATH_COUNT];
  Random locations = new Random(sourceSeed ^ 0x9e3779b97f4a7c15L);
  for (int index = 0; index < paths.length; index++) {
    // This authored local domain is placed into two regions below; it is not normalized globally.
    double x = locations.nextDouble() * LOCAL_WIDTH;
    double y = locations.nextDouble() * LOCAL_HEIGHT;
    paths[index] = trace(sourceSeed, x, y);
  }
  return paths;
}

GradientPath2D trace(long sourceSeed, double x, double y) {
  return GradientPath2D.trace(record("field", record("seed", Long.valueOf(sourceSeed)),
    "start", pair(x, y), "steps", Integer.valueOf(PATH_STEPS),
    "stepDistance", Double.valueOf(STEP_DISTANCE), "fieldScale", Double.valueOf(FIELD_SCALE),
    "fieldOffset", pair(0.0d, 0.0d), "angleBase", Double.valueOf(0.0d),
    "angleScale", Double.valueOf(Math.PI * 2.0d)));
}

void draw() {
  String beforeGeometry = geometryHash();
  drawParentGround();
  PGraphicsJava2D renderer = (PGraphicsJava2D)g;
  Shape clipBefore = renderer.g2.getClip();
  AffineTransform transformBefore = renderer.g2.getTransform();
  if (mode == 0) {
    // Global paths retain their world/canvas coordinates in both windows: identity placement.
    drawClipped(LEFT_REGION, new AffineTransform(), globalPaths, false);
    drawClipped(RIGHT_REGION, new AffineTransform(), globalPaths, false);
  } else {
    // Local paths share one local coordinate system. Each placement is explicit translation
    // followed by uniform scale; no nonuniform fit or hidden field-coordinate normalization.
    if (mode != 3) {
      drawClipped(LEFT_REGION, leftPlacement(), localPaths, mode == 2);
      drawClipped(RIGHT_REGION, rightPlacement(), localPaths, mode == 2);
    }
  }
  if (!sameShape(clipBefore, renderer.g2.getClip()) || !transformBefore.equals(renderer.g2.getTransform()))
    throw new IllegalStateException("regional child graphics leaked parent state");
  drawParentSentinel();
  displayedFrame = get();
  String afterGeometry = geometryHash();
  if (!beforeGeometry.equals(afterGeometry)) throw new IllegalStateException("drawing changed retained paths");
  saveStrings(sketchPath("geometry.sha256"), new String[]{beforeGeometry, afterGeometry});
}

void drawParentGround() {
  background(243, 240, 233);
  stroke(80, 90, 95, 35);
  strokeWeight(1.0f);
  for (int x = 0; x <= width; x += 24) line(x, 0, x, height);
  for (int y = 0; y <= height; y += 24) line(0, y, width, y);
  noFill();
  stroke(35, 45, 50, 190);
  strokeWeight(2.0f);
  rect((float)LEFT_REGION.getX(), (float)LEFT_REGION.getY(),
    (float)LEFT_REGION.getWidth(), (float)LEFT_REGION.getHeight());
  ellipseMode(CORNER);
  ellipse((float)RIGHT_REGION.getX(), (float)RIGHT_REGION.getY(),
    (float)RIGHT_REGION.getWidth(), (float)RIGHT_REGION.getHeight());
  fill(35, 45, 50, 210);
  textAlign(LEFT, BASELINE);
  textSize(12);
  text("spatial path study", 30, 62);
  text("clip first, then placement", 400, 62);
}

AffineTransform leftPlacement() {
  // min(220/220,320/300)=1; center the local 220x300 domain vertically in the rectangle.
  AffineTransform placement = AffineTransform.getTranslateInstance(30.0d, 90.0d);
  placement.scale(1.0d, 1.0d);
  return placement;
}

AffineTransform rightPlacement() {
  // min(260/220,320/300)=320/300. Center the uniformly scaled local domain in the ellipse box.
  double scale = 320.0d / 300.0d;
  double placedWidth = LOCAL_WIDTH * scale;
  AffineTransform placement = AffineTransform.getTranslateInstance(400.0d + (260.0d - placedWidth) * 0.5d, 80.0d);
  placement.scale(scale, scale);
  return placement;
}

void drawClipped(Shape canvasShape, AffineTransform placement, GradientPath2D[] paths, boolean circles) {
  PGraphicsJava2D renderer = (PGraphicsJava2D)g;
  // The private adapter owns only this child Graphics2D. Clip uses canvas coordinates before
  // local placement, so strokes/motifs are hard-clipped at the actual region boundary.
  Graphics2D child = (Graphics2D)renderer.g2.create();
  try {
    child.clip(canvasShape);
    child.transform(placement);
    child.setStroke(new BasicStroke(6.0f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
    for (int index = 0; index < paths.length; index++) {
      int red = 40 + (index * 47) % 170;
      int green = 65 + (index * 29) % 135;
      int blue = 85 + (index * 61) % 145;
      child.setColor(new Color(red, green, blue, circles ? 165 : 110));
      if (circles) drawCircles(child, paths[index]);
      else drawPath(child, paths[index]);
    }
  } finally {
    child.dispose();
  }
}

void drawPath(Graphics2D child, GradientPath2D path) {
  Path2D.Double shape = new Path2D.Double();
  path.pointInto(0L, point, 0);
  shape.moveTo(point[0], point[1]);
  for (int step = 1; step <= PATH_STEPS; step++) {
    path.pointInto((long)step, point, 0);
    shape.lineTo(point[0], point[1]);
  }
  child.draw(shape);
}

void drawCircles(Graphics2D child, GradientPath2D path) {
  for (int step = 0; step <= PATH_STEPS; step += 8) {
    path.pointInto((long)step, point, 0);
    child.fill(new Ellipse2D.Double(point[0] - 5.0d, point[1] - 5.0d, 10.0d, 10.0d));
  }
}

void drawParentSentinel() {
  // This Processing-owned mark must remain at this canvas coordinate after native child layers.
  noStroke();
  fill(25, 35, 40, 255);
  ellipseMode(CENTER);
  ellipse(696, 448, 10, 10);
  fill(25, 35, 40, 210);
  textAlign(RIGHT, BASELINE);
  textSize(11);
  text("parent sentinel", 708, 468);
}

boolean sameShape(Shape left, Shape right) {
  if (left == null || right == null) return left == right;
  java.awt.geom.Area difference = new java.awt.geom.Area(left);
  difference.exclusiveOr(new java.awt.geom.Area(right));
  return difference.isEmpty();
}

// Stable raw-binary hash for later private retained-geometry checks; not a persistence format.
String geometryHash() {
  try {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    hashPaths(digest, globalPaths);
    hashPaths(digest, localPaths);
    StringBuilder result = new StringBuilder();
    for (byte value : digest.digest()) result.append(String.format("%02x", value & 255));
    return result.toString();
  } catch (Exception error) {
    throw new IllegalStateException(error);
  }
}

void hashPaths(MessageDigest digest, GradientPath2D[] paths) {
  for (GradientPath2D path : paths) {
    for (int step = 0; step <= PATH_STEPS; step++) {
      path.pointInto((long)step, point, 0);
      hashDouble(digest, point[0]);
      hashDouble(digest, point[1]);
    }
    for (int step = 0; step < PATH_STEPS; step++) hashDouble(digest, path.headingAt((long)step));
  }
}

void hashDouble(MessageDigest digest, double value) {
  long bits = Double.doubleToRawLongBits(value);
  for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte)(bits >>> shift));
}

List<Object> pair(double x, double y) {
  List<Object> result = new ArrayList<Object>(2);
  result.add(Double.valueOf(x));
  result.add(Double.valueOf(y));
  return result;
}

Map<String, Object> record(Object... values) {
  Map<String, Object> result = new LinkedHashMap<String, Object>();
  for (int index = 0; index < values.length; index += 2)
    result.put((String)values[index], values[index + 1]);
  return result;
}
