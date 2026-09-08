/*
Face drawing adapted from Manolo ide, AllSketchs/2019/generativos/momito/momito.pde
Revision69bdd8513e4482a5e6018e36887d4bc208660eb5
https://github.com/manoloide/AllSketchs

MIT License

Copyright (c) 2020 Manolo ide

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import org.procedurals.examples.reliefmarks.ReliefComposition;
import org.procedurals.topology.Delaunay2D;

// Structural recreation of 2019/generativos/momito, using package-native algorithms.
// C: frame colour; H: relief height; R: seed; 0: reset; S: cached save.
// Source values are authored settings, not recommended operation ranges.
long SEED = 42;
boolean TALL = false;
int[] PALETTE = {0x366A51, 0xDFAB56, 0xE5463E, 0x2884BC};
int COLOR = 0;
ReliefComposition composition;
PImage displayedFrame;
int[] face = new int[3];
double[] a = new double[2], b = new double[2], c = new double[2];

void settings() { size(960, 960, P3D); pixelDensity(1); }
void setup() { rebuild(); noLoop(); }
void rebuild() { composition = ReliefComposition.create(SEED); }

void draw() {
  background(240);
  ambientLight(120, 120, 120);
  directionalLight(10, 20, 30, 0, -.5, -1);
  lightFalloff(0, 1, 0);
  directionalLight(180, 160, 160, -.8, .5, -1);
  ortho(-480, 480, -480, 480, .02, 2000);
  translate(width * .5, height * .5);
  rotateX(QUARTER_PI);
  rotateZ(QUARTER_PI);
  scale(2.2);
  noStroke();
  drawSpikes();
  int rgb = PALETTE[COLOR];
  fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
  Delaunay2D mesh = composition.mesh();
  for (int i = 0; i < mesh.faceCount(); i++) {
    mesh.triangleInto(i, face, 0);
    mesh.pointInto(face[0], a, 0);
    mesh.pointInto(face[1], b, 0);
    mesh.pointInto(face[2], c, 0);
    drawReliefFace(TALL ? 12 : 4);
  }
  displayedFrame = get(); // Capture on the OpenGL animation thread.
}

void drawSpikes() {
  fill(255);
  for (int leaf = 0; leaf < composition.leafCount(); leaf++) {
    if (!composition.spikeAt(leaf)) continue;
    composition.centerInto(leaf, a);
    float height = (float) composition.spikeHeight(leaf);
    pushMatrix();
    translate((float) a[0], (float) a[1], height * .5);
    box(height * .02, height * .02, height);
    popMatrix();
  }
}

void drawReliefFace(float height) {
  // Canonical package face roles replace the source triangulator's vertex order.
  // One sloped face and two triangles along the first edge: not a closed extrusion.
  beginShape(TRIANGLES);
  vertex((float) a[0], (float) a[1], height);
  vertex((float) b[0], (float) b[1], height);
  vertex((float) c[0], (float) c[1], 0);
  vertex((float) a[0], (float) a[1], height);
  vertex((float) b[0], (float) b[1], height);
  vertex((float) b[0], (float) b[1], 0);
  vertex((float) a[0], (float) a[1], height);
  vertex((float) b[0], (float) b[1], height);
  vertex((float) a[0], (float) a[1], 0);
  endShape();
}

void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') {
    if (displayedFrame != null) displayedFrame.save(sketchPath("relief-marks.png"));
    return;
  }
  if (k == 'c') COLOR = (COLOR + 1) % PALETTE.length;
  else if (k == 'h') TALL = !TALL;
  else if (k == 'r') { SEED = (SEED + 1) & 0xffffffffL; rebuild(); }
  else if (k == '0') { SEED = 42; TALL = false; COLOR = 0; rebuild(); }
  else return;
  redraw();
}
