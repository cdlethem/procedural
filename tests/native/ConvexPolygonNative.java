package org.procedurals.sampling;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.lang.management.ManagementFactory;

/** Focused native checks for ordered convex polygon placement ownership and geometry. */
public final class ConvexPolygonNative {
    private static int checks;
    private interface Action { void run(); }
    private static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
    private static Map<String,Object> map(Object... values) { Map<String,Object> m=new LinkedHashMap<String,Object>(); for(int i=0;i<values.length;i+=2)m.put((String)values[i],values[i+1]); return m; }
    private static void check(boolean ok,String message){checks++;if(!ok)throw new AssertionError(message);}
    private static void error(String code,int index,Action action){try{action.run();throw new AssertionError("missing "+code);}catch(ConvexPolygonPlacements2D.PlacementException e){check(code.equals(e.code)&&e.candidateIndex==index,"wrong error");}}
    private static double[][] square(double x,double y,double size){return new double[][]{{x,y},{x+size,y},{x+size,y+size},{x,y+size}};}
    private static void geometry(){
        double[][][] input={square(0,0,2),square(1,0,2),square(5,0,2)};
        ConvexPolygonPlacements2D typed=ConvexPolygonPlacements2D.filter(input);
        check(typed.size()==2&&typed.attempts()==3,"greedy order"); check(typed.sourceIndexAt(1)==2,"source index");
        check(typed.vertexCountAt(0)==4&&typed.xAt(0,1)==2&&typed.yAt(0,1)==0,"accessors");
        ConvexPolygonPlacements2D object=ConvexPolygonPlacements2D.filter(map("polygons",list(list(list(0,0),list(2,0),list(2,2),list(0,2)))));
        check(object.size()==1&&object.xAt(0,0)==0,"object route");
        input[0][0][0]=999;
        input[2]=square(999,999,3);
        check(typed.xAt(0,0)==0 && typed.xAt(1,0)==5,"typed input deeply detached");
        List<Object> inputPoint=list(0,0);
        List<Object> inputPolygon=list(inputPoint,list(1,0),list(0,1));
        List<Object> inputPolygons=list(inputPolygon);
        ConvexPolygonPlacements2D fromList=ConvexPolygonPlacements2D.filter(map("polygons",inputPolygons));
        inputPoint.set(0,99); inputPolygon.clear(); inputPolygons.clear();
        check(fromList.xAt(0,0)==0 && fromList.vertexCountAt(0)==3,"object input deeply detached");
        Map<String,Object> untouched=object.toValues();
        Map<String,Object> values=object.toValues();
        List<Object> outputPolygons=(List<Object>)values.get("polygons");
        List<Object> outputVertices=(List<Object>)outputPolygons.get(0);
        List<Object> outputPoint=(List<Object>)outputVertices.get(0);
        outputPoint.set(0,99.0); outputPoint.add(7.0); outputPoint.remove(2);
        outputVertices.set(0,list(9.0,9.0)); outputVertices.add(list(3.0,3.0)); outputVertices.remove(outputVertices.size()-1);
        outputPolygons.add(list()); outputPolygons.remove(outputPolygons.size()-1);
        ((List<Object>)values.get("sourceIndices")).set(0,99);
        check(object.size()==1 && object.xAt(0,0)==0 && object.sourceIndexAt(0)==0
            && object.toValues().equals(untouched),"all output levels detached");
        double[][][] reverse={{{0,0},{0,2},{2,2},{2,0}}}; check(ConvexPolygonPlacements2D.filter(reverse).size()==1,"reverse winding");
        error("INDEX_OUT_OF_RANGE",-1,new Action(){public void run(){object.sourceIndexAt(-1);}});
        error("INDEX_OUT_OF_RANGE",-1,new Action(){public void run(){object.xAt(0,4);}});
        error("INDEX_OUT_OF_RANGE",-1,new Action(){public void run(){object.yAt(Long.MAX_VALUE,0);}});
        error("INDEX_OUT_OF_RANGE",-1,new Action(){public void run(){object.xAt(0,Long.MIN_VALUE);}});
    }
    private static void validation(){
        error("INVALID_INPUT",-1,new Action(){public void run(){ConvexPolygonPlacements2D.filter(map("polygons",list(),"extra",1));}});
        error("INVALID_INPUT",0,new Action(){public void run(){ConvexPolygonPlacements2D.filter(new double[][][]{{{0,0},{1,0}}});}});
        error("INVALID_POLYGON",0,new Action(){public void run(){ConvexPolygonPlacements2D.filter(new double[][][]{{{0,0},{1,0},{2,0}}});}});
        error("INVALID_POLYGON",0,new Action(){public void run(){ConvexPolygonPlacements2D.filter(new double[][][]{{{0,0},{2,2},{0,2},{2,0}}});}});
        error("INVALID_INPUT",0,new Action(){public void run(){ConvexPolygonPlacements2D.filter(map("polygons",list(list(list(true,0),list(1,0),list(0,1)))));}});
        error("INVALID_POLYGON",0,new Action(){public void run(){ConvexPolygonPlacements2D.filter(new double[][][]{{{0,0},{1,0},{0,1},{0,0}}});}});
        error("INVALID_INPUT",0,new Action(){public void run(){ConvexPolygonPlacements2D.filter(new double[][][]{{{0,0},{1,0},{0,Double.NaN}}});}});
        error("INVALID_INPUT",-1,new Action(){public void run(){ConvexPolygonPlacements2D.filter(map("polygons",new java.util.AbstractList<Object>(){
            public int size(){return 357913942;} public Object get(int i){throw new AssertionError("oversize proposals read");}
        }));}});
        error("INVALID_INPUT",0,new Action(){public void run(){ConvexPolygonPlacements2D.filter(map("polygons",list(new java.util.AbstractList<Object>(){
            public int size(){return 1073741824;} public Object get(int i){throw new AssertionError("oversize vertices read");}
        })));}});
        Object[] carriers={Byte.valueOf((byte)0),Short.valueOf((short)0),Integer.valueOf(0),Long.valueOf(0),Float.valueOf(0),Double.valueOf(0)};
        for(final Object carrier:carriers) {
            ConvexPolygonPlacements2D placement=ConvexPolygonPlacements2D.filter(map("polygons",list(list(list(carrier,0),list(1,0),list(0,1)))));
            check(placement.size()==1,"numeric carrier");
        }
        Object[] rejected={null,true,"0",java.math.BigInteger.ZERO,java.math.BigDecimal.ZERO,new ArbitraryNumber(),new double[]{0,0},Double.NaN,Double.POSITIVE_INFINITY};
        for(final Object carrier:rejected) error("INVALID_INPUT",0,new Action(){public void run(){ConvexPolygonPlacements2D.filter(map("polygons",list(list(list(carrier,0),list(1,0),list(0,1)))));}});
        error("INVALID_POLYGON",1,new Action(){public void run(){ConvexPolygonPlacements2D.filter(new double[][][] {square(0,0,2),new double[][]{{0,0},{1,0},{2,0}}});}});
        error("INVALID_INPUT",1,new Action(){public void run(){ConvexPolygonPlacements2D.filter(map("polygons",list(list(list(0,0),list(1,0),list(0,1)),list(list(0,0),list(1,0),list((Object)null,1)))));}});
    }
    private static String workload(int count,int vertices,boolean overlap){
        double[][][] data=new double[count][vertices][2];
        for(int i=0;i<count;i++) {
            double cx=overlap?15*Math.cos(i*.013):(i%100)*12;
            double cy=overlap?15*Math.sin(i*.013):(i/100)*12;
            for(int j=0;j<vertices;j++) {
                double a=2*Math.PI*j/vertices+i*.007;
                data[i][j][0]=cx+4*Math.cos(a); data[i][j][1]=cy+4*Math.sin(a);
            }
        }
        if(count>=5000 && overlap) {
            java.util.Random random=new java.util.Random(42);
            for(int i=0;i<count;i++) {
                double cx=random.nextDouble()*512,cy=random.nextDouble()*512;
                double radius=2+38*random.nextDouble()*random.nextDouble();
                double ratio=.2+.8*random.nextDouble(),phase=random.nextDouble()*Math.PI*2;
                for(int j=0;j<vertices;j++) {
                    double a=2*Math.PI*j/vertices;
                    double x=radius*Math.cos(a),y=radius*ratio*Math.sin(a);
                    data[i][j][0]=cx+x*Math.cos(phase)-y*Math.sin(phase);
                    data[i][j][1]=cy+x*Math.sin(phase)+y*Math.cos(phase);
                }
            }
            return measure(data,"seed42-variable-ellipse-outlines",-1);
        }
        return measure(data,"rotated-"+vertices+"-overlap-"+overlap,overlap?-1:count);
    }
    private static String fallbackWorkload(){
        double[][][] data=new double[500][][];
        for(int i=0;i<data.length;i++)data[i]=new double[][]{{0,0},{1,0},{0,1}};
        return measure(data,"identical-triangles-exact-contact",1);
    }
    private static String measure(double[][][] data,String label,int expected){
        long before=allocated(),start=System.nanoTime();
        ConvexPolygonPlacements2D result=ConvexPolygonPlacements2D.filter(data);
        long elapsed=System.nanoTime()-start,after=allocated();
        long bytes=before<0||after<0?-1:after-before;
        if(expected>=0)check(result.size()==expected,"workload survivor count");
        else check(result.size()>1 && result.size()<data.length,"workload active rejection");
        double checksum=0;
        for(int i=0;i<result.size();i++) {
            checksum+=result.sourceIndexAt(i);
            for(int j=0;j<result.vertexCountAt(i);j++)checksum+=result.xAt(i,j)+result.yAt(i,j);
        }
        return "{\"proposals\":"+data.length+",\"scenario\":\""+label+"\",\"survivors\":"+result.size()
            +",\"checksum\":"+checksum+",\"elapsed_ns\":"+elapsed+",\"allocated_bytes\":"+bytes+"}";
    }
    private static long allocated(){
        java.lang.management.ThreadMXBean bean=ManagementFactory.getThreadMXBean();
        if(bean instanceof com.sun.management.ThreadMXBean){
            com.sun.management.ThreadMXBean memory=(com.sun.management.ThreadMXBean)bean;
            if(memory.isThreadAllocatedMemorySupported()&&memory.isThreadAllocatedMemoryEnabled())
                return memory.getThreadAllocatedBytes(Thread.currentThread().getId());
        }
        return -1;
    }
    private static final class ArbitraryNumber extends java.lang.Number { public int intValue(){return 0;} public long longValue(){return 0;} public float floatValue(){return 0;} public double doubleValue(){return 0;} }
    public static void main(String[] args){geometry();validation();for(int i=0;i<3;i++)workload(100,12,true);System.out.println("{\"status\":\"passed\",\"checks\":"+checks+",\"workloads\":["+workload(500,4,false)+","+workload(500,12,true)+","+workload(5000,12,true)+","+fallbackWorkload()+"]}");}
}
