package org.procedurals.raster;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Focused ownership, carrier and checked-access tests for RasterRemap2D. */
public final class RasterRemapNative {
    private static int assertions;
    private interface Action { void run(); }
    private static void check(boolean value, String message) { assertions++; if (!value) throw new AssertionError(message); }
    private static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
    private static Map<String,Object> map(Object... values) { Map<String,Object> result = new LinkedHashMap<String,Object>(); for (int i=0;i<values.length;i+=2) result.put((String)values[i], values[i+1]); return result; }
    private static Map<String,Object> input(Object coordinate) { return map("source", map("width",2,"height",2,"pixels",list(0L,4294901760L,255L,305419896L)), "outputWidth",1,"outputHeight",1,"sourceCoordinates",list(coordinate)); }
    private static void invalid(Action action) { try { action.run(); throw new AssertionError("missing invalid"); } catch (RasterRemap2D.RasterRemapException error) { check("INVALID_INPUT".equals(error.code), "invalid code"); } }
    private static void access(Action action, String code) { try { action.run(); throw new AssertionError("missing access"); } catch (RasterRemap2D.RasterRemapException error) { check(code.equals(error.code), "access code"); } }
    private static void ownership() {
        List<Object> pixels = list(0L,4294901760L,255L,305419896L); List<Object> pair = list(0.5,0.5);
        Map<String,Object> config = map("source",map("width",2,"height",2,"pixels",pixels),"outputWidth",1,"outputHeight",1,"sourceCoordinates",list(pair));
        RasterRemap2D result=RasterRemap2D.remap(config); Map<String,Object> values=result.toValues(); pixels.set(0,99L); pair.set(0,1.0); config.clear(); check(result.toValues().equals(values),"object input detached");
        @SuppressWarnings("unchecked") List<Object> exported=(List<Object>)values.get("pixels"); exported.set(0,0L); check(!result.toValues().equals(values),"toValues deep detached");
        int[] copy=result.pixels(); copy[0]=0; check(result.pixelAt(0L)!=0,"pixels detached");
    }
    private static void typedOwnership() {
        int[] source = {0xff123456, 0x000000ff};
        double[] coordinates = {0, 0, 1, 0};
        RasterRemap2D result = RasterRemap2D.remap(2, 1, source, 2, 1, coordinates);
        source[0] = 0; coordinates[0] = 1;
        check(result.pixelAt(0L) == 0xff123456 && result.pixelAt(1L) == 0x000000ff,
              "typed input buffers detached");
    }
    private static void access() {
        RasterRemap2D result=RasterRemap2D.remap(2,2,new int[]{0,0,0,0},1,1,new double[]{0,0});
        access(()->result.pixelAt(Boolean.TRUE),"INVALID_INDEX"); access(()->result.pixelAt(-1L),"INVALID_INDEX"); check(result.pixelAt(-0.0)==0,"negative zero index accepted");
        access(()->result.pixelAt(9007199254740991L),"INDEX_OUT_OF_RANGE"); access(()->result.pixelAt(9007199254740992d),"INVALID_INDEX"); access(()->result.pixelAt(Long.MAX_VALUE),"INVALID_INDEX");
    }
    private static void invalidInputs() {
        invalid(()->RasterRemap2D.remap(input(list(0, Double.NaN))));
        invalid(()->RasterRemap2D.remap(input(list(0, Double.NEGATIVE_INFINITY))));
        invalid(()->RasterRemap2D.remap(0, 2, new int[0], 1, 1, new double[]{0, 0}));
        invalid(()->RasterRemap2D.remap(2147483647, 2, new int[0], 1, 1, new double[]{0, 0}));
        invalid(()->RasterRemap2D.remap(1, 1, new int[1], 1073741824, 1, new double[0]));
        invalid(()->RasterRemap2D.remap(2,2,null,1,1,new double[]{0,0})); invalid(()->RasterRemap2D.remap(2,2,new int[3],1,1,new double[]{0,0}));
        invalid(()->RasterRemap2D.remap(2,2,new int[4],1,1,null)); invalid(()->RasterRemap2D.remap(2,2,new int[4],1,1,new double[]{0})); invalid(()->RasterRemap2D.remap(2,2,new int[4],1,1,new double[]{0,Double.POSITIVE_INFINITY}));
        invalid(()->RasterRemap2D.remap(input(list(new BigInteger("1"),0)))); invalid(()->RasterRemap2D.remap(input(list(new BigDecimal("1"),0)))); invalid(()->RasterRemap2D.remap(input(list(new Number(){public int intValue(){return 0;}public long longValue(){return 0;}public float floatValue(){return 0;}public double doubleValue(){return 0;}} ,0))));
    }
    public static void main(String[] args) { ownership(); typedOwnership(); access(); invalidInputs(); System.out.println("{\"status\":\"passed\",\"assertions\":"+assertions+"}"); }
}
