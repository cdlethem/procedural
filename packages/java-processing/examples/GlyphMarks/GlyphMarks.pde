import org.procedurals.examples.glyphmarks.GlyphComposition;
import org.procedurals.examples.glyphmarks.GlyphFont;
import org.procedurals.paths.GradientPath2D;
import org.procedurals.color.CyclicPalette;
import java.util.Arrays;
import java.util.Collections;

// An editable composition, motivated by 2018/Generativos/numbers.
// N: shorter trail; D: sparser stamps; G: letters; M: dots; C: colour.
// V: integration distance; F: field scale; R: seed; 0: reset; S: save.
// Piece settings, not recommended library ranges. See cp8-glyph-marks.md.
long SEED = 42;
boolean SHORT = false, SPARSE = false, LETTERS = false, DOTS = false;
boolean COLOURED = false, FASTER = false, FINER = false;
String DIGITS = "0123456789", ALPHABET = "ABCDEFGHIJ";
GlyphComposition composition;
CyclicPalette palette;
PFont glyphFont;
PImage displayedFrame;
double[] anchor = new double[2];

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() {
  // Explicit file loading fails if the font is absent or cannot display our symbols.
  // The distribution will supply the file and its license in the sketch data folder.
  glyphFont = GlyphFont.load(dataPath("GlyphMarks.ttf"), DIGITS + ALPHABET, 48f);
  palette = CyclicPalette.create(Collections.singletonMap("colors",
    Arrays.asList(0x183E4A, 0x347969, 0xAF5441, 0xE9C46A)));
  rebuild();
  noLoop();
}
void rebuild() {
  composition = GlyphComposition.create(SEED, FASTER ? 2.0d : 0.75d,
    FINER ? 0.03d : 0.006d);
}
void draw() {
  background(230);
  noStroke();
  textFont(glyphFont);
  textAlign(CENTER, CENTER);
  ellipseMode(CENTER);
  int visibleSteps = SHORT ? 80 : 160;
  int stride = SPARSE ? 4 : 1;
  String symbols = LETTERS ? ALPHABET : DIGITS;
  for (int p = 0; p < composition.pathCount(); p++) {
    GradientPath2D path = composition.pathAt(p);
    float markSize = (float)composition.sizeAt(p);
    textSize(markSize);
    char symbol = symbols.charAt(composition.symbolIndexAt(p));
    for (int j = 0; j < visibleSteps; j += stride) {
      // Stamp before the movement at step j. The final integrated point is unused.
      path.pointInto(j, anchor, 0);
      double phase = j / (double)visibleSteps;
      if (COLOURED) {
        int rgb = palette.sample(phase);
        fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 50);
      } else {
        fill((float)(230.0d - 200.0d * phase), 50);
      }
      // Replace this small drawing block with your own mark. It does no integration.
      if (DOTS) ellipse((float)anchor[0], (float)anchor[1], markSize/5, markSize/5);
      else text(symbol, (float)anchor[0], (float)anchor[1]);
    }
  }
  displayedFrame = get();
}
void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') {
    if (displayedFrame != null)
      displayedFrame.save(sketchPath("glyph-marks-" + nf(frameCount, 4) + ".png"));
    return;
  }
  if (k == 'n') SHORT = !SHORT;
  else if (k == 'd') SPARSE = !SPARSE;
  else if (k == 'g') LETTERS = !LETTERS;
  else if (k == 'm') DOTS = !DOTS;
  else if (k == 'c') COLOURED = !COLOURED;
  else {
    if (k == 'v') FASTER = !FASTER;
    else if (k == 'f') FINER = !FINER;
    else if (k == 'r') SEED = (SEED + 1) & 0xffffffffL;
    else if (k == '0') {
      SEED = 42; SHORT = false; SPARSE = false; LETTERS = false; DOTS = false;
      COLOURED = false; FASTER = false; FINER = false;
    } else return;
    rebuild();
  }
  redraw();
}
