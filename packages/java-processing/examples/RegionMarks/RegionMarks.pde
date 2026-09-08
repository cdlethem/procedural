import org.procedurals.examples.regionmarks.RegionComposition;

// R: new seed; N: more/fewer splits; G: change the selected part of the live list.
// M: single mark or grid; C: recolour; X: authored cells; S: save displayed canvas.
// These are example settings, not library defaults or recommended ranges.
long SEED = 42;
int REPLACEMENTS = 100;
double FRACTION = 0.5d;
boolean GRID_MARKS = false, ALTERNATE = false, AUTHORED = false;
int[] COLORS = {0x173F5F, 0x20639B, 0x3CAEA3, 0xF6D55C, 0xED553B};
int[] OTHER_COLORS = {0x264653, 0x2A9D8F, 0xE9C46A, 0xF4A261, 0xE76F51};
RegionComposition composition;

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() { rebuild(); noLoop(); }
void rebuild() {
  composition = AUTHORED ? RegionComposition.authored()
    : RegionComposition.seeded(SEED, REPLACEMENTS, FRACTION);
  println(composition.size() + " cells");
}
void draw() {
  background(243, 240, 232); noStroke();
  int[] colors = ALTERNATE ? OTHER_COLORS : COLORS;
  double[] bounds = new double[4], point = new double[2];
  for (int i = 0; i < composition.size(); i++) {
    composition.boundsInto(i, bounds);
    double w = bounds[2] - bounds[0], h = bounds[3] - bounds[1];
    double inset = Math.min(1.0d, Math.min(w, h) * 0.05d);
    int rgb = colors[composition.idAt(i) % colors.length];
    fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 190);
    rect((float)(bounds[0] + inset), (float)(bounds[1] + inset),
         (float)(w - 2 * inset), (float)(h - 2 * inset));
    fill(255, 245);
    if (GRID_MARKS) {
      float diameter = (float)(Math.min(w, h) / 12);
      for (int mark = 0; mark < 9; mark++) {
        composition.markInto(mark, bounds, point);
        ellipse((float)point[0], (float)point[1], diameter, diameter);
      }
    } else {
      float diameter = (float)(Math.min(w, h) * 0.28d);
      ellipse((float)(bounds[0] + w * 0.5d), (float)(bounds[1] + h * 0.5d), diameter, diameter);
    }
  }
}
void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') { saveFrame("region-marks-####.png"); return; }
  if (k == 'm') GRID_MARKS = !GRID_MARKS;
  else if (k == 'c') ALTERNATE = !ALTERNATE;
  else {
    if (k == 'x') AUTHORED = !AUTHORED;
    else if (!AUTHORED && k == 'r') SEED = (SEED + 1) & 0xffffffffL;
    else if (!AUTHORED && k == 'n') REPLACEMENTS = REPLACEMENTS == 100 ? 200 : 100;
    else if (!AUTHORED && k == 'g') FRACTION = FRACTION == 0.5d ? 1.0d : 0.5d;
    else return;
    rebuild();
  }
  redraw();
}
