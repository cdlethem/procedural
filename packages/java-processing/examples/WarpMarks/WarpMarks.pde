import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.color.CyclicPalette;
import org.procedurals.fields.GradientNoise2D01;
import org.procedurals.raster.RasterRemap2D;

// F: field; P: dot pattern / stripes; W: displacement 0/32/64; 0: reset; S: save.
// These are authored example settings, not library defaults or measured ranges.
final int SIDE = 640;
final int[] COLORS = {0xE76F51, 0xF4A261, 0xE9C46A, 0x2A9D8F, 0x264653};
int strength = 32;
boolean alternateField = false, stripes = false;
PGraphics sourceCanvas;
PImage displayedFrame;
int[] sourcePixels;
double[] packedCoordinates;
CyclicPalette palette;
GradientNoise2D01 noiseField;

void settings() { size(SIDE, SIDE, JAVA2D); pixelDensity(1); }

void setup() {
  palette = palette(COLORS);
  Map<String, Object> field = new LinkedHashMap<String, Object>();
  field.put("seed", 42);
  noiseField = GradientNoise2D01.create(field);
  captureSource();
  remapSource();
  noLoop();
}

CyclicPalette palette(int[] colors) {
  List<Integer> values = new ArrayList<Integer>();
  for (int colorValue : colors) values.add(colorValue);
  Map<String, Object> config = new LinkedHashMap<String, Object>();
  config.put("colors", values);
  return CyclicPalette.create(config);
}

void captureSource() {
  if (sourceCanvas == null) sourceCanvas = createGraphics(SIDE, SIDE, JAVA2D);
  sourceCanvas.beginDraw();
  sourceCanvas.background(248, 245, 238);
  sourceCanvas.noStroke();
  if (stripes) {
    for (int row = 0; row < SIDE; row += 32) {
      int rgb = COLORS[(row / 32) % COLORS.length];
      sourceCanvas.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
      sourceCanvas.rect(0, row, SIDE, 16);
    }
  } else {
    for (int y = 12; y < SIDE; y += 24) {
      for (int x = 12; x < SIDE; x += 24) {
        int rgb = (int)palette.sample((x + 3.0 * y) / SIDE);
        sourceCanvas.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
        sourceCanvas.ellipse(x, y, 12, 12);
      }
    }
  }
  sourceCanvas.endDraw();
  PImage captured = sourceCanvas.get();
  captured.loadPixels();
  sourcePixels = captured.pixels.clone();
}

void remapSource() {
  packedCoordinates = new double[SIDE * SIDE * 2];
  for (int y = 0; y < SIDE; y++) {
    for (int x = 0; x < SIDE; x++) {
      int index = (y * SIDE + x) * 2;
      double dx, dy;
      if (strength == 0) {
        dx = x; dy = y;
      } else if (alternateField) {
        dx = x + strength * Math.sin(y * (2.0 * Math.PI) / 160.0);
        dy = y + strength * Math.sin(x * (2.0 * Math.PI) / 160.0);
      } else {
        double angle = noiseField.sample(x * 0.01, y * 0.01) * (2.0 * Math.PI);
        dx = x + strength * Math.cos(angle);
        dy = y + strength * Math.sin(angle);
      }
      packedCoordinates[index] = dx;
      packedCoordinates[index + 1] = dy;
    }
  }
  RasterRemap2D result = RasterRemap2D.remap(SIDE, SIDE, sourcePixels,
    SIDE, SIDE, packedCoordinates);
  displayedFrame = createImage(SIDE, SIDE, ARGB);
  displayedFrame.loadPixels();
  int[] remapped = result.pixels();
  arrayCopy(remapped, displayedFrame.pixels);
  displayedFrame.updatePixels();
}

void draw() {
  background(248, 245, 238);
  image(displayedFrame, 0, 0);
}

void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') { if (displayedFrame != null) displayedFrame.save("warp-marks.png"); return; }
  if (k == 'w') { strength = strength == 0 ? 32 : strength == 32 ? 64 : 0; remapSource(); }
  else if (k == 'f') { alternateField = !alternateField; remapSource(); }
  else if (k == 'p') { stripes = !stripes; captureSource(); remapSource(); }
  else if (k == '0') {
    strength = 32; alternateField = false; stripes = false;
    captureSource(); remapSource();
  } else return;
  redraw();
}
