import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.color.CyclicPalette;
import org.procedurals.fields.GradientNoise2D01;
import org.procedurals.layout.RegularGrid;
import org.procedurals.paths.GradientPath2D;

// Space: run/pause; .: one paused tick; M: body/centerline; W: taper; 0: reset; S: cached save.
// The layout, field, step length, taper, palette, and counts are authored piece settings.
// They are not library defaults, source compatibility settings, or corpus useful ranges.
final int HEAD_COUNT = 12;
final int SPINE_STEPS = 24;
final double STEP_DISTANCE = 4.0d;
final double FIELD_SCALE = 0.0035d;
final double HALF_WIDTH = 12.0d;
final int[] COLORS = {0x173F5F, 0xAF5441, 0xE9C46A, 0x347969};

boolean running = false;
boolean dirty = true;
boolean centerlines = false;
double taperExponent = 0.7d;
long tick = 0L;

Map<String, Object> fieldConfig;
GradientNoise2D01 field;
CyclicPalette palette;
double[] initialHeads;
double[] heads;
GradientPath2D[] spines;
PImage displayedFrame;
double[] point = new double[2];

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }

void setup() {
  fieldConfig = record("seed", Long.valueOf(42L));
  // The traces below use this exact fixed config. The direct field query supplies a stable
  // palette phase; it does not add a second motion or noise policy.
  field = GradientNoise2D01.create(fieldConfig);
  palette = palette(COLORS);
  buildInitialHeads();
  resetState();
  // Keep the display loop active. Paused frames return before integration.
}

void buildInitialHeads() {
  RegularGrid layout = RegularGrid.create(record("origin", pair(160.0d, 200.0d),
    "spacing", pair(110.0d, 120.0d), "columns", Integer.valueOf(4), "rows", Integer.valueOf(3)));
  if (layout.size() != HEAD_COUNT) throw new IllegalStateException("authored head layout");
  initialHeads = new double[HEAD_COUNT * 2];
  for (int head = 0; head < HEAD_COUNT; head++) layout.pointInto((long)head, initialHeads, head * 2);
}

void resetState() {
  double[] resetHeads = initialHeads.clone();
  GradientPath2D[] resetSpines = reconstructSpines(resetHeads);
  heads = resetHeads;
  spines = resetSpines;
  tick = 0L;
  running = false;
  centerlines = false;
  taperExponent = 0.7d;
  dirty = true;
}

// One bounded logical tick constructs every candidate head and backward spine before commit.
// A failed trace leaves the retained heads, spines, and tick unchanged.
void advanceTick() {
  if (tick == Long.MAX_VALUE) throw new IllegalStateException("tick counter exhausted");
  double[] nextHeads = new double[heads.length];
  GradientPath2D[] nextSpines = new GradientPath2D[HEAD_COUNT];
  for (int head = 0; head < HEAD_COUNT; head++) {
    GradientPath2D forward = trace(heads[head * 2], heads[head * 2 + 1], 1, 0.0d);
    forward.pointInto(1L, nextHeads, head * 2);
    nextSpines[head] = trace(nextHeads[head * 2], nextHeads[head * 2 + 1], SPINE_STEPS, Math.PI);
  }
  heads = nextHeads;
  spines = nextSpines;
  tick++;
}

GradientPath2D[] reconstructSpines(double[] sourceHeads) {
  GradientPath2D[] reconstructed = new GradientPath2D[HEAD_COUNT];
  for (int head = 0; head < HEAD_COUNT; head++)
    reconstructed[head] = trace(sourceHeads[head * 2], sourceHeads[head * 2 + 1], SPINE_STEPS, Math.PI);
  return reconstructed;
}

GradientPath2D trace(double x, double y, int steps, double angleBase) {
  return GradientPath2D.trace(record("field", fieldConfig, "start", pair(x, y),
    "steps", Integer.valueOf(steps), "stepDistance", Double.valueOf(STEP_DISTANCE),
    "fieldScale", Double.valueOf(FIELD_SCALE), "fieldOffset", pair(0.0d, 0.0d),
    "angleBase", Double.valueOf(angleBase), "angleScale", Double.valueOf(Math.PI * 2.0d)));
}

void draw() {
  if (!running && !dirty) return;
  if (running) advanceTick();
  renderBodies();
  displayedFrame = get();
  dirty = false;
}

void renderBodies() {
  background(246, 243, 235);
  for (int head = 0; head < HEAD_COUNT; head++) {
    GradientPath2D spine = spines[head];
    double phase = head * 0.17d + field.sample(heads[head * 2] * FIELD_SCALE,
      heads[head * 2 + 1] * FIELD_SCALE) * 0.2d;
    int rgb = palette.sample(phase);
    if (centerlines) drawCenterline(spine, rgb);
    else drawBody(spine, rgb);
  }
}

void drawBody(GradientPath2D spine, int rgb) {
  noStroke();
  fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 220);
  beginShape();
  for (int sample = 0; sample < SPINE_STEPS; sample++) {
    spine.pointInto((long)sample, point, 0);
    double heading = spine.headingAt((long)sample);
    double width = halfWidth(sample);
    vertex((float)(point[0] + Math.cos(heading + Math.PI * 0.5d) * width),
      (float)(point[1] + Math.sin(heading + Math.PI * 0.5d) * width));
  }
  for (int sample = SPINE_STEPS - 1; sample >= 0; sample--) {
    spine.pointInto((long)sample, point, 0);
    double heading = spine.headingAt((long)sample);
    double width = halfWidth(sample);
    vertex((float)(point[0] - Math.cos(heading + Math.PI * 0.5d) * width),
      (float)(point[1] - Math.sin(heading + Math.PI * 0.5d) * width));
  }
  endShape(CLOSE);
}

void drawCenterline(GradientPath2D spine, int rgb) {
  noFill();
  stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 225);
  strokeWeight(2.0f);
  strokeCap(ROUND);
  beginShape();
  // samples 0..23 have headings. The terminal point 24 is intentionally not drawn here.
  for (int sample = 0; sample < SPINE_STEPS; sample++) {
    spine.pointInto((long)sample, point, 0);
    vertex((float)point[0], (float)point[1]);
  }
  endShape();
}

double halfWidth(int sample) {
  return StrictMath.pow(1.0d - sample / (double)(SPINE_STEPS - 1), taperExponent) * HALF_WIDTH;
}

void keyPressed() {
  if (key == ' ') {
    running = !running;
    dirty = true;
    return;
  }
  if (key == '.') {
    if (!running) {
      advanceTick();
      dirty = true;
    }
    return;
  }
  char pressed = Character.toLowerCase(key);
  if (pressed == 's') {
    if (displayedFrame != null) displayedFrame.save(sketchPath("body-marks.png"));
    return;
  }
  if (pressed == 'm') centerlines = !centerlines;
  else if (pressed == 'w') taperExponent = taperExponent == 0.7d ? 2.0d : 0.7d;
  else if (pressed == '0') resetState();
  else return;
  dirty = true;
}

CyclicPalette palette(int[] colors) {
  List<Object> values = new ArrayList<Object>(colors.length);
  for (int rgbValue : colors) values.add(Integer.valueOf(rgbValue));
  return CyclicPalette.create(record("colors", values));
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
