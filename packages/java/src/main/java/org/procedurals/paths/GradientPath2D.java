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
    /** Static configuration or indexed-access failure with a stable catalog error code. */
    public static final class PathException extends IllegalArgumentException {
        /** Stable code: {@code INVALID_INPUT}, {@code INVALID_INDEX}, {@code INDEX_OUT_OF_RANGE}, or {@code INVALID_OUTPUT}. */
        public final String code;
        /**
         * Creates a stable path failure.
         *
         * @param code catalog error code
         */
        public PathException(String code) { super(code); this.code=code; }
    }
    /** Dynamic trace arithmetic or field-query failure with the originating step and stage. */
    public static final class TraceException extends ArithmeticException {
        /** Stable dynamic code: {@code TRACE_QUERY_INVALID} or {@code TRACE_ARITHMETIC_INVALID}. */
        public final String code;
        /** Zero-based advance whose calculation failed. */
        public final int stepIndex;
        /** Calculation stage such as {@code query_x}, {@code heading}, or {@code position_y}. */
        public final String stage;
        /**
         * Creates a dynamic trace failure.
         *
         * @param code stable dynamic catalog error code
         * @param stepIndex zero-based failing advance
         * @param stage named failing calculation stage
         */
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
    /**
     * Eagerly traces a retained path from the complete passive interchange configuration.
     * {@code steps} counts advances, so the result has {@code steps + 1} positions and exactly
     * {@code steps} headings; heading {@code i} moves position {@code i} to {@code i + 1}.
     * Start and stepDistance use caller coordinate units; fieldScale is field lattice units per
     * caller coordinate unit (an inverse-length scale), and fieldOffset is a field lattice
     * coordinate pair. AngleBase and angleScale use radians. All configuration is copied, arrays
     * are owned by the path, and no public artistic defaults or recommended ranges exist.
     * Provenance and complete semantics are in {@code catalog/operations/gradient-path.json}.
     *
     * @param config exactly field, start, steps, stepDistance, fieldScale, fieldOffset,
     *        angleBase, and angleScale
     * @return retained immutable trace after all requested advances complete
     * @throws PathException for static input failure before output allocation or field sampling
     * @throws TraceException for a failing dynamic query or arithmetic stage; no partial path returns
     * @throws OutOfMemoryError when the host cannot allocate the requested retained trace
     */
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
    /**
     * Returns the number of advances and headings. It is one less than the retained position count.
     *
     * @return configured advance count
     */
    public int steps() { return count; }
    /**
     * Java-interchange overload for {@link #pointAt(long)}.
     *
     * @param index Byte, Short, Integer, Long, Float, or Double finite nonnegative safe-integer
     *        position index in {@code [0, steps]}
     * @return detached binary64 {@code [x,y]} pair in caller coordinate units
     * @throws PathException {@code INVALID_INDEX} before {@code INDEX_OUT_OF_RANGE}
     */
    public double[] pointAt(Object index) { return pointAt(index(index)); }
    /**
     * Returns a detached binary64 position pair. The endpoint at {@code steps()} is valid.
     *
     * @param index finite nonnegative safe-integer position index in {@code [0, steps]}
     * @return detached binary64 {@code [x,y]} pair in caller coordinate units
     * @throws PathException {@code INVALID_INDEX} before {@code INDEX_OUT_OF_RANGE}
     */
    public double[] pointAt(long index) {
        int i=checked(index,false); return new double[]{positions[2*i],positions[2*i+1]};
    }
    /**
     * Java-interchange overload for {@link #headingAt(long)}.
     *
     * @param index Byte, Short, Integer, Long, Float, or Double finite nonnegative safe-integer
     *        heading index in {@code [0, steps)}
     * @return heading in radians that drove the corresponding advance
     * @throws PathException {@code INVALID_INDEX} before {@code INDEX_OUT_OF_RANGE}
     */
    public double headingAt(Object index) { return headingAt(index(index)); }
    /**
     * Returns the retained heading in radians for one advance. Unlike position access, the final
     * endpoint has no heading and {@code index == steps()} is out of range.
     *
     * @param index finite nonnegative safe-integer heading index in {@code [0, steps)}
     * @return heading in radians that moved this position to the next
     * @throws PathException {@code INVALID_INDEX} before {@code INDEX_OUT_OF_RANGE}
     */
    public double headingAt(long index) { return headings[checked(index,true)]; }
    /**
     * Java-interchange overload for {@link #pointInto(long, double[], int)}.
     *
     * @param index Byte, Short, Integer, Long, Float, or Double finite nonnegative safe-integer
     *        position index in {@code [0, steps]}
     * @param output writable binary64 destination requiring two slots from {@code offset}
     * @param offset nonnegative first destination slot
     * @throws PathException indexed and destination failures in the long-overload order
     */
    public void pointInto(Object index,double[] output,int offset) { pointInto(index(index),output,offset); }
    /**
     * Writes one retained position after index, range, destination, and offset validation. It
     * never exposes internal storage and leaves the destination unchanged on any failure.
     *
     * @param index finite nonnegative safe-integer position index in {@code [0, steps]}
     * @param output writable binary64 destination requiring two slots from {@code offset}
     * @param offset nonnegative first destination slot
     * @throws PathException {@code INVALID_INDEX}, then {@code INDEX_OUT_OF_RANGE}, then
     *         {@code INVALID_OUTPUT}
     */
    public void pointInto(long index,double[] output,int offset) {
        int i=checked(index,false);
        if(output==null || offset<0 || offset>output.length-2) throw new PathException("INVALID_OUTPUT");
        output[offset]=positions[2*i]; output[offset+1]=positions[2*i+1];
    }
    /**
     * Returns detached canonical input configuration for explicit recomputation. It neither
     * resamples the field nor exposes retained positions/headings.
     *
     * @return detached complete input-schema map
     * @throws OutOfMemoryError when the host cannot allocate the detached map
     */
    public Map<String,Object> serialize() {
        Map<String,Object> result=new LinkedHashMap<String,Object>();
        result.put("field",field.serialize()); result.put("start",Arrays.asList(startX,startY));
        result.put("steps",count); result.put("stepDistance",distance); result.put("fieldScale",scale);
        result.put("fieldOffset",Arrays.asList(offsetX,offsetY)); result.put("angleBase",base);
        result.put("angleScale",angleScale); return result;
    }
    /**
     * Materializes detached output-schema values: {@code steps()+1} position pairs and
     * {@code steps()} headings. This is explicit O(steps) allocation; failure leaves the
     * retained path unchanged and usable.
     *
     * @return detached map containing {@code positions} and {@code headings}
     * @throws OutOfMemoryError when the host cannot materialize detached output
     */
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
