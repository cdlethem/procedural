import java.util.Arrays;
import org.procedurals.processing.Java2DLayers;
import org.procedurals.processing.ProcessingImageFilters;

// M: sharp / soft / horizontal / vertical. B: blend with sharp. S: save.
// These kernel radii are composition choices, not recommended parameter ranges.
PImage[] layers;
PImage ground, displayed;
double[] softKernel, directionalKernel, deltaKernel, transition, coverage;
int mode = 0;
int filterCalls = 0;
boolean blended = false;
boolean dirty = true;

void settings() { size(720, 480, JAVA2D); pixelDensity(1); }
void setup() {
  ground = Java2DLayers.render(this, width, height, g -> {
    g.background(22, 34, 48);
    g.noStroke(); g.fill(32, 49, 63);
    for (int x = 0; x < width; x += 80) g.rect(x, 0, 40, height);
  });
  layers = new PImage[4];
  layers[0] = Java2DLayers.render(this, width, height, g -> {
    g.noStroke(); g.fill(240, 100, 65, 155);
    g.ellipse(390, 255, 240, 240);
    g.noFill(); g.stroke(255, 220, 120); g.strokeWeight(3);
    for (int i = 0; i < 7; i++) {
      float x = 140 + i*60;
      g.line(x, 110, x+70, 365);
    }
    g.stroke(125, 220, 240); g.strokeWeight(5);
    g.ellipse(300, 215, 170, 170);
  });
  softKernel = triangular(12);
  directionalKernel = triangular(24);
  deltaKernel = new double[] { 1 };
  layers[1] = filtered(softKernel, softKernel);
  layers[2] = filtered(directionalKernel, deltaKernel);
  layers[3] = filtered(deltaKernel, directionalKernel);
  transition = new double[width*height];
  coverage = new double[width*height];
  Arrays.fill(coverage, 1.0);
  for (int y = 0; y < height; y++) {
    for (int x = 0; x < width; x++) transition[y*width+x] = x/(double)(width-1);
  }
  rebuild();
}
// Authored finite weight profile; normalization is the package's responsibility.
double[] triangular(int radius) {
  double[] weights = new double[2*radius+1];
  for (int i = 0; i < weights.length; i++) weights[i] = radius+1-Math.abs(i-radius);
  return weights;
}
PImage filtered(double[] horizontal, double[] vertical) {
  long budget = (long)width*height*(horizontal.length+vertical.length);
  filterCalls++;
  return ProcessingImageFilters.separableBlur(this, layers[0], horizontal, vertical, budget);
}
void rebuild() {
  PImage selected = layers[mode];
  if (blended) selected = Java2DLayers.crossfade(this, layers[0], selected, transition);
  displayed = Java2DLayers.composite(this, selected, ground, coverage);
  dirty = true;
}
void draw() { if (dirty) { image(displayed, 0, 0); dirty = false; } }
void keyPressed() {
  if (key == 'm' || key == 'M') { mode = (mode+1)%layers.length; rebuild(); }
  if (key == 'b' || key == 'B') { blended = !blended; rebuild(); }
  if (key == 's' || key == 'S') displayed.save(sketchPath("blur-marks.png"));
}
