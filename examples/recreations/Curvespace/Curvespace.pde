import examples.recreations.curvespace.CurvespaceComposition;

// C recolours; R regenerates seeded inputs; 0 resets; S saves the cached frame.
// Draft independent recreation of 2018/Generativos/curvespace. Native review pending.
// Package owns radial deformation; this example owns scalar choices and drawing.
final int SIDE = 960;
final int[] COLORS = {0xFF5949, 0xFFC956, 0x1CEA64, 0x53EFF4};
long SEED = 42L;
boolean alternate = false;
CurvespaceComposition composition;
PImage displayedFrame;

void settings() {
  size(SIDE, SIDE, P2D);
  pixelDensity(1);
}

void setup() {
  rebuild();
  noLoop();
}

void rebuild() {
  composition = CurvespaceComposition.create(SEED);
}

int colourIndex(int index) {
  return (index + (alternate ? 1 : 0)) % COLORS.length;
}

void draw() {
  blendMode(BLEND);
  background(0xFF1C1528);
  strokeWeight(1);
  blendMode(ADD);
  drawDots();
  drawInfluences();
  drawLines(composition.verticalOutputs(), composition.verticalColors());
  drawLines(composition.horizontalOutputs(), composition.horizontalColors());
  displayedFrame = get();
}

void drawDots() {
  noFill();
  for (int i = 0; i < composition.dotInputs().length; i++) {
    int rgb = COLORS[colourIndex(composition.dotColors()[i])];
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 50);
    double[] point = composition.dotInputs()[i];
    point((float) point[0], (float) point[1]);
  }
}

void drawInfluences() {
  noFill();
  for (int i = 0; i < composition.influenceCenters().length; i++) {
    int rgb = COLORS[colourIndex(composition.influenceColors()[i])];
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 20);
    double[] center = composition.influenceCenters()[i];
    float diameter = (float) (2.0d * composition.influenceRadii()[i]);
    ellipse((float) center[0], (float) center[1], diameter, diameter);
  }
}

void drawLines(double[][][] lines, int[] lineColors) {
  noFill();
  for (int line = 0; line < lines.length; line++) {
    int rgb = COLORS[colourIndex(lineColors[line])];
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 40);
    beginShape();
    for (double[] point : lines[line]) vertex((float) point[0], (float) point[1]);
    endShape();
  }
}

void keyPressed() {
  char pressed = Character.toLowerCase(key);
  if (pressed == 's') {
    if (displayedFrame != null) displayedFrame.save(sketchPath("curvespace.png"));
    return;
  }
  if (pressed == 'c') {
    alternate = !alternate;
  } else if (pressed == 'r') {
    SEED = (SEED + 1L) & 0xffffffffL;
    rebuild();
  } else if (pressed == '0') {
    SEED = 42L;
    alternate = false;
    rebuild();
  } else {
    return;
  }
  redraw();
}
