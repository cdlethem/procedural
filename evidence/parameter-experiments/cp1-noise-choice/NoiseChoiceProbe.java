import java.util.*;
import processing.core.PApplet;
import processing.awt.PGraphicsJava2D;
import org.procedurals.layout.RegularGrid;

/** Private bounded design experiment; not a library operation or corpus reproduction.
 * Gradient interpolation is independently specified in cp1-noise-proposal.md.
 * lowbias32 mixer: skeeto/hash-prospector, Unlicense. No sketch code copied.
 */
public strictfp class NoiseChoiceProbe {
    static final int[][] GRAD={{1,0},{-1,0},{0,1},{0,-1},{1,1},{-1,1},{1,-1},{-1,-1}};
    static final int[] PALETTE={0x31A151,0xFFA71E,0x05084C,0xDE4638,0x3DBDB7};
    static int mix(int value) {
        value ^= value >>> 16; value *= 0x7feb352d;
        value ^= value >>> 15; value *= 0x846ca68b;
        return value ^ (value >>> 16);
    }
    static double dot(int seed,int i,int j,double x,double y) {
        int h=mix(mix(seed^i^0x9e3779b9)^j^0x85ebca6b);
        int[] g=GRAD[h&7]; return g[0]*x+g[1]*y;
    }
    static double fade(double t) { double a=t*t; double b=a*t; double c=t*6; double d=c-15; double e=t*d; double f=e+10; return b*f; }
    static double lerp(double a,double b,double t) { double difference=b-a; double product=t*difference; return a+product; }
    static double raw(int seed,double x,double y) {
        int i=(int)Math.floor(x),j=(int)Math.floor(y); double u=x-i,v=y-j;
        double a=dot(seed,i,j,u,v),b=dot(seed,i+1,j,u-1,v);
        double c=dot(seed,i,j+1,u,v-1),d=dot(seed,i+1,j+1,u-1,v-1);
        return lerp(lerp(a,b,fade(u)),lerp(c,d,fade(u)),fade(v));
    }
    static double field(int seed,double x,double y,int octaves) {
        double sum=0,weight=1,total=0;
        for(int k=0;k<octaves;k++) { sum+=weight*raw(seed,x,y); total+=weight; x*=2; y*=2; weight*=.5; }
        return Math.max(0,Math.min(1,.5+.5*(sum/total)));
    }
    static int colour(double phase) {
        double q=phase*PALETTE.length; int index=(int)Math.floor(q); double t=q-index;
        int a=PALETTE[index%PALETTE.length],b=PALETTE[(index+1)%PALETTE.length],rgb=0;
        for(int shift:new int[]{16,8,0}) {int c=(int)Math.floor(lerp((a>>shift)&255,(b>>shift)&255,t)+.5);rgb|=c<<shift;}
        return (180<<24)|rgb;
    }
    public static void main(String[] args) {
        if(args.length!=3)throw new IllegalArgumentException("octaves rotation output");
        int octaves=Integer.parseInt(args[0]); double angle=Math.toRadians(Double.parseDouble(args[1]));
        if(octaves!=1&&octaves!=4)throw new IllegalArgumentException("bounded experiment only");
        double cos=Math.cos(angle),sin=Math.sin(angle);
        Map<String,Object> params=new LinkedHashMap<>();
        params.put("origin",Arrays.asList(2,2));params.put("spacing",Arrays.asList(4,4));params.put("columns",160);params.put("rows",160);
        RegularGrid grid=RegularGrid.create(params); double[] p=new double[2];
        PGraphicsJava2D g=new PGraphicsJava2D();g.setParent(new PApplet());g.setSize(640,640);
        g.beginDraw();g.background(0xffece7da);g.strokeWeight(1);
        for(long i=0;i<grid.size();i++) {
            grid.pointInto(i,p,0); double x=p[0]*cos-p[1]*sin,y=p[0]*sin+p[1]*cos;
            double heading=4*Math.PI*field(42,17+x*.009,17+y*.009,octaves);
            double length=16*field(42,113+x*.013,113+y*.013,octaves);
            double phase=3*field(42,271+x*.007,271+y*.007,octaves);
            double dx=.5*length*Math.cos(heading),dy=.5*length*Math.sin(heading);
            g.stroke(colour(phase));g.line((float)(p[0]-dx),(float)(p[1]-dy),(float)(p[0]+dx),(float)(p[1]+dy));
        }
        g.endDraw();if(!g.save(args[2]))throw new AssertionError("save failed");g.dispose();
        System.out.println("Rendered "+grid.size()+" independent marks; octaves="+octaves);
    }
}
