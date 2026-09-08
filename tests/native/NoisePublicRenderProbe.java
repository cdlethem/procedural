import java.util.*;
import processing.core.PApplet;
import processing.awt.PGraphicsJava2D;
import org.procedurals.layout.RegularGrid;
import org.procedurals.fields.GradientNoise2D01;

/** Public grid/noise integration probe with private native drawing/palette arithmetic.
 * Matches the registered candidate design, not an upstream corpus baseline.
 */
public strictfp class NoisePublicRenderProbe {
    static final int[] PALETTE={0x31A151,0xFFA71E,0x05084C,0xDE4638,0x3DBDB7};
    static final GradientNoise2D01 FIELD=GradientNoise2D01.create(Collections.singletonMap("seed",42));
    static double field(int seed,double x,double y,int octaves) {
        if(seed!=42||octaves!=1)throw new IllegalArgumentException("registered single-octave probe only");
        return FIELD.sample(x,y);
    }
    static double lerp(double a,double b,double t) { double difference=b-a; double product=t*difference; return a+product; }
    static int colour(double phase) {
        double q=phase*PALETTE.length; int index=(int)Math.floor(q); double t=q-index;
        int a=PALETTE[index%PALETTE.length],b=PALETTE[(index+1)%PALETTE.length],rgb=0;
        for(int shift:new int[]{16,8,0}) {int c=(int)Math.floor(lerp((a>>shift)&255,(b>>shift)&255,t)+.5);rgb|=c<<shift;}
        return (180<<24)|rgb;
    }
    public static void main(String[] args) {
        if(args.length!=3)throw new IllegalArgumentException("octaves rotation output");
        int octaves=Integer.parseInt(args[0]); double angle=Math.toRadians(Double.parseDouble(args[1]));
        if(octaves!=1)throw new IllegalArgumentException("bounded experiment only");
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
