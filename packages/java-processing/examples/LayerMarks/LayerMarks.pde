import java.util.List;
import java.util.Map;
import org.procedurals.layout.RetainedRectangles2D;
import org.procedurals.processing.Java2DRegions;
import org.procedurals.raster.RasterCrossfade2D;

// Candidate workflow, not yet packaged/accepted. M switches composition; S saves.
// Replace makeSource() with a loaded image to use your own content.
PImage sourceImage, ground, displayed;
List<Java2DRegions.Region> regions;
int mode = 0;
boolean dirty = true;

void settings() { size(720, 480, JAVA2D); pixelDensity(1); }

void configureRender(long seed, Map<String, Double> parameters) {
  if (parameters == null || parameters.size() != 1 || !parameters.containsKey("mode"))
    throw new IllegalArgumentException("exact mode required");
  double value = parameters.get("mode");
  if (!Double.isFinite(value) || value != Math.floor(value) || value < 0 || value > 3)
    throw new IllegalArgumentException("mode 0..3 required");
  mode = (int)value;
}

void setup() {
  sourceImage = makeSource();
  background(244, 238, 222);
  ground = get();
  RetainedRectangles2D layout = RetainedRectangles2D.create(36, 36, 684, 444);
  layout.cut(0, "X", 360);
  layout.cut(1, "Y", 240);
  layout.cut(2, "Y", 240);
  regions = Java2DRegions.regions(layout.leaves());
  rebuild();
}

void rebuild() {
  Java2DRegions.Content picture = (target, region) -> {
    target.image(sourceImage, 0, 0);
    target.noFill(); target.stroke(255, 245, 200); target.strokeWeight(3);
    for (int radius = 30; radius < 420; radius += 35)
      target.ellipse(360, 240, radius*2, radius*2);
  };
  Java2DRegions.Content local = (target, region) -> {
    // Explicit snip from the larger source; replace this content independently of layout.
    PImage snip = sourceImage.get((int)region.left, (int)region.top,
      (int)(region.right-region.left), (int)(region.bottom-region.top));
    target.image(snip, 0, 0);
    target.stroke(18, 35, 53); target.strokeWeight(2);
    for (int x = 12; x < region.right-region.left; x += 16)
      target.line(x, 12, 150, 180);
  };
  if (mode == 0) displayed = Java2DRegions.render(this, ground, regions,
    Java2DRegions.Space.CANVAS, 0, picture);
  else if (mode < 3) displayed = Java2DRegions.render(this, ground, regions,
    Java2DRegions.Space.LOCAL, mode == 2 ? 24 : 0, local);
  else {
    PImage first = Java2DRegions.render(this, ground, regions, Java2DRegions.Space.CANVAS, 0, picture);
    PImage second = Java2DRegions.render(this, ground, regions, Java2DRegions.Space.LOCAL, 0, local);
    first.loadPixels(); second.loadPixels();
    double[] weights = new double[width*height];
    for (int y=0, i=0; y<height; y++) for (int x=0; x<width; x++, i++)
      weights[i] = constrain((x-180.0f)/360.0f, 0, 1);
    int[] mixed = RasterCrossfade2D.mix(width, height, first.pixels, second.pixels, weights).pixels();
    displayed = createImage(width, height, ARGB);
    displayed.loadPixels(); arrayCopy(mixed, displayed.pixels); displayed.updatePixels();
  }
  dirty = true;
}

PImage makeSource() {
  PGraphics p = createGraphics(width, height, JAVA2D);
  p.beginDraw(); p.background(22, 56, 67); p.noStroke();
  for (int r=220; r>10; r-=18) {
    p.fill(238, 140+r/3, 70); p.ellipse(195, 245, r*2, r*2);
  }
  p.fill(225, 85, 90); p.rect(425, 95, 190, 160, 20);
  p.fill(50, 185, 165); p.triangle(410, 400, 600, 185, 650, 415);
  p.endDraw(); PImage result = p.get(); p.dispose(); return result;
}

void draw() { if (dirty) { image(displayed, 0, 0); dirty = false; } }

void keyPressed() {
  if (key == 'm' || key == 'M') { mode = (mode+1)%4; rebuild(); }
  if (key == 's' || key == 'S') displayed.save(sketchPath("layer-marks.png"));
}
