import java.util.Map;
import org.procedurals.fields.Noise3DProbe;

// Private field study: fixed geometry, independent3D scalar values. Not a packaged starter.
long fieldSeed=42;
double depth=0.25;
int surfaceMode=0;
Noise3DProbe field;
public void configureRender(long seed, Map<String,Double> params) {
  if (params==null || params.size()!=2 || !params.containsKey("depth") || !params.containsKey("surface"))
    throw new IllegalArgumentException("depth and surface required");
  Double d=params.get("depth"), s=params.get("surface");
  if(d==null || !Double.isFinite(d) || Math.abs(d)>1000 || s==null || (s!=0 && s!=1))
    throw new IllegalArgumentException("invalid study setting");
  fieldSeed=seed; depth=d; surfaceMode=s.intValue();
}
void settings() { size(640,640,JAVA2D); pixelDensity(1); }
void setup() { field=new Noise3DProbe(fieldSeed); noLoop(); }
void draw() {
  background(247,242,230);
  if(surfaceMode==0) {
    stroke(35,70,80,180); strokeWeight(1.2);
    for(int y=24;y<620;y+=8) for(int x=24;x<620;x+=8) {
      double n=field.sample(x/96.0,y/96.0,depth);
      double angle=n*Math.PI*2, length=3+17*n;
      line(x,y,(float)(x+Math.cos(angle)*length),(float)(y+Math.sin(angle)*length));
    }
  } else {
    // Visible hemisphere, back-to-front rings. Ordinary authored projection only;
    // no claim of a native3D adapter, full sphere mesher or original recreation.
    noStroke();
    for(int ring=24;ring>=0;ring--) {
      double latitude=ring*Math.PI/50;
      int count=ring==0?1:96;
      for(int j=0;j<count;j++) {
        double angle=j*2*Math.PI/count;
        double x=Math.sin(latitude)*Math.cos(angle);
        double y=Math.sin(latitude)*Math.sin(angle);
        double z=Math.cos(latitude);
        double n=field.sample(2*x+3,2*y+3,2*z+depth);
        fill((float)(35+175*n),(float)(70+85*n),(float)(110-65*n));
        float size=(float)(4+7*z);
        ellipse((float)(320+260*x),(float)(320+260*y),size,size);
      }
    }
  }
}
