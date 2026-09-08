import java.util.List;
import java.util.Map;
import java.util.Random;

// Private CP21 retained rectangle study. A: staggered/aligned; D: decoration; H: holes.
// 0 resets the supplied seed and all controls; S saves only the cached displayed frame.
long seed = 42L;
boolean staggered = false;
boolean decoration = false;
boolean holes = false;
RetainedRects model;
PImage displayedFrame;
final int[] PALETTE = {0xE76F51, 0x2A9D8F, 0xE9C46A, 0x264653, 0xF4A261};

void settings() { size(512, 512, JAVA2D); pixelDensity(1); }

void configureRender(long suppliedSeed, Map<String, Double> params) {
  if (params == null || params.size() != 3
      || !params.containsKey("staggered") || !params.containsKey("decoration")
      || !params.containsKey("holes")) throw new IllegalArgumentException("exact staggered,decoration,holes required");
  seed = suppliedSeed;
  staggered = flag(params.get("staggered"));
  decoration = flag(params.get("decoration"));
  holes = flag(params.get("holes"));
}

boolean flag(Double value) {
  if (value == null || !Double.isFinite(value) || (value != 0.0 && value != 1.0))
    throw new IllegalArgumentException("flag must be 0 or 1");
  return value == 1.0;
}

void setup() { rebuild(); noLoop(); }

void rebuild() {
  model = new RetainedRects(24.0d, 24.0d, 488.0d, 488.0d);
  Random random = new Random(seed);
  for (int iteration = 0; iteration < 12; iteration++) {
    List<RetainedRects.Leaf> leaves = model.leaves();
    RetainedRects.Leaf selected = leaves.get(iteration % leaves.size());
    double ratioX = 0.25d + 0.5d * random.nextDouble();
    double ratioYLower = 0.25d + 0.5d * random.nextDouble();
    double ratioYUpper = 0.25d + 0.5d * random.nextDouble();
    long[] children = model.cut(selected.id, 'X', selected.left
        + (selected.right - selected.left) * ratioX);
    double[] cuts = new double[2];
    for (int child = 0; child < 2; child++) {
      RetainedRects.Leaf part = model.leaf(children[child]);
      double ratio = child == 0 || !staggered ? ratioYLower : ratioYUpper;
      cuts[child] = part.top + (part.bottom - part.top) * ratio;
    }
    model.cut(children[0], 'Y', cuts[0]);
    model.cut(children[1], 'Y', cuts[1]);
  }
  if (holes) {
    List<RetainedRects.Leaf> leaves = model.leaves();
    for (RetainedRects.Leaf leaf : leaves) if (leaf.id % 7L == 0L) model.remove(leaf.id);
  }
}

void draw() {
  background(247, 243, 233);
  for (RetainedRects.Leaf leaf : model.leaves()) {
    int rgb = PALETTE[(int) (leaf.id % PALETTE.length)];
    if (decoration) {
      noFill(); stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 210);
      rect((float) leaf.left, (float) leaf.top, (float) (leaf.right - leaf.left), (float) (leaf.bottom - leaf.top));
      line((float) ((leaf.left + leaf.right) * 0.5d), (float) leaf.top,
          (float) ((leaf.left + leaf.right) * 0.5d), (float) leaf.bottom);
      line((float) leaf.left, (float) ((leaf.top + leaf.bottom) * 0.5d),
          (float) leaf.right, (float) ((leaf.top + leaf.bottom) * 0.5d));
    } else {
      noStroke(); fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 190);
      rect((float) leaf.left, (float) leaf.top, (float) (leaf.right - leaf.left), (float) (leaf.bottom - leaf.top));
    }
  }
  displayedFrame = get();
}

void keyPressed() {
  char pressed = Character.toLowerCase(key);
  if (pressed == 's') { if (displayedFrame != null) displayedFrame.save(sketchPath("cut-study.png")); return; }
  if (pressed == 'a') { staggered = !staggered; rebuild(); }
  else if (pressed == 'd') { decoration = !decoration; }
  else if (pressed == 'h') { holes = !holes; rebuild(); }
  else if (pressed == '0') { seed = 42L; staggered = false; decoration = false; holes = false; rebuild(); }
  else return;
  redraw();
}
