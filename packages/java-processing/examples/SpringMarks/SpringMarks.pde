import org.procedurals.examples.springmarks.SpringComposition;
import org.procedurals.motion.TargetSprings2D;
import org.procedurals.topology.Delaunay2D;

// Start paused: D disturbs targets, then Space starts explicit ticks; . inspects one paused tick.
// M: dots/velocity/fixed-wire; C: palette; H: trails; T: target guides.
// K/V replace retained coefficients through detached state; 0 resets; S saves the
// completed cached frame. These regular sites, styles, and coefficients are authored
// example choices, not library defaults, recommended ranges, or source reproduction.
boolean RUNNING = false, DIRTY = true;
boolean ALTERNATE = false, TRAILS = true, TARGETS = false;
int MODE = 0;
double STRENGTH = 0.025d, RETENTION = 0.7d;
int[] COLORS = {0x173F5F, 0xAF5441, 0xE9C46A, 0x347969};
int[] OTHER_COLORS = {0x493657, 0xB85065, 0xE6B89C, 0x467C89};

SpringComposition composition;
PImage displayedFrame;
double[] position = new double[2], otherPosition = new double[2];
double[] velocity = new double[2], initial = new double[2], target = new double[2];
int[] edge = new int[2];

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }

void setup() {
  colorMode(RGB, 255);
  composition = new SpringComposition();
  println("Paused: press D, then Space. Press . to inspect one paused step.");
  // Keep the display loop active. Paused frames render but never advance the batch.
}

void draw() {
  if (!RUNNING && !DIRTY) return;
  if (RUNNING) composition.step();
  renderComposition();
  // Capture only after every drawing layer has completed. Saving never rerenders or ticks.
  displayedFrame = get();
  DIRTY = false;
}

void renderComposition() {
  background(243, 240, 232);
  drawInitialRings();
  if (TRAILS) drawTrails();
  if (MODE == 0) drawDots();
  else if (MODE == 1) drawVelocity();
  else drawFixedWire();
  if (TARGETS) drawTargetGuides();
}

int markColor(int index) {
  int[] colors = ALTERNATE ? OTHER_COLORS : COLORS;
  return colors[index % colors.length];
}

void rgbStroke(int rgb, int alpha) {
  stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, alpha);
}

void rgbFill(int rgb, int alpha) {
  fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, alpha);
}

void drawInitialRings() {
  noFill(); stroke(45, 50, 55, 75); strokeWeight(1); ellipseMode(CENTER);
  for (int body = 0; body < composition.motion().size(); body++) {
    composition.initialInto(body, initial, 0);
    ellipse((float)initial[0], (float)initial[1], 9, 9);
  }
}

void drawTrails() {
  noFill(); strokeWeight(1); strokeCap(ROUND); strokeJoin(ROUND);
  int samples = composition.sampleCount();
  for (int body = 0; body < composition.motion().size(); body++) {
    rgbStroke(markColor(body), 105);
    beginShape();
    // historyInto is chronological; endShape intentionally does not close the ring.
    for (int sample = 0; sample < samples; sample++) {
      composition.historyInto(sample, body, position, 0);
      vertex((float)position[0], (float)position[1]);
    }
    endShape();
  }
}

void drawDots() {
  noStroke(); ellipseMode(CENTER);
  TargetSprings2D motion = composition.motion();
  for (int body = 0; body < motion.size(); body++) {
    motion.positionInto((long)body, position, 0);
    rgbFill(markColor(body), 230);
    ellipse((float)position[0], (float)position[1], 8, 8);
  }
}

void drawVelocity() {
  TargetSprings2D motion = composition.motion();
  noFill(); strokeWeight(1.5f); strokeCap(ROUND);
  for (int body = 0; body < motion.size(); body++) {
    motion.positionInto((long)body, position, 0);
    motion.velocityInto((long)body, velocity, 0);
    rgbStroke(markColor(body), 220);
    // 24 is a display-only authored scale for the current logical-step velocity.
    line((float)position[0], (float)position[1],
      (float)(position[0] + velocity[0] * 24.0d),
      (float)(position[1] + velocity[1] * 24.0d));
  }
}

void drawFixedWire() {
  TargetSprings2D motion = composition.motion();
  Delaunay2D mesh = composition.mesh();
  noFill(); strokeWeight(1.1f); strokeCap(ROUND);
  for (int index = 0; index < mesh.edgeCount(); index++) {
    mesh.edgeInto((long)index, edge, 0);
    // Canonical mesh vertices are mapped back to the original spring body explicitly.
    int firstBody = composition.bodyForVertex(edge[0]);
    int secondBody = composition.bodyForVertex(edge[1]);
    motion.positionInto((long)firstBody, position, 0);
    motion.positionInto((long)secondBody, otherPosition, 0);
    rgbStroke(markColor(index), 185);
    line((float)position[0], (float)position[1],
      (float)otherPosition[0], (float)otherPosition[1]);
  }
}

void drawTargetGuides() {
  TargetSprings2D motion = composition.motion();
  noFill(); strokeWeight(1); strokeCap(ROUND);
  for (int body = 0; body < motion.size(); body++) {
    motion.positionInto((long)body, position, 0);
    composition.targetInto(body, target, 0);
    rgbStroke(markColor(body), 120);
    line((float)position[0], (float)position[1], (float)target[0], (float)target[1]);
    rgbStroke(markColor(body), 220);
    line((float)target[0] - 4, (float)target[1], (float)target[0] + 4, (float)target[1]);
    line((float)target[0], (float)target[1] - 4, (float)target[0], (float)target[1] + 4);
  }
}

void keyPressed() {
  if (key == ' ') {
    RUNNING = !RUNNING;
    return;
  }
  if (key == '.') {
    if (!RUNNING) {
      composition.step();
      DIRTY = true;
    }
    return;
  }

  char k = Character.toLowerCase(key);
  if (k == 's') {
    if (displayedFrame != null)
      displayedFrame.save(sketchPath("spring-marks-" + nf(frameCount, 4) + ".png"));
    return;
  }
  if (k == 'd') composition.disturb();
  else if (k == 'm') MODE = (MODE + 1) % 3;
  else if (k == 'c') ALTERNATE = !ALTERNATE;
  else if (k == 'h') TRAILS = !TRAILS;
  else if (k == 't') TARGETS = !TARGETS;
  else if (k == 'k') {
    STRENGTH = STRENGTH == 0.025d ? 0.05d : 0.025d;
    composition.response(STRENGTH, RETENTION);
  } else if (k == 'v') {
    RETENTION = RETENTION == 0.7d ? 0.9d : 0.7d;
    composition.response(STRENGTH, RETENTION);
  } else if (k == '0') {
    RUNNING = false; ALTERNATE = false; TRAILS = true; TARGETS = false; MODE = 0;
    STRENGTH = 0.025d; RETENTION = 0.7d;
    composition.reset();
  } else return;
  DIRTY = true;
  // The continuously active draw loop picks up this edit; the handler itself never ticks.
}
