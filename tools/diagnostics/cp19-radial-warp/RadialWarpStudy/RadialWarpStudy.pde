import java.util.Map;
import org.procedurals.paths.ClosedSpline2D;

// Private CP19 study. mode 0 is a grid; mode 1 transfers the warp to retained loops.
int mode = 0;
double radius = 120.0;
double power = 2.0;
long configuredSeed = 42L;
ClosedSpline2D[] loops;

// Exact experiment controls: mode (0/1), radius, and power.
void configureRender(long seed, Map<String, Double> params) {
  if (params == null || params.size() != 3
      || !params.containsKey("mode")
      || !params.containsKey("radius")
      || !params.containsKey("power")) {
    throw new IllegalArgumentException("exact mode,radius,power required");
  }
  configuredSeed = seed;
  mode = integer(params.get("mode"), 0, 1);
  radius = finite(params.get("radius"));
  power = finite(params.get("power"));
  if (radius < 0.0 || power < 0.0) {
    throw new IllegalArgumentException("radius and power must be nonnegative");
  }
}

double finite(Double value) {
  if (value == null || !Double.isFinite(value)) {
    throw new IllegalArgumentException("finite parameter required");
  }
  return value;
}

int integer(Double value, int minimum, int maximum) {
  double number = finite(value);
  if (number < minimum || number > maximum || number != Math.floor(number)) {
    throw new IllegalArgumentException("integer mode required");
  }
  return (int) number;
}

void settings() {
  size(512, 512, JAVA2D);
  pixelDensity(1);
}

void setup() {
  RadialPullStudyMath.assertions();
  buildLoops();
  noLoop();
}

void buildLoops() {
  double[][] base = {
    {80.0, 120.0}, {220.0, 70.0}, {390.0, 120.0},
    {430.0, 300.0}, {320.0, 430.0}, {120.0, 390.0}
  };
  loops = new ClosedSpline2D[3];
  for (int loopIndex = 0; loopIndex < loops.length; loopIndex++) {
    double scale = 0.62 + 0.19 * loopIndex;
    double[][] controls = new double[base.length][2];
    for (int i = 0; i < base.length; i++) {
      controls[i][0] = 256.0 + (base[i][0] - 256.0) * scale;
      controls[i][1] = 256.0 + (base[i][1] - 256.0) * scale;
    }
    loops[loopIndex] = ClosedSpline2D.create(controls, 32);
  }
}

void draw() {
  background(245, 240, 230);
  stroke(35, 55, 75, 210);
  noFill();
  if (mode == 0) {
    drawGrid();
  } else {
    drawLoops();
  }
}

void drawGrid() {
  for (int y = 16; y < 512; y += 16) {
    beginShape();
    for (int x = 16; x < 512; x += 2) {
      double[] warped = RadialPullStudyMath.warp(x, y, radius, power);
      vertex((float) warped[0], (float) warped[1]);
    }
    endShape();
  }
  for (int x = 16; x < 512; x += 16) {
    beginShape();
    for (int y = 16; y < 512; y += 2) {
      double[] warped = RadialPullStudyMath.warp(x, y, radius, power);
      vertex((float) warped[0], (float) warped[1]);
    }
    endShape();
  }
}

void drawLoops() {
  double[] sample = new double[4];
  for (ClosedSpline2D loop : loops) {
    beginShape();
    for (int i = 0; i < 256; i++) {
      double parameter = i * loop.controlCount() / 256.0;
      loop.sampleParameter(parameter, sample);
      double[] warped = RadialPullStudyMath.warp(sample[0], sample[1], radius, power);
      vertex((float) warped[0], (float) warped[1]);
    }
    endShape(CLOSE);
  }
}
