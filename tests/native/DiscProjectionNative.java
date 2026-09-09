package org.procedurals.geometry; import java.util.*; import java.math.*;
public final class DiscProjectionNative {static int n;interface A{void r();}static void ok(boolean x){n++;if(!x)throw new AssertionError();}static void err(A a,String c){try{a.r();throw new AssertionError();}catch(DiscProjection2D.DiscProjectionException e){ok(c.equals(e.code));}}static List<Object> l(Object...x){return new LinkedList<Object>(Arrays.asList(x));}static Map<String,Object> m(Object...x){Map<String,Object>r=new LinkedHashMap<String,Object>();for(int i=0;i<x.length;i+=2)r.put((String)x[i],x[i+1]);return r;}

 static void completeChecks() {
  double[] input={1,0}, discs={0,0,2};
  DiscProjection2D result=DiscProjection2D.project(input,discs,1,1);
  input[0]=99; discs[2]=99;
  double[] exported=result.points(); exported[0]=99;
  List<?> values=(List<?>)result.toValues().get("points");
  @SuppressWarnings("unchecked") List<Double> row=(List<Double>)values.get(0);
  row.set(0,99d); ok(result.points()[0]==2);
  double[] target={7,8,9,10}; result.pointInto(0,target,1);
  ok(Arrays.equals(target,new double[]{7,2,0,10}));
  long[] invalidIndexes={-1,9007199254740992L,Long.MAX_VALUE};
  for(long index:invalidIndexes) err(()->result.pointInto(index,null,-1),"INVALID_INDEX");
  err(()->result.pointInto(1,null,-1),"INDEX_OUT_OF_RANGE");
  err(()->result.pointInto(0,null,0),"INVALID_OUTPUT");
  for(int offset:new int[]{-1,3,Integer.MAX_VALUE}) {
   double[] before=target.clone();
   err(()->result.pointInto(0,target,offset),"INVALID_OUTPUT");
   ok(Arrays.equals(before,target));
  }
  Object[] forbidden={true,"0",new BigDecimal("0"),new Number(){public int intValue(){return 0;}public long longValue(){return 0;}public float floatValue(){return 0;}public double doubleValue(){return 0;}},Double.NaN,Double.POSITIVE_INFINITY};
  for(Object bad:forbidden) err(()->DiscProjection2D.project(m("points",l(l(bad,0)),"discs",l(),"strength",0,"maxTests",0)),"INVALID_INPUT");
  err(()->DiscProjection2D.project(null,new double[0],0,0),"INVALID_INPUT");
  err(()->DiscProjection2D.project(new double[0],null,0,0),"INVALID_INPUT");
  err(()->DiscProjection2D.project(new double[0],new double[]{0},0,0),"INVALID_INPUT");
  err(()->DiscProjection2D.project(new double[]{Double.NaN,0},new double[0],0,0),"INVALID_INPUT");
  err(()->DiscProjection2D.project(new double[0],new double[0],Double.NaN,0),"INVALID_INPUT");
  err(()->DiscProjection2D.project(new double[0],new double[0],0,Long.MAX_VALUE),"INVALID_INPUT");
  List<Object> mutablePoint=l(1d,0d), mutableDisc=l(0d,0d,2d);
  DiscProjection2D retained=DiscProjection2D.project(m("points",l(mutablePoint),"discs",l(mutableDisc),"strength",1,"maxTests",1));
  mutablePoint.set(0,99d);mutableDisc.set(2,99d);ok(retained.points()[0]==2);
 }
 public static void main(String[]x){completeChecks();double[]p={0,0},d={0,0,2,1,0,2};DiscProjection2D r=DiscProjection2D.project(p,d,.5,2);ok(r.points()[0]==2);DiscProjection2D q=DiscProjection2D.project(m("points",l(l(0,0)),"discs",l(l(0,0,2),l(1,0,2)),"strength",.5,"maxTests",2));ok(Arrays.equals(r.points(),q.points()));p[0]=9;ok(r.points()[0]==2);double[]t={7,7};err(()->r.pointInto(1,t,0),"INDEX_OUT_OF_RANGE");ok(t[0]==7&&t[1]==7);err(()->r.pointInto(0,t,1),"INVALID_OUTPUT");err(()->DiscProjection2D.project(m("points",l(l(new BigInteger("0"),0)),"discs",l(),"strength",0,"maxTests",0)),"INVALID_INPUT");err(()->DiscProjection2D.project(new double[]{0},new double[0],0,0),"INVALID_INPUT");err(()->DiscProjection2D.project(new double[]{0,0},new double[]{0,0,Double.NaN},0,0),"INVALID_INPUT");err(()->DiscProjection2D.project(new double[]{0,0},new double[]{0,0,2},0,0),"WORK_LIMIT");System.out.println("{\"status\":\"passed\",\"assertions\":"+n+"}");}}
