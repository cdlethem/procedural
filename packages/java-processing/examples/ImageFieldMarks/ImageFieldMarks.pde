import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.layout.RegularGrid;
import org.procedurals.processing.Java2DLayers;
import org.procedurals.processing.ProcessingImageField;

// Candidate: M switches size/visibility; I changes image; C uses image colors; S saves.
RegularGrid grid;
double[] positions;
PImage[] sources;
ProcessingImageField.Samples[] samples;
PImage displayed;
int sourceIndex = 0;
boolean visibility = false, sourceColors = false, dirty = true;

void settings() { size(720, 480, JAVA2D); pixelDensity(1); }
void setup() {
  Map<String, Object> layout = new LinkedHashMap<String, Object>();
  layout.put("origin", Arrays.asList(8.0, 8.0));
  layout.put("spacing", Arrays.asList(16.0, 16.0));
  layout.put("columns", 45); layout.put("rows", 30);
  grid = RegularGrid.create(layout);
  positions = new double[(int)grid.size()*2];
  for (int i = 0; i < grid.size(); i++) grid.pointInto(i, positions, i*2);
  sources = new PImage[2];
  sources[0] = Java2DLayers.render(this, width, height, g -> {
    g.background(235); g.noStroke();
    g.fill(40, 65, 85); g.ellipse(250, 240, 360, 360);
    g.fill(190, 125, 75); g.triangle(420, 400, 580, 70, 690, 400);
    g.fill(125); g.rect(0, 220, width, 40);
  });
  sources[1] = Java2DLayers.render(this, width, height, g -> {
    g.background(235); g.noStroke();
    for (int i = 0; i < 8; i++) {
      g.fill(25+i*28, 35+i*22, 55+i*18);
      g.rect(i*90, 0, 90, height);
    }
    g.fill(245); g.ellipse(360, 240, 320, 320);
  });
  samples = new ProcessingImageField.Samples[2];
  for (int i = 0; i < 2; i++) samples[i] = ProcessingImageField.snapshot(sources[i]).sample(positions);
  rebuild();
}
void rebuild() {
  ProcessingImageField.Samples values = samples[sourceIndex];
  displayed = Java2DLayers.render(this, width, height, g -> {
    g.background(246, 240, 225); g.noStroke();
    for (int i = 0; i < values.size(); i++) {
      double brightness = values.maxRgb01(i);
      if (visibility && brightness >= 0.65) continue;
      float diameter = visibility ? 10 : (float)(2 + 12*(1-brightness));
      if (sourceColors) g.fill(values.argb(i));
      else g.fill(30, 45, 55);
      g.ellipse((float)positions[i*2], (float)positions[i*2+1], diameter, diameter);
    }
  });
  dirty = true;
}
void draw() { if (dirty) { image(displayed, 0, 0); dirty = false; } }
void keyPressed() {
  if (key == 'm' || key == 'M') { visibility = !visibility; rebuild(); }
  if (key == 'i' || key == 'I') { sourceIndex = 1-sourceIndex; rebuild(); }
  if (key == 'c' || key == 'C') { sourceColors = !sourceColors; rebuild(); }
  if (key == 's' || key == 'S') displayed.save(sketchPath("image-field-marks.png"));
}
