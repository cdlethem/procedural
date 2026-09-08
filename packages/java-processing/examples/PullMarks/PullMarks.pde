import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import org.procedurals.color.CyclicPalette;
import org.procedurals.geometry.RadialPull2D;
import org.procedurals.paths.ClosedSpline2D;

// R: radius; P: power; C: recolour; M: retained contour transfer; 0: reset; S: save.
// These are artwork settings, not defaults or recommended parameter ranges.
// Independently composed from 2018/Generativos/curvespace radial pulls.
// Center discontinuities can fold/self-intersect sampled lines; no smooth/inverse guarantee.
final int SIDE = 512;
final int[] COLORS = {0x173F5F, 0xAF5441, 0xE9C46A, 0x347969};
double radius = 120.0d;
double power = 2.0d;
boolean alternate = false;
boolean contoursMode = false;
RadialPull2D field;
double[][][] gridInputs;
double[][][] contourInputs;
double[][][] gridOutput;
double[][][] contourOutput;
ClosedSpline2D[] loops;
PImage displayedFrame;
CyclicPalette palette;

void settings() {
  size(SIDE, SIDE, JAVA2D);
  pixelDensity(1);
}

void setup() {
  palette = palette(COLORS);
  buildContours();
  buildGridInputs();
  rebuildFieldAndOutputs();
  noLoop();
}

CyclicPalette palette(int[] colors) {
  List<Integer> values = new ArrayList<Integer>();
  for (int colorValue : colors) values.add(colorValue);
  Map<String, Object> descriptor = new LinkedHashMap<String, Object>();
  descriptor.put("colors", values);
  return CyclicPalette.create(descriptor);
}

void buildContours() {
  double[][] base = {
    {80.0d, 120.0d}, {220.0d, 70.0d}, {390.0d, 120.0d},
    {430.0d, 300.0d}, {320.0d, 430.0d}, {120.0d, 390.0d}
  };
  loops = new ClosedSpline2D[3];
  contourInputs = new double[loops.length][][];
  for (int loopIndex = 0; loopIndex < loops.length; loopIndex++) {
    double scale = 0.62d + 0.19d * loopIndex;
    double[][] controls = new double[base.length][2];
    for (int i = 0; i < base.length; i++) {
      controls[i][0] = 256.0d + (base[i][0] - 256.0d) * scale;
      controls[i][1] = 256.0d + (base[i][1] - 256.0d) * scale;
    }
    loops[loopIndex] = ClosedSpline2D.create(controls, 32);
    contourInputs[loopIndex] = new double[256][2];
    double[] sample = new double[4];
    for (int i = 0; i < 256; i++) {
      loops[loopIndex].sampleParameter(i * loops[loopIndex].controlCount() / 256.0d, sample);
      contourInputs[loopIndex][i][0] = sample[0];
      contourInputs[loopIndex][i][1] = sample[1];
    }
  }
}

void buildGridInputs() {
  gridInputs = new double[2 * ((SIDE - 1) / 16)][][];
  int path = 0;
  for (int y = 16; y < SIDE; y += 16) {
    gridInputs[path] = new double[SIDE / 2 - 8][2];
    for (int i = 0; i < gridInputs[path].length; i++) {
      gridInputs[path][i][0] = 16 + i * 2;
      gridInputs[path][i][1] = y;
    }
    path++;
  }
  for (int x = 16; x < SIDE; x += 16) {
    gridInputs[path] = new double[SIDE / 2 - 8][2];
    for (int i = 0; i < gridInputs[path].length; i++) {
      gridInputs[path][i][0] = x;
      gridInputs[path][i][1] = 16 + i * 2;
    }
    path++;
  }
}

void rebuildFieldAndOutputs() {
  field = RadialPull2D.create(new double[][] {
    {200.0d, 240.0d, radius, power},
    {350.0d, 320.0d, radius, power}
  });
  gridOutput = transform(gridInputs);
  contourOutput = transform(contourInputs);
}

double[][][] transform(double[][][] input) {
  double[][][] output = new double[input.length][][];
  double[] target = new double[2];
  for (int path = 0; path < input.length; path++) {
    output[path] = new double[input[path].length][2];
    for (int i = 0; i < input[path].length; i++) {
      field.transform(input[path][i][0], input[path][i][1], target);
      output[path][i][0] = target[0];
      output[path][i][1] = target[1];
    }
  }
  return output;
}

void draw() {
  background(245, 240, 230);
  noFill();
  strokeWeight(1.0f);
  if (contoursMode) drawContours();
  else drawGrid();
  displayedFrame = get();
}

void drawGrid() {
  for (int path = 0; path < gridOutput.length; path++) {
    int rgb = palette.sample((path + (alternate ? 2 : 0)) * 0.17d);
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 190);
    beginShape();
    for (double[] point : gridOutput[path]) vertex((float) point[0], (float) point[1]);
    endShape();
  }
}

void drawContours() {
  for (int path = 0; path < contourOutput.length; path++) {
    int rgb = palette.sample((path + (alternate ? 2 : 0)) * 0.31d);
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 210);
    noFill();
    beginShape();
    for (double[] point : contourOutput[path]) vertex((float) point[0], (float) point[1]);
    endShape(CLOSE);
  }
}

void keyPressed() {
  char keyValue = Character.toLowerCase(key);
  if (keyValue == 's') {
    if (displayedFrame != null) displayedFrame.save(sketchPath("pull-marks.png"));
    return;
  }
  if (keyValue == 'r') {
    radius = radius == 120.0d ? 180.0d : 120.0d;
    rebuildFieldAndOutputs();
  } else if (keyValue == 'p') {
    power = power == 2.0d ? 0.5d : 2.0d;
    rebuildFieldAndOutputs();
  } else if (keyValue == 'c') {
    alternate = !alternate;
  } else if (keyValue == 'm') {
    contoursMode = !contoursMode;
  } else if (keyValue == '0') {
    radius = 120.0d;
    power = 2.0d;
    alternate = false;
    contoursMode = false;
    rebuildFieldAndOutputs();
  } else {
    return;
  }
  redraw();
}
