// Start here. Change drawMark() in MarkField.java to invent your own mark.
// Constants describe this piece; they are not library defaults or recommended ranges.
long SEED = 42;
float MAX_LENGTH = 16;  // Change to 32 without changing the grid spacing.
boolean DRAW_BARS = false;  // Reuse the same positions and headings with another mark.
int[] COLORS = {0x31A151, 0xFFA71E, 0x05084C, 0xDE4638, 0x3DBDB7};
// Try {0x2E0551, 0xFF00C7, 0x01AFC2, 0xFDBE03, 0xF4F9FD} to recolour.

MarkField marks;

void settings() {
  size(640, 640, JAVA2D);
  pixelDensity(1);
}

void setup() {
  marks = MarkField.create(SEED, 160, 160, 4); // columns, rows, spacing in pixels
  noLoop();
}

void draw() {
  MarkField.paint(g, marks, MAX_LENGTH, COLORS, DRAW_BARS);
}

void keyPressed() {
  if (key == 's' || key == 'S') saveFrame("field-marks-####.png");
}
