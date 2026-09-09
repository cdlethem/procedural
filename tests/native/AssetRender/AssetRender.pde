import org.procedurals.color.StopRamp;
PImage source;
int marker;
void configureRender(long seed, java.util.Map<String, Double> params) {
  if (params.size()!=1 || !params.containsKey("marker")) throw new IllegalArgumentException("marker required");
  marker=params.get("marker").intValue();
}
void settings() { size(16,16,JAVA2D); pixelDensity(1); }
void setup() {
  source=loadImage("nested/pattern.png");
  if (source==null || source.width!=16 || source.height!=16) throw new IllegalStateException("missing asset");
  noLoop();
}
void draw() {
  image(source,0,0);
  StopRamp ramp=StopRamp.create(new double[]{0.0d,1.0d},new int[]{0x000000,0xFFFFFF});
  set(0,0,0xFF000000 | ramp.sample(marker));
}
