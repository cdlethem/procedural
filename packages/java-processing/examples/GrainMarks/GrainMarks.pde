import org.procedurals.examples.grainmarks.GrainComposition;
import org.procedurals.sampling.TrianglePoints2D;

// R: new seed; N: density; B: uniform / first-vertex / edge concentration.
// C: colour; M: dots or strokes; X: transfer to cells; 0: reset; S: save displayed canvas.
// Density, colour and mark dimensions are editable example choices, not API defaults.
long SEED = 42;
double DENSITY = 0.1d;
int DISTRIBUTION = 0;
boolean STROKES = false, ALTERNATE = false, CELLS = false;
int[] COLORS = {0x173F5F, 0x9B342F, 0x176B60, 0x634779, 0x805515};
int[] OTHER_COLORS = {0xBA402F, 0x344E75, 0x6B4672, 0x426D35, 0x8C5221};
GrainComposition composition;

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() { rebuild(); noLoop(); }
void rebuild() {
  composition = GrainComposition.create(SEED, DENSITY, DISTRIBUTION, CELLS);
  println(composition.totalPoints() + " points in " + composition.size() + " triangles");
}
void draw() {
  background(243, 240, 232);
  int[] colors = ALTERNATE ? OTHER_COLORS : COLORS;
  double[] position = new double[2];
  strokeWeight(1);
  for (int region = 0; region < composition.size(); region++) {
    TrianglePoints2D points = composition.regionAt(region);
    int rgb = colors[region % colors.length];
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 150);
    for (int i = 0; i < points.size(); i++) {
      points.pointInto(i, position, 0);
      float x = (float)position[0], y = (float)position[1];
      // Marks may extend beyond their sampled centres; this example does not clip strokes.
      if (STROKES) line(x - 2, y, x + 2, y);
      else point(x, y);
    }
  }
}
void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') { saveFrame("grain-marks-####.png"); return; }
  if (k == 'm') STROKES = !STROKES;
  else if (k == 'c') ALTERNATE = !ALTERNATE;
  else {
    if (k == '0') {
      SEED = 42; DENSITY = 0.1d; DISTRIBUTION = 0;
      STROKES = false; ALTERNATE = false; CELLS = false;
    } else if (k == 'r') SEED = (SEED + 1) & 0xffffffffL;
    else if (k == 'n') DENSITY = DENSITY == 0.1d ? 0.2d : 0.1d;
    else if (k == 'b') DISTRIBUTION = (DISTRIBUTION + 1) % 3;
    else if (k == 'x') CELLS = !CELLS;
    else return;
    rebuild();
  }
  redraw();
}
