// Independent helper lifecycle fixture: noLoop in setup AND draw, retained state/pixels.
int completed;
long configuredSeed;
public void configureRender(long seed, java.util.Map<String,Double> parameters) {
  if (!parameters.isEmpty()) throw new IllegalArgumentException("no parameters");
  configuredSeed=seed;
}
void settings() { size(32, 16, JAVA2D); pixelDensity(1); }
void setup() { background(0); noStroke(); noLoop(); }
void draw() {
  completed++;
  if (frameCount!=completed) throw new IllegalStateException("skipped frame");
  fill((int)(configuredSeed%256), completed, 0);
  rect(completed-1, 0, 1, 16);
  noLoop();
}
