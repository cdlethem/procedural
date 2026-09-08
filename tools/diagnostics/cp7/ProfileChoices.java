import java.io.File;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import processing.data.JSONObject;
import processing.data.JSONArray;
import processing.opengl.PGL;
import processing.opengl.PGraphics3D;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import processing.core.PApplet;
import org.procedurals.color.CyclicPalette;

/**
 * Private CP7 retained-profile mesh experiment. --inspect is pure geometry only;
 * --render is deliberately dormant until a separately registered P3D run.
 */
public final class ProfileChoices extends PApplet {
  private static final int MAX_FACES = 10000;
  private static final int[] PRIMARY = {0xEBB858,0xEEA8C1,0xD0CBC3,0x87B6C4,0xEA4140,0x5A5787};
  private static final int[] ALTERNATE = {0x243B53,0x3E8C93,0xE9C46A,0xE76F51};
  private final List<Choice> choices;
  private final File output;
  private int drawn;
  private int drawnFaces;
  private JSONObject context;

  private ProfileChoices(List<Choice> choices, File output) { this.choices=choices; this.output=output; }
  private static final class Point { final double z,r; Point(double z,double r){this.z=z;this.r=r;} }
  private static final class Face { final int a,b,c,band,cell; final String kind; Face(int a,int b,int c,String kind,int band,int cell){this.a=a;this.b=b;this.c=c;this.kind=kind;this.band=band;this.cell=cell;} }
  private static final class Mesh {
    final double[] xyz; final List<Face> faces; final int slices;
    Mesh(double[] xyz,List<Face> faces,int slices){this.xyz=xyz;this.faces=Collections.unmodifiableList(new ArrayList<Face>(faces));this.slices=slices;}
    int vertices(){return xyz.length/3;}
  }
  private static final class Choice { final String id; final Mesh mesh; final int[] palette; Choice(String id,Mesh mesh,int[] palette){this.id=id;this.mesh=mesh;this.palette=palette.clone();} }

  private static int put(List<Double> values,double x,double y,double z){int i=values.size()/3;values.add(x);values.add(y);values.add(z);return i;}
  private static double x(Mesh m,int i){return m.xyz[i*3];} private static double y(Mesh m,int i){return m.xyz[i*3+1];} private static double z(Mesh m,int i){return m.xyz[i*3+2];}
  private static void need(boolean value,String message){if(!value)throw new IllegalArgumentException(message);}

