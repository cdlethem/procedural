import org.procedurals.examples.pathmarks.PathMarkComposition;
// M switches movement/marks; L changes mark length; C changes palette.
// N changes step count; D changes distance; S saves the displayed canvas.
// These values describe this piece, not library defaults or recommended ranges.
long SEED = 42;
int STEPS = 2000;
// PDE unsuffixed decimals become float; retain binary64 inputs explicitly.
double DISTANCE = 0.4d;
double MARK_LENGTH = 12;
boolean TRACE = false;
boolean ALTERNATE = false;
int[] COLORS = {0x31A151, 0xFFA71E, 0x05084C, 0xDE4638, 0x3DBDB7};
int[] OTHER_COLORS = {0x2E0551, 0xFF00C7, 0x01AFC2, 0xFDBE03, 0xF4F9FD};
PathMarkComposition movement;
long DRAWN_SEGMENTS;

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() { movement = PathMarkComposition.create(SEED, STEPS, DISTANCE); noLoop(); }
void draw() { DRAWN_SEGMENTS = PathMarksCanvas.paint(this, movement, TRACE, MARK_LENGTH, ALTERNATE ? OTHER_COLORS : COLORS); }
void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') { saveFrame("path-marks-####.png"); return; }
  if (k == 'm') TRACE = !TRACE;
  else if (k == 'l') MARK_LENGTH = MARK_LENGTH == 12 ? 24 : 12;
  else if (k == 'c') ALTERNATE = !ALTERNATE;
  else if (k == 'n') { STEPS = STEPS == 2000 ? 2001 : 2000; movement = PathMarkComposition.create(SEED, STEPS, DISTANCE); }
  else if (k == 'd') { DISTANCE = DISTANCE == 0.4d ? 0.8d : 0.4d; movement = PathMarkComposition.create(SEED, STEPS, DISTANCE); }
  else return;
  redraw();
}
