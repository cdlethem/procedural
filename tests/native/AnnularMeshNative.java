package org.procedurals.mesh;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
/** Focused Java carrier, ownership, access atomicity, replay, and workload checks. */
public final class AnnularMeshNative  {
  private static int assertions;
  private interface Action  {
    void run();
  }
  private static final class OtherNumber extends Number  {
    public int intValue() {
      return 1;
    }
    public long longValue() {
      return 1;
    }
    public float floatValue() {
      return 1;
    }
    public double doubleValue() {
      return 1;
    }
  }
  private static void check(boolean ok,String text) {
    assertions++;
    if(!ok)throw new AssertionError(text);
  }
  private static Map<String,Object> config(Object outer,Object inner,Object bottom,Object top,Object slices,Object max) {
    Map<String,Object> m=new LinkedHashMap<String,Object>();
    m.put("outerRadius",outer);
    m.put("innerRadius",inner);
    m.put("bottomZ",bottom);
    m.put("topZ",top);
    m.put("slices",slices);
    m.put("maxFaces",max);
    return m;
  }
  private static Map<String,Object> ordinary() {
    return config(2d,1d,-1d,1d,3d,24d);
  }
  private static String code(Throwable e) {
    if(e instanceof AnnularMesh3D.MeshException)return ((AnnularMesh3D.MeshException)e).code;
    if(e instanceof AnnularMesh3D.FaceLimitException)return ((AnnularMesh3D.FaceLimitException)e).code;
    if(e instanceof AnnularMesh3D.MeshArithmeticException)return ((AnnularMesh3D.MeshArithmeticException)e).code;
    return null;
  }
  private static void expected(String wanted,Action a) {
    try {
      a.run();
      throw new AssertionError("missing "+wanted);
    }
    catch(Throwable e) {
      check(wanted.equals(code(e)),"expected "+wanted+" got "+e);
    }
  }
  private static long mix(long h,long v) {
    return (h^v)*0x100000001b3L;
  }
  private static long checksum(AnnularMesh3D m) {
    long h=0xcbf29ce484222325L;
    double[] scratch=new double[3];
    for (int i=0; i<m.vertexCount(); i++) {
      m.vertexInto(i,scratch,0);
      for(double v:scratch)h=mix(h,Double.doubleToRawLongBits(v));
    }
    for (int i=0; i<m.faceCount(); i++) {
      int[] t=m.triangleAt(i);
      m.normalInto(i,scratch,0);
      for (int j=0; j<3; j++) {
        h=mix(h,t[j]);
        h=mix(h,Double.doubleToRawLongBits(scratch[j]));
      }
      h=mix(h,m.faceKindAt(i).hashCode());
      h=mix(h,m.cellAt(i));
    }
    return h;
  }
  private static void access() {
    AnnularMesh3D m=AnnularMesh3D.generate(ordinary());
    double[] d= {
      1,2,3,4,5,6
    }
    ,before=d.clone();
    int[] q= {
      1,2,3,4,5,6
    }
    ,qbefore=q.clone();
    expected("INVALID_INDEX",()->m.vertexInto(-1L,d,-1));
    check(Arrays.equals(d,before),"negative index atomic");
    expected("INVALID_INDEX",()->m.vertexAt(Double.NaN));
    expected("INVALID_INDEX",()->m.vertexAt(Boolean.TRUE));
    expected("INVALID_INDEX",()->m.vertexAt("0"));
    expected("INVALID_INDEX",()->m.vertexAt(new BigDecimal("0")));
    expected("INVALID_INDEX",()->m.vertexAt(new OtherNumber()));
    expected("INVALID_INDEX",()->m.vertexAt(9007199254740992d));
    expected("INDEX_OUT_OF_RANGE",()->m.vertexInto((long)m.vertexCount(),d,-1));
    check(Arrays.equals(d,before),"range before output");
    expected("INVALID_OUTPUT",()->m.vertexInto(0L,null,0));
    expected("INVALID_OUTPUT",()->m.vertexInto(0L,d,Integer.MAX_VALUE));
    check(Arrays.equals(d,before),"output atomic");
    m.vertexInto(0L,d,2);
    check(d[0]==1&&d[1]==2&&d[5]==6,"vertex sentinels");
    check(Arrays.equals(Arrays.copyOfRange(d,2,5),m.vertexAt(0L)),"vertex into");
    expected("INVALID_OUTPUT",()->m.normalInto(0L,d,-1));
    check(d[0]==1&&d[1]==2&&d[5]==6,"normal negative offset atomic");
    expected("INVALID_OUTPUT",()->m.normalInto(0L,null,0));
    check(d[0]==1&&d[1]==2&&d[5]==6,"normal null atomic");
    m.normalInto(0L,d,2);
    check(Arrays.equals(Arrays.copyOfRange(d,2,5),m.normalAt(0L)),"normal into");
    expected("INVALID_OUTPUT",()->m.triangleInto(0L,q,4));
    check(Arrays.equals(q,qbefore),"triangle atomic");
    m.triangleInto(0L,q,1);
    check(q[0]==1&&q[4]==5&&q[5]==6,"triangle sentinels");
    check(Arrays.equals(Arrays.copyOfRange(q,1,4),m.triangleAt(0L)),"triangle into");
    double[] a=m.vertexAt(0),b=m.vertexAt(0);
    check(a!=b,"fresh At");
    long h=checksum(m);
    a[0]=77;
    double[] detachedNormal=m.normalAt(0);
    detachedNormal[0]=77;
    int[] detachedTriangle=m.triangleAt(0);
    detachedTriangle[0]=77;
    Map<String,Object> exported=m.toValues();
    ((java.util.List<Object>)((java.util.List<Object>)exported.get("positions")).get(0)).set(0,77d);
    ((java.util.List<Object>)((java.util.List<Object>)exported.get("triangles")).get(0)).set(0,77);
    ((java.util.List<Object>)((java.util.List<Object>)exported.get("normals")).get(0)).set(0,77d);
    ((java.util.List<Object>)exported.get("faceKinds")).clear();
    check(checksum(m)==h,"detached exports");
    Map<String,Object> input=ordinary();
    AnnularMesh3D held=AnnularMesh3D.generate(input);
    input.put("slices",12d);
    check(held.faceCount()==24,"input detached");
    check(!m.toValues().containsKey("bands"),"no band alias");
  }
  private static void carriers() {
    Object[] valid= {
      Byte.valueOf((byte)3),Short.valueOf((short)3),Integer.valueOf(3),Long.valueOf(3),Float.valueOf(3),Double.valueOf(3)
    }
    ;
    for(Object x:valid)check(AnnularMesh3D.generate(config(2d,1d,-1d,1d,x,24d)).faceCount()==24,"carrier");
    for(Object x:new Object[] {
      Boolean.TRUE,"3",new BigDecimal("3"),new OtherNumber(),Double.NaN,Double.POSITIVE_INFINITY
    }
    ) {
      final Object y=x;
      expected("INVALID_INPUT",()->AnnularMesh3D.generate(config(2d,1d,-1d,1d,y,24d)));
    }
    expected("FACE_LIMIT_EXCEEDED",()->AnnularMesh3D.generate(config(2d,1d,-1d,1d,3d,23d)));
    expected("MESH_ARITHMETIC_INVALID",()->AnnularMesh3D.generate(config(1e308,1d,-Double.MAX_VALUE,Double.MAX_VALUE,3d,24d)));
  }
  private static String workload(String id,int slices) {
    Map<String,Object> c=config(150d,110d,-15d,15d,(double)slices,(double)(8L*slices));
    for (int i=0; i<2; i++)checksum(AnnularMesh3D.generate(c));
    long elapsed=0,h=0;
    for (int i=0; i<3; i++) {
      long start=System.nanoTime();
      AnnularMesh3D m=AnnularMesh3D.generate(c);
      elapsed+=System.nanoTime()-start;
      h^=checksum(m);
    }
    return "{\"id\":\""+id+"\",\"faces\":"+(8*slices)+",\"warmups\":2,\"repetitions\":3,\"elapsed_nanos\":"+elapsed+",\"checksum\":\""+Long.toUnsignedString(h,16)+"\"}";
  }
  public static void main(String[] args) {
    try {
      carriers();
      access();
      AnnularMesh3D a=AnnularMesh3D.generate(ordinary()),b=AnnularMesh3D.generate(ordinary());
      check(checksum(a)==checksum(b),"same runtime replay");
      System.out.println("{\"status\":\"passed\",\"assertions\":"+assertions+",\"workloads\":["+workload("tiny",3)+","+workload("study",48)+","+workload("bounded",10000)+"]}");
    }
    catch(Throwable e) {
      System.out.println("{\"status\":\"failed\",\"assertions\":"+assertions+",\"error\":\""+String.valueOf(e).replace("\"","'")+"\"}");
      System.exit(1);
    }
  }
}
