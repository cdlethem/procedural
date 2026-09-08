import java.util.*;import org.procedurals.fields.GradientNoise2D01;
public class BandOracle {
static final double[] U={0.8702547766733915,0.601693955482915,0.6697971452958882,0.7651579391676933,0.3616586239077151,0.3783970079384744,0.759190633893013,0.641250972636044,0.6172660400625318,0.5829653574619442,0.7913701215293258,0.21161677478812635,0.495984198525548,0.7871705708093941,0.9042788534425199,0.916629797546193,0.8180336584337056,0.932465106016025,0.04456811770796776,0.20728135970421135,0.3457518760114908,0.8190646935254335,0.6288375523872674,0.6998372282832861,0.6056687671225518,0.6455541753675789,0.958301825914532,0.49650037731043994,0.5145662047434598,0.39442956796847284,0.5016636347863823,0.638093032175675,0.24913195916451514,0.9738310566172004,0.9159035282209516,0.362778706708923,0.08409904292784631,0.8761824383400381,0.6342218846548349,0.7069893905427307,0.9640441006049514,0.7648017634637654,0.10544830746948719,0.9016884840093553,0.8761687858495861,0.3789913465734571,0.37043645326048136,0.607770350528881};
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
 boolean ok=error<tolerance;decisions.add("{\"error\":"+error+",\"accepted\":"+ok+",\"proposal\":"+proposal+",\"rejectionHeading\":"+rejection+"}");
 if(ok){x=nx;y=ny;h=proposal;accepted++;p.add("["+x+","+y+"]");headings.add(Double.toString(h));}else h=rejection;
 }
 System.out.println("{\"id\":\""+id+"\",\"scale\":"+scale+",\"tolerance\":"+tolerance+",\"distance\":"+distance+",\"output\":{\"positions\":"+p+",\"headings\":"+headings+",\"attempts\":"+attempts+",\"accepted\":"+accepted+",\"rejected\":"+(attempts-accepted)+"},\"decisions\":"+decisions+"}");
}
public static void main(String[]args){run("constant",0,.002,4,1);run("mixed",.006,.002,12,1);run("stationary",0,.002,4,0);run("probe",.006,.002,1,1);double boundary=firstError;run("equal",.006,boundary,1,1);run("above",.006,Math.nextUp(boundary),1,1);}
}