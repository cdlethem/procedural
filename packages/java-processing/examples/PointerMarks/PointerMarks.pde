import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.layout.RegularGrid;
import org.procedurals.motion.TargetSprings2D;
import org.procedurals.topology.Delaunay2D;

// Space: run/pause; .: one paused tick; M: dots/fixed wire; T: target guides.
// Mouse press/drag supplies a held pointer; 0 resets; S saves the cached frame.
// Grid, response, radius, palette, and drawing are authored piece settings, not defaults.
final double RETURN_RATE = 0.04d;
final double POINTER_RADIUS = 180.0d;
final double POINTER_RATE = 0.12d;
final double STRENGTH = 0.025d;
final double RETENTION = 0.7d;
final int[] PALETTE = {0x173F5F, 0xAF5441, 0xE9C46A, 0x347969};

boolean running = false;
boolean dirty = true;
boolean wire = false;
boolean showTargets = false;
boolean pointerHeld = false;
double pointerX = 0.0d, pointerY = 0.0d;
long tick = 0L;

double[] initial;
double[] targets;
double[] nextTargets;
TargetSprings2D motion;
Delaunay2D initialMesh;
PImage displayedFrame;
double[] point = new double[2], otherPoint = new double[2];
int[] edge = new int[2];

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }

void setup() {
  buildInitialState();
  noLoop();
}

void buildInitialState() {
  RegularGrid grid = RegularGrid.create(record("origin", pair(128.0d, 128.0d),
    "spacing", pair(64.0d, 64.0d), "columns", Integer.valueOf(7), "rows", Integer.valueOf(7)));
  int count = (int)grid.size();
  initial = new double[count * 2];
  targets = new double[count * 2];
  nextTargets = new double[count * 2];
  List<Object> sites = new ArrayList<Object>(count);
  for (int body = 0; body < count; body++) {
    grid.pointInto((long)body, initial, body * 2);
    sites.add(pair(initial[body * 2], initial[body * 2 + 1]));
  }
  // This topology is built from the undeformed regular grid exactly once.
  initialMesh = Delaunay2D.triangulate(record("points", sites, "maxWork", Long.valueOf(50000000L)));
  resetState();
}

TargetSprings2D newMotion() {
  List<Object> bodies = new ArrayList<Object>(initial.length / 2);
  for (int body = 0; body < initial.length / 2; body++) {
    bodies.add(record("position", pair(initial[body * 2], initial[body * 2 + 1]),
      "velocity", pair(0.0d, 0.0d), "strength", Double.valueOf(STRENGTH),
      "retention", Double.valueOf(RETENTION)));
  }
  return TargetSprings2D.create(record("bodies", bodies));
}

void resetState() {
  System.arraycopy(initial, 0, targets, 0, initial.length);
  motion = newMotion();
  tick = 0L;
  pointerHeld = false;
  pointerX = 0.0d;
  pointerY = 0.0d;
  running = false;
  wire = false;
  showTargets = false;
  dirty = true;
}

// Deterministic replay seam: callers supply one already-sampled pointer for one logical tick.
// If the spring rejects the completed target array, targets and tick remain unchanged.
void stepWithInput(boolean held, double sampledPointerX, double sampledPointerY) {
  if (!Double.isFinite(sampledPointerX) || !Double.isFinite(sampledPointerY))
    throw new IllegalArgumentException("finite pointer required");
  if (tick == Long.MAX_VALUE) throw new IllegalStateException("tick counter exhausted");
  for (int offset = 0; offset < targets.length; offset += 2) {
    double targetX = targets[offset] + (initial[offset] - targets[offset]) * RETURN_RATE;
    double targetY = targets[offset + 1] + (initial[offset + 1] - targets[offset + 1]) * RETURN_RATE;
    if (held) {
      double dx = sampledPointerX - targetX;
      double dy = sampledPointerY - targetY;
      double distance = StrictMath.sqrt(dx * dx + dy * dy);
      if (distance < POINTER_RADIUS) {
        double amount = POINTER_RATE * (1.0d - distance / POINTER_RADIUS);
        targetX += dx * amount;
        targetY += dy * amount;
      }
    }
    nextTargets[offset] = targetX;
    nextTargets[offset + 1] = targetY;
  }
  motion.step(nextTargets);
  System.arraycopy(nextTargets, 0, targets, 0, targets.length);
  tick++;
}

