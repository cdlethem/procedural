import org.procedurals.examples.profilemarks.ProfileComposition;
import org.procedurals.mesh.RadialProfile3D;
import org.procedurals.color.CyclicPalette;

// P: profile; D: 8/32 angular slices; B/T: independent start/end caps.
// C: palette; X: arrange all three retained forms; 0: reset; S: save.
// These are editable example settings, not library defaults or recommended ranges.
int PROFILE = 0, SLICES = 32;
boolean START_CAP = true, END_CAP = true, ALTERNATE = false, TRIO = false;
int[] COLORS = {0xEBB858, 0xEEA8C1, 0xD0CBC3, 0x87B6C4, 0xEA4140, 0x5A5787};
int[] OTHER_COLORS = {0x243B53, 0x3E8C93, 0xE9C46A, 0xE76F51};
ProfileComposition composition;
PImage displayedFrame;
CyclicPalette primaryPalette, alternatePalette;
double[] vertexBuffer = new double[3], normalBuffer = new double[3];
int[] triangleBuffer = new int[3];

void settings() { size(640, 640, P3D); pixelDensity(1); }
void setup() { primaryPalette = palette(COLORS); alternatePalette = palette(OTHER_COLORS); rebuild(); noLoop(); }
 CyclicPalette palette(int[] colors) {
  java.util.List<Integer> values = new java.util.ArrayList<Integer>();
  for (int colorValue : colors) values.add(colorValue);
  java.util.Map<String, Object> config = new java.util.LinkedHashMap<String, Object>();
  config.put("colors", values);
  return CyclicPalette.create(config);
}
void rebuild() { composition = ProfileComposition.create(SLICES, START_CAP, END_CAP); }
void draw() {
  background(243, 240, 232);
  lights();
  ortho();
  noStroke();
  if (TRIO) {
    drawMesh(composition.meshAt(0), 140, 0.45f);
    drawMesh(composition.meshAt(1), 320, 0.45f);
    drawMesh(composition.meshAt(2), 500, 0.45f);
  } else drawMesh(composition.meshAt(PROFILE), 320, 1.0f);
  // Capture on the OpenGL animation thread; key events can safely save this CPU image.
  displayedFrame = get();
}
void drawMesh(RadialProfile3D mesh, float x, float objectScale) {
  pushMatrix();
  translate(x, 320);
  rotateX(1.0f);
  rotateY(0.35f);
  scale(objectScale);
  beginShape(TRIANGLES);
  for (int face = 0; face < mesh.faceCount(); face++) {
    // The metadata lets colour change independently of geometry.
    double phase = mesh.bandAt(face) < 0 ? (mesh.faceKindAt(face).equals("start-cap") ? 0.15d : 0.65d)
      : mesh.bandAt(face) / 8.0d + mesh.cellAt(face) / (composition.slices() * 8.0d);
    int rgb = (ALTERNATE ? alternatePalette : primaryPalette).sample(phase);
    fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
    mesh.normalInto(face, normalBuffer, 0);
    normal((float)normalBuffer[0], (float)normalBuffer[1], (float)normalBuffer[2]);
    mesh.triangleInto(face, triangleBuffer, 0);
    for (int corner = 0; corner < 3; corner++) {
      mesh.vertexInto(triangleBuffer[corner], vertexBuffer, 0);
      vertex((float)vertexBuffer[0], (float)vertexBuffer[1], (float)vertexBuffer[2]);
    }
  }
  endShape();
  popMatrix();
}
void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') {
    if (displayedFrame != null) displayedFrame.save(sketchPath("profile-marks-" + nf(frameCount, 4) + ".png"));
    return;
  }
  if (k == 'p') PROFILE = (PROFILE + 1) % 3;
  else if (k == 'c') ALTERNATE = !ALTERNATE;
  else if (k == 'x') TRIO = !TRIO;
  else {
    if (k == 'd') SLICES = SLICES == 32 ? 8 : 32;
    else if (k == 'b') START_CAP = !START_CAP;
    else if (k == 't') END_CAP = !END_CAP;
    else if (k == '0') { PROFILE = 0; SLICES = 32; START_CAP = true; END_CAP = true; ALTERNATE = false; TRIO = false; }
    else return;
    rebuild();
  }
  redraw();
}
