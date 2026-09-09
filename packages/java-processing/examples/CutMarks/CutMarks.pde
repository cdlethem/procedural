import java.util.List;
import java.util.Map;
import java.util.Random;
import org.procedurals.layout.RetainedRectangles2D;

// Click a region, then X/Y cuts it at its midpoint. Delete removes the selected region.
// A: aligned/staggered setup; D: decoration; H: holes; 0: reset; S: cached save.
// These seed, palette, cut count, ratios, and decorations are authored piece settings.
// They are not RetainedRectangles2D defaults or recommended operation ranges.
long seed = 42L;
boolean staggered = false;
boolean decoration = false;
boolean holes = false;
boolean initialEdit = false;
long selectedId = -1L;
RetainedRectangles2D model;
PImage displayedFrame;
final int[] PALETTE = {0xE76F51, 0x2A9D8F, 0xE9C46A, 0x264653, 0xF4A261};

void settings() { size(512, 512, JAVA2D); pixelDensity(1); }

// Optional repository render-helper hook. Interactive controls remain the artist-facing path.
void configureRender(long suppliedSeed, Map<String, Double> params) {
  if (params == null || (params.size() != 3 && params.size() != 4)
      || !params.containsKey("staggered") || !params.containsKey("decoration")
      || !params.containsKey("holes"))
    throw new IllegalArgumentException("exact staggered, decoration, holes required");
  for (String name : params.keySet())
    if (!name.equals("staggered") && !name.equals("decoration") && !name.equals("holes")
        && !name.equals("edit"))
      throw new IllegalArgumentException("unknown render parameter");
  seed = suppliedSeed;
  staggered = flag(params.get("staggered"));
  decoration = flag(params.get("decoration"));
  holes = flag(params.get("holes"));
  initialEdit = params.containsKey("edit") && flag(params.get("edit"));
}

boolean flag(Double value) {
  if (value == null || !Double.isFinite(value) || (value != 0.0d && value != 1.0d))
    throw new IllegalArgumentException("flag must be 0 or 1");
  return value == 1.0d;
}

void setup() { rebuild(); noLoop(); }

void rebuild() {
  model = RetainedRectangles2D.create(24.0d, 24.0d, 488.0d, 488.0d);
  Random random = new Random(seed);
  for (int iteration = 0; iteration < 12; iteration++) {
    List<RetainedRectangles2D.Leaf> leaves = model.leaves();
    RetainedRectangles2D.Leaf selected = leaves.get(iteration % leaves.size());
    double ratioX = 0.25d + 0.5d * random.nextDouble();
    double ratioYLow = 0.25d + 0.5d * random.nextDouble();
    double ratioYHigh = 0.25d + 0.5d * random.nextDouble();
    long[] children = cutIfInterior(selected, "X", selected.left
      + (selected.right - selected.left) * ratioX);
    if (children == null) continue;
    RetainedRectangles2D.Leaf low = model.leaf(children[0]);
    RetainedRectangles2D.Leaf high = model.leaf(children[1]);
    cutIfInterior(low, "Y", low.top + (low.bottom - low.top) * ratioYLow);
    double highRatio = staggered ? ratioYHigh : ratioYLow;
    cutIfInterior(high, "Y", high.top + (high.bottom - high.top) * highRatio);
  }
  if (holes) {
    List<RetainedRectangles2D.Leaf> leaves = model.leaves();
    for (RetainedRectangles2D.Leaf leaf : leaves)
      if (leaf.id % 7L == 0L) model.remove(leaf.id);
  }
  selectedId = -1L;
  if (initialEdit && model.size() > 0) {
    selectedId = model.leaves().get(0).id;
    cutSelected("X");
  }
}

// A midpoint can round back to an endpoint for a very narrow binary64 leaf. The core
// correctly rejects that cut; this sketch treats the user gesture as a harmless no-op.
long[] cutIfInterior(RetainedRectangles2D.Leaf leaf, String axis, double coordinate) {
  double low = axis.equals("X") ? leaf.left : leaf.top;
  double high = axis.equals("X") ? leaf.right : leaf.bottom;
  if (!(coordinate > low && coordinate < high)) return null;
  return model.cut(leaf.id, axis, coordinate);
}

void draw() {
  background(247, 243, 233);
  strokeWeight(1.0f);
  for (RetainedRectangles2D.Leaf leaf : model.leaves()) {
    int rgb = PALETTE[(int)(leaf.id % PALETTE.length)];
    float left = (float)leaf.left, top = (float)leaf.top;
    float width = (float)(leaf.right - leaf.left), height = (float)(leaf.bottom - leaf.top);
    if (decoration) {
      noFill();
      stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 210);
      rect(left, top, width, height);
      line((float)((leaf.left + leaf.right) * 0.5d), top,
        (float)((leaf.left + leaf.right) * 0.5d), top + height);
      line(left, (float)((leaf.top + leaf.bottom) * 0.5d), left + width,
        (float)((leaf.top + leaf.bottom) * 0.5d));
    } else {
      noStroke();
      fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 190);
      rect(left, top, width, height);
    }
  }
  if (selectedId >= 0L) {
    try {
      RetainedRectangles2D.Leaf selected = model.leaf(selectedId);
      noFill(); stroke(20, 20, 20, 255); strokeWeight(2.5f);
      rect((float)selected.left, (float)selected.top,
        (float)(selected.right - selected.left), (float)(selected.bottom - selected.top));
    } catch (RetainedRectangles2D.EditException error) {
      if (!"UNKNOWN_ID".equals(error.code)) throw error;
      selectedId = -1L;
    }
  }
  displayedFrame = get();
}

void mousePressed() {
  for (RetainedRectangles2D.Leaf leaf : model.leaves()) {
    if (mouseX >= leaf.left && mouseX <= leaf.right
        && mouseY >= leaf.top && mouseY <= leaf.bottom) {
      selectedId = leaf.id;
      redraw();
      return;
    }
  }
  selectedId = -1L;
  redraw();
}

void cutSelected(String axis) {
  if (selectedId < 0L) return;
  try {
    RetainedRectangles2D.Leaf selected = model.leaf(selectedId);
    double coordinate = axis.equals("X")
      ? selected.left + (selected.right - selected.left) * 0.5d
      : selected.top + (selected.bottom - selected.top) * 0.5d;
    long[] children = cutIfInterior(selected, axis, coordinate);
    if (children != null) selectedId = children[0];
  } catch (RetainedRectangles2D.EditException error) {
    if (!"UNKNOWN_ID".equals(error.code)) throw error;
    selectedId = -1L;
  }
}

void keyPressed() {
  char pressed = Character.toLowerCase(key);
  if (pressed == 's') {
    if (displayedFrame != null) displayedFrame.save(sketchPath("cut-marks.png"));
    return;
  }
  if (pressed == 'a') { staggered = !staggered; rebuild(); }
  else if (pressed == 'd') { decoration = !decoration; }
  else if (pressed == 'h') { holes = !holes; rebuild(); }
  else if (pressed == 'x') cutSelected("X");
  else if (pressed == 'y') cutSelected("Y");
  else if (keyCode == DELETE || keyCode == BACKSPACE) {
    if (selectedId >= 0L) {
      try { model.remove(selectedId); }
      catch (RetainedRectangles2D.EditException error) {
        if (!"UNKNOWN_ID".equals(error.code)) throw error;
      }
      selectedId = -1L;
    }
  }
  else if (pressed == '0') {
    seed = 42L; staggered = false; decoration = false; holes = false; initialEdit = false;
    rebuild();
  } else return;
  redraw();
}
