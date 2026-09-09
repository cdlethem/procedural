import org.procedurals.geometry.SegmentClip2D;
import org.procedurals.processing.Java2DLayers;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;

// Candidate workflow: H spacing, N notch, T source, C color, M endpoints,
// O input overlay, 0 reset, S cached save. Settings are authored artwork.
List<List<Double>> denseStrokes;
List<List<Double>> sparseStrokes;
List<List<Double>> suppliedStrokes;
List<List<Double>> sources;
List<List<Double>> polygon;
SegmentClip2D clipped;
PImage displayed;
boolean sparse = false, shallow = false, alternateSource = false;
boolean alternateColor = false, endpoints = true, overlay = false;
int clipCalls = 0;
final double[] segmentBuffer = new double[4];

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() {
  denseStrokes = hatch(12);
  sparseStrokes = hatch(28);
  suppliedStrokes = new ArrayList<List<Double>>();
  double[][] points = {{40,150},{600,220},{40,290},{600,360},{40,430},{600,500}};
  for (int i=1; i<points.length; i++) suppliedStrokes.add(Arrays.asList(
    points[i-1][0], points[i-1][1], points[i][0], points[i][1]));
  rebuildGeometry();
  noLoop();
}
List<List<Double>> hatch(int spacing) {
  List<List<Double>> result = new ArrayList<List<Double>>();
  for (int y=-180; y<700; y+=spacing)
    result.add(Arrays.asList(40d, (double)y, 600d, (double)y+220d));
  return result;
}
void rebuildGeometry() {
  sources = alternateSource ? suppliedStrokes : (sparse ? sparseStrokes : denseStrokes);
  double floor = shallow ? 430d : 270d;
  polygon = Arrays.asList(Arrays.asList(100d,100d), Arrays.asList(540d,100d),
    Arrays.asList(540d,540d), Arrays.asList(380d,540d), Arrays.asList(380d,floor),
    Arrays.asList(260d,floor), Arrays.asList(260d,540d), Arrays.asList(100d,540d));
  Map<String,Object> input = new LinkedHashMap<String,Object>();
  input.put("polygon", polygon);
  input.put("segments", sources);
  input.put("maxWork", 100000L);
  input.put("maxOutputSegments", 512);
  clipped = SegmentClip2D.clip(input);
  clipCalls++;
  rebuildDisplay();
}
void rebuildDisplay() {
  displayed = Java2DLayers.render(this, width, height, target -> {
    target.background(246,241,231);
    target.noFill();
    if (overlay) {
      target.stroke(222,216,205); target.strokeWeight(1);
      for (List<Double> s : sources)
        target.line(s.get(0).floatValue(), s.get(1).floatValue(), s.get(2).floatValue(), s.get(3).floatValue());
    }
    target.strokeWeight(2);
    for (int i=0; i<clipped.size(); i++) {
      clipped.segmentInto(i, segmentBuffer, 0);
      // Split pieces keep source identity, so both pieces receive the same color.
      int source = clipped.sourceIndexAt(i);
      if (alternateColor) target.stroke(source%2==0 ? color(137,62,100) : color(190,104,64));
      else target.stroke(31,90,101);
      target.line((float)segmentBuffer[0], (float)segmentBuffer[1], (float)segmentBuffer[2], (float)segmentBuffer[3]);
    }
    target.stroke(72,68,64); target.strokeWeight(1.5f); target.noFill(); target.beginShape();
    for (List<Double> p : polygon) target.vertex(p.get(0).floatValue(), p.get(1).floatValue());
    target.endShape(CLOSE);
    if (endpoints) {
      target.noStroke(); target.fill(187,82,54);
      for (int i=0; i<clipped.size(); i++) {
        clipped.segmentInto(i, segmentBuffer, 0);
        target.ellipse((float)segmentBuffer[0], (float)segmentBuffer[1], 4,4);
        target.ellipse((float)segmentBuffer[2], (float)segmentBuffer[3], 4,4);
      }
    }
  });
  redraw();
}
void draw() { image(displayed, 0, 0); }
void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k=='h') { sparse=!sparse; if (!alternateSource) rebuildGeometry(); }
  else if (k=='n') { shallow=!shallow; rebuildGeometry(); }
  else if (k=='t') { alternateSource=!alternateSource; rebuildGeometry(); }
  else if (k=='c') { alternateColor=!alternateColor; rebuildDisplay(); }
  else if (k=='m') { endpoints=!endpoints; rebuildDisplay(); }
  else if (k=='o') { overlay=!overlay; rebuildDisplay(); }
  else if (k=='0') {
    boolean geometryChanged=sparse || shallow || alternateSource;
    sparse=false; shallow=false; alternateSource=false;
    alternateColor=false; endpoints=true; overlay=false;
    if (geometryChanged) rebuildGeometry(); else rebuildDisplay();
  }
  else if (k=='s') displayed.save(sketchPath("clip-marks.png"));
}
