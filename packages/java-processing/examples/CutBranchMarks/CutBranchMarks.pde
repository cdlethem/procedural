import org.procedurals.examples.cutbranchmarks.CutBranchComposition;
import org.procedurals.topology.LinePool2D;

// Mutable-cut branching motivated by2019/generativos/brotes; independently drawn here.
// C: colour; A: angle; W: work; T: seed stroke; R: seed; 0: reset; S: save.
long SEED=42;
boolean NARROW=false, SPARSE=false, ALTERNATE=false;
int COLOR=0;
int[] COLORS={0xffebebeb,0xffe9ca54,0xff749ab2,0xffeb4313};
CutBranchComposition composition;
PImage displayedFrame;
double[] segment=new double[4];
void settings() { size(960,960,P2D);pixelDensity(1); }
void setup() { rebuild();noLoop(); }
void rebuild() { composition=CutBranchComposition.create(SEED,NARROW,SPARSE,ALTERNATE); }
void draw() {
  background(10,10,21);blendMode(NORMAL);
  stroke(COLORS[COLOR],100);strokeWeight(1);
  LinePool2D pool=composition.pool();
  for(int i=0;i<pool.size();i++) {
    pool.segmentInto(i,segment,0);
    line((float)segment[0],(float)segment[1],(float)segment[2],(float)segment[3]);
  }
  displayedFrame=get();
}
void keyPressed() {
  char k=Character.toLowerCase(key);
  if(k=='s') { if(displayedFrame!=null)displayedFrame.save(sketchPath("cut-branch-marks.png"));return; }
  if(k=='c') COLOR=(COLOR+1)%COLORS.length;
  else if(k=='a') { NARROW=!NARROW;rebuild(); }
  else if(k=='w') { SPARSE=!SPARSE;rebuild(); }
  else if(k=='t') { ALTERNATE=!ALTERNATE;rebuild(); }
  else if(k=='r') { SEED=(SEED+1)&0xffffffffL;rebuild(); }
  else if(k=='0') { SEED=42;NARROW=SPARSE=ALTERNATE=false;COLOR=0;rebuild(); }
  else return;
  redraw();
}