void draw() {
  if (!running && !dirty) return;
  if (running) {
    // Read the captured input once. No wall-clock, frame-rate, or live mouse read enters a tick.
    boolean held = pointerHeld;
    double sampledX = pointerX, sampledY = pointerY;
    stepWithInput(held, sampledX, sampledY);
  }
  renderMarks();
  displayedFrame = get();
  dirty = false;
}

void renderMarks() {
  background(244, 241, 233);
  if (wire) drawFixedWire();
  else drawDots();
  if (showTargets) drawTargetGuides();
}

void drawDots() {
  noStroke();
  ellipseMode(CENTER);
  for (int body = 0; body < motion.size(); body++) {
    motion.positionInto((long)body, point, 0);
    int rgb = PALETTE[body % PALETTE.length];
    fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 225);
    ellipse((float)point[0], (float)point[1], 9.0f, 9.0f);
  }
}

void drawFixedWire() {
  noFill();
  strokeWeight(1.1f);
  strokeCap(ROUND);
  for (int index = 0; index < initialMesh.edgeCount(); index++) {
    initialMesh.edgeInto((long)index, edge, 0);
    // Canonical vertices map to their original spring bodies. This is fixed initial
    // connectivity, not a current Delaunay mesh or a non-crossing guarantee.
    int firstBody = initialMesh.sourceIndexAt((long)edge[0]);
    int secondBody = initialMesh.sourceIndexAt((long)edge[1]);
    motion.positionInto((long)firstBody, point, 0);
    motion.positionInto((long)secondBody, otherPoint, 0);
    int rgb = PALETTE[index % PALETTE.length];
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 190);
    line((float)point[0], (float)point[1], (float)otherPoint[0], (float)otherPoint[1]);
  }
}

void drawTargetGuides() {
  noFill();
  strokeWeight(1.0f);
  for (int body = 0; body < motion.size(); body++) {
    motion.positionInto((long)body, point, 0);
    double targetX = targets[body * 2], targetY = targets[body * 2 + 1];
    int rgb = PALETTE[body % PALETTE.length];
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 105);
    line((float)point[0], (float)point[1], (float)targetX, (float)targetY);
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 220);
    line((float)targetX - 4.0f, (float)targetY, (float)targetX + 4.0f, (float)targetY);
    line((float)targetX, (float)targetY - 4.0f, (float)targetX, (float)targetY + 4.0f);
  }
}

void capturePointer() {
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    pointerX = (double)mouseX;
    pointerY = (double)mouseY;
    pointerHeld = true;
  } else pointerHeld = false;
}

void mousePressed() { capturePointer(); }
void mouseDragged() { capturePointer(); }
void mouseReleased() { pointerHeld = false; }

void keyPressed() {
  if (key == ' ') {
    running = !running;
    dirty = true;
    if (running) loop();
    else { noLoop(); redraw(); }
    return;
  }
  if (key == '.') {
    if (!running) {
      stepWithInput(pointerHeld, pointerX, pointerY);
      dirty = true;
      redraw();
    }
    return;
  }
  char pressed = Character.toLowerCase(key);
  if (pressed == 's') {
    if (displayedFrame != null) displayedFrame.save(sketchPath("pointer-marks.png"));
    return;
  }
  if (pressed == 'm') wire = !wire;
  else if (pressed == 't') showTargets = !showTargets;
  else if (pressed == '0') { resetState(); noLoop(); }
  else return;
  dirty = true;
  redraw();
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
