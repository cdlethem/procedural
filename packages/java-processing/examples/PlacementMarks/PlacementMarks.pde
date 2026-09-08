import org.procedurals.examples.placementmarks.PlacementComposition;
import org.procedurals.sampling.CirclePlacements2D;

// R changes seed; N changes proposal budget; X changes proposal source.
// G changes separation; I/O change minimum/maximum size.
// M changes motif; C changes palette; S saves the displayed canvas.
// These settings describe this piece, not library defaults or recommended ranges.
long SEED = 42;
int ATTEMPTS = 5000;
double MINIMUM = 4.0d, MAXIMUM = 64.0d, SEPARATION = 1.0d;
boolean RADIAL = false, DIAMONDS = false, ALTERNATE = false;
int[] COLORS = {0x31A151, 0xFFA71E, 0x05084C, 0xDE4638, 0x3DBDB7};
int[] OTHER_COLORS = {0x2E0551, 0xFF00C7, 0x01AFC2, 0xFDBE03, 0xF4F9FD};
PlacementComposition composition;

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() { rebuild(); noLoop(); }
void rebuild() {
  composition = RADIAL ? PlacementComposition.radial(SEPARATION)
    : PlacementComposition.seeded(SEED, ATTEMPTS, MINIMUM, MAXIMUM, SEPARATION);
  println(composition.placements().size() + " accepted of "
    + composition.placements().attempts() + " proposals");
}
void draw() {
  background(236, 231, 218);
  noFill(); strokeWeight(1); strokeCap(ROUND); strokeJoin(ROUND);
  CirclePlacements2D positions = composition.placements();
  int[] colors = ALTERNATE ? OTHER_COLORS : COLORS;
  double[] vertex = new double[2];
  for (int i = 0; i < positions.size(); i++) {
    int rgb = colors[(int)(positions.sourceIndexAt(i) % colors.length)];
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
    beginShape();
    for (int j = 0; j < (DIAMONDS ? 4 : 64); j++) {
      composition.vertexInto(i, j, DIAMONDS, vertex);
      vertex((float)vertex[0], (float)vertex[1]);
    }
    endShape(CLOSE);
  }
}
void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') { saveFrame("placement-marks-####.png"); return; }
  if (k == 'm') DIAMONDS = !DIAMONDS;
  else if (k == 'c') ALTERNATE = !ALTERNATE;
  else {
    if (k == 'x') RADIAL = !RADIAL;
    else if (k == 'g') SEPARATION = SEPARATION == 1.0d ? 1.2d : 1.0d;
    else if (!RADIAL && k == 'r') SEED = (SEED + 1) & 0xffffffffL;
    else if (!RADIAL && k == 'n') ATTEMPTS = ATTEMPTS == 5000 ? 10000 : 5000;
    else if (!RADIAL && k == 'i') MINIMUM = MINIMUM == 4.0d ? 8.0d : 4.0d;
    else if (!RADIAL && k == 'o') MAXIMUM = MAXIMUM == 64.0d ? 32.0d : 64.0d;
    else return;
    rebuild();
  }
  redraw();
}
