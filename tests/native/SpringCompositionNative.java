import org.procedurals.examples.springmarks.SpringComposition;
import org.procedurals.motion.TargetSprings2D;
import java.util.*;

/** Headless workflow checks; does not validate the future PDE or rendered appearance. */
public final class SpringCompositionNative {
  static int checks;
  static void check(boolean condition,String why) {checks++;if(!condition)throw new AssertionError(why);}
  static void exact(double[] a,double[] b,String why) {check(Arrays.equals(a,b),why);}
  static double[] targets(SpringComposition c) {
    double[] result=new double[c.motion().size()*2];
    for(int i=0;i<c.motion().size();i++)c.targetInto(i,result,i*2);
    return result;
  }
  static double[] positions(SpringComposition c) {
    double[] result=new double[c.motion().size()*2];
    for(int i=0;i<c.motion().size();i++)c.motion().positionInto((long)i,result,i*2);
    return result;
  }
  static double[] velocities(SpringComposition c) {
    double[] result=new double[c.motion().size()*2];
    for(int i=0;i<c.motion().size();i++)c.motion().velocityInto((long)i,result,i*2);
    return result;
  }
  public static void main(String[] args) {
    SpringComposition c=new SpringComposition();Object mesh=c.mesh();
    check(c.motion().size()==49,"49 regular sites");
    Object initial=c.motion().toValues();
    c.disturb();check(initial.equals(c.motion().toValues()),"disturb does not step");
    check(c.tick()==0&&c.sampleCount()==1,"disturb preserves history/tick");
    check(!Arrays.equals(targets(c),positions(c)),"disturb changes targets");
    c.reset();
    List<Object> states=new ArrayList<Object>();
    List<double[]> points=new ArrayList<double[]>(), goals=new ArrayList<double[]>();
    for(int tick=0;tick<=260;tick++) {
      if(tick==0||tick==140)c.disturb();
      states.add(c.motion().toValues());points.add(positions(c));goals.add(targets(c));
      int samples=Math.min(tick+1,121);
      check(c.tick()==tick&&c.sampleCount()==samples,"bounded history tick");
      check(c.oldestTick()==tick-samples+1,"oldest mapping");
      for(int sample=0;sample<samples;sample++) {
        double[] found=new double[98];
        for(int body=0;body<49;body++)c.historyInto(sample,body,found,body*2);
        exact(points.get(tick-samples+1+sample),found,"chronological history");
      }
      if(tick<260)c.step();
    }
    c.reset();check(c.mesh()==mesh,"reset retains initial connectivity");
    for(int tick=0;tick<=260;tick++) {
      if(tick==0||tick==140)c.disturb();
      check(states.get(tick).equals(c.motion().toValues()),"exact continuing replay");
      exact(goals.get(tick),targets(c),"exact target replay");
      if(tick<260)c.step();
    }
    double[] beforePosition=positions(c),beforeVelocity=velocities(c),beforeTargets=targets(c);
    long beforeTick=c.tick();TargetSprings2D previous=c.motion();
    c.response(0.05,0.9);
    check(c.motion()!=previous,"coefficient edit imports independent batch");
    exact(beforePosition,positions(c),"coefficient edit preserves positions");
    exact(beforeVelocity,velocities(c),"coefficient edit preserves velocities");
    exact(beforeTargets,targets(c),"coefficient edit preserves targets");
    check(c.tick()==beforeTick&&c.mesh()==mesh&&c.sampleCount()==121,"retains timeline and topology");
    for(int body=0;body<49;body++) {
      check(c.motion().strengthAt((long)body)==0.05&&c.motion().retentionAt((long)body)==0.9,"new response");
      c.motion().positionAt((long)body);c.motion().velocityAt((long)body);
    }
    exact(beforePosition,positions(c),"reads never step");
    TargetSprings2D changed=c.motion();
    try {c.response(-1,0.7);throw new AssertionError("invalid response accepted");}
    catch(TargetSprings2D.SpringException e){check(e.code.equals("INVALID_INPUT"),"response rejection");}
    check(c.motion()==changed,"failed coefficient import preserves batch");
    double[] point=new double[2],origin=new double[2];
    for(int vertex=0;vertex<c.mesh().vertexCount();vertex++) {
      c.mesh().pointInto((long)vertex,point,0);c.initialInto(c.bodyForVertex(vertex),origin,0);
      exact(point,origin,"canonical vertex maps to original spring");
    }
    c.reset();check(initial.equals(c.motion().toValues()),"reset restores initial coefficients and state");
    System.out.println("{\"status\":\"passed\",\"assertions\":"+checks+",\"replay_ticks\":261}");
  }
}
