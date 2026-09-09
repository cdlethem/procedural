import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.layout.RetainedRectangles2D;
import org.procedurals.paths.GradientPath2D;
import org.procedurals.processing.Java2DLayers;
import org.procedurals.processing.Java2DRegions;

// Candidate workflow: retained paths and images stay separate from the editable mask layout.
// The values below belong to this piece; they are not library defaults or recommended ranges.
final int PATH_COUNT = 24;
final int PATH_STEPS = 120;
final double STEP_DISTANCE = 4d;
final double FIELD_SCALE = 0.004d;
final int[] PATH_COLORS = {
  0xffe76f51, 0xffe9c46a, 0xff2a9d8f, 0xff457b9d,
  0xff8d5a97, 0xffe07a5f, 0xff81b29a, 0xff3d5a80
};

GradientPath2D[] paths;
PImage ground;
PImage globalImage;
PImage sourceImage;
PImage displayed;
List<Java2DRegions.MaskedRegion> masks;
int mode = 0;
boolean alternateLayout = false;
int sourceBuilds = 0;
int maskBuilds = 0;
int displayBuilds = 0;

void settings() { size(720, 480, JAVA2D); pixelDensity(1); }

void setup() {
  rebuildSources();
  rebuildMasks();
  rebuildDisplay();
  noLoop();
}

Map<String, Object> traceConfig(double x, double y) {
  Map<String, Object> field = new LinkedHashMap<String, Object>();
  field.put("seed", Long.valueOf(17L));
  Map<String, Object> config = new LinkedHashMap<String, Object>();
  config.put("field", field);
  config.put("start", Arrays.asList(Double.valueOf(x), Double.valueOf(y)));
  config.put("steps", Integer.valueOf(PATH_STEPS));
  config.put("stepDistance", Double.valueOf(STEP_DISTANCE));
  config.put("fieldScale", Double.valueOf(FIELD_SCALE));
  config.put("fieldOffset", Arrays.asList(Double.valueOf(0d), Double.valueOf(0d)));
  config.put("angleBase", Double.valueOf(-Math.PI));
  config.put("angleScale", Double.valueOf(2d * Math.PI));
  return config;
}

void rebuildSources() {
  paths = new GradientPath2D[PATH_COUNT];
  for (int path = 0; path < PATH_COUNT; path++)
    paths[path] = GradientPath2D.trace(traceConfig(50d + (path % 6) * 120d, 55d + (path / 6) * 120d));

  ground = Java2DLayers.render(this, width, height, target -> {
    target.background(245, 239, 225);
    target.noFill();
    target.stroke(72, 78, 83, 32);
    target.strokeWeight(1f);
    for (int x = 0; x <= width; x += 36) target.line(x, 0, x, height);
    for (int y = 0; y <= height; y += 36) target.line(0, y, width, y);
  });
  globalImage = Java2DLayers.render(this, width, height, target -> {
    target.background(27, 55, 74);
    target.noFill();
    target.strokeWeight(2.2f);
    double[] first = new double[2];
    double[] next = new double[2];
    for (int path = 0; path < paths.length; path++) {
      paths[path].pointInto(0L, first, 0);
      target.stroke(PATH_COLORS[path % PATH_COLORS.length]);
      for (int step = 0; step < PATH_STEPS; step++) {
        paths[path].pointInto((long) step + 1L, next, 0);
        target.line((float) first[0], (float) first[1], (float) next[0], (float) next[1]);
        first[0] = next[0];
        first[1] = next[1];
      }
    }
  });
  sourceImage = Java2DLayers.render(this, width, height, target -> {
    target.background(27, 55, 74);
    target.noStroke();
    for (int radius = 210; radius >= 18; radius -= 18) {
      target.fill(234, 130 + radius / 3, 69, 220);
      target.ellipse(180, 244, radius * 2, radius * 2);
    }
    target.fill(42, 157, 143);
    target.triangle(405, 404, 552, 72, 690, 404);
    target.fill(255, 214, 122, 185);
    target.rect(390, 116, 220, 34);
  });
  sourceBuilds++;
}

void rebuildMasks() {
  RetainedRectangles2D layout = RetainedRectangles2D.create(36d, 36d, 684d, 444d);
  long[] columns = layout.cut(0L, "X", alternateLayout ? 430d : 360d);
  layout.cut(columns[0], "Y", 240d);
  layout.cut(columns[1], "Y", 240d);

  masks = new ArrayList<Java2DRegions.MaskedRegion>();
  for (RetainedRectangles2D.Leaf leaf : layout.leaves()) {
    Java2DRegions.Region frame = new Java2DRegions.Region(
      leaf.id, leaf.left, leaf.top, leaf.right, leaf.bottom);
    PImage alpha = Java2DLayers.render(this, width, height, target -> {
      target.noStroke();
      target.fill(255);
      float ellipseWidth = (float) (leaf.right - leaf.left - 12d);
      float ellipseHeight = (float) (leaf.bottom - leaf.top - 12d);
      target.ellipse((float) ((leaf.left + leaf.right) * .5d),
        (float) ((leaf.top + leaf.bottom) * .5d), ellipseWidth, ellipseHeight);
    });
    masks.add(new Java2DRegions.MaskedRegion(frame, width, height,
      Java2DLayers.alphaMask(alpha)));
  }
  maskBuilds++;
}

void rebuildDisplay() {
  Java2DRegions.Content content;
  if (mode == 0) {
    content = (target, frame) -> target.image(globalImage, 0, 0);
  } else if (mode == 1) {
    content = (target, frame) -> {
      float frameWidth = (float) (frame.right - frame.left);
      float frameHeight = (float) (frame.bottom - frame.top);
      target.noFill();
      target.stroke(34, 58, 75);
      target.strokeWeight(1.5f);
      for (int x = -40; x < frameWidth + 80; x += 18)
        target.line(x, 0, frameWidth - x * .25f, frameHeight);
      target.stroke(207, 91, 72, 180);
      for (float radius = 18; radius < max(frameWidth, frameHeight); radius += 24)
        target.ellipse(frameWidth * .5f, frameHeight * .5f, radius * 2f, radius * 2f);
    };
  } else {
    content = (target, frame) -> {
      int snipWidth = (int) (frame.right - frame.left);
      int snipHeight = (int) (frame.bottom - frame.top);
      PImage snip = sourceImage.get((int) frame.left, (int) frame.top, snipWidth, snipHeight);
      target.image(snip, 0, 0);
      target.noFill();
      target.stroke(255, 245, 213, 180);
      target.strokeWeight(2f);
      target.rect(8, 8, snipWidth - 16, snipHeight - 16);
    };
  }
  displayed = Java2DRegions.renderMasked(this, ground, masks,
    mode == 0 ? Java2DRegions.Space.CANVAS : Java2DRegions.Space.LOCAL, content);
  displayBuilds++;
  redraw();
}

void draw() { image(displayed, 0, 0); }

void keyPressed() {
  char pressed = Character.toLowerCase(key);
  if (pressed == 'm') {
    mode = (mode + 1) % 3;
    rebuildDisplay();
  } else if (pressed == 'n') {
    alternateLayout = !alternateLayout;
    rebuildMasks();
    rebuildDisplay();
  } else if (pressed == '0') {
    boolean layoutChanged = alternateLayout;
    alternateLayout = false;
    mode = 0;
    if (layoutChanged) rebuildMasks();
    rebuildDisplay();
  } else if (pressed == 's') {
    displayed.save(sketchPath("masked-partition-marks.png"));
  }
}
