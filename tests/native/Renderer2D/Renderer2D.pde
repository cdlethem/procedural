import org.procedurals.color.StopRamp;
void configureRender(long seed, java.util.Map<String,Double> p) {}
void settings(){size(64,64,P2D);pixelDensity(1);}
void setup(){noLoop();}
void draw(){
  background(255);noStroke();
  fill(0,0,255);rect(8,8,48,48);
  StopRamp ramp=StopRamp.create(new double[]{0.0d,1.0d},new int[]{0xFF0000,0x00FF00});
  fill(0xFF000000 | ramp.sample(frameCount-1));rect(24,24,16,16);
}
