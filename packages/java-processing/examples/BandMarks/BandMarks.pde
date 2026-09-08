import java.util.HashMap;
import java.util.Map;
import org.procedurals.paths.NoiseBandPath2D;

// T changes tolerance, C changes colors, M changes marks, 0 resets and S saves.
// Independent composition motivated by 2018/Generativos/venas, not source replay.
NoiseBandPath2D[] paths;
boolean wider = false, alternate = false, marks = false;
PImage displayedFrame;
int[] colors = {0x224B63, 0x3A7D7C, 0x6B8E23, 0xC17C3D, 0x8B3D5C, 0x4F5D95};
int[] otherColors = {0xE76F51, 0x264653, 0xB84A62, 0x457B9D, 0x8A5A44, 0x606C38};

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() { rebuildPaths(); noLoop(); }

void rebuildPaths() {
  paths = new NoiseBandPath2D[64];
  for (int i = 0; i < paths.length; i++) {
    Map<String, Object> field = new HashMap<String, Object>();
    field.put("seed", 0x6a09e667L);
    Map<String, Object> p = new HashMap<String, Object>();
    p.put("field", field);
    p.put("start", java.util.Arrays.asList(40.0 + 80.0 * (i % 8), 40.0 + 80.0 * (i / 8)));
    p.put("heading", 0.0);
    p.put("seed", 1000 + i);
    p.put("attempts", 2048);
    p.put("stepDistance", 1.0);
    p.put("fieldScale", 0.006);
    p.put("fieldOffset", java.util.Arrays.asList(7.3, 11.7));
    p.put("tolerance", wider ? 0.008 : 0.002);
    p.put("maxVertices", 2049);
    paths[i] = NoiseBandPath2D.trace(p);
  }
}

void draw() {
  background(245, 240, 230);
  strokeWeight(0.8);
  double[] point = new double[2];
  int[] palette = alternate ? otherColors : colors;
  for (int i = 0; i < paths.length; i++) {
    NoiseBandPath2D path = paths[i];
    stroke(0xFF000000 | palette[i % palette.length], 150);
    if (marks) {
      for (int j = 1; j < path.size(); j += 8) {
        path.pointInto(j, point, 0);
        double h = path.headingAt(j - 1);
        double dx = -Math.sin(h) * 2.0, dy = Math.cos(h) * 2.0;
        line((float)(point[0] - dx), (float)(point[1] - dy),
             (float)(point[0] + dx), (float)(point[1] + dy));
      }
    } else {
      path.pointInto(0, point, 0);
      double x = point[0], y = point[1];
      for (int j = 1; j < path.size(); j++) {
        path.pointInto(j, point, 0);
        line((float)x, (float)y, (float)point[0], (float)point[1]);
        x = point[0]; y = point[1];
      }
    }
  }
  displayedFrame = get();
}

void keyPressed() {
  if (key == 's' || key == 'S') { displayedFrame.save("band-marks.png"); return; }
  if (key == 't' || key == 'T') { wider = !wider; rebuildPaths(); }
  else if (key == 'c' || key == 'C') alternate = !alternate;
  else if (key == 'm' || key == 'M') marks = !marks;
  else if (key == '0') { wider = false; alternate = false; marks = false; rebuildPaths(); }
  else return;
  redraw();
}
