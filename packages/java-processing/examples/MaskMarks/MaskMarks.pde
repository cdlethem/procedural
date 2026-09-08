import java.util.Map;
import org.procedurals.processing.Java2DLayers;

// Candidate example. M changes content; V shows the retained mask; S saves the cache.
PImage ground, source, marks, maskImage, displayed;
double[] coverage;
int mode = 0;
boolean showMask = false, dirty = true;

void settings() { size(720, 480, JAVA2D); pixelDensity(1); }

void configureRender(long seed, Map<String, Double> parameters) {
  if (parameters == null || parameters.size() != 1 || !parameters.containsKey("mode"))
    throw new IllegalArgumentException("exact mode required");
  Double value = parameters.get("mode");
  if (value == null || !Double.isFinite(value) || value != Math.floor(value) || value < 0 || value > 2)
    throw new IllegalArgumentException("mode 0..2 required");
  mode = value.intValue();
}

void setup() {
  ground = Java2DLayers.render(this, width, height, g -> g.background(239, 232, 213));
  source = Java2DLayers.render(this, width, height, g -> {
    g.background(21, 62, 75); g.noStroke();
    for (int radius = 250; radius > 12; radius -= 18) {
      g.fill(245, 120 + radius/3, 65); g.ellipse(245, 235, radius*2, radius*2);
    }
    g.fill(47, 190, 174); g.triangle(420, 395, 580, 65, 695, 400);
  });
  marks = Java2DLayers.render(this, width, height, g -> {
    g.background(32, 38, 63); g.stroke(235, 116, 116); g.strokeWeight(5);
    for (int x = -400; x < 900; x += 22) g.line(x, 0, x+350, height);
  });
  maskImage = Java2DLayers.render(this, width, height, g -> {
    g.noStroke(); g.fill(255); g.ellipse(245, 240, 360, 320);
    // Half alpha creates partial visibility; RGB does not determine alpha-mask values.
    g.fill(0, 128); g.triangle(410, 395, 575, 70, 675, 395);
  });
  coverage = Java2DLayers.alphaMask(maskImage);
  rebuild();
}

void rebuild() {
  if (showMask) displayed = maskImage;
  else if (mode == 0) displayed = Java2DLayers.composite(this, marks, ground, coverage);
  else if (mode == 1) displayed = Java2DLayers.composite(this, source, ground, coverage);
  else displayed = Java2DLayers.crossfade(this, marks, source, coverage);
  dirty = true;
}

void draw() {
  if (dirty) { background(110); image(displayed, 0, 0); dirty = false; }
}

void keyPressed() {
  if (key == 'm' || key == 'M') { mode = (mode+1)%3; rebuild(); }
  if (key == 'v' || key == 'V') { showMask = !showMask; rebuild(); }
  if (key == 's' || key == 'S') displayed.save(sketchPath("mask-marks.png"));
}
