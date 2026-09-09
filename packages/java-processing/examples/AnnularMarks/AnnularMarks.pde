import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.mesh.AnnularMesh3D;

// W width, D depth, F facets, C color, M arrangement, 0 reset, S save.
// Authored study settings, not defaults or recommended parameter ranges.
AnnularMesh3D mesh;
boolean wide = false, deep = false, coarse = false;
boolean alternate = false, arrangement = false;
int meshBuilds = 0;
PImage displayedFrame;
final int[] PRIMARY = {0xff7597aa, 0xffb66d55, 0xffeac798, 0xff585e77};
final int[] ALTERNATE = {0xffd386a2, 0xff51776c, 0xff9fc5ae, 0xff696482};
final double[] pointScratch = new double[3];
final double[] normalScratch = new double[3];
final int[] triangleScratch = new int[3];

void settings() { size(640, 640, P3D); pixelDensity(1); }

void setup() {
  rebuildMesh();
  noLoop();
}

void rebuildMesh() {
  Map<String, Object> config = new LinkedHashMap<String, Object>();
  config.put("outerRadius", 150.0);
  config.put("innerRadius", wide ? 60.0 : 110.0);
  config.put("bottomZ", deep ? -45.0 : -15.0);
  config.put("topZ", deep ? 45.0 : 15.0);
  config.put("slices", coarse ? 12 : 48);
  config.put("maxFaces", 384);
  mesh = AnnularMesh3D.generate(config);
  meshBuilds++;
}

int faceColor(String kind, boolean recolored) {
  int[] colors = recolored ? ALTERNATE : PRIMARY;
  if (kind.equals("outer-wall")) return colors[0];
  if (kind.equals("inner-wall")) return colors[1];
  if (kind.equals("top-annulus")) return colors[2];
  return colors[3];
}

void paintMesh(boolean recolored) {
  beginShape(TRIANGLES);
  for (long face = 0; face < mesh.faceCount(); face++) {
    fill(faceColor(mesh.faceKindAt(face), recolored));
    mesh.normalInto(face, normalScratch, 0);
    normal((float)normalScratch[0], (float)normalScratch[1], (float)normalScratch[2]);
    mesh.triangleInto(face, triangleScratch, 0);
    for (int corner = 0; corner < 3; corner++) {
      mesh.vertexInto(triangleScratch[corner], pointScratch, 0);
      vertex((float)pointScratch[0], (float)pointScratch[1], (float)pointScratch[2]);
    }
  }
  endShape();
}

void draw() {
  background(24, 27, 34);
  ortho();
  lights();
  noStroke();
  if (arrangement) {
    for (int instance = 0; instance < 3; instance++) {
      pushMatrix();
      translate(155 + 165 * instance, 225 + 90 * (instance % 2), 0);
      rotateX(0.9f); rotateY(0.3f + instance * 0.25f); scale(0.62f);
      paintMesh(alternate != (instance == 1));
      popMatrix();
    }
  } else {
    pushMatrix();
    translate(320, 320, 0); rotateX(0.9f); rotateY(0.3f);
    paintMesh(alternate);
    popMatrix();
  }
  displayedFrame = get();
}

void keyPressed() {
  char pressed = Character.toLowerCase(key);
  if (pressed == 's') {
    if (displayedFrame != null) displayedFrame.save("annular-marks.png");
    return;
  }
  boolean geometryChanged = false;
  if (pressed == 'w') { wide = !wide; geometryChanged = true; }
  else if (pressed == 'd') { deep = !deep; geometryChanged = true; }
  else if (pressed == 'f') { coarse = !coarse; geometryChanged = true; }
  else if (pressed == 'c') alternate = !alternate;
  else if (pressed == 'm') arrangement = !arrangement;
  else if (pressed == '0') {
    geometryChanged = wide || deep || coarse;
    wide = deep = coarse = alternate = arrangement = false;
  } else return;
  if (geometryChanged) rebuildMesh();
  redraw();
}
