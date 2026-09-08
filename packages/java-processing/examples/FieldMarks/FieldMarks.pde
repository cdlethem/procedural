// Start here. Edit MarkCommands.mark() to invent your own mark.
// These constants describe this piece, not library defaults or recommended ranges.
long SEED = 42;
float MAX_LENGTH = 16; // Try 32 while keeping the field fixed.
boolean DRAW_BARS = false;
int[] COLORS = {0x31A151, 0xFFA71E, 0x05084C, 0xDE4638, 0x3DBDB7};
// Alternate: {0x2E0551, 0xFF00C7, 0x01AFC2, 0xFDBE03, 0xF4F9FD}.
MarkField marks;

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() { marks = MarkField.create(SEED, 160, 160, 4); noLoop(); }
void draw() { MarkCommands.paint(this, marks, MAX_LENGTH, COLORS, DRAW_BARS); }
void keyPressed() {
  if (key == 's' || key == 'S') saveFrame("field-marks-####.png");
}
