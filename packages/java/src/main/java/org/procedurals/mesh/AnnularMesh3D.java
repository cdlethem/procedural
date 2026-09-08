package org.procedurals.mesh;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
/**
   *  Owned indexed closed annular mesh for {@code mesh.annular-solid-3d} 0.1.0.
* Local units are caller-defined; the axis is +Z and angular cells run +X toward +Y.
* It is motivated by {@code survey/out/2017/Generativos/aros/notes.md} and the private
* annular study. It has no renderer, style, random state, defaults, or recommended range.
* Results own packed primitive storage; all exported triples and values are detached.
   */
public final strictfp class AnnularMesh3D  {
  private static final int MAX_SLICES = 89478485;
  private static final int MAX_FACES = 715827881;
  private static final long SAFE = 9007199254740991L;
  private static final double TAU = 6.283185307179586;
  private static final String[] KEYS =  {
    "outerRadius","innerRadius","bottomZ","topZ","slices","maxFaces"
  }
  ;
  private static final String[] KINDS =  {
    "outer-wall","inner-wall","top-annulus","bottom-annulus"
  }
  ;
  /** Static input or retained-access error. */
  public static final class MeshException extends IllegalArgumentException  {
    public final String code;
    public MeshException(String code)  {
      super(code);
      this.code=code;
    }
  }
  /** Valid input exceeded its required face budget before geometry allocation. */
  public static final class FaceLimitException extends IllegalArgumentException  {
    public final String code="FACE_LIMIT_EXCEEDED";
    public FaceLimitException() {
      super("FACE_LIMIT_EXCEEDED");
    }
  }
  /** A face cannot produce the specified scaled flat normal. */
  public static final class MeshArithmeticException extends ArithmeticException  {
    public final String code="MESH_ARITHMETIC_INVALID";
    public final int faceIndex;
    public final String stage;
    MeshArithmeticException(int faceIndex,String stage) {
      super("MESH_ARITHMETIC_INVALID");
      this.faceIndex=faceIndex;
      this.stage=stage;
    }
  }
  private final double[] positions, normals;
  private final int[] triangles;
  private final int slices;
  private AnnularMesh3D(double[] positions,double[] normals,int[] triangles,int slices) {
    this.positions=positions;
    this.normals=normals;
    this.triangles=triangles;
    this.slices=slices;
  }
  /** Generates the four-ring, welded-seam annular solid from an exact passive Map record. */
  public static AnnularMesh3D generate(Object input)  {
    Map<?,?> map=record(input);
    double outer=number(map.get("outerRadius"));
    double inner=number(map.get("innerRadius"));
    if (!(outer>inner&&inner>0)) bad();
    double bottom=number(map.get("bottomZ"));
    double top=number(map.get("topZ"));
    if (!(bottom<top)) bad();
    int slices=count(map.get("slices"),3,MAX_SLICES);
    int maximum=count(map.get("maxFaces"),1,MAX_FACES);
    long faces=8L*slices, vertices=4L*slices;
    if(faces>maximum) throw new FaceLimitException();
    if(faces<1||faces>MAX_FACES||vertices>Integer.MAX_VALUE/3) throw new AssertionError("count");
    double[] p=new double[(int)(vertices*3)], n=new double[(int)(faces*3)];
    int[] t=new int[(int)(faces*3)];
    ring(p,0,outer,bottom,slices);
    ring(p,1,outer,top,slices);
    ring(p,2,inner,bottom,slices);
    ring(p,3,inner,top,slices);
    int face=0;
    for (int cell=0; cell<slices; cell++)  {
      int next=(cell+1)%slices, ob=cell, obt=next, ot=slices+cell, ott=slices+next;
      int ib=2*slices+cell, ibt=2*slices+next, it=3*slices+cell, itt=3*slices+next;
      face=quad(t,face,ob,obt,ott,ot);
      face=quad(t,face,ib,it,itt,ibt);
      face=quad(t,face,ot,ott,itt,it);
      face=quad(t,face,ob,ib,ibt,obt);
    }
    if(face!=faces) throw new AssertionError("face count");
    for (int i=0; i<face; i++) normal(p,t,i,n);
    return new AnnularMesh3D(p,n,t,slices);
  }
  private static void ring(double[] p,int ring,double radius,double z,int slices) {
    for (int cell=0; cell<slices; cell++) {
      double theta=(TAU*cell)/slices;
      put(p,ring*slices+cell,radius*Math.cos(theta),radius*Math.sin(theta),z);
    }
  }
  private static int quad(int[] t,int f,int a,int b,int c,int d) {
    face(t,f++,a,b,c);
    face(t,f++,a,c,d);
    return f;
  }
  private static void face(int[] t,int f,int a,int b,int c) {
    int i=f*3;
    t[i]=a;
    t[i+1]=b;
    t[i+2]=c;
  }
  private static void put(double[] p,int vertex,double x,double y,double z) {
    int i=vertex*3;
    p[i]=zero(x);
    p[i+1]=zero(y);
    p[i+2]=zero(z);
  }
  private static void normal(double[] p,int[] t,int face,double[] out) {
    int i=face*3,a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3;
    double ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    if(!finite(ux)||!finite(uy)||!finite(uz)||!finite(vx)||!finite(vy)||!finite(vz)) throw new MeshArithmeticException(face,"edge");
    double su=Math.max(Math.abs(ux),Math.max(Math.abs(uy),Math.abs(uz))),sv=Math.max(Math.abs(vx),Math.max(Math.abs(vy),Math.abs(vz)));
    if(su==0||sv==0) throw new MeshArithmeticException(face,"edge_scale");
    ux/=su;
    uy/=su;
    uz/=su;
    vx/=sv;
    vy/=sv;
    vz/=sv;
    double nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,sn=Math.max(Math.abs(nx),Math.max(Math.abs(ny),Math.abs(nz)));
    if(sn==0) throw new MeshArithmeticException(face,"cross_scale");
    double qx=nx/sn,qy=ny/sn,qz=nz/sn,length=Math.sqrt((qx*qx+qy*qy)+qz*qz);
    out[i]=zero(qx/length);
    out[i+1]=zero(qy/length);
    out[i+2]=zero(qz/length);
  }
  /** Returns retained vertex count V=4*slices. */
  public int vertexCount() {
    return positions.length/3;
  }
  /** Returns retained face count F=8*slices. */
  public int faceCount() {
    return triangles.length/3;
  }
  /** Returns a fresh detached local position triple. */
  public double[] vertexAt(long index) {
    return triple(positions,index(index,vertexCount()));
  }
  /** Numeric-carrier overload for {@link #vertexAt(long)}. */
  public double[] vertexAt(Object index) {
    return vertexAt(access(index));
  }
  /** Returns a fresh detached flat unit normal triple. */
  public double[] normalAt(long index) {
    return triple(normals,index(index,faceCount()));
  }
  /** Numeric-carrier overload for {@link #normalAt(long)}. */
  public double[] normalAt(Object index) {
    return normalAt(access(index));
  }
  /** Returns a fresh detached triangle-index triple. */
  public int[] triangleAt(long index) {
    int i=index(index,faceCount())*3;
    return new int[] {
      triangles[i],triangles[i+1],triangles[i+2]
    }
    ;
  }
  /** Numeric-carrier overload for {@link #triangleAt(long)}. */
  public int[] triangleAt(Object index) {
    return triangleAt(access(index));
  }
  /** Returns the aligned outer-wall, inner-wall, top-annulus, or bottom-annulus kind. */
  public String faceKindAt(long index) {
    return KINDS[(index(index,faceCount())%8)/2];
  }
  /** Numeric-carrier overload for {@link #faceKindAt(long)}. */
  public String faceKindAt(Object index) {
    return faceKindAt(access(index));
  }
  /** Returns the aligned angular cell. */
  public int cellAt(long index) {
    return index(index,faceCount())/8;
  }
  /** Numeric-carrier overload for {@link #cellAt(long)}. */
  public int cellAt(Object index) {
    return cellAt(access(index));
  }
  /** Validates then writes a position triple, preserving slots outside the triple. */
  public void vertexInto(long index,double[] output,int offset) {
    into(positions,index(index,vertexCount()),output,offset);
  }
  /** Numeric-carrier overload for {@link #vertexInto(long,double[],int)}. */
  public void vertexInto(Object index,double[] output,int offset) {
    vertexInto(access(index),output,offset);
  }
  /** Validates then writes a normal triple, preserving slots outside the triple. */
  public void normalInto(long index,double[] output,int offset) {
    into(normals,index(index,faceCount()),output,offset);
  }
  /** Numeric-carrier overload for {@link #normalInto(long,double[],int)}. */
  public void normalInto(Object index,double[] output,int offset) {
    normalInto(access(index),output,offset);
  }
  /** Validates then writes a triangle triple, preserving slots outside the triple. */
  public void triangleInto(long index,int[] output,int offset) {
    int f=index(index,faceCount());
    if(output==null||offset<0||offset>output.length-3)throw new MeshException("INVALID_OUTPUT");
    int i=f*3;
    output[offset]=triangles[i];
    output[offset+1]=triangles[i+1];
    output[offset+2]=triangles[i+2];
  }
  /** Numeric-carrier overload for {@link #triangleInto(long,int[],int)}. */
  public void triangleInto(Object index,int[] output,int offset) {
    triangleInto(access(index),output,offset);
  }
  /** Returns a deep detached ordinary-value representation in output-schema key order. */
  public Map<String,Object> toValues() {
    List<Object> ps=new ArrayList<Object>(vertexCount()),ts=new ArrayList<Object>(faceCount()),ns=new ArrayList<Object>(faceCount()),ks=new ArrayList<Object>(faceCount()),cs=new ArrayList<Object>(faceCount());
    for (int i=0; i<vertexCount(); i++) {
      double[] q=vertexAt(i);
      ps.add(list(q[0],q[1],q[2]));
    }
    for (int i=0; i<faceCount(); i++) {
      int[] q=triangleAt(i);
      double[] r=normalAt(i);
      ts.add(list(q[0],q[1],q[2]));
      ns.add(list(r[0],r[1],r[2]));
      ks.add(faceKindAt(i));
      cs.add(cellAt(i));
    }
    Map<String,Object> out=new LinkedHashMap<String,Object>();
    out.put("positions",ps);
    out.put("triangles",ts);
    out.put("normals",ns);
    out.put("faceKinds",ks);
    out.put("cells",cs);
    return out;
  }
  private static Map<?,?> record(Object value) {
    if(!(value instanceof Map))bad();
    Map<?,?> map=(Map<?,?>)value;
    if(map.size()!=KEYS.length)bad();
    for(String key:KEYS)if(!map.containsKey(key))bad();
    return map;
  }
  private static int count(Object value,int low,int high) {
    double n=number(value);
    if(n<low||n>high||n!=Math.floor(n))bad();
    return (int)n;
  }
  private static double number(Object value) {
    if(!(value instanceof Byte||value instanceof Short||value instanceof Integer||value instanceof Long||value instanceof Float||value instanceof Double))bad();
    double n=((Number)value).doubleValue();
    if(!finite(n))bad();
    return zero(n);
  }
  private static long access(Object value) {
    if(!(value instanceof Byte||value instanceof Short||value instanceof Integer||value instanceof Long||value instanceof Float||value instanceof Double))throw new MeshException("INVALID_INDEX");
    double n=((Number)value).doubleValue();
    if(!finite(n)||n<0||n>SAFE||n!=Math.floor(n))throw new MeshException("INVALID_INDEX");
    return (long)n;
  }
  private static int index(long value,int size) {
    if(value<0||value>SAFE)throw new MeshException("INVALID_INDEX");
    if(value>=size)throw new MeshException("INDEX_OUT_OF_RANGE");
    return (int)value;
  }
  private static void into(double[] data,int index,double[] output,int offset) {
    if(output==null||offset<0||offset>output.length-3)throw new MeshException("INVALID_OUTPUT");
    int i=index*3;
    output[offset]=data[i];
    output[offset+1]=data[i+1];
    output[offset+2]=data[i+2];
  }
  private static double[] triple(double[] data,int index) {
    int i=index*3;
    return new double[] {
      data[i],data[i+1],data[i+2]
    }
    ;
  }
  private static List<Object> list(Object a,Object b,Object c) {
    List<Object> out=new ArrayList<Object>(3);
    out.add(a);
    out.add(b);
    out.add(c);
    return out;
  }
  private static boolean finite(double value) {
    return !Double.isInfinite(value)&&!Double.isNaN(value);
  }
  private static double zero(double value) {
    return value==0?0:value;
  }
  private static void bad() {
    throw new MeshException("INVALID_INPUT");
  }
}
