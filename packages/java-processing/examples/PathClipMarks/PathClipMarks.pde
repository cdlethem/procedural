import org.procedurals.geometry.SegmentClip2D;
import org.procedurals.paths.GradientPath2D;
import org.procedurals.processing.Java2DLayers;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Retained composition study: N reclips against a notch, while C and O only redraw.
// Values describe this piece, not operation defaults or recommended artistic ranges.
final int PATH_COUNT = 6;
final int PATH_STEPS = 160;
final double STEP_DISTANCE = 4d;
final double FIELD_SCALE = 0.004d;
final long CLIP_WORK = 622144L;
final int CLIP_OUTPUT_LIMIT = 1920;
final double[][] STARTS = {
  {60d,140d}, {60d,212d}, {60d,284d}, {60d,356d}, {60d,428d}, {60d,500d}
};
final int[] PATH_COLORS = {0xff285c76, 0xffa84b5d, 0xff537e50, 0xff6d4c8f, 0xffbd7b38, 0xff357c81};

GradientPath2D[] traces;
List<List<Double>> sources;
int[] sourceToPath;
int[] sourceToStep;
List<List<Double>> polygon;
SegmentClip2D clipped;
PImage displayed;
boolean shallowNotch = false;
boolean alternateColors = false;
boolean showUnclipped = false;
int traceBuilds = 0;
int sourceBuilds = 0;
int clipBuilds = 0;
int displayBuilds = 0;
final double[] segmentBuffer = new double[4];

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }

void setup() {
  rebuildPathsAndSources();
  rebuildClip();
  noLoop();
}

Map<String,Object> traceConfig(double[] start) {
  Map<String,Object> field = new LinkedHashMap<String,Object>();
  field.put("seed", 17L);
  Map<String,Object> config = new LinkedHashMap<String,Object>();
  config.put("field", field);
  config.put("start", Arrays.asList(start[0], start[1]));
  config.put("steps", PATH_STEPS);
  config.put("stepDistance", STEP_DISTANCE);
  config.put("fieldScale", FIELD_SCALE);
  config.put("fieldOffset", Arrays.asList(0d, 0d));
  config.put("angleBase", -Math.PI);
  config.put("angleScale", 2d*Math.PI);
  return config;
}

void rebuildPathsAndSources() {
  traces = new GradientPath2D[PATH_COUNT];
  sources = new ArrayList<List<Double>>(PATH_COUNT*PATH_STEPS);
  sourceToPath = new int[PATH_COUNT*PATH_STEPS];
  sourceToStep = new int[PATH_COUNT*PATH_STEPS];
  int source = 0;
  for (int path = 0; path < PATH_COUNT; path++) {
    traces[path] = GradientPath2D.trace(traceConfig(STARTS[path]));
    traceBuilds++;
    double[] first = traces[path].pointAt(0L);
    for (int step = 0; step < PATH_STEPS; step++) {
      double[] second = traces[path].pointAt((long)step + 1L);
      // Ordinary drawing glue converts retained adjacent positions into clipping segments.
      sources.add(Arrays.asList(first[0], first[1], second[0], second[1]));
      sourceToPath[source] = path;
      sourceToStep[source] = step;
      source++;
      first = second;
    }
  }
  sourceBuilds++;
}

void rebuildClip() {
  double notchFloor = shallowNotch ? 430d : 200d;
  polygon = Arrays.asList(
    Arrays.asList(100d,100d), Arrays.asList(540d,100d),
    Arrays.asList(540d,540d), Arrays.asList(380d,540d),
    Arrays.asList(380d,notchFloor), Arrays.asList(260d,notchFloor),
    Arrays.asList(260d,540d), Arrays.asList(100d,540d)
  );
  Map<String,Object> input = new LinkedHashMap<String,Object>();
  input.put("polygon", polygon);
  input.put("segments", sources);
  input.put("maxWork", CLIP_WORK);
  input.put("maxOutputSegments", CLIP_OUTPUT_LIMIT);
  clipped = SegmentClip2D.clip(input);
  clipBuilds++;
  rebuildDisplay();
}

void rebuildDisplay() {
  displayed = Java2DLayers.render(this, width, height, target -> {
    target.background(247, 243, 233);
    target.noFill();
    if (showUnclipped) {
      target.stroke(189, 184, 176, 72);
      target.strokeWeight(0.7f);
      for (List<Double> source : sources)
        target.line(source.get(0).floatValue(), source.get(1).floatValue(),
          source.get(2).floatValue(), source.get(3).floatValue());
    }
    target.strokeWeight(1.5f);
    for (int piece = 0; piece < clipped.size(); piece++) {
      clipped.segmentInto(piece, segmentBuffer, 0);
      int source = clipped.sourceIndexAt(piece);
      int path = sourceToPath[source];
      // Every split piece retains its source path's palette identity.
      target.stroke(alternateColors ? PATH_COLORS[path] : color(37, 89, 107));
      target.line((float)segmentBuffer[0], (float)segmentBuffer[1],
        (float)segmentBuffer[2], (float)segmentBuffer[3]);
    }
    target.noFill();
    target.stroke(68, 64, 60);
    target.strokeWeight(1.5f);
    target.beginShape();
    for (List<Double> point : polygon)
      target.vertex(point.get(0).floatValue(), point.get(1).floatValue());
    target.endShape(CLOSE);
  });
  displayBuilds++;
  redraw();
}

void draw() { image(displayed, 0, 0); }

void keyPressed() {
  char pressed = Character.toLowerCase(key);
  if (pressed == 'n') { shallowNotch = !shallowNotch; rebuildClip(); }
  else if (pressed == 'c') { alternateColors = !alternateColors; rebuildDisplay(); }
  else if (pressed == 'o') { showUnclipped = !showUnclipped; rebuildDisplay(); }
  else if (pressed == '0') {
    boolean reclips = shallowNotch;
    shallowNotch = false;
    alternateColors = false;
    showUnclipped = false;
    if (reclips) rebuildClip(); else rebuildDisplay();
  }
  else if (pressed == 's') displayed.save(sketchPath("path-clip-marks.png"));
}
