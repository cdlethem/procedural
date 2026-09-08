import org.procedurals.processing.Java2DLayers;
import org.procedurals.processing.Java2DImagePlacement;

// Candidate: F changes fit; C crops; A aligns; M masks; S saves the cached result.
PImage source, ground, placed, displayed;
double[] mask, fullCoverage;
int fitIndex = 0, alignment = 1;
boolean cropped = false, masked = false, dirty = true;

void settings() { size(720, 480, JAVA2D); pixelDensity(1); }
void setup() {
  source = Java2DLayers.render(this, 320, 160, g -> {
    g.noStroke();
    g.fill(235, 114, 80); g.rect(0, 0, 160, 160);
    g.fill(42, 157, 143); g.rect(160, 0, 160, 160);
    g.fill(250, 224, 155); g.ellipse(80, 80, 120, 120);
    g.fill(27, 55, 74); g.triangle(180, 140, 240, 20, 300, 140);
    g.fill(255, 160); g.rect(0, 70, 320, 20);
  });
  ground = Java2DLayers.render(this, width, height, g -> {
    g.background(241, 235, 219);
    g.stroke(209, 202, 186);
    for (int x = 0; x < width; x += 20) g.line(x, 0, x, height);
    for (int y = 0; y < height; y += 20) g.line(0, y, width, y);
  });
  PImage shape = Java2DLayers.render(this, width, height, g -> {
    g.noStroke(); g.fill(255); g.ellipse(360, 240, 440, 320);
  });
  mask = Java2DLayers.alphaMask(shape);
  fullCoverage = new double[width * height];
  java.util.Arrays.fill(fullCoverage, 1.0);
  rebuildPlacement();
}
void rebuildPlacement() {
  Java2DImagePlacement.Crop selection = cropped
    ? new Java2DImagePlacement.Crop(80, 0, 160, 160)
    : new Java2DImagePlacement.Crop(0, 0, 320, 160);
  placed = Java2DImagePlacement.render(this, source, selection, width, height,
    new Java2DImagePlacement.Frame(80, 60, 560, 360),
    Java2DImagePlacement.Fit.values()[fitIndex], alignment * 0.5, alignment * 0.5);
  rebuildDisplay();
}
void rebuildDisplay() {
  displayed = Java2DLayers.composite(this, placed, ground, masked ? mask : fullCoverage);
  dirty = true;
}
void draw() {
  if (dirty) { image(displayed, 0, 0); dirty = false; }
}
void keyPressed() {
  if (key == 'f' || key == 'F') { fitIndex = (fitIndex + 1) % 3; rebuildPlacement(); }
  if (key == 'c' || key == 'C') { cropped = !cropped; rebuildPlacement(); }
  if (key == 'a' || key == 'A') { alignment = (alignment + 1) % 3; rebuildPlacement(); }
  if (key == 'm' || key == 'M') { masked = !masked; rebuildDisplay(); }
  if (key == 's' || key == 'S') displayed.save(sketchPath("placement-image-marks.png"));
}
