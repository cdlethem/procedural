import java.util.Map;
import java.util.Random;
import org.procedurals.paths.ClosedSpline2D;

// Authored template for a smooth closed outline and repeated marks.
// The retained spline boundary is motivated by databol and the ClosedSpline2D contract;
// this is not a source recreation, library default, or counted starter.

long renderSeed = 42L;
double renderRadius = 110.0;
double renderSpacing = 18.0;
ClosedSpline2D loop;
PImage displayedFrame;
// The seed belongs to this template's java.util.Random control generation; it does not
// call Processing randomSeed() or claim compatibility with a source sketch stream.

// Call this before settings() or setup() when a host supplies a render configuration.
public void configureRender(long seed, Map<String, Double> params) {
  if (params == null || params.size() != 2
      || !params.containsKey("radius") || !params.containsKey("spacing")) {
    throw new IllegalArgumentException("params must contain exactly radius and spacing");
  }
  Double suppliedRadius = params.get("radius");
  Double suppliedSpacing = params.get("spacing");
  if (suppliedRadius == null || !Double.isFinite(suppliedRadius)
      || suppliedRadius < 20.0 || suppliedRadius > 180.0) {
    throw new IllegalArgumentException("radius must be finite and in [20,180]");
  }
  if (suppliedSpacing == null || !Double.isFinite(suppliedSpacing)
      || suppliedSpacing < 4.0 || suppliedSpacing > 80.0) {
    throw new IllegalArgumentException("spacing must be finite and in [4,80]");
  }
  renderSeed = seed;
  renderRadius = suppliedRadius;
  renderSpacing = suppliedSpacing;
}

void settings() {
  size(512, 512, JAVA2D);
  pixelDensity(1);
}

void setup() {
  buildLoop();
  noLoop();
}

void buildLoop() {
  Random random = new Random(renderSeed);
  double[][] controls = new double[6][2];
  for (int i = 0; i < controls.length; i++) {
    double angle = i * Math.PI / 3.0;
    double factor = 0.8 + 0.4 * random.nextDouble();
    controls[i][0] = 256.0 + Math.cos(angle) * renderRadius * factor;
    controls[i][1] = 256.0 + Math.sin(angle) * renderRadius * factor;
  }
  loop = ClosedSpline2D.create(controls, 32);
}

void draw() {
  background(245, 240, 230);
  double[] sample = new double[4];
  noFill();
  stroke(38, 48, 58, 210);
  strokeWeight(1.2);
  beginShape();
  for (int i = 0; i < 192; i++) {
    loop.sampleParameter(i * loop.controlCount() / 192.0, sample);
    vertex((float) sample[0], (float) sample[1]);
  }
  endShape(CLOSE);

  rectMode(CENTER);
  noStroke();
  fill(49, 104, 116, 220);
  for (double distance = 0.0; distance < loop.length(); distance += renderSpacing) {
    loop.sampleDistance(distance, sample);
    if (sample[2] == 0.0 && sample[3] == 0.0) continue;
    pushMatrix();
    translate((float) sample[0], (float) sample[1]);
    rotate((float) Math.atan2(sample[3], sample[2]));
    rect(0, 0, 10, 24, 3);
    popMatrix();
  }
  displayedFrame = get();
}
