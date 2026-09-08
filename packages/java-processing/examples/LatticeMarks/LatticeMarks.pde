import org.procedurals.examples.latticemarks.LatticeComposition;
import org.procedurals.paths.OccupiedLatticePaths2D;
import org.procedurals.color.CyclicPalette;
import java.util.Arrays;
import java.util.Collections;

// Grow paths from ordered starts; restyle the retained arrangement.
// C palette; M paths/dots; W width; L move limit; N starts; R seed.
// 0 restores the baseline; S saves the completed canvas.
// These are authored piece settings, not library defaults.
long SEED = 42;
boolean MANY = false, LONG = false, DOTS = false, WIDE = false, ALT = false;
LatticeComposition composition;
CyclicPalette palette, other;
PImage displayedFrame;
int[] cell = new int[2];

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }

void setup() {
  colorMode(RGB, 255);
  palette = CyclicPalette.create(Collections.singletonMap("colors",
    Arrays.asList(0x173F5F, 0xAF5441, 0xE9C46A, 0x347969)));
  other = CyclicPalette.create(Collections.singletonMap("colors",
    Arrays.asList(0x493657, 0xB85065, 0xE6B89C, 0x467C89)));
  rebuild();
  noLoop();
}

void rebuild() { composition = LatticeComposition.create(SEED, MANY, LONG); }
int colour(int path) { return (ALT ? other : palette).sample(path * .173d); }

void draw() {
  background(243, 240, 232);
  drawGrid();
  strokeCap(ROUND);
  strokeJoin(ROUND);
  OccupiedLatticePaths2D paths = composition.paths();
  for (int path = 0; path < paths.pathCount(); path++) {
    int length = paths.pathLengthAt((long) path);
    if (length == 0) continue;
    int rgb = colour(path);
    if (DOTS) drawVertices(paths, path, length, rgb);
    else drawPath(paths, path, length, rgb);
  }
  displayedFrame = get();
}

void drawGrid() {
  stroke(205, 200, 190);
  strokeWeight(1);
  for (int i = 0; i <= 24; i++) {
    line(32, 32 + 24 * i, 608, 32 + 24 * i);
    line(32 + 24 * i, 32, 32 + 24 * i, 608);
  }
}

void drawVertices(OccupiedLatticePaths2D paths, int path, int length, int rgb) {
  noStroke();
  fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
  for (int index = 0; index < length; index++) drawCellDot(paths, path, index, 6);
}

void drawPath(OccupiedLatticePaths2D paths, int path, int length, int rgb) {
  strokeWeight((WIDE ? .65 : .35) * 24);
  stroke(30, 30, 30, 70);
  drawSegments(paths, path, length, 3);
  stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
  drawSegments(paths, path, length, 0);
  // Pale endpoints contrast with the coloured stroke; isolated cells stay visible.
  stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
  strokeWeight(2);
  fill(255, 250, 230);
  drawCellDot(paths, path, 0, 8);
  if (length > 1) drawCellDot(paths, path, length - 1, 8);
}

void drawSegments(OccupiedLatticePaths2D paths, int path, int length, float offset) {
  for (int index = 1; index < length; index++) {
    paths.cellInto((long) path, (long) (index - 1), cell, 0);
    float x = LatticeComposition.pixel(cell[0]);
    float y = LatticeComposition.pixel(cell[1]);
    paths.cellInto((long) path, (long) index, cell, 0);
    line(x + offset, y + offset,
      LatticeComposition.pixel(cell[0]) + offset, LatticeComposition.pixel(cell[1]) + offset);
  }
}

void drawCellDot(OccupiedLatticePaths2D paths, int path, int index, float diameter) {
  paths.cellInto((long) path, (long) index, cell, 0);
  ellipse(LatticeComposition.pixel(cell[0]), LatticeComposition.pixel(cell[1]), diameter, diameter);
}

void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') {
    if (displayedFrame != null)
      displayedFrame.save(sketchPath("lattice-marks-" + nf(frameCount, 4) + ".png"));
    return;
  }
  if (k == 'c') ALT = !ALT;
  else if (k == 'm') DOTS = !DOTS;
  else if (k == 'w') WIDE = !WIDE;
  else if (k == 'l') { LONG = !LONG; rebuild(); }
  else if (k == 'n') { MANY = !MANY; rebuild(); }
  else if (k == 'r') { SEED = (SEED + 1) & 0xffffffffL; rebuild(); }
  else if (k == '0') {
    SEED = 42;
    MANY = LONG = DOTS = WIDE = ALT = false;
    rebuild();
  } else return;
  redraw();
}
