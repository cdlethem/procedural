import org.procedurals.layout.BinaryCellPartition2D;

// CP17 workflow; scoped native and distribution evidence is recorded separately.
// A changes attempted cuts, P changes axis policy, C recolors, M changes decoration,
// 0 resets, S saves the displayed frame. Settings are artwork choices, not defaults.
// Independently composed from the integer panel idioms in poop and barab.
BinaryCellPartition2D layout;
int attempts = 80;
boolean randomAxis = false, alternate = false, solidPanels = false;
PImage displayedFrame;
int[] colors = {0x264653, 0x2A9D8F, 0xD7AA35, 0xE28D4B, 0xD96750};
int[] otherColors = {0x375E97, 0x8C579C, 0x458A73, 0xB15075, 0xA77C40};

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() { rebuildLayout(); noLoop(); }

void rebuildLayout() {
  layout = BinaryCellPartition2D.generate(42L, 60, 60, attempts,
      randomAxis ? "RANDOM" : "LONGEST");
}

void draw() {
  background(245, 242, 235);
  rectMode(CORNER);
  strokeWeight(1);
  int[] bounds = new int[4];
  int[] palette = alternate ? otherColors : colors;
  for (int index = 0; index < layout.size(); index++) {
    layout.boundsInto(index, bounds);
    // Cell-to-world conversion is ordinary drawing arithmetic; no partition logic here.
    float x = 20 + bounds[0] * 10, y = 20 + bounds[1] * 10;
    float w = (bounds[2] - bounds[0]) * 10, h = (bounds[3] - bounds[1]) * 10;
    int ink = 0xFF000000 | palette[index % palette.length];
    if (solidPanels) {
      stroke(ink); fill(ink, 90);
      rect(x + 2, y + 2, w - 4, h - 4);
      stroke(40, 60, 70, 180);
      line(x + w * 0.5, y + 3, x + w * 0.5, y + h - 3);
    } else {
      stroke(ink, 210); noFill();
      for (float inset = 1; w - 2 * inset > 0 && h - 2 * inset > 0; inset += 3)
        rect(x + inset, y + inset, w - 2 * inset, h - 2 * inset);
    }
  }
  displayedFrame = get();
}

void keyPressed() {
  if (key == 's' || key == 'S') { displayedFrame.save("panel-marks.png"); return; }
  if (key == 'a' || key == 'A') {
    attempts = attempts == 80 ? 240 : attempts == 240 ? 20 : 80;
    rebuildLayout();
  } else if (key == 'p' || key == 'P') {
    randomAxis = !randomAxis;
    rebuildLayout();
  } else if (key == 'c' || key == 'C') alternate = !alternate;
  else if (key == 'm' || key == 'M') solidPanels = !solidPanels;
  else if (key == '0') {
    attempts = 80; randomAxis = false; alternate = false; solidPanels = false;
    rebuildLayout();
  } else return;
  redraw();
}
