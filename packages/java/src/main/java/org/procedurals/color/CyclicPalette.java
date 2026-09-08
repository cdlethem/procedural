package org.procedurals.color;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cyclic opaque encoded-sRGB8 interpolation, motivated by
 * 2018/Generativos/mountain4, 2018/Generativos/pelines and
 * 2017/Generativos/Cuadricula. Contract: color.cyclic-palette 0.1.0.
 * Phase is in cycles, a deliberate normalization of source entry coordinates.
 * No default palette, phase or encouraged artistic range is established.
 * RGB24 values are 0xRRGGBB; opacity and renderer conversion are caller concerns.
 * Independently specified, not Processing lerpColor compatibility.
 */
public strictfp final class CyclicPalette {
    public static final class PaletteException extends IllegalArgumentException {
        public final String code;
        public PaletteException(String code) { super(code); this.code=code; }
    }
    private final int[] colors;
    private CyclicPalette(int[] colors) { this.colors=colors; }

    public static CyclicPalette create(Object input) {
        if (!(input instanceof Map)) throw new PaletteException("INVALID_INPUT");
        Map<?,?> params=(Map<?,?>)input;
        if (params.size()!=1 || !params.containsKey("colors") || !(params.get("colors") instanceof List))
            throw new PaletteException("INVALID_INPUT");
        List<?> values=(List<?>)params.get("colors");
        if (values.isEmpty()) throw new PaletteException("INVALID_INPUT");
        int[] colors=new int[values.size()];
        int index=0;
        for (Object value:values) {
            double n=number(value,"INVALID_INPUT");
            if (n<0 || n>16777215 || n!=Math.floor(n)) throw new PaletteException("INVALID_INPUT");
            colors[index++]=(int)n;
        }
        return new CyclicPalette(colors);
    }

    public Map<String,Object> serialize() {
        List<Integer> values=new ArrayList<Integer>(colors.length);
        for (int color:colors) values.add(color);
        Map<String,Object> result=new LinkedHashMap<String,Object>();
        result.put("colors",values);
        return result;
    }

    public int sample(Object phase) { return sample(number(phase,"INVALID_QUERY")); }

    /** O(1) scalar query without query-container allocation or mutable state. */
    public int sample(double phase) {
        if (!Double.isFinite(phase)) throw new PaletteException("INVALID_QUERY");
        if (colors.length==1) return colors[0];
        double f=phase-Math.floor(phase);
        if (f==0 || f==1) f=0;
        double x=f*colors.length;
        if (x==colors.length) x=0;
        int i=(int)Math.floor(x);
        double t=x-i;
        int j=i+1==colors.length?0:i+1;
        int a=colors[i],b=colors[j];
        return channel((a>>>16)&255,(b>>>16)&255,t)*65536
            +channel((a>>>8)&255,(b>>>8)&255,t)*256
            +channel(a&255,b&255,t);
    }

    private static int channel(int a,int b,double t) {
        double d=b-a;
        double p=t*d;
        double v=a+p;
        return (int)Math.floor(v+0.5);
    }

    private static double number(Object value,String code) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double))
            throw new PaletteException(code);
        double n=((Number)value).doubleValue();
        if (!Double.isFinite(n)) throw new PaletteException(code);
        return n;
    }
}
