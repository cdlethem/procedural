import org.procedurals.examples.branchmarks.BranchComposition;
import org.procedurals.topology.BranchTree2D;

// N: append/remove one generation; G: fixed/narrowing spread; W: wider spread.
// B: two/three child slots; R: seed; X: transfer roots to CP3 circle placements.
// C: colour; M: thin lines/taper and actual tips; 0: reset; S: save displayed canvas.
// These are editable example settings, not library defaults or recommended ranges.
long SEED = 42;
boolean MORE = false, NARROWING = false, BINARY = false, WIDER = false, FOREST = false;
boolean TAPER = true, ALTERNATE = false;
int[] COLORS = {0x183E4A, 0x225B60, 0x347969, 0xAF5441};
int[] OTHER_COLORS = {0x443D65, 0x765075, 0xA96962, 0xBB793E};
BranchComposition composition;

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() { rebuild(); noLoop(); }
void rebuild() {
  composition = BranchComposition.create(SEED, MORE, NARROWING, BINARY, WIDER, FOREST);
  println(composition.totalSegments() + " segments in " + composition.size() + " trees");
}
void draw() {
  background(243, 240, 232);
  int[] colors = ALTERNATE ? OTHER_COLORS : COLORS;
  double[] segment = new double[4];
  for (int root = 0; root < composition.size(); root++) {
    BranchTree2D tree = composition.treeAt(root);
    for (int i = 0; i < tree.size(); i++) {
      tree.segmentInto(i, segment, 0);
      // Colour by absolute generation so an added generation does not recolour old ones.
      int rgb = colors[min(colors.length - 1, tree.generationAt(i) / 2)];
      stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
      strokeWeight(TAPER ? (float)Math.max(0.65d, tree.lengthAt(i) * 0.035d) : 1.0f);
      line((float)segment[0], (float)segment[1], (float)segment[2], (float)segment[3]);
    }
    if (TAPER) {
      noStroke();
      int rgb = colors[colors.length - 1];
      fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
      for (int i = 0; i < tree.size(); i++) {
        if (tree.childCountAt(i) != 0) continue;
        tree.segmentInto(i, segment, 0);
        ellipse((float)segment[2], (float)segment[3], 4, 4);
      }
    }
  }
}
void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') { saveFrame("branch-marks-####.png"); return; }
  if (k == 'm') TAPER = !TAPER;
  else if (k == 'c') ALTERNATE = !ALTERNATE;
  else {
    if (k == '0') {
      SEED = 42; MORE = false; NARROWING = false; BINARY = false;
      WIDER = false; FOREST = false; TAPER = true; ALTERNATE = false;
    } else if (k == 'r') SEED = (SEED + 1) & 0xffffffffL;
    else if (k == 'n') MORE = !MORE;
    else if (k == 'g') NARROWING = !NARROWING;
    else if (k == 'w') WIDER = !WIDER;
    else if (k == 'b') BINARY = !BINARY;
    else if (k == 'x') FOREST = !FOREST;
    else return;
    rebuild();
  }
  redraw();
}
