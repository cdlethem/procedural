import java.io.File;
import java.util.ArrayList;
import java.util.List;
import processing.core.PApplet;
import processing.awt.PGraphicsJava2D;

/** Private moderate-coordinate visual study, not a shipped workflow. */
public final class SegmentClipView extends PApplet {
  private final File output;
  private int view;
  private final String[] names = {"hatch", "sparse", "deep-notch", "supplied-strokes"};
  private SegmentClipView(File output) { this.output = output; }
  public void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
  public void draw() {
    if (!(g instanceof PGraphicsJava2D) || pixelDensity != 1) throw new AssertionError("JAVA2D density1");
    double floor = view == 2 ? 430 : 270;
    SegmentClipStudy.Point[] polygon = {
      new SegmentClipStudy.Point(100,100),new SegmentClipStudy.Point(540,100),
      new SegmentClipStudy.Point(540,540),new SegmentClipStudy.Point(380,540),
      new SegmentClipStudy.Point(380,floor),new SegmentClipStudy.Point(260,floor),
      new SegmentClipStudy.Point(260,540),new SegmentClipStudy.Point(100,540)
    };
    List<SegmentClipStudy.Segment> sources = new ArrayList<>();
    if (view == 3) {
      // Caller-authored strokes; clipping is the only geometric algorithm under study.
      double[][] points={{40,150},{600,220},{40,290},{600,360},{40,430},{600,500}};
      for(int i=1;i<points.length;i++) sources.add(new SegmentClipStudy.Segment(
        points[i-1][0],points[i-1][1],points[i][0],points[i][1]));
    } else {
      for(int y=-180;y<700;y+=view==1?28:12)
        sources.add(new SegmentClipStudy.Segment(40,y,600,y+220));
    }
    List<SegmentClipStudy.RetainedInterval> clipped=SegmentClipStudy.clip(polygon,
      sources.toArray(new SegmentClipStudy.Segment[0]));
    background(246,241,231);
    noFill();stroke(222,216,205);strokeWeight(1);
    for(SegmentClipStudy.Segment s:sources) line((float)s.a.x,(float)s.a.y,(float)s.b.x,(float)s.b.y);
    stroke(31,90,101);strokeWeight(2);
    for(SegmentClipStudy.RetainedInterval s:clipped) line((float)s.a.x,(float)s.a.y,(float)s.b.x,(float)s.b.y);
    stroke(72,68,64);strokeWeight(1.5f);beginShape();
    for(SegmentClipStudy.Point p:polygon) vertex((float)p.x,(float)p.y);
    endShape(CLOSE);
    noStroke();fill(187,82,54);
    for(SegmentClipStudy.RetainedInterval s:clipped) {
      ellipse((float)s.a.x,(float)s.a.y,4,4);ellipse((float)s.b.x,(float)s.b.y,4,4);
    }
    save(new File(output,names[view]+".png").getAbsolutePath());
    System.out.println(names[view]+" sources="+sources.size()+" intervals="+clipped.size());
    if(++view==names.length) exit();
  }
  public static void main(String[] args) {
    File out=new File(args[0]);if(!out.isDirectory())throw new IllegalArgumentException("output directory required");
    PApplet.runSketch(new String[]{"SegmentClipView"},new SegmentClipView(out));
  }
}
