from pathlib import Path
m32=(1<<32)-1;m64=(1<<64)-1
state=0;s=[]
for _ in range(2):
 state=(state+0x9e3779b97f4a7c15)&m64;z=state;z=((z^(z>>30))*0xbf58476d1ce4e5b9)&m64;z=((z^(z>>27))*0x94d049bb133111eb)&m64;z^=z>>31;s.extend([z&m32,z>>32])
def rot(x,k):return ((x<<k)|(x>>(32-k)))&m32
u=[]
for _ in range(48):
 u.append(((rot((s[1]*5)&m32,7)*9)&m32)/2**32);t=(s[1]<<9)&m32;s[2]^=s[0];s[3]^=s[1];s[1]^=s[2];s[0]^=s[3];s[2]^=t;s[3]=rot(s[3],11)
source='''import java.util.*;import org.procedurals.fields.GradientNoise2D01;
public class BandOracle {
static final double[] U={VALUES};
static final GradientNoise2D01 F=GradientNoise2D01.create(Collections.singletonMap("seed",177));
static double firstError;
static void run(String id,double scale,double tolerance,int attempts,double distance) {
 double x=320,y=320,h=0,level=F.sample(x*scale+7.3,y*scale+11.7); int accepted=0;
 StringJoiner p=new StringJoiner(",","["," ]"), headings=new StringJoiner(",","[", "]");p.add("[320.0,320.0]");
 StringJoiner decisions=new StringJoiner(",","[", "]");
 for(int i=0;i<attempts;i++) {
 double lo=(-0x1.921fb54442d18p0)*U[4*i],hi=0x1.921fb54442d18p0*U[4*i+1];
 double span=hi-lo,delta=span*U[4*i+2],turn=lo+delta,proposal=h+turn;
 double dx=distance*StrictMath.cos(proposal),nx=x+dx;
 double dy=distance*StrictMath.sin(proposal),ny=y+dy;
 double value=F.sample(nx*scale+7.3,ny*scale+11.7);
 double driftProduct=.2*U[4*i+3],drift=-.1+driftProduct,rejection=h+drift;
 double error=Math.abs(value-level);if(i==0)firstError=error;
 boolean ok=error<tolerance;decisions.add("{\\"error\\":"+error+",\\"accepted\\":"+ok+",\\"proposal\\":"+proposal+",\\"rejectionHeading\\":"+rejection+"}");
 if(ok){x=nx;y=ny;h=proposal;accepted++;p.add("["+x+","+y+"]");headings.add(Double.toString(h));}else h=rejection;
 }
 System.out.println("{\\"id\\":\\""+id+"\\",\\"scale\\":"+scale+",\\"tolerance\\":"+tolerance+",\\"distance\\":"+distance+",\\"output\\":{\\"positions\\":"+p+",\\"headings\\":"+headings+",\\"attempts\\":"+attempts+",\\"accepted\\":"+accepted+",\\"rejected\\":"+(attempts-accepted)+"},\\"decisions\\":"+decisions+"}");
}
public static void main(String[]args){run("constant",0,.002,4,1);run("mixed",.006,.002,12,1);run("stationary",0,.002,4,0);run("probe",.006,.002,1,1);double boundary=firstError;run("equal",.006,boundary,1,1);run("above",.006,Math.nextUp(boundary),1,1);}
}'''.replace('VALUES',','.join(repr(v) for v in u))
Path('.work/cp15-band-vectors/BandOracle.java').write_text(source)
Path('.work/cp15-band-vectors/uniforms.json').write_text(str(u))
