package org.procedurals.examples.springmarks;

import java.util.*;
import org.procedurals.layout.RegularGrid;
import org.procedurals.motion.TargetSprings2D;
import org.procedurals.topology.Delaunay2D;

/**
 * Editable target policy, bounded trails and fixed-connectivity transfer for SpringMarks.
 * The spring recurrence is motivated by survey/out/2018/Generativos/araniaaas/notes.md;
 * this regular layout and local target impulse are authored composition choices.
 * Constants here are example settings, not library defaults or encouraged ranges.
 */
public final strictfp class SpringComposition {
    private static final int HISTORY = 121;
    private final double[] initial;
    private final double[] targets;
    private final double[] nextTargets;
    private final double[][] history;
    private final Delaunay2D mesh;
    private final Map<String,Object> initialState;
    private TargetSprings2D motion;
    private long tick;
    private int newest;
    private int samples;

    public SpringComposition() {
        RegularGrid grid=RegularGrid.create(record("origin",pair(128,128),
            "spacing",pair(64,64),"columns",7,"rows",7));
        int count=(int)grid.size();
        initial=new double[count*2];targets=new double[count*2];nextTargets=new double[count*2];
        history=new double[HISTORY][count*2];
        List<Object> bodies=new ArrayList<Object>(count), sites=new ArrayList<Object>(count);
        for(int i=0;i<count;i++) {
            grid.pointInto((long)i,initial,i*2);
            List<Object> point=pair(initial[i*2],initial[i*2+1]);
            sites.add(point);
            bodies.add(record("position",point,"velocity",pair(0,0),"strength",0.025d,"retention",0.7d));
        }
        initialState=record("bodies",bodies);
        mesh=Delaunay2D.triangulate(record("points",sites,"maxWork",50000000L));
        reset();
    }

    /** Restore motion and example history without rebuilding initial connectivity. */
    public void reset() {
        motion=TargetSprings2D.create(initialState);
        System.arraycopy(initial,0,targets,0,initial.length);
        tick=0;newest=0;samples=1;
        System.arraycopy(initial,0,history[0],0,initial.length);
    }

    /** Change only the targets. Calling this at rest does not itself run a tick. */
    public void disturb() {
        for(int i=0;i<targets.length;i+=2) {
            double dx=initial[i]-320,dy=initial[i+1]-320;
            double distance=StrictMath.sqrt(dx*dx+dy*dy);
            if(distance<200) {
                double weight=1-distance/200;
                targets[i]+=80*weight;targets[i+1]-=40*weight;
            }
        }
    }

    /** One explicit return-policy update, spring step and completed history sample. */
    public void step() {
        if(tick==Long.MAX_VALUE) throw new IllegalStateException("example tick counter exhausted");
        for(int i=0;i<targets.length;i++) nextTargets[i]=targets[i]+(initial[i]-targets[i])*0.04;
        // If the core fails, targets, tick and history remain at the previous sample.
        motion.step(nextTargets);
        System.arraycopy(nextTargets,0,targets,0,targets.length);
        tick++;
        newest=(newest+1)%HISTORY;
        if(samples<HISTORY)samples++;
        for(int i=0;i<motion.size();i++)motion.positionInto((long)i,history[newest],i*2);
    }

    /** Replace coefficients through the same detached state route available to artists. */
    public void response(double strength,double retention) {
        Map<String,Object> state=motion.toValues();
        for(Object value:(List<?>)state.get("bodies")) {
            @SuppressWarnings("unchecked") Map<String,Object> body=(Map<String,Object>)value;
            body.put("strength",strength);body.put("retention",retention);
        }
        TargetSprings2D replacement=TargetSprings2D.create(state);
        motion=replacement;
    }

    public TargetSprings2D motion() {return motion;}
    public Delaunay2D mesh() {return mesh;}
    public long tick() {return tick;}
    public int sampleCount() {return samples;}
    public long oldestTick() {return tick-samples+1;}

    public void initialInto(int body,double[] output,int offset) {
        checkBody(body);checkOutput(output,offset);
        output[offset]=initial[body*2];output[offset+1]=initial[body*2+1];
    }
    public void targetInto(int body,double[] output,int offset) {
        checkBody(body);checkOutput(output,offset);
        output[offset]=targets[body*2];output[offset+1]=targets[body*2+1];
    }
    /** Sample0 is oldest, sampleCount-1 is current; never join newest back to oldest. */
    public void historyInto(int sample,int body,double[] output,int offset) {
        if(sample<0||sample>=samples)throw new IndexOutOfBoundsException("sample");
        checkBody(body);checkOutput(output,offset);
        int slot=(newest-samples+1+HISTORY+sample)%HISTORY;
        output[offset]=history[slot][body*2];output[offset+1]=history[slot][body*2+1];
    }
    /** Convert a canonical mesh vertex to its original spring body explicitly. */
    public int bodyForVertex(int vertex) {return mesh.sourceIndexAt((long)vertex);}

    private void checkBody(int body) {
        if(body<0||body>=motion.size())throw new IndexOutOfBoundsException("body");
    }
    private static void checkOutput(double[] output,int offset) {
        if(output==null||offset<0||offset>output.length-2)throw new IllegalArgumentException("output pair");
    }
    private static List<Object> pair(double x,double y) {
        return new ArrayList<Object>(Arrays.<Object>asList(x,y));
    }
    private static Map<String,Object> record(Object... values) {
        Map<String,Object> result=new LinkedHashMap<String,Object>();
        for(int i=0;i<values.length;i+=2)result.put((String)values[i],values[i+1]);
        return result;
    }
}
