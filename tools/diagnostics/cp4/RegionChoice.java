import java.io.File;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PConstants;

/**
 * Private CP4 region walkthrough. This is a bounded JAVA2D investigation, not a
 * package API, public contract, catalog entry, or source reconstruction. Its chooser
 * intentionally uses java.util.Random only as a labelled investigation stream.
 */
public strictfp final class RegionChoice {
  private static final int WIDTH=640, HEIGHT=640;
  private static final long SEED=42L;
  private static final int[] PALETTE={0x173F5F,0x20639B,0x3CAEA3,0xF6D55C,0xED553B};
  private static final int BACKGROUND=0xF3F0E8;
  private RegionChoice() { }

  private static final class Leaf {
    final int id; final double x,y,width,height;
    Leaf(int id,double x,double y,double width,double height) { this.id=id;this.x=x;this.y=y;this.width=width;this.height=height; }
    double area() { return width*height; }
  }
  private static final class Leaves {
    final ArrayList<Leaf> values=new ArrayList<Leaf>();
    int nextId=1;
    Leaves() { values.add(new Leaf(0,0,0,WIDTH,HEIGHT)); }
    /** Exact investigation schedule: append TL/TR/BR/BL, then remove the selected parent. */
    void replaceQuadrants(int index) {
      Leaf parent=values.get(index); double halfWidth=parent.width*0.5d,halfHeight=parent.height*0.5d;
      values.add(new Leaf(nextId++,parent.x,parent.y,halfWidth,halfHeight));
      values.add(new Leaf(nextId++,parent.x+halfWidth,parent.y,halfWidth,halfHeight));
      values.add(new Leaf(nextId++,parent.x+halfWidth,parent.y+halfHeight,halfWidth,halfHeight));
      values.add(new Leaf(nextId++,parent.x,parent.y+halfHeight,halfWidth,halfHeight));
      values.remove(index);
    }
    /** Explicit design-transfer route: append row-major grid cells, then remove parent. */
    void replaceGridById(int id,int columns,int rows) {
      if(columns<=0 || rows<=0) throw new IllegalArgumentException("grid dimensions");
      int index=-1; for(int i=0;i<values.size();i++) if(values.get(i).id==id) { index=i; break; }
      if(index<0) throw new IllegalArgumentException("missing selected leaf id "+id);
      Leaf parent=values.get(index); double cellWidth=parent.width/columns,cellHeight=parent.height/rows;
      for(int row=0;row<rows;row++) for(int column=0;column<columns;column++)
        values.add(new Leaf(nextId++,parent.x+column*cellWidth,parent.y+row*cellHeight,cellWidth,cellHeight));
      values.remove(index);
    }
  }
  private static final class Profile {
    final String id,selection,content; final int replacements; final Leaves leaves;
    Profile(String id,String selection,String content,int replacements,Leaves leaves) { this.id=id;this.selection=selection;this.content=content;this.replacements=replacements;this.leaves=leaves; }
  }
  private static final class Digest {
    final MessageDigest digest;
    Digest() { try { digest=MessageDigest.getInstance("SHA-256"); } catch(NoSuchAlgorithmException error) { throw new AssertionError(error); } }
    void text(String value) { digest.update(value.getBytes(StandardCharsets.UTF_8));digest.update((byte)0); }
    void integer(int value) { digest.update((byte)(value>>>24));digest.update((byte)(value>>>16));digest.update((byte)(value>>>8));digest.update((byte)value); }
    void bits(double value) { long raw=Double.doubleToRawLongBits(value);for(int shift=56;shift>=0;shift-=8)digest.update((byte)(raw>>>shift)); }
    String finish() { StringBuilder out=new StringBuilder(64);for(byte value:digest.digest())out.append(String.format("%02x",value&255));return out.toString(); }
  }

  private static Profile seeded(String id,int replacements,boolean full,String content) {
    Leaves leaves=new Leaves(); Random chooser=new Random(SEED);
    for(int step=0;step<replacements;step++) {
      float selectionBound=full ? leaves.values.size() : leaves.values.size()*0.5f;
      // Exactly one nextFloat call per replacement; no palette prelude or content consumes it.
      int selected=(int)(chooser.nextFloat()*selectionBound);
      if(selected<0 || selected>=leaves.values.size()) throw new AssertionError("chooser index");
      leaves.replaceQuadrants(selected);
    }
    return new Profile(id,full?"full-live-list":"first-half-live-list",content,replacements,leaves);
  }
  private static Profile explicitTransfer() {
    Leaves leaves=new Leaves();
    leaves.replaceGridById(0,2,3); // six cells, row-major child creation ids 1..6
    leaves.replaceGridById(3,2,3); // one live cell receives a second explicit 2x3 replacement
    return new Profile("explicit-grid-refinement-transfer","explicit-stable-id-plan","content-grid",2,leaves);
  }
  private static Profile profile(String id) {
    if("100half".equals(id)) return seeded(id,100,false,"panel-mark");
    if("200half".equals(id)) return seeded(id,200,false,"panel-mark");
    if("100full".equals(id)) return seeded(id,100,true,"panel-mark");
    if("same100half-contentgrid".equals(id)) return seeded(id,100,false,"content-grid");
    if("explicit-grid-refinement-transfer".equals(id)) return explicitTransfer();
    throw new IllegalArgumentException("unknown registered case: "+id);
  }
  private static boolean raw(double a,double b) { return Double.doubleToRawLongBits(a)==Double.doubleToRawLongBits(b); }
  private static boolean sameGeometry(Leaves left,Leaves right) {
    if(left.values.size()!=right.values.size()) return false;
    for(int i=0;i<left.values.size();i++) { Leaf a=left.values.get(i),b=right.values.get(i);
      if(a.id!=b.id||!raw(a.x,b.x)||!raw(a.y,b.y)||!raw(a.width,b.width)||!raw(a.height,b.height)) return false;
    } return true;
  }
  private static String geometryHash(Leaves leaves) {
    Digest digest=new Digest();digest.text("cp4-region-leaves-v1");digest.integer(leaves.values.size());
    for(Leaf leaf:leaves.values) { digest.integer(leaf.id);digest.bits(leaf.x);digest.bits(leaf.y);digest.bits(leaf.width);digest.bits(leaf.height); }
    return digest.finish();
  }
  private static void require(boolean condition,String message) { if(!condition) throw new AssertionError(message); }
  private static void verify(Leaves leaves,String label,boolean dyadic) {
    double area=0.0;
    for(int i=0;i<leaves.values.size();i++) { Leaf a=leaves.values.get(i);
      require(Double.isFinite(a.x)&&Double.isFinite(a.y)&&Double.isFinite(a.width)&&Double.isFinite(a.height),label+" finite bounds");
      require(a.width>0.0&&a.height>0.0,label+" positive bounds");
      require(a.x>=0.0&&a.y>=0.0&&a.x+a.width<=WIDTH&&a.y+a.height<=HEIGHT,label+" canvas coverage");
      area+=a.area();
      for(int j=0;j<i;j++) { Leaf b=leaves.values.get(j);
        boolean overlap=a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
        require(!overlap,label+" overlapping interiors");
      }
    }
    if(dyadic) require(raw(area,WIDTH*(double)HEIGHT),label+" exact dyadic area conservation"); else require(Math.abs(area-WIDTH*(double)HEIGHT)<=1e-9,label+" explicit-grid area conservation");
  }
  private static void numeric() {
    Profile half=profile("100half"), twice=profile("200half"), full=profile("100full"), grid=profile("same100half-contentgrid"), explicit=profile("explicit-grid-refinement-transfer");
    verify(half.leaves,half.id,true);verify(twice.leaves,twice.id,true);verify(full.leaves,full.id,true);verify(grid.leaves,grid.id,true);verify(explicit.leaves,explicit.id,false);
    require(half.leaves.values.size()==301,"100 replacements leaf count"); require(twice.leaves.values.size()==601,"200 replacements leaf count");
    require(sameGeometry(half.leaves,grid.leaves),"content replacement changed geometry");
    require(!geometryHash(half.leaves).equals(geometryHash(full.leaves)),"selection variants unexpectedly identical");
    require(sameGeometry(half.leaves,profile("100half").leaves),"seeded order nondeterministic");
    StringBuilder profiles=new StringBuilder();
    for(String id:new String[]{"100half","200half","100full","same100half-contentgrid","explicit-grid-refinement-transfer"}) {
      if(profiles.length()>0) profiles.append(','); Profile value=profile(id);
      profiles.append(quote(id)).append(":{").append("\"selection\":").append(quote(value.selection)).append(",\"content\":").append(quote(value.content)).append(",\"replacements\":").append(value.replacements).append(",\"leaf_count\":").append(value.leaves.values.size()).append(",\"geometry_sha256\":").append(quote(geometryHash(value.leaves))).append('}');
    }
    System.out.println("{\"status\":\"passed\",\"experiment\":\"cp4-regions\",\"private_only\":true,\"chooser\":{\"class\":\"java.util.Random\",\"seed\":42,\"stream_status\":\"investigation compatibility stream; not an eventual portable default\",\"draws_per_replacement\":1,\"selection_draw\":\"nextFloat\",\"half_selection\":\"nextFloat() * (liveLeafCount * 0.5f), then Java int cast\",\"palette_prelude\":\"none; private stream divergence from source prelude\",\"replacement_order\":\"append TL,TR,BR,BL then remove parent\"},\"checks\":{\"positive_finite_bounds\":true,\"area_conservation\":true,\"non_overlapping_interiors\":true,\"deterministic_leaf_order\":true,\"content_variant_geometry_identity\":true,\"explicit_grid_transfer\":true},\"profiles\":{"+profiles+"},\"rendering\":\"dormant; root single-executor approval required\"}");
  }
  private static void paint(PGraphicsJava2D graphics,Profile profile) {
    graphics.background((BACKGROUND>>>16)&255,(BACKGROUND>>>8)&255,BACKGROUND&255);graphics.noStroke();
    for(Leaf leaf:profile.leaves.values) {
      int color=PALETTE[Math.floorMod(leaf.id,PALETTE.length)];
      float x=(float)leaf.x,y=(float)leaf.y,w=(float)leaf.width,h=(float)leaf.height;
      float inset=Math.min(1f,Math.min(w,h)*0.05f);
      graphics.fill((color>>>16)&255,(color>>>8)&255,color&255,190);graphics.rect(x+inset,y+inset,w-2f*inset,h-2f*inset);
      graphics.fill(255,245);
      if("content-grid".equals(profile.content)) {
        for(int row=0;row<3;row++) for(int column=0;column<3;column++) { float px=x+w*(column+0.5f)/3f,py=y+h*(row+0.5f)/3f;float d=Math.min(w,h)/12f;graphics.ellipse(px,py,d,d); }
      } else { float d=Math.min(w,h)*0.28f;graphics.ellipse(x+w*0.5f,y+h*0.5f,d,d); }
    }
  }
  private static void render(String id,String output) {
    if(!new File(output).isAbsolute()) throw new IllegalArgumentException("output path must be absolute");
    Profile value=profile(id);verify(value.leaves,id,!"explicit-grid-refinement-transfer".equals(id));String before=geometryHash(value.leaves);
    PApplet parent=new PApplet();parent.noLoop();PGraphicsJava2D graphics=new PGraphicsJava2D();graphics.setParent(parent);graphics.setPrimary(false);graphics.pixelDensity=1;graphics.setSize(WIDTH,HEIGHT);
    try { graphics.beginDraw();paint(graphics,value);graphics.endDraw();if(!graphics.save(output))throw new AssertionError("save failed"); } finally { graphics.dispose(); }
    String after=geometryHash(value.leaves);require(before.equals(after),"drawing changed retained leaves");
    System.out.println("{\"status\":\"rendered\",\"case\":"+quote(id)+",\"output\":"+quote(output)+",\"geometry_sha256\":"+quote(before)+",\"canvas\":[640,640],\"renderer\":\"JAVA2D\"}");
  }
  private static String quote(String value) { return "\""+value.replace("\\","\\\\").replace("\"","\\\"")+"\""; }
  public static void main(String[] args) {
    if(args.length==1&&"--numeric".equals(args[0])) { numeric();return; }
    if(args.length==2) { render(args[0],args[1]);return; }
    throw new IllegalArgumentException("usage: RegionChoice --numeric | RegionChoice <registered-case> <absolute-output.png>");
  }
}
