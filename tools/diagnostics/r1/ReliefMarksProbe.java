import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import processing.opengl.PGraphics3D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.event.KeyEvent;
import org.procedurals.topology.Delaunay2D;
import org.procedurals.layout.QuadrantPartition2D;
import org.procedurals.examples.reliefmarks.ReliefComposition;
import org.procedurals.color.CyclicPalette;

/** Observe the actual preprocessed PDE; geometry goldens remain in core conformance. */
public final class ReliefMarksProbe extends ReliefMarks {
  static final String[] IDS = {"baseline","palette","reset-colour","tall","reset-height","new-seed","final-reset"};
  static final char[] NEXT = "c0h0r0s".toCharArray();
  final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  final File expectedCore;
  final StringBuilder records = new StringBuilder();
  int draws, keys, vertices, boxes, spikeIndex;
  boolean drawingSpikes;
  float lastX,lastY,lastZ;
  boolean observing;
  ReliefComposition previous;
  Map<String,Object> baselineValues, previousValues;
  int[] baselinePixels, previousPixels;
  PImage savedFrame;
  ReliefMarksProbe(File core) { expectedCore = core; }
  static void require(boolean yes, String why) { if (!yes) throw new AssertionError(why); }
  static void f(float actual, double expected) {
    require(Float.floatToRawIntBits(actual)==Float.floatToRawIntBits((float)expected),"coordinate/style value");
  }
  static String source(Class<?> type) {
    try { return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath(); }
    catch(Exception e) { throw new IllegalStateException(e); }
  }
  static boolean reset(int i) { return i==2 || i==4 || i==6; }
  static boolean style(int i) { return i==1 || i==3; }
  void state(int i) {
    require(SEED==(i==5?43:42) && TALL==(i==3) && COLOR==(i==1?1:0),"settings");
    require(composition.leafCount()==871 && composition.mesh().inputCount()==871,"source structural cell count");
    Map<String,Object> values=composition.mesh().toValues();
    if(i==0) baselineValues=values;
    else if(style(i)) require(composition==previous && values.equals(previousValues),"retained topology and spike selection");
    else {
      require(composition!=previous,"new structural result");
      require(reset(i)?values.equals(baselineValues):!values.equals(previousValues),"structural values/reset");
    }
  }
  @Override public void drawSpikes() {
    drawingSpikes=true;spikeIndex=0;super.drawSpikes();drawingSpikes=false;
  }
  @Override public void translate(float x,float y,float z) {
    if(observing && drawingSpikes) {lastX=x;lastY=y;lastZ=z;}
    super.translate(x,y,z);
  }
  @Override public void box(float w,float d,float h) {
    if(observing) {
      require(drawingSpikes,"unexpected box");
      while(spikeIndex<composition.leafCount() && !composition.spikeAt(spikeIndex)) spikeIndex++;
      require(spikeIndex<composition.leafCount(),"extra spike");
      double[] p=new double[2];composition.centerInto(spikeIndex,p);
      float height=(float)composition.spikeHeight(spikeIndex);
      f(lastX,p[0]);f(lastY,p[1]);f(lastZ,height*.5f);
      f(w,height*.02f);f(d,height*.02f);f(h,height);
      require(g.fill && !g.stroke && g.fillColor==0xffffffff,"spike style");
      spikeIndex++;boxes++;
    }
    super.box(w,d,h);
  }
  @Override public void vertex(float x,float y,float z) {
    if(observing) {
      require(!drawingSpikes,"unexpected vertex callback");
      int faceIndex=vertices/9, role=vertices%9;
      Delaunay2D mesh=composition.mesh();require(faceIndex<mesh.faceCount(),"extra relief vertex");
      int[] ids=mesh.triangleAt(faceIndex);
      int[] roles={0,1,2,0,1,1,0,1,0};
      double[] p=mesh.pointAt(ids[roles[role]]);
      f(x,p[0]);f(y,p[1]);f(z,(role==2||role==5||role==8)?0:(TALL?12:4));
      require(g.fill && !g.stroke && g.fillColor==(0xff000000|PALETTE[COLOR]),"relief fill");
      vertices++;
    }
    super.vertex(x,y,z);
  }
  @Override public void setup() {
    super.setup();
    require(width==960 && height==960 && pixelDensity==1 && g instanceof PGraphics3D,"environment");
    for(Class<?> c:new Class<?>[]{Delaunay2D.class,QuadrantPartition2D.class})
      require(source(c).equals(expectedCore.getAbsolutePath()),"candidate core origin");
  }
  @Override public void draw() {
    int i=draws;require(i<IDS.length,"extra draw");state(i);vertices=boxes=0;
    observing=true;super.draw();observing=false;
    require(vertices==composition.mesh().faceCount()*9,"three triangles per face");
    int expectedSpikes=0;
    for(int leaf=0;leaf<composition.leafCount();leaf++) if(composition.spikeAt(leaf)) expectedSpikes++;
    require(boxes==expectedSpikes,"all selected spikes drawn");
    loadPixels();int[] shown=pixels.clone();displayedFrame.loadPixels();
    require(Arrays.equals(shown,displayedFrame.pixels),"completed cache");
    if(i==0) baselinePixels=shown.clone();
    else if(reset(i)) require(Arrays.equals(baselinePixels,shown),"reset pixels");
    else require(!Arrays.equals(previousPixels,shown),"visible edit");
    save(sketchPath(IDS[i]+".png"));
    if(records.length()>0) records.append(',');
    records.append("{\"id\":\"").append(IDS[i]).append("\",\"vertices\":").append(vertices)
      .append(",\"spikes\":").append(boxes).append(",\"retained\":").append(composition==previous).append('}');
    previous=composition;previousValues=composition.mesh().toValues();previousPixels=shown;draws++;
    events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,NEXT[i],0)),150,TimeUnit.MILLISECONDS);
  }
  @Override public void keyPressed() {
    require(keys<NEXT.length && key==NEXT[keys],"key order");
    ReliefComposition before=composition;PImage cached=displayedFrame;
    super.keyPressed();keys++;
    if(key=='s') {
      require(composition==before && displayedFrame==cached,"save unchanged");savedFrame=cached;
      long at=System.nanoTime();events.schedule(()->finish(at),300,TimeUnit.MILLISECONDS);
    }
  }
  void finish(long at) {
    try {
      long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-at);
      require(quiet>=300 && draws==7 && keys==7 && displayedFrame==savedFrame && composition==previous,"quiet cached save");
      String report="{\"status\":\"passed\",\"frames\":7,\"key_events\":7,\"keys\":\""+new String(NEXT)
        +"\",\"save_quiet_ms\":"+quiet+",\"renderer_class\":\""+g.getClass().getName()
        +"\",\"core_code_source\":\""+source(Delaunay2D.class)
        +"\",\"composition_code_source\":\""+source(ReliefComposition.class)+"\",\"states\":["+records+"]}";
      Files.write(Paths.get(sketchPath("native.json")),report.getBytes(StandardCharsets.UTF_8));events.shutdown();exit();
    } catch(Throwable e) {e.printStackTrace();System.exit(1);}
  }
  public static void main(String[] args) {
    Thread.setDefaultUncaughtExceptionHandler((t,e)->{e.printStackTrace();System.exit(1);});
    PApplet.runSketch(new String[]{"--sketch-path="+args[0],"ReliefMarksProbe"},new ReliefMarksProbe(new File(args[1])));
  }
}
