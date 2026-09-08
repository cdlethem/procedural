import java.io.File;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PConstants;

/**
 * Private CP3 placement experiment. This independently specified diagnostic is not a
 * package API, source reconstruction, catalog entry, or native target support claim.
 * Its render branch runs a private JAVA2D mechanism experiment.
 */
public strictfp final class SpacingChoice {
  private static final int WIDTH=640, HEIGHT=640, ATTEMPTS=5000;
  private static final double ORIGIN_X=64.0, ORIGIN_Y=64.0, DOMAIN_W=512.0, DOMAIN_H=512.0;
  private static final double MIN_R=4.0, MAX_R=64.0, SMALL_MAX_R=32.0;
  private static final int[] PALETTE={0x31A151,0xFFA71E,0x05084C,0xDE4638,0x3DBDB7};
  private static final int BACKGROUND=0xECE7DA;
  private static final long U32_DENOMINATOR=4294967296L;
  private static final int WARMUPS=1, REPS=3;

  private SpacingChoice() {}

  private static final class Digest {
    final MessageDigest value;
    Digest() { try { value=MessageDigest.getInstance("SHA-256"); } catch(NoSuchAlgorithmException e) { throw new AssertionError(e); } }
    void text(String v) { value.update(v.getBytes(StandardCharsets.UTF_8)); value.update((byte)0); }
    void integer(int v) { value.update((byte)(v>>>24));value.update((byte)(v>>>16));value.update((byte)(v>>>8));value.update((byte)v); }
    void longValue(long v) { for(int s=56;s>=0;s-=8)value.update((byte)(v>>>s)); }
    void bits(double v) { longValue(Double.doubleToRawLongBits(v)); }
    String finish() { byte[] b=value.digest(); StringBuilder r=new StringBuilder(64); for(byte x:b)r.append(String.format("%02x",x&255));return r.toString(); }
  }

  /** SplitMix64 startup only; every operation intentionally wraps in Java long. */
  private static final class Xoshiro128ss11 {
    int s0,s1,s2,s3;
    Xoshiro128ss11(long seed) {
      long x=seed & 0xffffffffL;
      long first=splitMixNext(x); x+=0x9e3779b97f4a7c15L;
      long second=splitMixNext(x);
      s0=(int)first; s1=(int)(first>>>32); s2=(int)second; s3=(int)(second>>>32);
      if((s0|s1|s2|s3)==0)throw new AssertionError("SplitMix64 produced unreachable all-zero xoshiro state");
    }
    private static long splitMixNext(long x) {
      long z=x+0x9e3779b97f4a7c15L;
      z=(z^(z>>>30))*0xbf58476d1ce4e5b9L;
      z=(z^(z>>>27))*0x94d049bb133111ebL;
      return z^(z>>>31);
    }
    int nextInt() {
      int result=Integer.rotateLeft(s1*5,7)*9;
      int t=s1<<9;
      s2^=s0; s3^=s1; s1^=s2; s0^=s3;
      s2^=t; s3=Integer.rotateLeft(s3,11);
      return result;
    }
    double unit() { return ((double)Integer.toUnsignedLong(nextInt()))/(double)U32_DENOMINATOR; }
    String stateJson() { return "["+u32(s0)+","+u32(s1)+","+u32(s2)+","+u32(s3)+"]"; }
  }

  /** Retained packed accepted placements only: no seeded all-proposal carrier exists. */
  private static final class Circles {
    double[] x=new double[32],y=new double[32],r=new double[32]; int[] source=new int[32]; int size;
    void add(double px,double py,double pr,int index) {
      if(size==x.length)grow(); x[size]=px;y[size]=py;r[size]=pr;source[size++]=index;
    }
    private void grow() { int n=x.length*2; double[] nx=new double[n],ny=new double[n],nr=new double[n];int[] ni=new int[n];System.arraycopy(x,0,nx,0,size);System.arraycopy(y,0,ny,0,size);System.arraycopy(r,0,nr,0,size);System.arraycopy(source,0,ni,0,size);x=nx;y=ny;r=nr;source=ni; }
    long rawBytes() { return (long)size*(Double.BYTES*3+Integer.BYTES); }
    long allocatedBytes() { return (long)x.length*(Double.BYTES*3+Integer.BYTES); }
  }
  private static final class ProposalList {
    double[] x,y,r; int[] source; int size;
    ProposalList(int n) { x=new double[n];y=new double[n];r=new double[n];source=new int[n]; }
    void add(double px,double py,double pr,int index) { x[size]=px;y[size]=py;r[size]=pr;source[size++]=index; }
  }
  private static final class Result {
    final String id; final Circles circles; final long attempts,comparisons,draws;
    final String proposalHash,centreHash,geometryHash,finalRngState;
    Result(String id,Circles c,long a,long comparisons,long draws,String p,String centres,String finalRngState) {
      this.id=id;circles=c;attempts=a;this.comparisons=comparisons;this.draws=draws;proposalHash=p;centreHash=centres;geometryHash=geometry(c);this.finalRngState=finalRngState;
    }
  }

  private static void finite(double v,String stage) { if(!Double.isFinite(v))throw new IllegalArgumentException("non-finite "+stage); }
  private static void finiteConfig(double... values) { for(double value:values)finite(value,"configuration"); }
  private static boolean accept(Circles kept,double px,double py,double pr,double scale,long[] comparisons) {
    finite(px,"candidate x");finite(py,"candidate y");finite(pr,"candidate radius");finite(scale,"separation scale");
    for(int i=0;i<kept.size;i++) {
      double dx=px-kept.x[i]; finite(dx,"dx"); double dy=py-kept.y[i]; finite(dy,"dy");
      double squared=dx*dx; finite(squared,"dx squared"); double ySquared=dy*dy; finite(ySquared,"dy squared"); squared=squared+ySquared; finite(squared,"distance squared");
      double sum=pr+kept.r[i]; finite(sum,"radius sum"); double limit=sum*scale; finite(limit,"separation limit"); double limitSquared=limit*limit; finite(limitSquared,"separation limit squared");
      comparisons[0]++;
      if(squared<limitSquared)return false; // equality is accepted.
    }
    return true;
  }
  private static double radius(double min,double max,double u,double v) {
    double span=max-min; finite(span,"radius span"); double first=span*u; finite(first,"radius u product"); double second=first*v; finite(second,"radius uv product"); double result=second+min; finite(result,"radius"); return result;
  }
  private static Result seeded(String id,long seed,int attempts,double maxRadius,double separation) {
    finiteConfig(ORIGIN_X,ORIGIN_Y,DOMAIN_W,DOMAIN_H,MIN_R,maxRadius,separation);
    if(attempts<0 || minInvalid(maxRadius))throw new IllegalArgumentException("invalid seeded profile");
    Xoshiro128ss11 rng=new Xoshiro128ss11(seed); Circles kept=new Circles(); long[] compares={0L}; Digest proposals=new Digest(), centres=new Digest();
    for(int index=0;index<attempts;index++) {
      double ux=rng.unit(),uy=rng.unit(),u=rng.unit(),v=rng.unit();
      double xProduct=DOMAIN_W*ux; finite(xProduct,"x product"); double px=ORIGIN_X+xProduct; finite(px,"x");
      double yProduct=DOMAIN_H*uy; finite(yProduct,"y product"); double py=ORIGIN_Y+yProduct; finite(py,"y");
      double pr=radius(MIN_R,maxRadius,u,v);
      proposals.bits(px);proposals.bits(py);proposals.bits(pr);
      centres.bits(px);centres.bits(py);
      if(accept(kept,px,py,pr,separation,compares))kept.add(px,py,pr,index);
    }
    return new Result(id,kept,attempts,compares[0],(long)attempts*4L,proposals.finish(),centres.finish(),rng.stateJson());
  }
  private static boolean minInvalid(double max) { return !Double.isFinite(max)||max<MIN_R; }
  private static Result filter(String id,ProposalList input,double separation) {
    finiteConfig(separation);Circles kept=new Circles();long[] compares={0L};Digest proposals=new Digest(),centres=new Digest();
    for(int i=0;i<input.size;i++) {
      double px=input.x[i],py=input.y[i],pr=input.r[i]; finite(px,"explicit x");finite(py,"explicit y");finite(pr,"explicit radius");
      proposals.bits(px);proposals.bits(py);proposals.bits(pr);centres.bits(px);centres.bits(py);
      if(accept(kept,px,py,pr,separation,compares))kept.add(px,py,pr,input.source[i]);
    }
    return new Result(id,kept,input.size,compares[0],0L,proposals.finish(),centres.finish(),null);
  }
  private static ProposalList radial() {
    ProposalList values=new ProposalList(160);int index=0;
    for(int band=0;band<5;band++) { double radius=48.0*(band+1);double phase=band*Math.PI/32.0;
      for(int point=0;point<32;point++,index++) { double angle=phase+(2.0*Math.PI*point)/32.0;double x=320.0+radius*Math.cos(angle);double y=320.0+radius*Math.sin(angle);values.add(x,y,new double[]{8.0,14.0,20.0}[index%3],index); }
    }
    return values;
  }
  private static String geometry(Circles c) { Digest d=new Digest();d.text("cp3-retained-circles-v1");d.integer(c.size);for(int i=0;i<c.size;i++){d.integer(c.source[i]);d.bits(c.x[i]);d.bits(c.y[i]);d.bits(c.r[i]);}return d.finish(); }
  private static String colours(Circles c) { Digest d=new Digest();d.text("cp3-source-index-palette-v1");d.integer(c.size);for(int i=0;i<c.size;i++){d.integer(c.source[i]);d.integer(PALETTE[Math.floorMod(c.source[i],PALETTE.length)]);}return d.finish(); }
  private static String commands(Circles c,boolean diamonds) { Digest d=new Digest();d.text(diamonds?"cp3-diamond-v1":"cp3-ring-v1");d.integer(c.size);int segments=diamonds?4:64;
    for(int i=0;i<c.size;i++){d.integer(c.source[i]);d.integer(PALETTE[Math.floorMod(c.source[i],PALETTE.length)]);for(int j=0;j<segments;j++){double a=(2.0*Math.PI*j)/segments;double x=c.x[i]+c.r[i]*Math.cos(a),y=c.y[i]+c.r[i]*Math.sin(a);finite(x,"command x");finite(y,"command y");d.bits(x);d.bits(y);}}return d.finish(); }
  private static boolean same(Circles a,Circles b) { if(a.size!=b.size)return false;for(int i=0;i<a.size;i++)if(a.source[i]!=b.source[i]||Double.doubleToRawLongBits(a.x[i])!=Double.doubleToRawLongBits(b.x[i])||Double.doubleToRawLongBits(a.y[i])!=Double.doubleToRawLongBits(b.y[i])||Double.doubleToRawLongBits(a.r[i])!=Double.doubleToRawLongBits(b.r[i]))return false;return true; }
  private static void require(boolean condition,String message){if(!condition)throw new AssertionError(message);}
  private static String u32(int value){return Long.toUnsignedString(Integer.toUnsignedLong(value));}
  private static String quote(String value){return "\""+value.replace("\\","\\\\").replace("\"","\\\"")+"\"";}
  /** This schema is shared verbatim by --numeric profiles and one-case render reports. */
  private static String profile(String id,Result r,boolean diamonds) { return "{\"id\":"+quote(id)+",\"attempts\":"+r.attempts+",\"accepted_count\":"+r.circles.size+",\"comparisons\":"+r.comparisons+",\"unit_draws\":"+r.draws+",\"retained_raw_bytes\":"+r.circles.rawBytes()+",\"candidate_sha256\":"+quote(r.proposalHash)+",\"centres_sha256\":"+quote(r.centreHash)+",\"accepted_sha256\":"+quote(r.geometryHash)+",\"colour_sha256\":"+quote(colours(r.circles))+",\"palette_assignment\":\"source_index_modulo_5\",\"render_vertex_conversion\":\"binary64 model expressions cast to Java float at vertex submission\",\"model_vertex_sha256\":"+quote(commands(r.circles,diamonds))+",\"motif\":"+quote(diamonds?"diamond-4":"ring-64")+(r.finalRngState==null?"":",\"final_rng_state\":"+r.finalRngState)+"}"; }
  private static String vectors() { long[] seeds={0L,1L,42L,2147483648L,4294967295L};StringBuilder out=new StringBuilder("[");
    for(int s=0;s<seeds.length;s++){if(s>0)out.append(',');Xoshiro128ss11 rng=new Xoshiro128ss11(seeds[s]);out.append("{\"seed\":").append(seeds[s]).append(",\"initial_state\":").append(rng.stateJson()).append(",\"outputs\":[");for(int i=0;i<10;i++){if(i>0)out.append(',');int value=rng.nextInt();out.append("{\"u32\":").append(u32(value)).append(",\"state\":").append(rng.stateJson()).append('}');}out.append("]}");}return out.append(']').toString(); }
  private static String prefixCheck() { Result shortRun=seeded("prefix-5000",42L,5000,MAX_R,1.0),longRun=seeded("prefix-10000",42L,10000,MAX_R,1.0);require(shortRun.circles.size<=longRun.circles.size,"prefix count");for(int i=0;i<shortRun.circles.size;i++){require(shortRun.circles.source[i]==longRun.circles.source[i],"prefix source");require(Double.doubleToRawLongBits(shortRun.circles.x[i])==Double.doubleToRawLongBits(longRun.circles.x[i]),"prefix x");require(Double.doubleToRawLongBits(shortRun.circles.y[i])==Double.doubleToRawLongBits(longRun.circles.y[i]),"prefix y");require(Double.doubleToRawLongBits(shortRun.circles.r[i])==Double.doubleToRawLongBits(longRun.circles.r[i]),"prefix radius");}return "{\"prefix_5000_of_10000\":true,\"accepted_5000\":"+shortRun.circles.size+",\"accepted_10000\":"+longRun.circles.size+"}"; }
  private static String analyticChecks() { ProposalList tangent=new ProposalList(3);tangent.add(0,0,10,0);tangent.add(20,0,10,1);tangent.add(19.999,0,10,2);Result equal=filter("tangent",tangent,1.0);require(equal.circles.size==2&&equal.circles.source[1]==1,"tangent equality accepted");ProposalList bigFirst=new ProposalList(2);bigFirst.add(0,0,10,0);bigFirst.add(12,0,4,1);ProposalList smallFirst=new ProposalList(2);smallFirst.add(12,0,4,1);smallFirst.add(0,0,10,0);Result a=filter("big-first",bigFirst,1.0),b=filter("small-first",smallFirst,1.0);require(a.circles.source[0]==0&&b.circles.source[0]==1,"proposal order observable");return "{\"tangent_equality_accepted\":true,\"strict_overlap_rejected\":true,\"order_changes_retained_source\":true}"; }
  private static String timing(int attempts) { for(int i=0;i<WARMUPS;i++)seeded("timing",42L,attempts,MAX_R,1.0);long total=0,sink=0;Result last=null;for(int i=0;i<REPS;i++){long start=System.nanoTime();last=seeded("timing",42L,attempts,MAX_R,1.0);total+=System.nanoTime()-start;sink^=last.circles.size^last.comparisons;}if(sink==Long.MIN_VALUE||last==null)throw new AssertionError("timing sink");return "{\"attempts\":"+attempts+",\"warmups\":"+WARMUPS+",\"repetitions\":"+REPS+",\"total_nanos\":"+total+",\"mean_nanos\":"+(total/REPS)+",\"last_accepted_count\":"+last.circles.size+",\"last_comparisons\":"+last.comparisons+",\"last_retained_raw_bytes\":"+last.circles.rawBytes()+",\"last_retained_capacity_payload_bytes\":"+last.circles.allocatedBytes()+",\"workload\":\"seeded proposal generation, ordered acceptance, and SHA-256 proposal/centre/accepted summaries\"}"; }
  private static void numeric() {
    Result base=seeded("base-rings",42L,ATTEMPTS,MAX_R,1.0);Result separated=seeded("more-separation",42L,ATTEMPTS,MAX_R,1.2);Result smaller=seeded("smaller-forms",42L,ATTEMPTS,SMALL_MAX_R,1.0);Result radial=filter("authored-radial",radial(),1.0);
    require(base.proposalHash.equals(separated.proposalHash),"separation proposal reuse");require(base.centreHash.equals(separated.centreHash),"separation centre reuse");require(base.centreHash.equals(smaller.centreHash),"small max retains centre proposals");
    String beforeMotifs=geometry(base.circles),beforeColours=colours(base.circles);String ringCommands=commands(base.circles,false);String diamondCommands=commands(base.circles,true);String afterMotifs=geometry(base.circles),afterColours=colours(base.circles);
    require(beforeMotifs.equals(afterMotifs),"ring/diamond command generation mutated retained circles");require(beforeColours.equals(afterColours),"ring/diamond command generation changed source-index colours");require(!ringCommands.equals(diamondCommands),"motifs must differ");
    String prefix=prefixCheck(),analytic=analyticChecks();
    String json="{\"status\":\"passed\",\"experiment\":\"cp3-placement\",\"private_only\":true,\"streams\":{\"algorithm\":\"xoshiro128** 1.1\",\"initialization\":\"uint32 seed; two SplitMix64 outputs low32/high32\",\"unit\":\"uint32/2^32 [0,1)\",\"provenance\":\"design/capabilities/cp3-rng-options.md; project-defined scalar initialization, not corpus/Processing compatibility\",\"seed_vectors\":"+vectors()+"},\"profiles\":{\"base-rings\":"+profile("base-rings",base,false)+",\"more-separation\":"+profile("more-separation",separated,false)+",\"smaller-forms\":"+profile("smaller-forms",smaller,false)+",\"diamonds\":"+profile("diamonds",base,true)+",\"authored-radial\":"+profile("authored-radial",radial,false)+"},\"relationships\":{\"same_candidate_hash_base_separation\":true,\"same_candidate_hash_base_diamond\":true,\"same_centres_base_smaller\":true,\"same_centres_base_diamond\":true,\"motif_shared_object_numeric_only\":true,\"same_geometry_base_diamond\":true,\"same_colours_base_diamond\":true},\"numeric_prefix\":"+prefix+",\"analytic\":"+analytic+",\"timing_observations\":["+timing(5000)+","+timing(200000)+"],\"rendering\":\"dormant; root single-executor approval required\"}";
    System.out.println(json);
  }
  private static Result caseResult(String id){if("base-rings".equals(id))return seeded(id,42L,ATTEMPTS,MAX_R,1.0);if("more-separation".equals(id))return seeded(id,42L,ATTEMPTS,MAX_R,1.2);if("smaller-forms".equals(id))return seeded(id,42L,ATTEMPTS,SMALL_MAX_R,1.0);if("authored-radial".equals(id))return filter(id,radial(),1.0);if("diamonds".equals(id))return seeded(id,42L,ATTEMPTS,MAX_R,1.0);throw new IllegalArgumentException("unknown render case");}
  private static void render(String id,String output){
    if(!new File(output).isAbsolute())throw new IllegalArgumentException("output path must be absolute");
    Result value=caseResult(id);boolean diamonds="diamonds".equals(id);String before=profile(id,value,diamonds);String beforeAccepted=geometry(value.circles);
    PApplet host=new PApplet();host.noLoop();PGraphicsJava2D graphics=new PGraphicsJava2D();graphics.setParent(host);graphics.setPrimary(false);graphics.pixelDensity=1;graphics.setSize(WIDTH,HEIGHT);boolean saved=false;
    try{graphics.beginDraw();graphics.background((BACKGROUND>>>16)&255,(BACKGROUND>>>8)&255,BACKGROUND&255);graphics.noFill();graphics.strokeWeight(1);graphics.strokeCap(PConstants.ROUND);graphics.strokeJoin(PConstants.ROUND);int count=diamonds?4:64;for(int i=0;i<value.circles.size;i++){int rgb=PALETTE[Math.floorMod(value.circles.source[i],PALETTE.length)];graphics.stroke((rgb>>>16)&255,(rgb>>>8)&255,rgb&255);graphics.beginShape();for(int j=0;j<count;j++){double a=2.0*Math.PI*j/count;graphics.vertex((float)(value.circles.x[i]+value.circles.r[i]*Math.cos(a)),(float)(value.circles.y[i]+value.circles.r[i]*Math.sin(a)));}graphics.endShape(PConstants.CLOSE);}graphics.endDraw();if(saved)throw new AssertionError("save already called");saved=graphics.save(output);if(!saved)throw new AssertionError("save failed");}finally{graphics.dispose();}
    String after=profile(id,value,diamonds);String afterAccepted=geometry(value.circles);require(before.equals(after),"render mutated accepted placements");require(beforeAccepted.equals(afterAccepted),"render mutated accepted geometry");
    System.out.println("{\"status\":\"rendered\",\"case\":"+quote(id)+",\"output\":"+quote(output)+",\"profile\":"+before+",\"before_accepted_sha256\":"+quote(beforeAccepted)+",\"after_accepted_sha256\":"+quote(afterAccepted)+"}");
  }
  public static void main(String[] args){if(args.length==1&&"--numeric".equals(args[0])){numeric();return;}if(args.length==2){render(args[0],args[1]);return;}throw new IllegalArgumentException("usage: SpacingChoice --numeric | SpacingChoice <registered-case> <absolute-output.png>");}
}
