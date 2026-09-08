package org.procedurals.topology;

import java.math.BigInteger;
import java.util.*;

/** Focused ownership, atomic access and numeric-carrier checks for seeded line pools. */
public final class LinePoolNative {
  private static int assertions;
  private interface Action { void run(); }
  private static void check(boolean v,String m){assertions++;if(!v)throw new AssertionError(m);}
  private static List<Object> list(Object...v){return new ArrayList<Object>(Arrays.asList(v));}
  private static Map<String,Object> map(Object...v){Map<String,Object>m=new LinkedHashMap<String,Object>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m;}
  private static Map<String,Object> cfg(Object segment){return map("seed",0,"segment",segment,"attempts",0,"firstCutAngleScale",1.0,"minCutLength",1.0,"maxSegments",4);}
  private static void expect(String code,Action a){Throwable t=null;try{a.run();}catch(Throwable e){t=e;}check(t instanceof LinePool2D.LinePoolException,"exception "+code);check(code.equals(((LinePool2D.LinePoolException)t).code),"code "+code);}
  @SuppressWarnings("unchecked") private static void ownership(){
    List<Object> segment=list(0.0,0.0,1.0,0.0); Map<String,Object> input=cfg(segment); LinePool2D p=LinePool2D.generate(input); Map<String,Object> before=p.toValues();
    segment.set(2,99.0); input.clear(); check(p.toValues().equals(before),"input detached");
    List<Object> exported=(List<Object>)p.toValues().get("segments"); ((List<Object>)exported.get(0)).set(0,77.0); check(p.segmentAt(0L)[0]==0.0,"export detached");
    double[] a=p.segmentAt(0L),b=p.segmentAt(0L); check(a!=b,"segment fresh"); a[0]=5.0; check(p.segmentAt(0L)[0]==0.0,"segment detached");
  }
  private static void access(){
    final LinePool2D p=LinePool2D.generate(cfg(list(0.0,0.0,1.0,0.0))); double[] out={7.0,8.0,9.0,10.0,11.0};
    expect("INDEX_OUT_OF_RANGE",()->p.segmentInto(3L,(double[])null,0)); check(Arrays.equals(out,new double[]{7,8,9,10,11}),"range precedence");
    expect("INVALID_INDEX",()->p.segmentInto(BigInteger.ONE,out,0)); expect("INVALID_OUTPUT",()->p.segmentInto(0L,out,2)); check(Arrays.equals(out,new double[]{7,8,9,10,11}),"atomic output");
    expect("INVALID_INDEX",()->p.segmentAt(Boolean.TRUE)); expect("INVALID_INDEX",()->p.dividedAt(new BigInteger("1")));
  }
  private static void signedZero(){
    LinePool2D p=LinePool2D.generate(cfg(list(-0.0,-0.0,-0.0,-0.0))); double[] s=p.segmentAt(0L); for(double v:s)check(Double.doubleToRawLongBits(v)==0L,"segment +0");
    @SuppressWarnings("unchecked") List<Object> out=(List<Object>)p.toValues().get("segments"); @SuppressWarnings("unchecked") List<Object> row=(List<Object>)out.get(0); for(Object v:row)check(Double.doubleToRawLongBits(((Double)v).doubleValue())==0L,"export +0");
  }
  private static void numeric(){expect("INVALID_INPUT",()->LinePool2D.generate(map("seed",new BigInteger("1"),"segment",list(0,0,1,0),"attempts",0,"firstCutAngleScale",1,"minCutLength",1,"maxSegments",4)));}
  public static void main(String[] args){ownership();access();signedZero();numeric();System.out.println("{\"status\":\"passed\",\"assertions\":"+assertions+"}");}
}
