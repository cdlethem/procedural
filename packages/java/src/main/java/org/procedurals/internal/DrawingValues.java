package org.procedurals.internal;

import java.math.BigInteger;
import java.util.*;

/** Internal pure drawing.fresh-raster-2d v0.1.0 validation, not a renderer.
 * Motivated by survey/out/2018/Generativos/pelines/notes.md and
 * survey/out/2019/generativos/ciserp/notes.md. Bounds are engineering policy,
 * not measured artistic recommendations. Returned values are detached.
 */
public strictfp final class DrawingValues {
    private DrawingValues() {}
    public static final class DrawingError extends IllegalArgumentException {
        public final String code;
        DrawingError(String code) { super(code); this.code=code; }
    }
    private static DrawingError fail(String code) { return new DrawingError(code); }
    private static double number(Object value,String code) {
        if (value==null) throw fail(code);
        Class<?> type=value.getClass();
        // Passive standard numeric carriers only; never invoke arbitrary Number
        // subclass conversion code. BigInteger represents Python-sized integers.
        if (type!=Byte.class && type!=Short.class && type!=Integer.class && type!=Long.class &&
            type!=Float.class && type!=Double.class && type!=BigInteger.class) throw fail(code);
        double n=((Number)value).doubleValue();
        if (!Double.isFinite(n)) throw fail(code);
        return n==0 ? 0.0 : n;
    }
    private static int integer(Object value,int low,int high,String code) {
        double n=number(value,code);
        if (n!=Math.floor(n) || n<low || n>high) throw fail(code);
        return (int)n;
    }
    private static Map<?,?> record(Object value,String code,String... keys) {
        if (!(value instanceof Map)) throw fail(code);
        Map<?,?> m=(Map<?,?>)value;
        if (!m.keySet().equals(new HashSet<String>(Arrays.asList(keys)))) throw fail(code);
        return m;
    }
    public static Map<String,Object> validateEnvironment(Object value) {
        String code="INVALID_ENVIRONMENT";
        Map<?,?> m=record(value,code,"width","height","density","background");
        Map<String,Object> out=new LinkedHashMap<String,Object>();
        out.put("width",integer(m.get("width"),1,2048,code));
        out.put("height",integer(m.get("height"),1,2048,code));
        out.put("density",integer(m.get("density"),1,1,code));
        out.put("background",integer(m.get("background"),0,16777215,code));
        return out;
    }
    private static double[] point(Object value) {
        if (!(value instanceof List) || ((List<?>)value).size()!=2) throw fail("INVALID_COMMAND");
        List<?> p=(List<?>)value;
        return new double[]{number(p.get(0),"INVALID_COMMAND"),number(p.get(1),"INVALID_COMMAND")};
    }
    /** Exact represented-binary64 predicate; inputs must already be finite. */
    public static boolean strictlyConvex(double[][] points) {
        BigInteger[] mantissas=new BigInteger[8];
        int[] exponents=new int[8];
        int minimum=0;
        for (int i=0;i<8;i++) {
            long bits=Double.doubleToRawLongBits(points[i/2][i%2]);
            int e=(int)((bits>>>52)&2047);
            long m=bits&0xfffffffffffffL;
            if (e!=0) m|=1L<<52;
            int exponent=m==0 ? 0 : e==0 ? -1074 : e-1075;
            mantissas[i]=BigInteger.valueOf(bits<0 ? -m : m);
            exponents[i]=exponent; minimum=Math.min(minimum,exponent);
        }
        for (int i=0;i<8;i++) mantissas[i]=mantissas[i].shiftLeft(exponents[i]-minimum);
        int sign=0;
        for (int i=0;i<4;i++) {
            int a=2*i,b=2*((i+1)%4),c=2*((i+2)%4);
            BigInteger dx=mantissas[b].subtract(mantissas[a]);
            BigInteger dy=mantissas[b+1].subtract(mantissas[a+1]);
            BigInteger ex=mantissas[c].subtract(mantissas[a]);
            BigInteger ey=mantissas[c+1].subtract(mantissas[a+1]);
            int turn=dx.multiply(ey).subtract(dy.multiply(ex)).signum();
            if (turn==0 || (sign!=0 && turn!=sign)) return false;
            sign=turn;
        }
        return true;
    }
    public static double binary32(double value) {
        float result=(float)value;
        if (!Float.isFinite(result)) throw fail("INVALID_COMMAND");
        return result==0 ? 0.0 : (double)result;
    }
    /** Environment must already have passed validateEnvironment at frame begin. */
    public static Map<String,Object> normalizeCommand(Object value,Map<String,Object> environment) {
        String code="INVALID_COMMAND";
        if (!(value instanceof Map)) throw fail(code);
        Object kind=((Map<?,?>)value).get("kind");
        boolean segment="segment2".equals(kind);
        Map<?,?> command;
        double[][] points;
        double width=0;
        if (segment) {
            command=record(value,code,"kind","from","to","rgb","opacity8","width","cap");
            if (!"round".equals(command.get("cap"))) throw fail(code);
            points=new double[][]{point(command.get("from")),point(command.get("to"))};
            width=number(command.get("width"),code);
            if (width<=0) throw fail(code);
        } else if ("quad2".equals(kind)) {
            command=record(value,code,"kind","vertices","rgb","opacity8");
            Object vertices=command.get("vertices");
            if (!(vertices instanceof List) || ((List<?>)vertices).size()!=4) throw fail(code);
            points=new double[4][];
            for (int i=0;i<4;i++) points[i]=point(((List<?>)vertices).get(i));
        } else throw fail(code);
        int rgb=integer(command.get("rgb"),0,16777215,code);
        int opacity=integer(command.get("opacity8"),0,255,code);
        if (segment ? Arrays.equals(points[0],points[1]) : !strictlyConvex(points)) throw fail(code);
        for (double[] p:points) { p[0]=binary32(p[0]); p[1]=binary32(p[1]); }
        if (segment) width=binary32(width);
        int w=((Number)environment.get("width")).intValue(),h=((Number)environment.get("height")).intValue();
        int margin=Math.max(w,h);
        for (double[] p:points) if (p[0]<-margin || p[0]>w+margin || p[1]<-margin || p[1]>h+margin) throw fail(code);
        if (segment && (width<1.0/256 || width>margin)) throw fail(code);
        if (!segment && !strictlyConvex(points)) throw fail(code);
        List<Object> converted=new ArrayList<Object>();
        for (double[] p:points) converted.add(new ArrayList<Double>(Arrays.asList(p[0],p[1])));
        Map<String,Object> out=new LinkedHashMap<String,Object>();
        out.put("outcome",segment && Arrays.equals(points[0],points[1]) ? "noop" : "emit");
        out.put("kind",kind);out.put("points",converted);out.put("rgb",rgb);
        out.put("channels",new ArrayList<Integer>(Arrays.asList((rgb>>>16)&255,(rgb>>>8)&255,rgb&255)));
        out.put("opacity8",opacity);out.put("alpha64",opacity/255.0);
        if (segment) { out.put("width",width);out.put("cap","round"); }
        return out;
    }
}
