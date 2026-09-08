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
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.event.KeyEvent;
import org.procedurals.paths.OccupiedLatticePaths2D;
import org.procedurals.examples.latticemarks.LatticeComposition;
import org.procedurals.color.CyclicPalette;

/** Observe the actual preprocessed PDE; geometry goldens remain in core conformance. */
public final class LatticeMarksProbe extends LatticeMarks {
  static final String[] IDS = {"baseline","palette","dots","reset-mode","wide","reset-width",
    "longer","reset-length","more-starts","reset-count","new-seed","final-reset"};
  static final char[] NEXT = "cm0w0l0n0r0s".toCharArray();
  final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  final File expectedCore;
  final List<double[]> commands = new ArrayList<double[]>();
  final StringBuilder records = new StringBuilder();
  int draws, keys, cursor, lines, ellipses;
  boolean observing;
  LatticeComposition previous;
  Map<String,Object> baselineValues, previousValues;
  int[] baselinePixels, previousPixels;
  PImage savedFrame;
  LatticeMarksProbe(File core) { expectedCore = core; }
  static void require(boolean yes, String why) { if (!yes) throw new AssertionError(why); }
  static void f(float actual, double expected) {
    require(Float.floatToRawIntBits(actual)==Float.floatToRawIntBits((float)expected),"coordinate/style value");
  }
  static String source(Class<?> type) {
    try { return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath(); }
    catch(Exception e) { throw new IllegalStateException(e); }
  }
  static boolean reset(int i) { return i==3 || i==5 || i==7 || i==9 || i==11; }
  static boolean style(int i) { return i==1 || i==2 || i==4; }
  void state(int i) {
    require(SEED==(i==10?43:42) && MANY==(i==8) && LONG==(i==6),"structural settings");
    require(ALT==(i==1||i==2) && DOTS==(i==2) && WIDE==(i==4),"style settings");
    Map<String,Object> values=composition.paths().toValues();
    if(i==0) baselineValues=values;
    else if(style(i)) require(composition==previous && values.equals(previousValues),"retained object/geometry/RNG");
    else {
      require(composition!=previous,"new structural result");
      require(reset(i)?values.equals(baselineValues):!values.equals(previousValues),"structural values/reset");
    }
  }
  void lineCommand(double a,double b,double c,double d,int color,double weight) {
    commands.add(new double[]{0,a,b,c,d,color,weight});
  }
  void dotCommand(int[] cell,double diameter,int fill,boolean outlined,int outline) {
    commands.add(new double[]{1,44+24*cell[0],44+24*cell[1],diameter,diameter,fill,outlined?1:0,outline});
  }
  void expectedDrawing() {
    commands.clear();
    for(int i=0;i<=24;i++) {
      lineCommand(32,32+24*i,608,32+24*i,0xffcdc8be,1);
      lineCommand(32+24*i,32,32+24*i,608,0xffcdc8be,1);
    }
    OccupiedLatticePaths2D paths=composition.paths();
    for(int p=0;p<paths.pathCount();p++) {
      int n=paths.pathLengthAt((long)p);
      if(n==0) continue;
      int color=0xff000000 | (ALT?other:palette).sample(p*.173d);
      if(DOTS) {
        for(int j=0;j<n;j++) dotCommand(paths.cellAt((long)p,(long)j),6,color,false,0);
      } else {
        for(int layer=0;layer<2;layer++) {
          int offset=layer==0?3:0;
          for(int j=1;j<n;j++) {
            int[] a=paths.cellAt((long)p,(long)(j-1)), b=paths.cellAt((long)p,(long)j);
            lineCommand(44+24*a[0]+offset,44+24*a[1]+offset,44+24*b[0]+offset,44+24*b[1]+offset,
              layer==0?0x461e1e1e:color,(WIDE?.65f:.35f)*24);
          }
        }
        dotCommand(paths.cellAt((long)p,0L),8,0xfffffae6,true,color);
        if(n>1) dotCommand(paths.cellAt((long)p,(long)(n-1)),8,0xfffffae6,true,color);
      }
    }
  }
  double[] next(int kind) {
    require(cursor<commands.size(),"extra primitive");
    double[] c=commands.get(cursor++);require(c[0]==kind,"primitive order");
    require(((PGraphicsJava2D)g).g2.getTransform().isIdentity(),"untransformed drawing");
    return c;
  }
  @Override public void line(float a,float b,float c,float d) {
    if(observing) {
      double[] e=next(0);f(a,e[1]);f(b,e[2]);f(c,e[3]);f(d,e[4]);
      require(g.stroke && g.strokeColor==(int)e[5],"line colour");f(g.strokeWeight,e[6]);lines++;
    }
    super.line(a,b,c,d);
  }
  @Override public void ellipse(float a,float b,float c,float d) {
    if(observing) {
      double[] e=next(1);f(a,e[1]);f(b,e[2]);f(c,e[3]);f(d,e[4]);
      require(g.fill && g.fillColor==(int)e[5] && g.stroke==(e[6]==1) && g.ellipseMode==CENTER,"dot style");
      if(g.stroke) { require(g.strokeColor==(int)e[7],"endpoint outline");f(g.strokeWeight,2); }
      ellipses++;
    }
    super.ellipse(a,b,c,d);
  }
  @Override public void setup() {
    super.setup();
    require(width==640 && height==640 && pixelDensity==1 && g instanceof PGraphicsJava2D,"environment");
    for(Class<?> c:new Class<?>[]{OccupiedLatticePaths2D.class,CyclicPalette.class})
      require(source(c).equals(expectedCore.getAbsolutePath()),"candidate core origin");
  }
  @Override public void draw() {
    int i=draws;require(i<IDS.length,"extra draw");state(i);expectedDrawing();cursor=lines=ellipses=0;
    observing=true;super.draw();observing=false;
    require(cursor==commands.size(),"all expected primitives");
    loadPixels();int[] shown=pixels.clone();displayedFrame.loadPixels();
    require(Arrays.equals(shown,displayedFrame.pixels),"completed cache");
    if(i==0) baselinePixels=shown.clone();
    else if(reset(i)) require(Arrays.equals(baselinePixels,shown),"reset pixels");
    else require(!Arrays.equals(previousPixels,shown),"visible edit");
    save(sketchPath(IDS[i]+".png"));
    if(records.length()>0) records.append(',');
    records.append("{\"id\":\"").append(IDS[i]).append("\",\"lines\":").append(lines)
      .append(",\"ellipses\":").append(ellipses).append(",\"retained\":").append(composition==previous).append('}');
    previous=composition;previousValues=composition.paths().toValues();previousPixels=shown;draws++;
    events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,NEXT[i],0)),150,TimeUnit.MILLISECONDS);
  }
  @Override public void keyPressed() {
    require(keys<NEXT.length && key==NEXT[keys],"key order");
    LatticeComposition before=composition;PImage cached=displayedFrame;
    super.keyPressed();keys++;
    if(key=='s') {
      require(composition==before && displayedFrame==cached,"save unchanged");savedFrame=cached;
      long at=System.nanoTime();events.schedule(()->finish(at),300,TimeUnit.MILLISECONDS);
    }
  }
  void finish(long at) {
    try {
      long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-at);
      require(quiet>=300 && draws==12 && keys==12 && displayedFrame==savedFrame && composition==previous,"quiet cached save");
      String report="{\"status\":\"passed\",\"frames\":12,\"key_events\":12,\"keys\":\""+new String(NEXT)
        +"\",\"save_quiet_ms\":"+quiet+",\"renderer_class\":\""+g.getClass().getName()
        +"\",\"core_code_source\":\""+source(OccupiedLatticePaths2D.class)
        +"\",\"composition_code_source\":\""+source(LatticeComposition.class)+"\",\"states\":["+records+"]}";
      Files.write(Paths.get(sketchPath("native.json")),report.getBytes(StandardCharsets.UTF_8));events.shutdown();exit();
    } catch(Throwable e) {e.printStackTrace();System.exit(1);}
  }
  public static void main(String[] args) {
    Thread.setDefaultUncaughtExceptionHandler((t,e)->{e.printStackTrace();System.exit(1);});
    PApplet.runSketch(new String[]{"--sketch-path="+args[0],"LatticeMarksProbe"},new LatticeMarksProbe(new File(args[1])));
  }
}
