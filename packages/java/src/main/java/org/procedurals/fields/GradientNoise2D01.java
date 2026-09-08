package org.procedurals.fields;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pure single-octave scalar field, motivated by 2018/Generativos/pelines.
 * Independently specified algorithm; not Processing noise compatibility.
 * Seed is explicit unsigned32; no artistic default or encouraged parameter range
 * is established. Coordinates require exact-safe lower and upper lattice corners.
 * Contract: field.gradient-noise-2d-01 0.1.0. lowbias32 mixer provenance:
 * https://github.com/skeeto/hash-prospector (Unlicense); see THIRD_PARTY_NOTICES.md.
 */
public strictfp final class GradientNoise2D01 {
    public static final class NoiseException extends IllegalArgumentException {
        public final String code;
        public NoiseException(String code) { super(code); this.code=code; }
    }
    private static final int[][] GRAD={{1,0},{-1,0},{0,1},{0,-1},{1,1},{-1,1},{1,-1},{-1,-1}};
    private final int seed;
    private GradientNoise2D01(int seed) { this.seed=seed; }

    public static GradientNoise2D01 create(Object input) {
        if(!(input instanceof Map)) { fail("INVALID_INPUT"); return null; }
        Map<?,?> params=(Map<?,?>)input;
        if(params.size()!=1 || !params.containsKey("seed")) fail("INVALID_INPUT");
        double n=number(params.get("seed"),"INVALID_INPUT");
        if(n<0 || n>4294967295L || n!=Math.floor(n)) fail("INVALID_INPUT");
        return new GradientNoise2D01((int)(long)n);
    }
    public Map<String,Object> serialize() {
        Map<String,Object> result=new LinkedHashMap<String,Object>();
        result.put("seed",((long)seed)&0xffffffffL); return result;
    }
    /** Interchange tuple route; the two-scalar overload avoids query-array allocation. */
    public double sample(Object point) {
        if(!(point instanceof List) || ((List<?>)point).size()!=2) { fail("INVALID_QUERY"); return 0; }
        List<?> p=(List<?>)point; return sample(p.get(0),p.get(1));
    }
    public double sample(Object x,Object y) {
        double a=number(x,"INVALID_QUERY"); validate(a);
        double b=number(y,"INVALID_QUERY"); return sample(a,b);
    }
    /** No state consumption or query allocation; exact binary64 result in [0,1]. */
    public double sample(double x,double y) {
        validate(x); validate(y);
        long i=(long)Math.floor(x),j=(long)Math.floor(y);
        double u=x-(double)i,v=y-(double)j;
        double um=u-1,vm=v-1;
        double n00=dot(seed,i,j,u,v),n10=dot(seed,i+1,j,um,v);
        double n01=dot(seed,i,j+1,u,vm),n11=dot(seed,i+1,j+1,um,vm);
        double fx=fade(u),fy=fade(v);
        double bottom=lerp(n00,n10,fx),top=lerp(n01,n11,fx);
        double raw=lerp(bottom,top,fy),scaled=.5*raw,result=.5+scaled;
        if(result<=0) return 0.0;
        return result>=1 ? 1.0 : result;
    }
    static int mix(int v) {
        v^=v>>>16; v*=0x7feb352d; v^=v>>>15; v*=0x846ca68b; return v^(v>>>16);
    }
    static int corner(int seed,long i,long j) { return mix(mix(seed^(int)i^0x9e3779b9)^(int)j^0x85ebca6b); }
    private static double dot(int seed,long i,long j,double x,double y) {
        int[] g=GRAD[corner(seed,i,j)&7]; double px=g[0]*x,py=g[1]*y; return px+py;
    }
    private static double fade(double t) { double a=t*t,b=a*t,c=6*t,d=c-15,e=t*d,f=e+10; return b*f; }
    private static double lerp(double a,double b,double t) { double d=b-a,p=t*d; return a+p; }
    private static void validate(double q) {
        if(Double.isNaN(q) || Double.isInfinite(q) || q < -9007199254740991L || q>=9007199254740991L) fail("INVALID_QUERY");
    }
    private static double number(Object value,String error) {
        if(!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long || value instanceof Float || value instanceof Double)) { fail(error); return 0; }
        double n=((Number)value).doubleValue();
        if(Double.isNaN(n)||Double.isInfinite(n)) fail(error);
        return n;
    }
    private static void fail(String code) { throw new NoiseException(code); }
}
