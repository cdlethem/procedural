package org.procedurals.mesh;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
/**
 * Owned indexed closed annular mesh for {@code mesh.annular-solid-3d} 0.1.0.
 *
 * <p>Local units are caller-defined. The axis is {@code +Z}, and angular cells increase
 * from {@code +X} toward {@code +Y}. The result contains four welded rings in
 * outer-bottom, outer-top, inner-bottom, inner-top order, and four face kinds per cell:
 * outer wall, inner wall, top annulus, and bottom annulus. There is no seam vertex at
 * {@code 2π} and no interior radial face.</p>
 *
 * <p>The operation is motivated by {@code survey/out/2017/Generativos/aros/notes.md}
 * (the {@code annulusMesh} candidate and its modularisation decision) and the associated
 * private study decision in {@code evidence/parameter-experiments/annular-mesh/decision.md}.
 * That evidence establishes the annular boundary geometry; its
 * colors, animation, renderer, duplicated internal faces, and winding/axial discrepancies
 * are outside this operation. The operation has no renderer, style, random state, defaults,
 * or recommended parameter range. Results own packed primitive storage; exported triples
 * and maps are detached copies.</p>
 *
 * <p>The {@code Into} methods validate the index before the destination and leave the
 * destination unchanged on validation failure. Their three array writes are not a
 * synchronization mechanism; callers must coordinate shared destination access.</p>
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
  /**
   * Static input or retained-result access failed.
   *
   * <p>{@link #code} identifies {@code INVALID_INPUT}, {@code INVALID_INDEX},
   * {@code INDEX_OUT_OF_RANGE}, or {@code INVALID_OUTPUT}.</p>
   */
  public static final class MeshException extends IllegalArgumentException  {
    /** Stable contract error code. */
    public final String code;
    /**
     * Creates an exception for a contract error.
     * @param code stable error code to expose
     */
    public MeshException(String code)  {
      super(code);
      this.code=code;
    }
  }
  /** Valid input exceeded its required face budget before geometry allocation. */
  public static final class FaceLimitException extends IllegalArgumentException  {
    /** Stable value {@code FACE_LIMIT_EXCEEDED}. */
    public final String code="FACE_LIMIT_EXCEEDED";
    /** Creates a face-budget exception with the stable contract message. */
    public FaceLimitException() {
      super("FACE_LIMIT_EXCEEDED");
    }
  }
  /** A generated face cannot produce the specified scaled flat normal. */
  public static final class MeshArithmeticException extends ArithmeticException  {
    /** Stable value {@code MESH_ARITHMETIC_INVALID}. */
    public final String code="MESH_ARITHMETIC_INVALID";
    /** Zero-based face index whose normal calculation failed. */
    public final int faceIndex;
    /** Arithmetic stage: {@code edge}, {@code edge_scale}, or {@code cross_scale}. */
    public final String stage;
    /**
     * Records the failed face and normal-arithmetic stage.
     *
     * <p>This constructor is package-private because callers receive this exception only
     * from eager generation.</p>
     * @param faceIndex zero-based triangle face whose normal failed
     * @param stage failed normal stage: {@code edge}, {@code edge_scale}, or {@code cross_scale}
     */
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
  /**
   * Generates the four-ring, welded-seam annular solid from an exact passive map record.
   *
   * <p>The record must contain exactly {@code outerRadius}, {@code innerRadius},
   * {@code bottomZ}, {@code topZ}, {@code slices}, and {@code maxFaces}. Static validation
   * completes before count checks, allocation, topology, or normal arithmetic. A valid
   * input produces {@code V = 4 * slices} shared vertices and {@code F = 8 * slices}
   * triangles. {@link FaceLimitException} is raised before geometry allocation when
   * {@code F > maxFaces}; arithmetic failure raises {@link MeshArithmeticException} and
   * returns no partial result. There are no defaults, renderer effects, or retained input
   * references.</p>
   *
   * <p>Radii and axial coordinates are finite local distance values, with
   * {@code outerRadius > innerRadius > 0} and {@code bottomZ < topZ}.
   * {@code slices} is an integer in [3,89478485]; {@code maxFaces} is an integer in
   * [1,715827881]. These ceilings address packed storage and do not guarantee that
   * such allocations are practical. Numeric carriers are Byte, Short, Integer, Long,
   * Float and Double; other Number subclasses and booleans are rejected.</p>
   *
   * @param input passive map record with the six exact contract keys
   * @return a new immutable mesh owning its generated positions, normals, and triangle indices
   * @throws MeshException if the record, numeric carriers, domains, or exact keys are invalid
   * @throws FaceLimitException if the exact triangle count exceeds {@code maxFaces}
   * @throws MeshArithmeticException if a generated face normal fails at a specified stage
   * @throws OutOfMemoryError if host allocation cannot provide the result; no partial result is returned
   */
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
  /**
   * Returns the retained vertex count, {@code V = 4 * slices}.
   * @return number of position triples; vertices are indexed from zero
   */
  public int vertexCount() {
    return positions.length/3;
  }
  /**
   * Returns the retained triangle face count, {@code F = 8 * slices}.
   * @return number of triangle and aligned normal, kind, and cell records
   */
  public int faceCount() {
    return triangles.length/3;
  }
  /**
   * Returns a fresh detached local {@code [x,y,z]} position triple for a vertex.
   * @param index zero-based vertex index
   * @return new three-element array containing the vertex position
   * @throws MeshException if the index is invalid or outside the vertex range
   */
  public double[] vertexAt(long index) {
    return triple(positions,index(index,vertexCount()));
  }
  /**
   * Returns a vertex position using an accepted numeric index carrier.
   * @param index finite nonnegative safe integral numeric carrier
   * @return fresh detached local {@code [x,y,z]} vertex position
   * @throws MeshException if the carrier is invalid or outside the vertex range
   */
  public double[] vertexAt(Object index) {
    return vertexAt(access(index));
  }
  /**
   * Returns a fresh detached flat unit normal triple aligned with a triangle face.
   * @param index zero-based triangle face index
   * @return new three-element array containing the face normal
   * @throws MeshException if the index is invalid or outside the face range
   */
  public double[] normalAt(long index) {
    return triple(normals,index(index,faceCount()));
  }
  /**
   * Returns a face normal using an accepted numeric index carrier.
   * @param index finite nonnegative safe integral numeric carrier
   * @return fresh detached flat unit normal triple
   * @throws MeshException if the carrier is invalid or outside the face range
   */
  public double[] normalAt(Object index) {
    return normalAt(access(index));
  }
  /**
   * Returns a fresh detached {@code [a,b,c]} position-vertex index triple for a face.
   * @param index zero-based triangle face index
   * @return new three-element array of vertex indices
   * @throws MeshException if the index is invalid or outside the face range
   */
  public int[] triangleAt(long index) {
    int i=index(index,faceCount())*3;
    return new int[] {
      triangles[i],triangles[i+1],triangles[i+2]
    }
    ;
  }
  /**
   * Returns triangle vertex indices using an accepted numeric index carrier.
   * @param index finite nonnegative safe integral numeric carrier
   * @return fresh detached {@code [a,b,c]} vertex-index triple
   * @throws MeshException if the carrier is invalid or outside the face range
   */
  public int[] triangleAt(Object index) {
    return triangleAt(access(index));
  }
  /**
   * Returns the face kind aligned with a triangle face.
   * @param index zero-based triangle face index
   * @return {@code outer-wall}, {@code inner-wall}, {@code top-annulus}, or {@code bottom-annulus}
   * @throws MeshException if the index is invalid or outside the face range
   */
  public String faceKindAt(long index) {
    return KINDS[(index(index,faceCount())%8)/2];
  }
  /**
   * Returns a face kind using an accepted numeric index carrier.
   * @param index finite nonnegative safe integral numeric carrier
   * @return aligned face-kind string
   * @throws MeshException if the carrier is invalid or outside the face range
   */
  public String faceKindAt(Object index) {
    return faceKindAt(access(index));
  }
  /**
   * Returns the angular cell aligned with a triangle face.
   * @param index zero-based triangle face index
   * @return zero-based cell in increasing angular traversal order
   * @throws MeshException if the index is invalid or outside the face range
   */
  public int cellAt(long index) {
    return index(index,faceCount())/8;
  }
  /**
   * Returns an aligned angular cell using an accepted numeric index carrier.
   * @param index finite nonnegative safe integral numeric carrier
   * @return zero-based angular cell
   * @throws MeshException if the carrier is invalid or outside the face range
   */
  public int cellAt(Object index) {
    return cellAt(access(index));
  }
  /**
   * Validates access and destination, then writes one vertex position triple atomically.
   * @param index zero-based vertex index
   * @param output writable destination array of at least three slots from {@code offset}
   * @param offset destination slot receiving the vertex's {@code x} component
   * @throws MeshException if index or destination validation fails; no destination slot is changed
   */
  public void vertexInto(long index,double[] output,int offset) {
    into(positions,index(index,vertexCount()),output,offset);
  }
  /**
   * Writes a vertex position using an accepted numeric index carrier.
   * @param index finite nonnegative safe integral numeric carrier
   * @param output writable destination double array
   * @param offset destination slot receiving {@code x}; three contiguous slots are required
   * @throws MeshException if index or destination validation fails; writes are atomic
   */
  public void vertexInto(Object index,double[] output,int offset) {
    vertexInto(access(index),output,offset);
  }
  /**
   * Validates access and destination, then writes one face normal triple atomically.
   * @param index zero-based triangle face index
   * @param output writable destination array of at least three slots from {@code offset}
   * @param offset destination slot receiving the normal's {@code x} component
   * @throws MeshException if index or destination validation fails; no destination slot is changed
   */
  public void normalInto(long index,double[] output,int offset) {
    into(normals,index(index,faceCount()),output,offset);
  }
  /**
   * Writes a face normal using an accepted numeric index carrier.
   * @param index finite nonnegative safe integral numeric carrier
   * @param output writable destination double array
   * @param offset destination slot receiving {@code x}; three contiguous slots are required
   * @throws MeshException if index or destination validation fails; writes are atomic
   */
  public void normalInto(Object index,double[] output,int offset) {
    normalInto(access(index),output,offset);
  }
  /**
   * Validates access and destination, then writes one triangle's three vertex indices atomically.
   * @param index zero-based triangle face index
   * @param output writable destination integer array of at least three slots from {@code offset}
   * @param offset destination slot receiving the first vertex index
   * @throws MeshException if index or destination validation fails; no destination slot is changed
   */
  public void triangleInto(long index,int[] output,int offset) {
    int f=index(index,faceCount());
    if(output==null||offset<0||offset>output.length-3)throw new MeshException("INVALID_OUTPUT");
    int i=f*3;
    output[offset]=triangles[i];
    output[offset+1]=triangles[i+1];
    output[offset+2]=triangles[i+2];
  }
  /**
   * Writes triangle vertex indices using an accepted numeric index carrier.
   * @param index finite nonnegative safe integral numeric carrier
   * @param output writable destination integer array
   * @param offset destination slot receiving the first vertex index; three contiguous slots are required
   * @throws MeshException if index or destination validation fails; writes are atomic
   */
  public void triangleInto(Object index,int[] output,int offset) {
    triangleInto(access(index),output,offset);
  }
  /**
   * Returns a deep detached ordinary-value representation in output-schema key order.
   * The keys are {@code positions}, {@code triangles}, {@code normals}, {@code faceKinds},
   * and {@code cells}; each position, triangle, and normal is a separate three-element list.
   * @return newly allocated map and nested lists containing all retained output values
   * @throws OutOfMemoryError if materialization allocation fails; retained mesh data remains intact
   */
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
