// Independent private CP20 geometry study; not a packaged starter or source recreation.
long suppliedSeed;
double ratio;
int shape;
double[][][] proposals;
int[] retained;
public void configureRender(long seed, java.util.Map<String,Double> values) {
  if (values.size()!=2 || !values.containsKey("ratio") || !values.containsKey("shape"))
    throw new IllegalArgumentException("require ratio and shape");
  ratio=values.get("ratio");
  double kind=values.get("shape");
  if (!(ratio>0 && ratio<=1) || !(kind==0 || kind==1))
    throw new IllegalArgumentException("private study configuration");
  shape=(int)kind;
  suppliedSeed=seed;
}
void settings() { size(512,512,JAVA2D); pixelDensity(1); }
void setup() {
  noLoop();
  java.util.Random random=new java.util.Random(suppliedSeed);
  proposals=new double[600][][];
  for (int i=0;i<proposals.length;i++) {
    double x=24+464*random.nextDouble(), y=24+464*random.nextDouble();
    double length=12+85*random.nextDouble()*random.nextDouble();
    double angle=2*Math.PI*random.nextDouble();
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
  retained=ConvexStudy.filter(proposals);
}
void draw() {
  background(246,226,220); noStroke();
  int[] colors={0xFFEF276B,0xFFA14FBE,0xFF1D43B8,0xFFF8CA9C};
  for (int index:retained) {
    fill(colors[index%colors.length]);
    beginShape();
    for (double[] point:proposals[index]) vertex((float)point[0],(float)point[1]);
    endShape(CLOSE);
  }
}
