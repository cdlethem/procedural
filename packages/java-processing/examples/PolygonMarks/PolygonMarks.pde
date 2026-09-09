import org.procedurals.sampling.ConvexPolygonPlacements2D;

// Independently composed from the celular/celular2 outline-placement motivation.
// A: thickness; M: diamonds; C: color; R: seed; 0: reset; S: cached save.
// Authored settings, not recommended operation ranges. Closed outlines include contact.
long seed=42;
double ratio=0.8d;
int shape=0;
boolean alternate=false;
double[][] poses;
double[][][] proposals;
ConvexPolygonPlacements2D placements;
PImage displayedFrame;
final int[] COLORS={0xFFEF276B,0xFFA14FBE,0xFF1D43B8,0xFFF8CA9C};

void settings() { size(512,512,JAVA2D); pixelDensity(1); }
void setup() { rebuildPoses(); rebuildPlacements(); noLoop(); }

// Optional repository render-helper hook; use native controls in the Processing editor.
public void configureRender(long suppliedSeed, java.util.Map<String,Double> values) {
  for (String key:values.keySet())
    if (!key.equals("ratio") && !key.equals("shape")) throw new IllegalArgumentException("unknown parameter");
  seed=suppliedSeed;
  if (values.containsKey("ratio")) ratio=values.get("ratio");
  double kind=values.containsKey("shape") ? values.get("shape") : 0;
  if (!(ratio>0 && ratio<=1) || !(kind==0 || kind==1))
    throw new IllegalArgumentException("example requires ratio in (0,1] and shape 0 or 1");
  shape=(int)kind;
}

void rebuildPoses() {
  java.util.Random random=new java.util.Random(seed);
  poses=new double[600][4];
  for (int i=0;i<poses.length;i++) {
    poses[i][0]=24+464*random.nextDouble();
    poses[i][1]=24+464*random.nextDouble();
    poses[i][2]=12+85*random.nextDouble()*random.nextDouble();
    poses[i][3]=2*Math.PI*random.nextDouble();
  }
}

void rebuildPlacements() {
  proposals=new double[poses.length][][];
  for (int i=0;i<poses.length;i++) {
    double x=poses[i][0], y=poses[i][1], length=poses[i][2], angle=poses[i][3];
    double ca=Math.cos(angle), sa=Math.sin(angle);
    int count=shape==0 ? 12 : 4;
    double[][] polygon=new double[count][2];
    for (int j=0;j<count;j++) {
      double u,v;
      if (shape==1) {
        double a=j*Math.PI/2;
        u=length*Math.cos(a); v=length*ratio*Math.sin(a);
      } else {
        // Two semicircular ends sampled as the actual collision/drawing outline.
        double a=-Math.PI/2+(j%(count/2))*Math.PI/(count/2-1)
          +(j>=count/2 ? Math.PI : 0);
        u=(j<count/2 ? length/2 : -length/2)+length*ratio/2*Math.cos(a);
        v=length*ratio/2*Math.sin(a);
      }
      polygon[j][0]=x+u*ca-v*sa;
      polygon[j][1]=y+u*sa+v*ca;
    }
    proposals[i]=polygon;
  }
  placements=ConvexPolygonPlacements2D.filter(proposals);
}

void draw() {
  background(246,226,220); noStroke();
  for (int i=0;i<placements.size();i++) {
    int source=placements.sourceIndexAt(i);
    fill(COLORS[(source+(alternate ? 2 : 0))%COLORS.length]);
    beginShape();
    for (int j=0;j<placements.vertexCountAt(i);j++)
      vertex((float)placements.xAt(i,j),(float)placements.yAt(i,j));
    endShape(CLOSE);
  }
  displayedFrame=get();
}

void keyPressed() {
  char k=Character.toLowerCase(key);
  if (k=='s') {
    if (displayedFrame!=null) displayedFrame.save(sketchPath("polygon-marks.png"));
    return;
  }
  if (k=='a') { ratio=ratio==0.8d ? 0.2d : 0.8d; rebuildPlacements(); }
  else if (k=='m') { shape=1-shape; rebuildPlacements(); }
  else if (k=='c') alternate=!alternate;
  else if (k=='r') { seed++; rebuildPoses(); rebuildPlacements(); }
  else if (k=='0') {
    seed=42; ratio=0.8d; shape=0; alternate=false; rebuildPoses(); rebuildPlacements();
  } else return;
  redraw();
}
