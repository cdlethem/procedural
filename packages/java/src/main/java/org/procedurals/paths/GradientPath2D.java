package org.procedurals.paths;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.fields.GradientNoise2D01;

/**
 * Retained gradient-field movement, independently specified from motivating work
 * 2019/generativos/ciserp, 2018/Generativos/mantel, 2019/generativos/natalata,
 * and 2019/generativos/limo002. Contract: path.gradient-trace-2d 0.1.0.
 * No public artistic defaults or encouraged ranges are established by the measured
 * evidence. The reviewed private experiment uses 2000 steps of distance 0.4;
 * these values are examples, not recommended bounds or source reproduction.
 * Output uses O(steps) binary64 storage; traversal with pointInto allocates nothing.
 */
public strictfp final class GradientPath2D {
    public static final class PathException extends IllegalArgumentException {
        public final String code;
        public PathException(String code) { super(code); this.code=code; }
    }
    public static final class TraceException extends ArithmeticException {
        public final String code;
        public final int stepIndex;
        public final String stage;
        public TraceException(String code,int stepIndex,String stage) {
            super(code+" at step "+stepIndex+" ("+stage+")");
            this.code=code; this.stepIndex=stepIndex; this.stage=stage;
        }
    }
    private final GradientNoise2D01 field;
    private final int count;
    private final double startX,startY,distance,scale,offsetX,offsetY,base,angleScale;
    private final double[] positions,headings;
    private GradientPath2D(GradientNoise2D01 field,int count,double x,double y,
            double distance,double scale,double ox,double oy,double base,double angleScale) {
        this.field=field; this.count=count; startX=x; startY=y; this.distance=distance;
        this.scale=scale; offsetX=ox; offsetY=oy; this.base=base; this.angleScale=angleScale;
        positions=new double[2*(count+1)]; headings=new double[count];
        positions[0]=x; positions[1]=y;
        for(int i=0;i<count;i++) {
            double qx=x*scale; queryFinite(qx,i,"query_x"); qx=qx+ox; query(qx,i,"query_x");
            double qy=y*scale; queryFinite(qy,i,"query_y"); qy=qy+oy; query(qy,i,"query_y");
            double sample=field.sample(qx,qy);
            double mapped=angleScale*sample; arithmetic(mapped,i,"heading");
            double h=base+mapped; arithmetic(h,i,"heading"); h=zero(h);
            double cosine=Math.cos(h); double dx=distance*cosine; arithmetic(dx,i,"delta_x");
            double sine=Math.sin(h); double dy=distance*sine; arithmetic(dy,i,"delta_y");
            double nx=x+dx; arithmetic(nx,i,"position_x");
            double ny=y+dy; arithmetic(ny,i,"position_y");
            x=zero(nx); y=zero(ny);
            positions[2*(i+1)]=x; positions[2*(i+1)+1]=y; headings[i]=h;
        }
    }
    /** Validate configuration before allocating or querying; no partial path escapes. */
    public static GradientPath2D trace(Object config) {
        if(!(config instanceof Map)) throw new PathException("INVALID_INPUT");
        Map<?,?> p=(Map<?,?>)config;
        String[] keys={"field","start","steps","stepDistance","fieldScale","fieldOffset","angleBase","angleScale"};
        if(p.size()!=keys.length) throw new PathException("INVALID_INPUT");
        for(String key:keys) if(!p.containsKey(key)) throw new PathException("INVALID_INPUT");
        GradientNoise2D01 field;
        try { field=GradientNoise2D01.create(p.get("field")); }
        catch(GradientNoise2D01.NoiseException e) { throw new PathException("INVALID_INPUT"); }
        List<?> start=pair(p.get("start"));
        double x=number(start.get(0),"INVALID_INPUT"),y=number(start.get(1),"INVALID_INPUT");
        double n=number(p.get("steps"),"INVALID_INPUT");
        if(n<0 || n>1073741822 || n!=Math.floor(n)) throw new PathException("INVALID_INPUT");
        double distance=number(p.get("stepDistance"),"INVALID_INPUT");
        if(distance<0) throw new PathException("INVALID_INPUT");
        double scale=number(p.get("fieldScale"),"INVALID_INPUT");
        List<?> offset=pair(p.get("fieldOffset"));
        double ox=number(offset.get(0),"INVALID_INPUT"),oy=number(offset.get(1),"INVALID_INPUT");
        double base=number(p.get("angleBase"),"INVALID_INPUT");
        double angleScale=number(p.get("angleScale"),"INVALID_INPUT");
        return new GradientPath2D(field,(int)n,x,y,distance,scale,ox,oy,base,angleScale);
    }
    public int steps() { return count; }
    public double[] pointAt(Object index) { return pointAt(index(index)); }
    public double[] pointAt(long index) {
        int i=checked(index,false); return new double[]{positions[2*i],positions[2*i+1]};
    }
    public double headingAt(Object index) { return headingAt(index(index)); }
    public double headingAt(long index) { return headings[checked(index,true)]; }
    public void pointInto(Object index,double[] output,int offset) { pointInto(index(index),output,offset); }
    public void pointInto(long index,double[] output,int offset) {
        int i=checked(index,false);
        if(output==null || offset<0 || offset>output.length-2) throw new PathException("INVALID_OUTPUT");
        output[offset]=positions[2*i]; output[offset+1]=positions[2*i+1];
    }
    /** Detached configuration for explicit recomputation; never exposes internal storage. */
    public Map<String,Object> serialize() {
        Map<String,Object> result=new LinkedHashMap<String,Object>();
        result.put("field",field.serialize()); result.put("start",Arrays.asList(startX,startY));
        result.put("steps",count); result.put("stepDistance",distance); result.put("fieldScale",scale);
        result.put("fieldOffset",Arrays.asList(offsetX,offsetY)); result.put("angleBase",base);
        result.put("angleScale",angleScale); return result;
    }
    /** Explicit O(steps) materialization; failure leaves the retained path usable. */
    public Map<String,Object> toValues() {
        List<Object> points=new ArrayList<Object>(count+1);
        List<Double> angles=new ArrayList<Double>(count);
        for(int i=0;i<=count;i++) points.add(Arrays.asList(positions[2*i],positions[2*i+1]));
        for(double h:headings) angles.add(h);
        Map<String,Object> result=new LinkedHashMap<String,Object>();
        result.put("positions",points); result.put("headings",angles); return result;
    }
    private int checked(long index,boolean heading) {
        if(index<0 || index>9007199254740991L) throw new PathException("INVALID_INDEX");
        if(index>count || (heading && index==count)) throw new PathException("INDEX_OUT_OF_RANGE");
        return (int)index;
    }
    private static long index(Object value) {
        double n=number(value,"INVALID_INDEX");
        if(n<0 || n>9007199254740991L || n!=Math.floor(n)) throw new PathException("INVALID_INDEX");
        return (long)n;
    }
    private static List<?> pair(Object value) {
        if(!(value instanceof List) || ((List<?>)value).size()!=2) throw new PathException("INVALID_INPUT");
        return (List<?>)value;
    }
    private static double number(Object value,String code) {
        if(!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long || value instanceof Float || value instanceof Double)) throw new PathException(code);
        double n=((Number)value).doubleValue(); if(!finite(n)) throw new PathException(code); return zero(n);
    }
    private static boolean finite(double n) { return !Double.isNaN(n) && !Double.isInfinite(n); }
    private static double zero(double n) { return n==0 ? 0.0 : n; }
    private static void queryFinite(double n,int i,String stage) {
        if(!finite(n)) throw new TraceException("TRACE_QUERY_INVALID",i,stage);
    }
    private static void query(double n,int i,String stage) {
        if(!finite(n) || n < -9007199254740991L || n>=9007199254740991L) throw new TraceException("TRACE_QUERY_INVALID",i,stage);
    }
    private static void arithmetic(double n,int i,String stage) {
        if(!finite(n)) throw new TraceException("TRACE_ARITHMETIC_INVALID",i,stage);
    }
}