  private static Mesh build(List<Point> profile,int slices,boolean bottomCap,boolean topCap){
    need(slices>=3&&profile.size()>=2,"profile/slices");
    for(int i=0;i<profile.size();i++){Point p=profile.get(i);need(Double.isFinite(p.z)&&Double.isFinite(p.r)&&p.r>=0,"finite profile");if(i>0)need(profile.get(i-1).z<p.z,"increasing z");if(i>0&&i+1<profile.size())need(p.r>0,"positive interior radius");}
    need(!(profile.size()==2&&profile.get(0).r==0&&profile.get(1).r==0),"two poles");
    int sideFaces=0;for(int i=0;i+1<profile.size();i++)sideFaces+=slices*(profile.get(i).r==0||profile.get(i+1).r==0?1:2);
    int capFaces=(bottomCap&&profile.get(0).r>0?slices:0)+(topCap&&profile.get(profile.size()-1).r>0?slices:0);
    need(sideFaces+capFaces<=MAX_FACES,"face preflight");
    List<Double> positions=new ArrayList<Double>();List<Object> rings=new ArrayList<Object>();List<Face> faces=new ArrayList<Face>();
    for(Point p:profile){if(p.r==0){rings.add(Integer.valueOf(put(positions,0,0,p.z)));}else{int[] ring=new int[slices];for(int c=0;c<slices;c++){double t=2*Math.PI*c/slices;ring[c]=put(positions,p.r*Math.cos(t),p.r*Math.sin(t),p.z);}rings.add(ring);}}
    for(int band=0;band+1<profile.size();band++){
      Object low=rings.get(band), high=rings.get(band+1);
      for(int cell=0;cell<slices;cell++){int next=(cell+1)%slices;
        if(low instanceof int[]&&high instanceof int[]){int[] a=(int[])low,b=(int[])high;faces.add(new Face(a[cell],a[next],b[next],"side",band,cell));faces.add(new Face(a[cell],b[next],b[cell],"side",band,cell));}
        else if(low instanceof Integer){int[] b=(int[])high;faces.add(new Face(((Integer)low).intValue(),b[next],b[cell],"side",band,cell));}
        else {int[] a=(int[])low;faces.add(new Face(a[cell],a[next],((Integer)high).intValue(),"side",band,cell));}
      }
    }
    if(bottomCap&&rings.get(0) instanceof int[]){int center=put(positions,0,0,profile.get(0).z);int[] ring=(int[])rings.get(0);for(int c=0;c<slices;c++)faces.add(new Face(center,ring[(c+1)%slices],ring[c],"bottom-cap",-1,c));}
    if(topCap&&rings.get(rings.size()-1) instanceof int[]){int center=put(positions,0,0,profile.get(profile.size()-1).z);int[] ring=(int[])rings.get(rings.size()-1);for(int c=0;c<slices;c++)faces.add(new Face(center,ring[c],ring[(c+1)%slices],"top-cap",-1,c));}
    double[] xyz=new double[positions.size()];for(int i=0;i<xyz.length;i++)xyz[i]=positions.get(i);Mesh mesh=new Mesh(xyz,faces,slices);inspect(mesh);return mesh;
  }
  private static void inspect(Mesh mesh){
    need(mesh.xyz.length%3==0,"positions");for(double v:mesh.xyz)need(Double.isFinite(v),"finite position");
    for(Face f:mesh.faces){need(f.a>=0&&f.b>=0&&f.c>=0&&f.a<mesh.vertices()&&f.b<mesh.vertices()&&f.c<mesh.vertices(),"index");need(f.a!=f.b&&f.b!=f.c&&f.c!=f.a,"repeated index");double[] n=normal(mesh,f);double area=n[0]*n[0]+n[1]*n[1]+n[2]*n[2];need(Double.isFinite(area)&&area>0,"area");if("bottom-cap".equals(f.kind))need(n[2]<0,"bottom winding");if("top-cap".equals(f.kind))need(n[2]>0,"top winding");}
  }
  private static double[] normal(Mesh m,Face f){double ax=x(m,f.a),ay=y(m,f.a),az=z(m,f.a);double ux=x(m,f.b)-ax,uy=y(m,f.b)-ay,uz=z(m,f.b)-az;double vx=x(m,f.c)-ax,vy=y(m,f.c)-ay,vz=z(m,f.c)-az;return new double[]{uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx};}
  private static String hash(Mesh mesh) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      ByteBuffer bytes = ByteBuffer.allocate(8);
      for (double value : mesh.xyz) {
        bytes.clear(); bytes.putLong(Double.doubleToRawLongBits(value)); digest.update(bytes.array());
      }
      for (Face face : mesh.faces) {
        for (int value : new int[]{face.a,face.b,face.c,face.band,face.cell}) {
          bytes.clear(); bytes.putLong(value); digest.update(bytes.array());
        }
        digest.update(face.kind.getBytes(StandardCharsets.UTF_8)); digest.update((byte)0);
      }
      StringBuilder hex = new StringBuilder();
      for (byte value : digest.digest()) hex.append(String.format(java.util.Locale.ROOT,"%02x",value & 255));
      return hex.toString();
    } catch (Exception error) { throw new IllegalStateException(error); }
  }
  private static List<Point> baseline(){List<Point> p=new ArrayList<Point>();for(int j=0;j<=16;j++)p.add(new Point(-160+20*j,60));return p;}
  private static List<Point> waist(){List<Point> p=new ArrayList<Point>();for(int j=0;j<=16;j++)p.add(new Point(-160+20*j,60-36*Math.cos((j/16.0-.5)*Math.PI)));return p;}
  private static List<Point> pointed(){List<Point> p=new ArrayList<Point>();for(int j=0;j<=16;j++)p.add(new Point(-160+20*j,j==16?0:60*(1-j/16.0)));return p;}
  private static List<Choice> choices() {
    // Bound the complete fixed experiment before allocating any mesh; these are private configurations.
    int total = 1088 + 1088 + 1024 + 272 + 1024;
    need(total <= MAX_FACES, "whole experiment face preflight");
    Mesh base=build(baseline(),32,true,true);
    Mesh waist=build(waist(),32,true,true);
    Mesh pointed=build(pointed(),32,true,false);
    List<Choice> result = Arrays.asList(new Choice("baseline",base,PRIMARY),
        new Choice("waist",waist,PRIMARY),new Choice("pointed",pointed,PRIMARY),
        new Choice("coarse",build(baseline(),8,true,true),PRIMARY),
        new Choice("open",build(baseline(),32,false,false),PRIMARY),
        new Choice("recolour",base,ALTERNATE),new Choice("transfer",base,PRIMARY));
    int actual=0;
    for (int i=0;i<5;i++) actual+=result.get(i).mesh.faces.size();
    need(actual==total,"whole experiment face count");
    need(result.get(5).mesh==base && result.get(6).mesh==base,"retained reuse");
    return result;
  }
  private static JSONObject inspectJson(List<Choice> choices) {
    JSONObject result=new JSONObject(); result.setString("status","passed");
    JSONArray cases=new JSONArray(); int generated=0,drawn=0;
    for (int i=0;i<choices.size();i++) {
      Choice choice=choices.get(i); JSONObject entry=new JSONObject();
      entry.setString("id",choice.id); JSONArray meshes=new JSONArray();
      Mesh[] used = "transfer".equals(choice.id)
          ? new Mesh[]{choices.get(0).mesh,choices.get(1).mesh,choices.get(2).mesh}
          : new Mesh[]{choice.mesh};
      int faces=0;
      for (int j=0;j<used.length;j++) {
        Mesh mesh=used[j]; JSONObject record=new JSONObject();
        record.setInt("vertices",mesh.vertices()); record.setInt("faces",mesh.faces.size());
        record.setString("geometry_sha256",hash(mesh)); meshes.setJSONObject(j,record);
        faces+=mesh.faces.size();
      }
      entry.setJSONArray("meshes",meshes); entry.setInt("drawn_faces",faces);
      entry.setBoolean("reuses_retained_geometry",i>=5); cases.setJSONObject(i,entry);
      drawn+=faces; if(i<5) generated+=choice.mesh.faces.size();
    }
    result.setJSONArray("cases",cases); result.setInt("generated_faces",generated);
    result.setInt("expected_drawn_faces",drawn); return result;
  }
  public static void main(String[] args) {
    List<Choice> choices=choices();
    if(args.length==1 && "--dump".equals(args[0])) {
      JSONObject report=new JSONObject(); JSONArray meshes=new JSONArray();
      for(int i=0;i<5;i++) {
        Choice choice=choices.get(i); Mesh mesh=choice.mesh; JSONObject value=new JSONObject();
        value.setString("id",choice.id); JSONArray positions=new JSONArray(),faces=new JSONArray();
        for(int j=0;j<mesh.vertices();j++) {
          JSONArray xyz=new JSONArray(); xyz.setDouble(0,x(mesh,j)); xyz.setDouble(1,y(mesh,j)); xyz.setDouble(2,z(mesh,j));
          positions.setJSONArray(j,xyz);
        }
        for(int j=0;j<mesh.faces.size();j++) {
          Face face=mesh.faces.get(j); JSONObject entry=new JSONObject(); JSONArray indices=new JSONArray();
          indices.setInt(0,face.a); indices.setInt(1,face.b); indices.setInt(2,face.c);
          entry.setJSONArray("indices",indices); entry.setString("kind",face.kind);
          entry.setInt("band",face.band); entry.setInt("cell",face.cell); faces.setJSONObject(j,entry);
        }
        value.setJSONArray("positions",positions); value.setJSONArray("faces",faces); meshes.setJSONObject(i,value);
      }
      report.setJSONArray("meshes",meshes); System.out.println(report); return;
    }
    if(args.length==1 && "--inspect".equals(args[0])) {
      System.out.println(inspectJson(choices)); return;
    }
    if(args.length==2 && "--render".equals(args[0])) {
      File out=new File(args[1]); need(out.isAbsolute() && out.isDirectory(),"existing absolute output directory");
      PApplet.runSketch(new String[]{"ProfileChoices"},new ProfileChoices(choices,out)); return;
    }
    throw new IllegalArgumentException("usage: --inspect | --render <absolute-output-directory>");
  }
  private static CyclicPalette palette(int[] colors) {
    Map<String,Object> input = new LinkedHashMap<String,Object>(); List<Integer> values = new ArrayList<Integer>();
    for (int color : colors) values.add(Integer.valueOf(color)); input.put("colors", values); return CyclicPalette.create(input);
  }
  private void drawMesh(Mesh mesh, int[] colors) {
    CyclicPalette palette=palette(colors);
    beginShape(TRIANGLES);
    for(Face face:mesh.faces) {
      double phase="side".equals(face.kind) ? face.band/8.0+face.cell/(mesh.slices*8.0)
          : ("bottom-cap".equals(face.kind) ? .15 : .65);
      fill(0xff000000 | palette.sample(phase));
      double[] n=normal(mesh,face);
      double length=Math.sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]);
      // Flat per-face normals are explicit private rendering glue, evaluated once per drawn triangle.
      normal((float)(n[0]/length),(float)(n[1]/length),(float)(n[2]/length));
      vertex((float)x(mesh,face.a),(float)y(mesh,face.a),(float)z(mesh,face.a));
      vertex((float)x(mesh,face.b),(float)y(mesh,face.b),(float)z(mesh,face.b));
      vertex((float)x(mesh,face.c),(float)y(mesh,face.c),(float)z(mesh,face.c));
      drawnFaces++;
    }
    endShape();
  }
  private void placedMesh(Mesh mesh,int[] colors,float px,float scaleValue) {
    pushMatrix(); translate(px,320); rotateX(1.0f); rotateY(.35f); scale(scaleValue);
    drawMesh(mesh,colors); popMatrix();
  }
  private void renderChoice(Choice choice) {
    if("transfer".equals(choice.id)) {
      for(int i=0;i<3;i++) placedMesh(choices.get(i).mesh,PRIMARY,140+180*i,.45f);
    } else placedMesh(choice.mesh,choice.palette,320,1);
  }
  public void settings(){size(640,640,P3D);pixelDensity(1);}
  public void setup(){
    need(g instanceof PGraphics3D,"actual P3D renderer");
    context=new JSONObject(); context.setString("renderer_class",g.getClass().getName());
    PGL gl=beginPGL();
    try {
      String[] names={"vendor","renderer","version"}; int[] constants={PGL.VENDOR,PGL.RENDERER,PGL.VERSION};
      for(int i=0;i<3;i++) {
        String value=gl.getString(constants[i]); need(value!=null && !value.trim().isEmpty(),"GL context string");
        context.setString(names[i],value);
      }
    } finally {endPGL();}
    frameRate(15);
  }
  public void draw(){
    need(drawn<choices.size(),"unexpected extra draw");
    Choice choice=choices.get(drawn); background(243,240,232); lights(); noStroke(); ortho();
    renderChoice(choice);
    loadPixels(); int changed=0;
    for(int pixel:pixels) {
      need((pixel>>>24)==255,"opaque frame");
      if((pixel&0xffffff)!=0xf3f0e8) changed++;
    }
    need(changed>0,"nonblank frame "+choice.id);
    File image=new File(output,choice.id+".png"); need(!image.exists(),"refuse overwrite image");
    save(image.getAbsolutePath()); drawn++;
    if(drawn==choices.size()) {
      JSONObject report=inspectJson(choices);
      need(drawnFaces==report.getInt("expected_drawn_faces"),"actual drawn faces");
      report.setJSONObject("context",context); report.setInt("frames",drawn);
      report.setInt("drawn_faces",drawnFaces); report.setInt("normal_evaluations",drawnFaces);
      report.setInt("width",width); report.setInt("height",height); report.setInt("pixel_density",pixelDensity);
      File nativeFile=new File(output,"native.json"); need(!nativeFile.exists(),"refuse overwrite native report");
      saveJSONObject(report,nativeFile.getAbsolutePath()); noLoop(); exit();
    }
  }
}
