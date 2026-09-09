package org.procedurals.fields;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

/** Focused carrier, ownership, query purity and actual workload checks. */
public final class Noise3DNative {
    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static Map<String,Object> config(Object seed) {
        Map<String,Object> result=new LinkedHashMap<String,Object>(); result.put("seed",seed); return result;
    }
    private static void error(String code, Runnable action) {
        try { action.run(); throw new AssertionError("missing "+code); }
        catch (GradientNoise3D01.NoiseException expected) { require(expected.code.equals(code),"error code"); }
    }
    private static void ownershipAndCarriers() {
        GradientNoise3D01 reference=GradientNoise3D01.create(2);
        double scalar=reference.sample(.2,.3,.4);
        for(Object seed:new Object[]{(byte)2,(short)2,2,2L,2.0f,2.0})
            require(GradientNoise3D01.create(config(seed)).sample(.2,.3,.4)==scalar,"boxed seed");
        for(Object q:new Object[]{(byte)2,(short)2,2,2L,2.0f,2.0})
            require(reference.sample(q,q,q)==.5,"boxed query");
        Number custom=new Number() {
            public int intValue(){return 2;} public long longValue(){return 2;}
            public float floatValue(){return 2;} public double doubleValue(){return 2;}
        };
        for(Object bad:new Object[]{null,true,"2",BigInteger.valueOf(2),custom,
                Double.NaN,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY,Long.MAX_VALUE}) {
            error("INVALID_INPUT",()->GradientNoise3D01.create(config(bad)));
            error("INVALID_QUERY",()->reference.sample(bad,0,0));
            error("INVALID_QUERY",()->reference.sample(0,bad,0));
            error("INVALID_QUERY",()->reference.sample(0,0,bad));
        }
        error("INVALID_INPUT",()->GradientNoise3D01.create(-1L));
        error("INVALID_INPUT",()->GradientNoise3D01.create(4294967296L));
        error("INVALID_INPUT",()->GradientNoise3D01.create((Object)null));
        Map<String,Object> input=config(2);
        GradientNoise3D01 owned=GradientNoise3D01.create(input); input.put("seed",3);
        Map<String,Object> exported=owned.serialize();exported.clear();
        require(owned.sample(.2,.3,.4)==scalar,"input/output ownership");
        require(owned.serialize().get("seed").equals(2L),"seed snapshot");
        Object tuple=Arrays.asList(.2,.3,.4);
        require(owned.sample(tuple)==scalar,"tuple unchanged");
    }
    private static void purityAndPeriod() {
        GradientNoise3D01 field=GradientNoise3D01.create(42);
        double[][] points={{.25,.5,.75},{-.25,1.5,-2.75},{.1,.2,.3},{-5e-324,0,.5}};
        double[] values=new double[points.length];
        for(int i=0;i<points.length;i++) values[i]=field.sample(points[i][0],points[i][1],points[i][2]);
        for(int i=points.length-1;i>=0;i--) require(values[i]==field.sample(points[i][0],points[i][1],points[i][2]),"reordered samples");
        for(int axis=0;axis<3;axis++) {
            double[] p={.25,.5,.75};p[axis]+=4294967296.0;
            require(field.sample(p[0],p[1],p[2])==values[0],"represented lattice period");
        }
        require(field.sample(.25,.5,.75)!=field.sample(.25,.5,1.75),"depth affects field");
        require(GradientNoise3D01.create(0).serialize().equals(GradientNoise3D01.create(config(-0.0)).serialize()),"seed zero normalization");
    }
    private static long traverse(GradientNoise3D01 field,int count) {
        long sum=0xcbf29ce484222325L;
        for(int i=0;i<count;i++) {
            double value=field.sample((i%1000)*.013,(i/1000)*.017,(i%17)*.071);
            require(Double.isFinite(value)&&value>=0&&value<=1,"bounded sample");
            sum=(sum^Double.doubleToRawLongBits(value))*0x100000001b3L;
        }
        return sum;
    }
    public static void main(String[] args) {
        ownershipAndCarriers();purityAndPeriod();
        GradientNoise3D01 field=GradientNoise3D01.create(42);
        for(int i=0;i<5;i++) traverse(field,20000);
        StringBuilder output=new StringBuilder("{\"status\":\"passed\",\"warmup_runs\":5,\"warmup_queries\":20000,\"workloads\":[");
        int[] sizes={1,250000,1000000};
        for(int i=0;i<sizes.length;i++) {
            long start=System.nanoTime();long checksum=traverse(field,sizes[i]);long elapsed=System.nanoTime()-start;
            if(i>0)output.append(',');
            output.append("{\"queries\":").append(sizes[i]).append(",\"elapsed_ns\":").append(elapsed)
                .append(",\"checksum\":\"").append(Long.toUnsignedString(checksum)).append("\"}");
        }
        System.out.println(output.append("]}"));
    }
}
