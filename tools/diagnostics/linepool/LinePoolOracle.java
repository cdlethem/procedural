import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Private, deliberately simple oracle for the draft seeded-line-pool contract.
 * It is not a package implementation and owns no Processing state.
 */
public final class LinePoolOracle {
  private static final double PI = 0x1.921fb54442d18p1;

  record Input(long seed, double x0, double y0, double x1, double y1,
               int attempts, double angleScale, double minimum, int maximum) {}
  record Segment(double x0, double y0, double x1, double y1, boolean divided) {}
  static final class Failure extends RuntimeException {
    final String type, stage;
    final int attempt, selectedIndex, childOrdinal;
    List<String> draws, selections;
    Failure(String type, int attempt, String stage, int selectedIndex, int childOrdinal) {
      this.type = type; this.attempt = attempt; this.stage = stage;
      this.selectedIndex = selectedIndex; this.childOrdinal = childOrdinal;
    }
  }
  static final class Result {
    final List<Segment> segments; final int attempts, cuts, skips;
    final List<String> draws, selections, firstChoices;
    Result(List<Segment> segments, int attempts, int cuts, int skips,
           List<String> draws, List<String> selections, List<String> firstChoices) {
      this.segments=segments; this.attempts=attempts; this.cuts=cuts; this.skips=skips;
      this.draws=draws; this.selections=selections; this.firstChoices=firstChoices;
    }
  }
  static final class Rng {
    int s0, s1, s2, s3;
    Rng(long seed) {
      long state = seed & 0xffffffffL;
      long q0 = split(state += 0x9e3779b97f4a7c15L);
      long q1 = split(state += 0x9e3779b97f4a7c15L);
      s0=(int)q0; s1=(int)(q0 >>> 32); s2=(int)q1; s3=(int)(q1 >>> 32);
    }
    private static long split(long z) {
      z = (z ^ (z >>> 30)) * 0xbf58476d1ce4e5b9L;
      z = (z ^ (z >>> 27)) * 0x94d049bb133111ebL;
      return z ^ (z >>> 31);
    }
    int next() {
      int out = Integer.rotateLeft(s1 * 5, 7) * 9;
      int t = s1 << 9;
      s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t; s3 = Integer.rotateLeft(s3, 11);
      return out;
    }
  }
  static final class Eval {
    final Rng rng; final List<String> draws = new ArrayList<>(), selections = new ArrayList<>(), firstChoices = new ArrayList<>();
    Eval(long seed) { rng = new Rng(seed); }
    double u(String label) {
      int word = rng.next();
      double u = Integer.toUnsignedLong(word) / 4294967296.0;
      draws.add("{\"label\":\""+label+"\",\"word\":\"0x"+String.format("%08x", word)+"\",\"uBits\":\""+bits(u)+"\"}");
      return u;
    }
    double r(double lo, double hi, String label) { return lo >= hi ? lo : lo + ((hi-lo)*u(label)); }
    double c(double value, int attempt, String stage) {
      if (!Double.isFinite(value)) { Failure f=new Failure("ARITHMETIC_OVERFLOW", attempt, stage, -1, -1); f.draws=draws; f.selections=selections; throw f; }
      return value;
    }
    double childC(double value, int attempt, String stage, int ordinal) {
      if (!Double.isFinite(value)) { Failure f=new Failure("ARITHMETIC_OVERFLOW", attempt, stage, -1, ordinal); f.draws=draws; f.selections=selections; throw f; }
      return value;
    }
  }
  static Result evaluate(Input in) {
    validate(in);
    List<Segment> pool = new ArrayList<>(); pool.add(new Segment(in.x0,in.y0,in.x1,in.y1,false));
    Eval e = new Eval(in.seed); int cuts=0, skips=0;
    for (int attempt=0; attempt<in.attempts; attempt++) {
      int size=pool.size();
      int index = Math.min(size-1, (int)Math.floor((e.u("selection") * size) * e.r(.8,1,"selectionBias")));
      e.selections.add("{\"attempt\":"+attempt+",\"index\":"+index+"}");
      Segment parent=pool.get(index); double sx=parent.x0, sy=parent.y0, ex=parent.x1, ey=parent.y1;
      double dx=e.c(ex-sx,attempt,"difference_x"), dy=e.c(ey-sy,attempt,"difference_y");
      double xx=e.c(dx*dx,attempt,"square_x"), yy=e.c(dy*dy,attempt,"square_y");
      double squared=e.c(xx+yy,attempt,"squared_length");
      double length=StrictMath.sqrt(squared), heading=StrictMath.atan2(dy,dx);
      if (length < in.minimum) { skips++; continue; }
      double fraction=e.r(e.r(.6,.7,"fractionLower"),e.r(0,.8,"fractionUpper"),"fraction");
      if (parent.divided) fraction = fraction*.4;
      double remainder=length*(1-fraction);
      List<Child> children=new ArrayList<>();
      if (!parent.divided) {
        double a=e.c(e.r(0,1.2,"positiveAngleA")*e.r(.2,1,"positiveAngleB")*in.angleScale,attempt,"spread_positive");
        double b=e.c(e.r(0,1.2,"negativeAngleA")*e.r(.2,1,"negativeAngleB")*in.angleScale,attempt,"spread_negative");
        e.u("unused");
        double l0=e.c(remainder*e.r(.9,1.2,"positiveLength"),attempt,"length_positive");
        double l1=e.c(remainder*e.r(.9,1.2,"negativeLength"),attempt,"length_negative");
        double l2=e.c(remainder*e.r(.9,1.2,"straightLength"),attempt,"length_straight");
        double h0=e.c(heading+a,attempt,"heading_positive");
        double h1=e.c(heading-b,attempt,"heading_negative");
        double h2=e.c(heading+e.r(-.1,.1,"straightHeading"),attempt,"heading_straight");
        int choice=Math.min(2,(int)Math.floor(3*e.u("firstChoice")));
        e.firstChoices.add("{\"attempt\":"+attempt+",\"choice\":"+choice+"}");
        if (choice==1) { children.add(new Child(h0,l0,false)); children.add(new Child(h1,l1,false)); }
        else if (choice==2) children.add(new Child(h2,l2,false));
      } else {
        double deviation=e.r(.1,.4,"repeatDeviation");
        double sign=e.u("repeatSign")<.5 ? -1 : 1; deviation=(deviation*sign)*2;
        double distance=e.c(remainder*e.r(.9,1.1,"repeatLength"),attempt,"length_repeat");
        double turn=e.c(heading+deviation,attempt,"heading_repeat");
        children.add(new Child(Double.NaN,Double.NaN,true)); children.add(new Child(turn,distance,false));
      }
      if (size+children.size()>in.maximum) {
        Failure f = new Failure("SEGMENT_LIMIT_EXCEEDED",attempt,null,index,-1);
        f.draws=e.draws; f.selections=e.selections; throw f;
      }
      double nx=e.c(sx+e.c(dx*fraction,attempt,"cut_delta_x"),attempt,"cut_x");
      double ny=e.c(sy+e.c(dy*fraction,attempt,"cut_delta_y"),attempt,"cut_y");
      List<Segment> prepared=new ArrayList<>();
      for (int ordinal=0;ordinal<children.size();ordinal++) {
        Child child=children.get(ordinal);
        if (child.continuation) prepared.add(new Segment(nx,ny,ex,ey,true));
        else {
          double cx=e.childC(nx+e.childC(StrictMath.cos(child.turn)*child.distance,attempt,"child_delta_x",ordinal),attempt,"child_x",ordinal);
          double cy=e.childC(ny+e.childC(StrictMath.sin(child.turn)*child.distance,attempt,"child_delta_y",ordinal),attempt,"child_y",ordinal);
          prepared.add(new Segment(nx,ny,cx,cy,false));
        }
      }
      pool.set(index,new Segment(sx,sy,nx,ny,true)); pool.addAll(prepared); cuts++;
    }
    return new Result(pool,in.attempts,cuts,skips,e.draws,e.selections,e.firstChoices);
  }
  record Child(double turn,double distance,boolean continuation) {}
  static void validate(Input x) {
    if (x.seed<0 || x.seed>0xffffffffL || x.attempts<0 || x.minimum<=0 || x.maximum<1 || x.maximum>536870911 ||
        !Double.isFinite(x.x0)||!Double.isFinite(x.y0)||!Double.isFinite(x.x1)||!Double.isFinite(x.y1)||
        !Double.isFinite(x.angleScale)||x.angleScale<0||!Double.isFinite(x.minimum))
      throw new Failure("INVALID_INPUT",-1,null,-1,-1);
  }
  static String bits(double x) { return String.format("0x%016x", Double.doubleToRawLongBits(x==0.0 ? 0.0 : x)); }
  static String quote(String s) { return "\""+s+"\""; }
  static String resultJson(String name, Input in) {
    StringBuilder b=new StringBuilder("{\"name\":"+quote(name)+",\"input\":{");
    b.append("\"seed\":").append(in.seed).append(",\"segmentBits\":[").append(quote(bits(in.x0))).append(',').append(quote(bits(in.y0))).append(',').append(quote(bits(in.x1))).append(',').append(quote(bits(in.y1))).append("],\"attempts\":").append(in.attempts).append(",\"angleScaleBits\":").append(quote(bits(in.angleScale))).append(",\"minimumBits\":").append(quote(bits(in.minimum))).append(",\"maximum\":").append(in.maximum).append("}");
    try { Result r=evaluate(in); b.append(",\"outcome\":\"success\",\"attempts\":").append(r.attempts).append(",\"successfulCuts\":").append(r.cuts).append(",\"skips\":").append(r.skips).append(",\"selections\":").append(r.selections).append(",\"firstChoices\":").append(r.firstChoices).append(",\"draws\":").append(r.draws).append(",\"segments\":[");
      for(int i=0;i<r.segments.size();i++){if(i>0)b.append(','); Segment s=r.segments.get(i); b.append("{\"bits\":[").append(quote(bits(s.x0))).append(',').append(quote(bits(s.y0))).append(',').append(quote(bits(s.x1))).append(',').append(quote(bits(s.y1))).append("],\"divided\":").append(s.divided).append('}');} b.append(']');
    } catch(Failure f) { b.append(",\"outcome\":\"error\",\"error\":{\"type\":").append(quote(f.type)); if(f.attempt>=0)b.append(",\"attempt\":").append(f.attempt); if(f.stage!=null)b.append(",\"stage\":").append(quote(f.stage)); if(f.selectedIndex>=0)b.append(",\"selectedIndex\":").append(f.selectedIndex); if(f.childOrdinal>=0)b.append(",\"childOrdinal\":").append(f.childOrdinal); b.append("}"); if(f.selections!=null)b.append(",\"selections\":").append(f.selections); if(f.draws!=null)b.append(",\"draws\":").append(f.draws); }
    return b.append('}').toString();
  }
  static long seedForChoice(int wanted) {
    for(long seed=0;seed<1_000_000;seed++) {
      Result r=evaluate(new Input(seed,0,0,10,0,1,1,.01,3));
      if(r.firstChoices.size()==1 && r.firstChoices.get(0).equals("{\"attempt\":0,\"choice\":"+wanted+"}")) return seed;
    }
    throw new AssertionError();
  }
  static long seedForRevisit() { for(long seed=0;seed<1_000_000;seed++) { try { Result r=evaluate(new Input(seed,0,0,10,0,3,1,0.01,20)); if(r.selections.size()==3 && r.selections.get(1).contains("\"index\":0")) return seed; } catch(Failure ignored) {} } throw new AssertionError(); }
  static long seedForSpreadOverflow() {
    for(long seed=0;seed<1_000_000;seed++) try {
      evaluate(new Input(seed,0,0,10,0,1,Double.MAX_VALUE,.01,4));
    } catch(Failure f) { if ("spread_positive".equals(f.stage) || "spread_negative".equals(f.stage)) return seed; }
    throw new AssertionError("no bounded spread-overflow seed");
  }
  static void assertChoiceCase(long seed, int choice, int size) {
    Result r=evaluate(new Input(seed,0,0,10,0,1,1,.01,3));
    if (r.firstChoices.size()!=1 || !r.firstChoices.get(0).equals("{\"attempt\":0,\"choice\":"+choice+"}") || r.segments.size()!=size)
      throw new AssertionError("choice case did not prove requested topology");
  }
  static void crosscheckManualCases() {
    Result z=evaluate(new Input(42,0,0,1,0,0,1.4,4,1));
    Result shortRoot=evaluate(new Input(42,0,0,1,0,3,1.4,4,1));
    Result zeroRoot=evaluate(new Input(42,2,3,2,3,2,1.4,4,1));
    Result extremeZero=evaluate(new Input(42,-1e308,0,1e308,0,0,1.4,4,1));
    Result underflow=evaluate(new Input(42,0,0,1e-200,0,1,1.4,1e-210,1));
    if(z.cuts!=0 || shortRoot.skips!=3 || zeroRoot.skips!=2 || extremeZero.segments.size()!=1 || underflow.skips!=1)
      throw new AssertionError("manual success/skip crosscheck failed");
    expectStage(new Input(42,-1e308,0,1e308,0,1,1.4,4,1),"difference_x");
    expectStage(new Input(42,0,0,1e200,0,1,1.4,4,1),"square_x");
    expectStage(new Input(42,0,0,1e154,1e154,1,1.4,4,1),"squared_length");
  }
  static void expectStage(Input in, String stage) { try { evaluate(in); throw new AssertionError("missing "+stage); } catch(Failure f) { if(!stage.equals(f.stage)) throw new AssertionError("expected "+stage+" got "+f.stage); } }
  public static void main(String[] args) throws IOException {
    long c0=seedForChoice(0), c1=seedForChoice(1), c2=seedForChoice(2), revisit=seedForRevisit(), spread=seedForSpreadOverflow();
    assertChoiceCase(c0,0,1); assertChoiceCase(c1,1,3); assertChoiceCase(c2,2,2);
    crosscheckManualCases();
    List<String> cases=new ArrayList<>();
    cases.add(resultJson("zero_work",new Input(0,-0.0,0,1,-0.0,0,1,1,4)));
    cases.add(resultJson("short_root",new Input(0,0,0,1,0,1,1,2,4)));
    cases.add(resultJson("equal_threshold_root",new Input(c0,0,0,1,0,1,1,1,1)));
    cases.add(resultJson("first_selection_0",new Input(c0,0,0,10,0,1,1,.01,3)));
    cases.add(resultJson("first_selection_1",new Input(c1,0,0,10,0,1,1,.01,3)));
    cases.add(resultJson("first_selection_2",new Input(c2,0,0,10,0,1,1,.01,3)));
    cases.add(resultJson("revisit",new Input(revisit,0,0,10,0,3,1,.01,20)));
    cases.add(resultJson("capacity_one_zero_child",new Input(c0,0,0,10,0,1,1,.01,1)));
    cases.add(resultJson("capacity_one_append_failure",new Input(c1,0,0,10,0,1,1,.01,1)));
    cases.add(resultJson("difference_overflow",new Input(0,-Double.MAX_VALUE,0,Double.MAX_VALUE,0,1,1,.01,4)));
    cases.add(resultJson("spread_overflow",new Input(spread,0,0,10,0,1,Double.MAX_VALUE,.01,4)));
    String json="{\"oracle\":\"LinePoolOracle.java private independent StrictMath object-list evaluator\",\"contract\":\"topology.seeded-line-pool-2d draft 0.1.0\",\"caseSeeds\":{\"choice0\":"+c0+",\"choice1\":"+c1+",\"choice2\":"+c2+",\"revisit\":"+revisit+",\"spreadOverflow\":"+spread+"},\"manualFixtureCrosscheck\":\"passed: all 8 root-derived expectations\",\"cases\":["+String.join(",",cases)+"]}\n";
    Path out=Path.of(args.length==0 ? ".work/diagnostics/line-pool/oracle-cases-corrected.json" : args[0]); Files.createDirectories(out.getParent()); Files.writeString(out,json);
  }
}
