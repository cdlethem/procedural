import org.procedurals.geometry.DiscProjection2D;
import org.procedurals.processing.Java2DLayers;

// M: strength; O: influence order; C: colors; S: save the retained display.
// Authored settings, not defaults or recommended ranges. This is deformation,
// not collision resolution: later discs can undo earlier exclusion.
final int CONTOUR_POINTS = 241;
final int LINE_POINTS = 121;
final int LINE_COUNT = 12;
final double[] STRENGTHS = {0.45, 1.0, 0.0};
double[] inputPoints;
double[][] discOrders;
DiscProjection2D[] projected;
double[][] coordinates;
int mode = 0;
int order = 0;
int projectionCalls = 0;
boolean alternate = false;
boolean dirty = true;
PImage displayed;

void settings() { size(720, 480, JAVA2D); pixelDensity(1); }
void setup() {
  inputPoints = new double[2*(CONTOUR_POINTS+LINE_COUNT*LINE_POINTS)];
  for (int i = 0; i < CONTOUR_POINTS; i++) {
    double angle = Math.PI*2*i/(CONTOUR_POINTS-1);
    inputPoints[2*i] = 180+105*Math.cos(angle);
    inputPoints[2*i+1] = 250+105*Math.sin(angle);
  }
  for (int row = 0; row < LINE_COUNT; row++) {
    for (int i = 0; i < LINE_POINTS; i++) {
      int index = CONTOUR_POINTS+row*LINE_POINTS+i;
      inputPoints[2*index] = 390+i*2.5;
      inputPoints[2*index+1] = 120+row*23;
    }
  }
  discOrders = new double[2][];
  discOrders[0] = new double[] {250,215,72, 230,300,58, 535,205,58, 585,270,72};
  discOrders[1] = new double[discOrders[0].length];
  for (int i = 0; i < 4; i++) {
    System.arraycopy(discOrders[0], 3*i, discOrders[1], 3*(3-i), 3);
  }
  projected = new DiscProjection2D[6];
  coordinates = new double[6][];
  for (int o = 0; o < 2; o++) {
    for (int m = 0; m < 3; m++) {
      int index = o*3+m;
      long budget = (long)(inputPoints.length/2)*(discOrders[o].length/3);
      projected[index] = DiscProjection2D.project(inputPoints, discOrders[o], STRENGTHS[m], budget);
      projectionCalls++;
      coordinates[index] = projected[index].points();
    }
  }
  rebuild();
}
void paths(PGraphics target, double[] points) {
  target.beginShape();
  for (int i = 0; i < CONTOUR_POINTS; i++) target.vertex((float)points[2*i], (float)points[2*i+1]);
  target.endShape();
  for (int row = 0; row < LINE_COUNT; row++) {
    target.beginShape();
    for (int i = 0; i < LINE_POINTS; i++) {
      int index = CONTOUR_POINTS+row*LINE_POINTS+i;
      target.vertex((float)points[2*index], (float)points[2*index+1]);
    }
    target.endShape();
  }
}
void rebuild() {
  displayed = Java2DLayers.render(this, width, height, g -> {
    g.background(248, 245, 235); g.noFill();
    g.stroke(125, 145, 160, 115); g.strokeWeight(1);
    double[] discs = discOrders[order];
    for (int i = 0; i < discs.length; i += 3) {
      g.ellipse((float)discs[i], (float)discs[i+1], (float)(2*discs[i+2]), (float)(2*discs[i+2]));
    }
    g.stroke(190, 110, 100, 85); paths(g, inputPoints);
    if (alternate) g.stroke(145, 55, 100);
    else g.stroke(25, 70, 125);
    g.strokeWeight(1.6); paths(g, coordinates[order*3+mode]);
  });
  dirty = true;
}
void draw() { if (dirty) { image(displayed, 0, 0); dirty = false; } }
void keyPressed() {
  if (key == 'm' || key == 'M') { mode = (mode+1)%3; rebuild(); }
  if (key == 'o' || key == 'O') { order = 1-order; rebuild(); }
  if (key == 'c' || key == 'C') { alternate = !alternate; rebuild(); }
  if (key == 's' || key == 'S') displayed.save(sketchPath("projection-marks.png"));
}
