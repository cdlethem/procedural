package org.procedurals.mesh;


import java.util.ArrayList;

import java.util.LinkedHashMap;

import java.util.List;

import java.util.Map;


/**
 * Owned indexed radial profile mesh for {@code mesh.radial-profile-surface-3d} 0.1.0.
 * Motivated by {@code survey/out/2017/Generativos/cilindros/notes.md} and
 * {@code survey/out/2017/Generativos/fieeee/notes.md}; see the reviewed operation contract.
 * The source observations and private 8/32-slice experiment (and a 128-slice source helper)
 * are discrete observations with confounds, not defaults, encouraged ranges, or capacity advice.
 * @see <a href="../../../../survey/out/2017/Generativos/cilindros/notes.md">cilindros notes</a>
 * @see <a href="../../../../survey/out/2017/Generativos/fieeee/notes.md">fieeee notes</a>
 */
public final strictfp class RadialProfile3D {

  private static final int MAX = 715827881;

  private static final long SAFE = 9007199254740991L;

  private static final double TAU = 6.283185307179586;

  private static final String[] KEYS={
    "profile","slices","capStart","capEnd","maxFaces"}
  ;

  /** Static input or retained-access error; see {@link #generate(Object)}. */
  public static final class MeshException extends IllegalArgumentException {
     public final String code;
     /** Creates an error carrying the catalog code. */
     public MeshException(String code){
      super(code);
      this.code=code;
      }
     }

  /** Valid input exceeded its required face budget before geometry allocation. */
  public static final class FaceLimitException extends IllegalArgumentException {
     public final String code="FACE_LIMIT_EXCEEDED";
     /** Creates the fixed face-limit error. */
     public FaceLimitException(){
      super("FACE_LIMIT_EXCEEDED");
      }
     }

  /** A generated triangle has an unrepresentable scaled normal, with canonical face detail. */
  public static final class MeshArithmeticException extends ArithmeticException {
     public final String code="MESH_ARITHMETIC_INVALID";
     public final int faceIndex;
     public final String stage;
     MeshArithmeticException(int faceIndex,String stage){
      super("MESH_ARITHMETIC_INVALID");
      this.faceIndex=faceIndex;
      this.stage=stage;
      }
     }

  private final double[] positions,normals;
   private final int[] triangles,bands,cells;
   private final String[] kinds;

  private RadialProfile3D(double[] p,double[] n,int[] t,String[] k,int[] b,int[] c){
    positions=p;
    normals=n;
    triangles=t;
    kinds=k;
    bands=b;
    cells=c;
    }

  /**
   * Eagerly generates detached packed geometry from the exact passive input record.
   * No profile, cap, slice, or face-budget default is supplied; see the class provenance.
   */
  public static RadialProfile3D generate(Object input){

    Map<?,?> map=record(input,KEYS);
     Profile profile=profile(map.get("profile"));
     int slices=count(map.get("slices"),3,MAX);
     boolean start=bool(map.get("capStart")),end=bool(map.get("capEnd"));
     int maximum=count(map.get("maxFaces"),1,MAX);

    int poles=(profile.r[0]==0?1:0)+(profile.r[profile.n-1]==0?1:0);
     int caps=(start&&profile.r[0]>0?1:0)+(end&&profile.r[profile.n-1]>0?1:0);

    long faces=(long)slices*(2L*(profile.n-1)-poles+caps);
     long vertices=(long)(profile.n-poles)*slices+poles+caps;

    if(faces>maximum)throw new FaceLimitException();
     if(faces<1||vertices<1||vertices>faces+1||faces>MAX||vertices>MAX+1)throw new AssertionError("count");

    double[] positions=new double[(int)(vertices*3)],normals=new double[(int)(faces*3)];
     int[] triangles=new int[(int)(faces*3)],bands=new int[(int)faces],cells=new int[(int)faces];
     String[] kinds=new String[(int)faces];
     int[] starts=new int[profile.n];
     boolean[] ring=new boolean[profile.n];
     int vertex=0;

    for(int i=0;i<profile.n;i++){

      starts[i]=vertex;
       if(profile.r[i]==0){
        put(positions,vertex++,0,0,profile.z[i]);
        }
       else {
        ring[i]=true;
        for(int cell=0;cell<slices;cell++){
          double theta=(TAU*cell)/slices;
          put(positions,vertex++,profile.r[i]*Math.cos(theta),profile.r[i]*Math.sin(theta),profile.z[i]);
          }
        }

    }

    int startCenter=-1,endCenter=-1;
     if(start&&ring[0]){
      startCenter=vertex;
      put(positions,vertex++,0,0,profile.z[0]);
      }
     if(end&&ring[profile.n-1]){
      endCenter=vertex;
      put(positions,vertex++,0,0,profile.z[profile.n-1]);
      }

    int face=0;

    for(int band=0;band+1<profile.n;band++)for(int cell=0;cell<slices;cell++){
      int next=(cell+1)%slices;
       if(ring[band]&&ring[band+1]){
        int a=starts[band]+cell,b=starts[band]+next,c=starts[band+1]+next,d=starts[band+1]+cell;
        face=face(triangles,kinds,bands,cells,face,a,b,c,"side",band,cell);
        face=face(triangles,kinds,bands,cells,face,a,c,d,"side",band,cell);
        }
      else if(!ring[band])face=face(triangles,kinds,bands,cells,face,starts[band],starts[band+1]+next,starts[band+1]+cell,"side",band,cell);
      else face=face(triangles,kinds,bands,cells,face,starts[band]+cell,starts[band]+next,starts[band+1],"side",band,cell);
      }

    if(startCenter>=0)for(int cell=0;cell<slices;cell++)face=face(triangles,kinds,bands,cells,face,startCenter,starts[0]+((cell+1)%slices),starts[0]+cell,"start-cap",-1,cell);

    if(endCenter>=0)for(int cell=0;cell<slices;cell++)face=face(triangles,kinds,bands,cells,face,endCenter,starts[profile.n-1]+cell,starts[profile.n-1]+((cell+1)%slices),"end-cap",-1,cell);

    if(face!=faces)throw new AssertionError("face count");
     for(int i=0;i<face;i++)normal(positions,triangles,i,normals);
     return new RadialProfile3D(positions,normals,triangles,kinds,bands,cells);

  }

  private static void put(double[] data,int vertex,double x,double y,double z){
    int i=vertex*3;
    data[i]=zero(x);
    data[i+1]=zero(y);
    data[i+2]=zero(z);
    }

  private static int face(int[] t,String[] k,int[] b,int[] c,int f,int a,int d,int e,String kind,int band,int cell){
    int i=f*3;
    t[i]=a;
    t[i+1]=d;
    t[i+2]=e;
    k[f]=kind;
    b[f]=band;
    c[f]=cell;
    return f+1;
    }

  private static void normal(double[] p,int[] t,int face,double[] output){
    int i=face*3,a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3;
    double ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2];
    if(!finite(ux)||!finite(uy)||!finite(uz))throw new MeshArithmeticException(face,"edge");
    double vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    if(!finite(vx)||!finite(vy)||!finite(vz))throw new MeshArithmeticException(face,"edge");
    double su=Math.max(Math.abs(ux),Math.max(Math.abs(uy),Math.abs(uz))),sv=Math.max(Math.abs(vx),Math.max(Math.abs(vy),Math.abs(vz)));
    if(su==0||sv==0)throw new MeshArithmeticException(face,"edge_scale");
    ux/=su;
    uy/=su;
    uz/=su;
    vx/=sv;
    vy/=sv;
    vz/=sv;
    double nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,sn=Math.max(Math.abs(nx),Math.max(Math.abs(ny),Math.abs(nz)));
    if(sn==0)throw new MeshArithmeticException(face,"cross_scale");
    double qx=nx/sn,qy=ny/sn,qz=nz/sn,length=Math.sqrt((qx*qx+qy*qy)+qz*qz);
    output[i]=zero(qx/length);
    output[i+1]=zero(qy/length);
    output[i+2]=zero(qz/length);
    }

  /** Returns the retained vertex count. */
  public int vertexCount() { return positions.length / 3; }
  /** Returns the retained triangle/face count. */
  public int faceCount() { return triangles.length / 3; }

  /** Returns a fresh detached position triple for a validated index. */
  public double[] vertexAt(long index) { return triple(positions, index(index, vertexCount())); }
  /** Numeric-carrier overload for {@link #vertexAt(long)}. */
  public double[] vertexAt(Object index) { return vertexAt(access(index)); }
  /** Returns a fresh detached flat-normal triple for a validated face index. */
  public double[] normalAt(long index) { return triple(normals, index(index, faceCount())); }
  /** Numeric-carrier overload for {@link #normalAt(long)}. */
  public double[] normalAt(Object index) { return normalAt(access(index)); }
  /** Returns a fresh detached three-index triangle carrier. */
  public int[] triangleAt(long index) { int offset=index(index,faceCount())*3; return new int[]{triangles[offset],triangles[offset+1],triangles[offset+2]}; }
  /** Numeric-carrier overload for {@link #triangleAt(long)}. */
  public int[] triangleAt(Object index) { return triangleAt(access(index)); }
  /** Returns the aligned exact face kind. */
  public String faceKindAt(long index) { return kinds[index(index, faceCount())]; }
  /** Numeric-carrier overload for {@link #faceKindAt(long)}. */
  public String faceKindAt(Object index) { return faceKindAt(access(index)); }
  /** Returns the aligned side band, or -1 for a cap. */
  public int bandAt(long index) { return bands[index(index, faceCount())]; }
  /** Numeric-carrier overload for {@link #bandAt(long)}. */
  public int bandAt(Object index) { return bandAt(access(index)); }
  /** Returns the aligned angular cell. */
  public int cellAt(long index) { return cells[index(index, faceCount())]; }
  /** Numeric-carrier overload for {@link #cellAt(long)}. */
  public int cellAt(Object index) { return cellAt(access(index)); }

  /** Validates then writes one position triple, leaving all other destination slots unchanged. */
  public void vertexInto(long index,double[] output,int offset) { into(positions,index(index,vertexCount()),output,offset); }
  /** Numeric-carrier overload for {@link #vertexInto(long,double[],int)}. */
  public void vertexInto(Object index,double[] output,int offset) { vertexInto(access(index),output,offset); }
  /** Validates then writes one normal triple, leaving all other destination slots unchanged. */
  public void normalInto(long index,double[] output,int offset) { into(normals,index(index,faceCount()),output,offset); }
  /** Numeric-carrier overload for {@link #normalInto(long,double[],int)}. */
  public void normalInto(Object index,double[] output,int offset) { normalInto(access(index),output,offset); }
  /** Validates then writes one triangle triple, leaving all other destination slots unchanged. */
  public void triangleInto(long index,int[] output,int offset) {
    int face=index(index,faceCount());
    if(output==null||offset<0||offset>output.length-3)throw new MeshException("INVALID_OUTPUT");
    int source=face*3; output[offset]=triangles[source]; output[offset+1]=triangles[source+1]; output[offset+2]=triangles[source+2];
  }
  /** Numeric-carrier overload for {@link #triangleInto(long,int[],int)}. */
  public void triangleInto(Object index,int[] output,int offset) { triangleInto(access(index),output,offset); }

  /** Materializes a deep detached ordinary-value representation in output-schema key order. */
  public Map<String,Object> toValues(){
    List<Object> ps=new ArrayList<Object>(vertexCount()),ts=new ArrayList<Object>(faceCount()),ns=new ArrayList<Object>(faceCount()),ks=new ArrayList<Object>(faceCount()),bs=new ArrayList<Object>(faceCount()),cs=new ArrayList<Object>(faceCount());
    for(int i=0;i<vertexCount();i++){double[] q=vertexAt(i);ps.add(list(q[0],q[1],q[2]));}
    for(int i=0;i<faceCount();i++){int[] q=triangleAt(i);ts.add(list(q[0],q[1],q[2]));double[] n=normalAt(i);ns.add(list(n[0],n[1],n[2]));ks.add(kinds[i]);bs.add(bands[i]);cs.add(cells[i]);}
    Map<String,Object> out=new LinkedHashMap<String,Object>(); out.put("positions",ps);out.put("triangles",ts);out.put("normals",ns);out.put("faceKinds",ks);out.put("bands",bs);out.put("cells",cs);return out;
  }

  private static void into(double[] data,int n,double[] out,int offset){
    if(out==null||offset<0||offset>out.length-3)throw new MeshException("INVALID_OUTPUT");
    n*=3;
    out[offset]=data[n];
    out[offset+1]=data[n+1];
    out[offset+2]=data[n+2];
    }
   private static double[] triple(double[] a,int n){
    n*=3;
    return new double[]{
      a[n],a[n+1],a[n+2]}
    ;
    }

  private static final class Profile{
    final int n;
    final double[] z,r;
    Profile(double[] z,double[] r){
      n=z.length;
      this.z=z;
      this.r=r;
      }
    }

  private static Profile profile(Object value){
    if(!(value instanceof List)||((List<?>)value).size()<2)bad();
    List<?> rows=(List<?>)value; int size=rows.size(); double[] z=new double[size],r=new double[size]; int index=0;
    for(Object row:rows){
      if(!(row instanceof List)||((List<?>)row).size()!=2)bad();
      List<?> pair=(List<?>)row; z[index]=number(pair.get(0)); r[index]=number(pair.get(1));
      if(index>0&&!(z[index-1]<z[index]))bad();
      if(r[index]<0||(index>0&&index+1<size&&r[index]<=0))bad();
      index++;
    }
    if(size==2&&r[0]==0&&r[1]==0)bad(); return new Profile(z,r);
  }

  private static Map<?,?> record(Object x,String[] keys){
    if(!(x instanceof Map))bad();
    Map<?,?> m=(Map<?,?>)x;
    if(m.size()!=keys.length)bad();
    for(String k:keys)if(!m.containsKey(k))bad();
    return m;
    }
   private static boolean bool(Object x){
    if(!(x instanceof Boolean))bad();
    return ((Boolean)x).booleanValue();
    }
   private static int count(Object x,int low,int high){
    double n=number(x);
    if(n<low||n>high||n!=Math.floor(n))bad();
    return (int)n;
    }
   private static double number(Object x){
    if(!(x instanceof Byte||x instanceof Short||x instanceof Integer||x instanceof Long||x instanceof Float||x instanceof Double))bad();
    double n=((Number)x).doubleValue();
    if(!finite(n))bad();
    return zero(n);
    }
   private static boolean finite(double x){
    return !Double.isInfinite(x)&&!Double.isNaN(x);
    }
   private static void bad(){
    throw new MeshException("INVALID_INPUT");
    }
   private static double zero(double x){
    return x==0?0:x;
    }
   private static long access(Object x){
    if(!(x instanceof Byte||x instanceof Short||x instanceof Integer||x instanceof Long||x instanceof Float||x instanceof Double))throw new MeshException("INVALID_INDEX");
    double n=((Number)x).doubleValue();
    if(!finite(n)||n<0||n>SAFE||n!=Math.floor(n))throw new MeshException("INVALID_INDEX");
    return (long)n;
    }
   private static int index(long i,int size){
    if(i<0||i>SAFE)throw new MeshException("INVALID_INDEX");
    if(i>=size)throw new MeshException("INDEX_OUT_OF_RANGE");
    return (int)i;
    }
   private static List<Object> list(Object a,Object b,Object c){
    List<Object>x=new ArrayList<Object>(3);
    x.add(a);
    x.add(b);
    x.add(c);
    return x;
    }

}

