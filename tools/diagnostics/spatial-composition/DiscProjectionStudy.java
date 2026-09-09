import java.io.File;
import java.util.ArrayList;
import java.util.List;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;

/** Private visual study of the frozen sequential outward-projection semantics. */
public final class DiscProjectionStudy extends PApplet {
  private static final int WIDTH=720, HEIGHT=480;
  private static final double[] STRENGTHS={0.0,0.45,1.0};
  private static final class Disc { final double x,y,r; Disc(double x,double y,double r){this.x=x;this.y=y;this.r=r;} }
  private final File out; private int view;
  private DiscProjectionStudy(File out){this.out=out;}
  public void settings(){size(WIDTH,HEIGHT,JAVA2D);pixelDensity(1);}
  public void setup(){}
  private static double[] project(double x,double y,Disc[] discs,double strength){
    for(Disc disc:discs){double dx=x-disc.x,dy=y-disc.y,d=Math.sqrt(dx*dx+dy*dy);if(d<disc.r){double ux=d==0?1:dx/d,uy=d==0?0:dy/d,move=strength*(disc.r-d);x+=ux*move;y+=uy*move;}}
    return new double[]{x,y};
  }
  private void discs(Disc[] values){noFill();stroke(120,145,170,130);strokeWeight(1);for(Disc d:values)ellipse((float)d.x,(float)d.y,(float)(2*d.r),(float)(2*d.r));}
  private void contour(Disc[] values,double strength){double cx=180,cy=250,r=105;discs(values);noFill();stroke(220,100,85,110);strokeWeight(1);ellipse((float)cx,(float)cy,(float)(2*r),(float)(2*r));stroke(25,70,125);strokeWeight(2);beginShape();for(int i=0;i<=240;i++){double a=TWO_PI*i/240.0;double[] p=project(cx+Math.cos(a)*r,cy+Math.sin(a)*r,values,strength);vertex((float)p[0],(float)p[1]);}endShape();fill(40);noStroke();text("closed contour",105,410);}
  private void lines(Disc[] values,double strength){discs(values);stroke(220,100,85,85);strokeWeight(1);for(int row=0;row<12;row++)line(390,120+row*23,690,120+row*23);stroke(25,70,125);strokeWeight(1.6f);for(int row=0;row<12;row++){beginShape();for(int i=0;i<=120;i++){double[] p=project(390+i*2.5,120+row*23,values,strength);vertex((float)p[0],(float)p[1]);}endShape();}fill(40);noStroke();text("open parallel lines",490,410);}
  private void normal(double strength){background(248);fill(30);textAlign(LEFT,TOP);text("Sequential outward disc projection  |  strength "+strength,20,18);Disc[] contourDiscs={new Disc(250,215,72),new Disc(230,300,58)};Disc[] lineDiscs={new Disc(535,205,58),new Disc(605,310,68)};contour(contourDiscs,strength);lines(lineDiscs,strength);fill(70);text("red: original; blue: projected; grey: supplied discs",20,450);}
  private void order(){background(248);fill(30);textAlign(LEFT,TOP);text("Overlapping discs: same points, reversed influence order, strength 0.45",20,18);Disc a=new Disc(145,245,85),b=new Disc(225,245,85);Disc[] ab={a,b},ba={b,a};for(int side=0;side<2;side++){Disc[] order=side==0?ab:ba;double ox=side==0?0:360;noFill();stroke(120,145,170,130);ellipse((float)(a.x+ox),(float)a.y,(float)(2*a.r),(float)(2*a.r));ellipse((float)(b.x+ox),(float)b.y,(float)(2*b.r),(float)(2*b.r));stroke(220,100,85,85);line((float)(60+ox),230,(float)(310+ox),230);stroke(25,70,125);strokeWeight(2);beginShape();for(int i=0;i<=180;i++){double[] p=project(60+i*250.0/180.0,230,order,0.45);vertex((float)(p[0]+ox),(float)p[1]);}endShape();fill(40);noStroke();text(side==0?"A then B":"B then A",(float)(110+ox),400);}fill(70);text("The blue paths differ because the second disc receives the first disc's changed point.",20,450);}
  public void draw(){if(!(g instanceof PGraphicsJava2D)||pixelDensity!=1)throw new AssertionError("JAVA2D density1 required");if(view<STRENGTHS.length){normal(STRENGTHS[view]);save(new File(out,"strength-"+(view==0?"0":view==1?"045":"1")+".png").getAbsolutePath());view++;return;}order();save(new File(out,"order-reversed.png").getAbsolutePath());exit();}
  public static void main(String[] args){if(args.length!=1)throw new IllegalArgumentException("output directory");File out=new File(args[0]);if(!out.isDirectory())throw new IllegalArgumentException("missing output");PApplet.runSketch(new String[]{"--sketch-path="+out.getAbsolutePath(),"DiscProjectionStudy"},new DiscProjectionStudy(out));}
}
