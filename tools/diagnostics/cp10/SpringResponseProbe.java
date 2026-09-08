import processing.core.*;
import processing.awt.PGraphicsJava2D;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Diagnostic of the preprocessed upstream Point body, not a library implementation. */
public final class SpringResponseProbe extends SourcePoint {
  static final int[] TICKS={0,1,10,30,60,120};
  final ArrayList<Point> sites=new ArrayList<Point>();
  final float[][] trace=new float[121][9];
  final StringBuilder records=new StringBuilder();
  int tick,frame;
  float retention;
  String caseId;
  static void require(boolean v,String why){if(!v)throw new AssertionError(why);}
  static void same(float a,float b,String why){require(Float.floatToIntBits(a)==Float.floatToIntBits(b),why);}
  public void settings(){size(640,640,JAVA2D);pixelDensity(1);}
  public void setup(){
    require(g instanceof PGraphicsJava2D,"JAVA2D");
    mouseX=10000;mouseY=10000;randomSeed(42);colorMode(RGB,255);
    for(int y:new int[]{128,320,512})for(int x:new int[]{96,256,416}){
      Point p=new Point(new PVector(x,y));p.decay=retention;p.tgt.x+=100;sites.add(p);
    }
    record();
  }
  void record(){
    if(records.length()>0)records.append(',');
    records.append("{\"tick\":").append(tick).append(",\"sites\":[");
    for(int i=0;i<sites.size();i++){
      Point p=sites.get(i);trace[tick][i]=p.pos.x;
      if(i>0)records.append(',');
      records.append('[').append(p.pos.x).append(',').append(p.pos.y).append(',').append(p.tgt.x)
        .append(',').append(p.tgt.y).append(',').append(p.vel.x).append(',').append(p.vel.y).append(']');
    }
    records.append("]}");
  }
  void step(){
    for(Point p:sites){
      float target=p.tgt.x+(p.ini.x-p.tgt.x)*0.04f;
      float updated=p.vel.x+(target-p.pos.x)*probeSpring;
      float position=p.pos.x+updated;
      float velocity=updated*retention;
      p.update();
      same(p.tgt.x,target,"target-before-force");same(p.pos.x,position,"position-before-damping");
      same(p.vel.x,velocity,"retained velocity");same(p.pos.y,p.ini.y,"unchanged y");same(p.vel.y,0,"zero y velocity");
      require(Float.isFinite(position)&&Float.isFinite(velocity),"finite trajectory");
    }
    tick++;record();
  }
  public void draw(){
    require(frame<TICKS.length,"unexpected frame");
    while(tick<TICKS[frame])step();
    background(245,242,234);
    for(int i=0;i<sites.size();i++){
      Point p=sites.get(i);
      noFill();stroke(165,160,151);strokeWeight(1);ellipse(p.ini.x,p.ini.y,14,14);
      stroke(195,125,56);strokeWeight(2);
      for(int t=1;t<=tick;t++)line(trace[t-1][i],p.ini.y,trace[t][i],p.ini.y);
      stroke(35,42,50);strokeWeight(2);line(p.pos.x,p.pos.y,p.pos.x+p.vel.x*4,p.pos.y);
      noStroke();fill(31,95,126);ellipse(p.pos.x,p.pos.y,10,10);
    }
    get().save(sketchPath(String.format(java.util.Locale.ROOT,"frame_%05d.png",tick)));
    frame++;
    if(frame==TICKS.length){
      noLoop();
      try{
        String report="{\"status\":\"passed\",\"case\":\""+caseId+"\",\"spring\":"+probeSpring+
          ",\"retention\":"+retention+",\"frames\":6,\"ticks\":120,\"records\":["+records+"]}";
        Files.write(Paths.get(sketchPath("native.json")),report.getBytes(StandardCharsets.UTF_8));
      }catch(Exception e){throw new RuntimeException(e);}
      exit();
    }
  }
  public static void main(String[] args){
    if(args.length!=4)throw new IllegalArgumentException("output,case,spring,retention required");
    Thread.setDefaultUncaughtExceptionHandler((thread,error)->{error.printStackTrace();System.exit(1);});
    SpringResponseProbe p=new SpringResponseProbe();p.caseId=args[1];p.probeSpring=Float.parseFloat(args[2]);p.retention=Float.parseFloat(args[3]);
    PApplet.runSketch(new String[]{"--sketch-path="+args[0],"SpringResponseProbe"},p);
  }
}
