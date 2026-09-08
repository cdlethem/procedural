/*
Building and window drawing adapted from Manolo ide, AllSketchs/2019/generativos/ciscis002/ciscis002.pde
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
import org.procedurals.examples.citymarks.CityComposition;
import org.procedurals.topology.Delaunay2D;
import org.procedurals.layout.RegularGrid;
import org.procedurals.color.CyclicPalette;
import java.util.Collections;
import java.util.Arrays;

// Structural ciscis002 recreation. C: colour, H: height, R: seed, 0: reset, S: save.
long SEED = 42;
boolean LOW = false;
int COLOR = 0;
CityComposition composition;
CyclicPalette palette;
PImage displayedFrame;
int[] face = new int[3];
double[] a = new double[2], b = new double[2], c = new double[2];
double[] uv = new double[2];
long drawnWindows;
long drawNanos;

void settings() { size(960, 960, P3D); pixelDensity(1); }
void setup() {
  palette = CyclicPalette.create(Collections.singletonMap("colors",
    Arrays.asList(0x121B4B, 0x028594, 0xE55E7F, 0xFBAF34, 0xF0D5CA)));
  rebuild();
  noLoop();
}
void rebuild() { composition = CityComposition.create(SEED); }
void loadFace(int index) {
  Delaunay2D mesh = composition.mesh();
  mesh.triangleInto(index, face, 0);
  mesh.pointInto(face[0], a, 0);
  mesh.pointInto(face[1], b, 0);
  mesh.pointInto(face[2], c, 0);
}
void draw() {
  long started = System.nanoTime();
  drawnWindows = 0;
  background(0);
  ambientLight(120, 120, 120);
  directionalLight(10, 20, 30, 0, -.5, -1);
  lightFalloff(0, 1, 0);
  directionalLight(180, 160, 160, -.8, .5, -1);
  ortho(-480, 480, -480, 480, .02, 2500);
  translate(width*.5, height*.5, -400);
  rotateX(QUARTER_PI);
  rotateZ(QUARTER_PI);
  scale(2.1);
  stroke(0, 240);
  strokeWeight(.08);
  for (int f = 0; f < composition.mesh().faceCount(); f++) {
    if (!composition.groundVisible(f)) continue;
    loadFace(f);
    fill(composition.groundGray(f));
    roof(0);
  }
  strokeWeight(.4);
  for (int f = 0; f < composition.mesh().faceCount(); f++) {
    loadFace(f);
    float h = (float)((LOW ? 80 : 200) * composition.heightUnit(f));
    int rgb = palette.sample(composition.palettePhase(f) + COLOR/5.0);
    fill((rgb >>> 16)&255, (rgb >>> 8)&255, rgb&255);
    roof(h);
    wall(a, b, h); wall(c, b, h); wall(a, c, h);
    windows(f, 0, a, b, h);
    windows(f, 1, c, b, h);
    windows(f, 2, a, c, h);
  }
  displayedFrame = get();
  drawNanos = System.nanoTime() - started;
}
void roof(float h) {
  beginShape(TRIANGLES);
  vertex((float)a[0], (float)a[1], h);
  vertex((float)b[0], (float)b[1], h);
  vertex((float)c[0], (float)c[1], h);
  endShape();
}
void wall(double[] start, double[] end, float h) {
  beginShape(QUADS);
  vertex((float)start[0], (float)start[1], h);
  vertex((float)end[0], (float)end[1], h);
  vertex((float)end[0], (float)end[1], 0);
  vertex((float)start[0], (float)start[1], 0);
  endShape();
}
void windows(int f, int w, double[] start, double[] end, float h) {
  double dx = end[0]-start[0], dy = end[1]-start[1];
  float angle = (float)Math.atan2(dy, dx);
  float ww = (float)(Math.hypot(dx, dy)/composition.horizontalCount(f)
    * composition.wallWidthFraction(f, w));
  float hh = (float)(h/composition.verticalCount(f)
    * composition.wallHeightFraction(f, w));
  RegularGrid grid = composition.windowGrid(f);
  for (int i = 0; i < grid.size(); i++) {
    grid.pointInto(i, uv, 0);
    pushMatrix();
    translate((float)(start[0]+dx*uv[1]), (float)(start[1]+dy*uv[1]),
      (float)(h*(1-uv[0])));
    rotateZ(angle);
    if (composition.windowLit(f, w, i)) fill(255, 220, 200);
    else fill(0);
    box(ww, .1, hh);
    popMatrix();
    drawnWindows++;
  }
}
void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') {
    if (displayedFrame != null) displayedFrame.save(sketchPath("city-marks.png"));
    return;
  }
  if (k == 'c') COLOR = (COLOR+1)%5;
  else if (k == 'h') LOW = !LOW;
  else if (k == 'r') { SEED = (SEED+1)&0xffffffffL; rebuild(); }
  else if (k == '0') { SEED = 42; LOW = false; COLOR = 0; rebuild(); }
  else return;
  redraw();
}
