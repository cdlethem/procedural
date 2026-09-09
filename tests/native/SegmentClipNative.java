package org.procedurals.geometry;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Focused Java-native contract checks for the reviewed segment clipping fixtures. */
public final class SegmentClipNative {
    private static int checks;
    private interface Action { void run(); }
    private static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
    private static Map<String,Object> input(Object polygon,Object segments,Object work,Object output) { Map<String,Object> m=new LinkedHashMap<String,Object>();m.put("polygon",polygon);m.put("segments",segments);m.put("maxWork",work);m.put("maxOutputSegments",output);return m; }
    private static List<Object> rows(double[][] rows) { List<Object> out=new ArrayList<Object>();for(double[] row:rows){List<Object> r=new ArrayList<Object>();for(double v:row)r.add(Double.valueOf(v));out.add(r);}return out; }
    private static void check(boolean okay,String label) { checks++;if(!okay)throw new AssertionError(label); }
    private static void expected(String code,Action action) { try {action.run();throw new AssertionError("missing "+code);}catch(SegmentClip2D.SegmentClipException e){check(code.equals(e.code),"expected "+code+" got "+e.code);} }
    private static SegmentClip2D run(String id,double[][] polygon,double[][] segments,long work,long output,int count) { SegmentClip2D result=SegmentClip2D.clip(input(rows(polygon),rows(segments),Long.valueOf(work),Long.valueOf(output)));check(result.size()==count,id+" count");return result; }
    private static double[][] square() { return new double[][]{{0,0},{4,0},{4,4},{0,4}}; }
    private static double[][] notch() { return new double[][]{{0,0},{6,0},{6,6},{4,6},{4,2},{2,2},{2,6},{0,6}}; }
    private static void bits(double actual,String bits,String label){check(Long.toHexString(Double.doubleToRawLongBits(actual)).equals(bits),label);}
    private static void fixtures() {
        SegmentClip2D a=run("horizontal",square(),new double[][]{{-1,2,5,2}},216,16,1);bits(a.segmentAt(0)[0],"0","horizontal zero");bits(a.intervalAt(0)[1],"3feaaaaaaaaaaaab","horizontal t");
        run("vertical",square(),new double[][]{{2,-1,2,5}},216,16,1);run("boundary",square(),new double[][]{{-1,0,5,0}},216,16,1);run("vertex-diagonal",square(),new double[][]{{-1,-1,5,5}},216,16,1);
        run("point-tangent",square(),new double[][]{{-1,1,1,-1}},216,0,0);run("zero-length",square(),new double[][]{{2,2,2,2}},216,0,0);run("empty-sources",square(),new double[0][],16,0,0);
        run("inside",square(),new double[][]{{1,1,3,3}},216,1,1);run("concave-split",notch(),new double[][]{{-1,4,7,4}},712,2,2);
        run("reversed-winding",new double[][]{{0,6},{2,6},{2,2},{4,2},{4,6},{6,6},{6,0},{0,0}},new double[][]{{-1,4,7,4}},712,2,2);
        run("reversed-source",notch(),new double[][]{{7,4,-1,4}},712,2,2);run("collinear-floor",notch(),new double[][]{{-1,2,7,2}},712,1,1);
        SegmentClip2D identity=run("source-identity",notch(),new double[][]{{8,8,9,9},{-1,4,7,4},{1,1,1,1},{1,1,5,1}},2656,3,3);check(identity.sourceIndexAt(0)==1&&identity.sourceIndexAt(2)==3,"fixture source identity");
        run("straight-vertex",new double[][]{{0,0},{2,0},{4,0},{4,4},{0,4}},new double[][]{{-1,2,5,2}},313,16,1);
        run("scale--1000",new double[][]{{0,0},{3.7330544740128755E-301,0},{3.7330544740128755E-301,3.7330544740128755E-301},{0,3.7330544740128755E-301}},new double[][]{{-9.332636185032189E-302,1.8665272370064378E-301,4.666318092516094E-301,1.8665272370064378E-301}},216,16,1);
        run("scale-900",new double[][]{{0,0},{3.3810849992682576E271,0},{3.3810849992682576E271,3.3810849992682576E271},{0,3.3810849992682576E271}},new double[][]{{-8.452712498170644E270,1.6905424996341288E271,4.226356249085322E271,1.6905424996341288E271}},216,16,1);
        expected("WORK_LIMIT_EXCEEDED",()->run("work-minus-one",square(),new double[][]{{-1,2,5,2}},215,16,0)); expected("OUTPUT_LIMIT_EXCEEDED",()->run("output-zero",square(),new double[][]{{-1,2,5,2}},216,0,0)); expected("OUTPUT_LIMIT_EXCEEDED",()->run("split-output-one",notch(),new double[][]{{-1,4,7,4}},712,1,0));
        expected("INVALID_POLYGON",()->run("bow-tie",new double[][]{{0,0},{4,4},{0,4},{4,0}},new double[0][],16,0,0));expected("INVALID_POLYGON",()->run("nonzero-crossing",new double[][]{{0,0},{5,4},{0,4},{4,0}},new double[0][],16,0,0));expected("INVALID_POLYGON",()->run("edge-touch",new double[][]{{0,0},{4,0},{4,4},{2,0},{0,4}},new double[0][],25,0,0));expected("INVALID_POLYGON",()->run("backtrack",new double[][]{{0,0},{4,0},{2,0},{4,4},{0,4}},new double[0][],25,0,0));expected("INVALID_POLYGON",()->run("repeated-closure",new double[][]{{0,0},{4,0},{4,4},{0,4},{0,0}},new double[0][],25,0,0));
        expected("REPRESENTATION_COLLAPSE",()->run("interval-collapse",new double[][]{{0,0},{Double.MIN_VALUE,0},{Double.MIN_VALUE,1},{0,1}},new double[][]{{-1,.5,1,.5}},216,2,0)); expected("REPRESENTATION_COLLAPSE",()->run("gap-collapse",new double[][]{{-1,-1},{1,-1},{1,1},{Double.MIN_VALUE,1},{Double.MIN_VALUE,0},{0,0},{0,1},{-1,1}},new double[][]{{-1,.5,1,.5}},712,2,0));expected("REPRESENTATION_COLLAPSE",()->run("endpoint-collapse",new double[][]{{0,0},{Double.MIN_VALUE,0},{0,Double.MIN_VALUE}},new double[][]{{0,0,Double.MIN_VALUE,Double.MIN_VALUE}},137,1,0));expected("OUTPUT_LIMIT_EXCEEDED",()->run("output-before-endpoint-collapse",new double[][]{{0,0},{Double.MIN_VALUE,0},{0,Double.MIN_VALUE}},new double[][]{{0,0,Double.MIN_VALUE,Double.MIN_VALUE}},137,0,0));expected("WORK_LIMIT_EXCEEDED",()->run("work-before-invalid-polygon",new double[][]{{0,0},{4,4},{0,4},{4,0}},new double[0][],0,0,0));
        Map<String,Object> late=input(rows(square()),list(list(-1,2,5,2),list(0,0,Boolean.TRUE,1)),0L,16L);expected("INVALID_INPUT",()->SegmentClip2D.clip(late));Map<String,Object> extra=input(rows(square()),rows(new double[][]{{-1,2,5,2}}),216L,16L);extra.put("extra",1);expected("INVALID_INPUT",()->SegmentClip2D.clip(extra));Map<String,Object> missing=input(rows(square()),rows(new double[][]{{-1,2,5,2}}),216L,16L);missing.remove("maxWork");expected("INVALID_INPUT",()->SegmentClip2D.clip(missing));expected("INVALID_INPUT",()->SegmentClip2D.clip(input(rows(square()),rows(new double[][]{{-1,2,5,2}}),216L,Boolean.FALSE)));expected("INVALID_INPUT",()->SegmentClip2D.clip(input(rows(square()),rows(new double[][]{{-1,2,5,2}}),0L,-1L)));
    }
    private static void ownershipAccessAndCarriers() {
        Object[] accepted={Byte.valueOf((byte)0),Short.valueOf((short)0),Integer.valueOf(0),Long.valueOf(0),Float.valueOf(0),Double.valueOf(0)};
        for(Object n:accepted) { List<Object> point=list(n,0);SegmentClip2D r=SegmentClip2D.clip(input(list(point,list(4,0),list(4,4),list(0,4)),list(list(-1,2,5,2)),216L,1L));check(r.size()==1,"numeric carrier"); }
        Object[] rejected={new BigDecimal("0"),"0",Boolean.TRUE};for(Object n:rejected){Map<String,Object> invalid=input(list(list(n,0),list(4,0),list(4,4),list(0,4)),list(list(-1,2,5,2)),216L,1L);expected("INVALID_INPUT",()->SegmentClip2D.clip(invalid));}
        List<Object> polygon=rows(square()), sources=rows(new double[][]{{-1,2,5,2}});SegmentClip2D result=SegmentClip2D.clip(input(polygon,sources,216L,1L));polygon.clear();sources.clear();check(result.segmentAt(0)[0]==0,"input detached");double[] value=result.segmentAt(0);value[0]=99;check(result.segmentAt(0)[0]==0,"at detached");double[] interval=result.intervalAt(0);interval[0]=99;check(result.intervalAt(0)[0]>0,"intervalAt detached");Map<String,Object> values=result.toValues();((List<Object>)((List<Object>)values.get("segments")).get(0)).set(0,99.0);((List<Object>)((List<Object>)values.get("intervals")).get(0)).set(0,99.0);((List<Object>)values.get("sourceIndices")).set(0,99);check(result.segmentAt(0)[0]==0&&result.intervalAt(0)[0]>0&&result.sourceIndexAt(0)==0,"export detached");
        double[] target={7,7,7,7,7,7};expected("INVALID_INDEX",()->result.segmentInto(Double.NaN,target,1));check(target[1]==7,"invalid index atomic");expected("INDEX_OUT_OF_RANGE",()->result.segmentInto(1L,target,1));expected("INVALID_OUTPUT",()->result.segmentInto(0L,target,3));check(target[3]==7,"invalid output atomic");expected("INVALID_INDEX",()->result.segmentInto(-1L,null,-1));expected("INVALID_OUTPUT",()->result.segmentInto(0L,target,-1));result.segmentInto(0L,target,1);check(target[1]==0&&target[3]==4&&target[4]==2,"offset write");double[] intervalTarget={8,8,8,8};expected("INVALID_INDEX",()->result.intervalInto(new BigDecimal("0"),intervalTarget,1));check(intervalTarget[1]==8,"invalid interval index atomic");expected("INVALID_OUTPUT",()->result.intervalInto(0L,intervalTarget,3));check(intervalTarget[3]==8,"invalid interval output atomic");result.intervalInto(0L,intervalTarget,1);check(intervalTarget[1]>0&&intervalTarget[2]<1,"interval offset write");expected("INVALID_INDEX",()->result.intervalAt(new BigDecimal("0")));expected("INVALID_INDEX",()->result.sourceIndexAt(9007199254740992L));
    }
    public static void main(String[] args) { fixtures();ownershipAccessAndCarriers();System.out.println("{\"status\":\"passed\",\"checks\":"+checks+"}"); }
}
