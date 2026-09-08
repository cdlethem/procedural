import org.procedurals.paths.ClosedSpline2D;
import java.util.Random;

// T moves one control per loop, C recolors, M switches tiles/fans, 0 resets, S saves.
// Independent composition motivated by databol and blobs; not source replay.
// These constants are artwork choices, not library defaults or recommended ranges.
ClosedSpline2D[] curves;
boolean moved = false, alternate = false, fans = false;
PImage displayedFrame;
int[] colors = {0xDE6B48, 0x3B8D91, 0xD3A73B, 0x71619A};
int[] otherColors = {0x366A8C, 0xA95478, 0x678C49, 0xC87632};

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() { rebuildCurves(); noLoop(); }

void rebuildCurves() {
  curves = new ClosedSpline2D[4];
  Random random = new Random(42);
  for (int i = 0; i < curves.length; i++) {
    double cx = 170 + (i % 2) * 300, cy = 170 + (i / 2) * 300;
    double[][] controls = new double[6][2];
    for (int j = 0; j < controls.length; j++) {
      double angle = j * Math.PI / 3.0;
      double radius = 82 + random.nextInt(36);
      controls[j][0] = cx + Math.cos(angle) * radius;
      controls[j][1] = cy + Math.sin(angle) * radius;
    }
    if (moved) { controls[1][0] += 42; controls[1][1] -= 32; }
    curves[i] = ClosedSpline2D.create(controls, 32);
  }
}

void draw() {
  background(245, 240, 230);
  int[] palette = alternate ? otherColors : colors;
  double[] sample = new double[4];
  for (int i = 0; i < curves.length; i++) {
    ClosedSpline2D curve = curves[i];
    int ink = 0xFF000000 | palette[i];
    if (fans) {
      // Fan drawing is an artistic use of this selected outline, not polygon triangulation.
      float cx = 170 + (i % 2) * 300, cy = 170 + (i / 2) * 300;
      noStroke();
      double[] next = new double[4];
      for (int j = 0; j < 192; j++) {
        curve.sampleParameter(j * curve.controlCount() / 192.0, sample);
        curve.sampleParameter((j + 1) * curve.controlCount() / 192.0, next);
        fill(ink, 110 + (j % 16) * 8);
        triangle(cx, cy, (float)sample[0], (float)sample[1], (float)next[0], (float)next[1]);
      }
    } else {
      noFill(); stroke(ink, 95); strokeWeight(0.8);
      beginShape();
      for (int j = 0; j < 192; j++) {
        curve.sampleParameter(j * curve.controlCount() / 192.0, sample);
        vertex((float)sample[0], (float)sample[1]);
      }
      endShape(CLOSE);
      // Approximate distance queries remove the need to implement a spline lookup here.
      rectMode(CENTER); noStroke();
      for (double distance = 0; distance < curve.length(); distance += 18) {
        curve.sampleDistance(distance, sample);
        if (sample[2] == 0 && sample[3] == 0) continue;
        pushMatrix();
        translate((float)sample[0], (float)sample[1]);
        rotate((float)Math.atan2(sample[3], sample[2]));
        fill(ink); rect(0, 0, 12, 22, 3);
        fill(245, 240, 230); rect(0, 0, 4, 10, 1);
        popMatrix();
      }
    }
  }
  displayedFrame = get();
}

void keyPressed() {
  if (key == 's' || key == 'S') { displayedFrame.save("loop-marks.png"); return; }
  if (key == 't' || key == 'T') { moved = !moved; rebuildCurves(); }
  else if (key == 'c' || key == 'C') alternate = !alternate;
  else if (key == 'm' || key == 'M') fans = !fans;
  else if (key == '0') { moved = false; alternate = false; fans = false; rebuildCurves(); }
  else return;
  redraw();
}
