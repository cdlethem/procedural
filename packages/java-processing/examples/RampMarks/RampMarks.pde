import org.procedurals.color.StopRamp;

// T moves a color stop; C recolors; F changes scalar coordinates; 0 resets; S saves.
// These are authored artwork settings, not library defaults or recommended ranges.
boolean shifted = false, alternate = false, radial = false;
StopRamp ramp;
PImage displayedFrame;

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }

void setup() {
  rebuildRamp();
  noLoop();
}

void rebuildRamp() {
  double[] positions = {0.0, shifted ? 0.6 : 0.25, 0.8, 1.0};
  int[] colors = alternate
    ? new int[]{0x352344, 0xB84A62, 0xF4E8C1, 0x477AAB}
    : new int[]{0x173F5F, 0x2A9D8F, 0xE9C46A, 0xE76F51};
  ramp = StopRamp.create(positions, colors);
}

void draw() {
  background(248, 245, 238);
  noStroke();
  // The positions and circle sizes stay fixed throughout every color edit.
  for (int y = 12; y < height; y += 24) {
    for (int x = 12; x < width; x += 24) {
      double value = radial
        ? Math.hypot(x - width / 2.0, y - height / 2.0) / (width * 0.65)
        : x / (width - 1.0);
      int rgb = ramp.sample(value);
      fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
      ellipse(x, y, 16, 16);
    }
  }
  displayedFrame = get();
}

void keyPressed() {
  char pressed = Character.toLowerCase(key);
  if (pressed == 's') { if (displayedFrame != null) displayedFrame.save("ramp-marks.png"); return; }
  if (pressed == 't') { shifted = !shifted; rebuildRamp(); }
  else if (pressed == 'c') { alternate = !alternate; rebuildRamp(); }
  else if (pressed == 'f') { radial = !radial; }
  else if (pressed == '0') {
    shifted = false; alternate = false; radial = false; rebuildRamp();
  } else return;
  redraw();
}
