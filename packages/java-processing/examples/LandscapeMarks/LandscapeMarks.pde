/*
Landscape drawing adapted from Manolo ide, AllSketchs/2019/generativos/parapara/parapara.pde
Revision69bdd8513e4482a5e6018e36887d4bc208660eb5
https://github.com/manoloide/AllSketchs

MIT License

Copyright (c) 2020 Manolo ide

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import org.procedurals.examples.landscapemarks.LandscapeComposition;
import org.procedurals.color.CyclicPalette;
import java.util.Collections;
import java.util.Arrays;

// C: palette; P: stripe spacing; R: seed; 0: reset; S: cached save.
long SEED = 42;
boolean UNIFORM = false;
int COLOR = 0;
int[] COLORS = {0x152425,0x1D3740,0x06263E,0x074B7D,0x094D88,
  0x1D6C9E,0xff2000,0x1D6C9E,0xff2010};
LandscapeComposition composition;
CyclicPalette palette;
PImage displayedFrame;
double[] point = new double[2], a = new double[2], b = new double[2], c = new double[2];
int[] face = new int[3];
void settings() { size(960,960,P2D); pixelDensity(1); }
void setup() {
  palette=CyclicPalette.create(Collections.singletonMap("colors", Arrays.asList(
    0x152425,0x1D3740,0x06263E,0x074B7D,0x094D88,0x1D6C9E,0xff2000,0x1D6C9E,0xff2010)));
  rebuild(); noLoop();
}
void rebuild() { composition=LandscapeComposition.create(SEED); }
int swatch(int i) { return 0xff000000 | COLORS[(i+COLOR)%COLORS.length]; }
int eased(double index) {
  double q=Math.abs(index)%COLORS.length;
  double whole=Math.floor(q);
  double phase=(whole+Math.pow(q-whole,10.8)+COLOR)/COLORS.length;
  return 0xff000000 | palette.sample(phase);
}
void draw() {
  background(0,2,4); noStroke();
  drawHorizon(); drawStripes(false); drawStripes(true);
  stroke(255,10); noFill();
  beginShape(TRIANGLES);
  for(int f=0;f<composition.mesh().faceCount();f++) {
    loadFace(f);
    vertex((float)a[0],(float)a[1]); vertex((float)b[0],(float)b[1]); vertex((float)c[0],(float)c[1]);
  }
  endShape(CLOSE); noStroke();
  for(int i=0;i<composition.placements().size();i++) drawDisk(i);
  for(int f=0;f<composition.mesh().faceCount();f++) drawSpeck(f);
  displayedFrame=get();
}
void drawHorizon() {
  double base=height*composition.horizon();
  for(int layer=0;layer<3;layer++) {
    fill(swatch(composition.horizonColor(layer))); beginShape();
    for(int x=0;x<width;x++) {
      double n=composition.noise().sample(x*composition.horizonFrequency(layer),0);
      double rise=Math.pow(Math.max(0,Math.min(1,n*4-2)),1.4)*width*.012;
      vertex(x,(float)(base-rise));
    }
    vertex(width,(float)base); vertex(0,(float)base); endShape(CLOSE);
  }
}
void drawStripes(boolean sky) {
  double h=composition.horizon(), power=UNIFORM?1:4.2;
  double left=composition.stripeStart(sky,0), right=composition.stripeStart(sky,1);
  double dl=composition.stripeDrift(sky,0), dr=composition.stripeDrift(sky,1);
  for(int i=0;i<1000;i++) {
    double t1=Math.pow(i/1000.0,power), t2=Math.pow((i+1)/1000.0,power);
    float y1=(float)(height*(sky?(1-t1)*h:h+t1*(1-h)));
    float y2=(float)(height*(sky?(1-t2)*h:h+t2*(1-h)));
    beginShape();
    fill(eased(left+dl*(i+1)),180);vertex(0,y2);
    fill(eased(left+dl*i),180);vertex(0,y1);
    fill(eased(right+dr*i),180);vertex(width,y1);
    fill(eased(right+dr*(i+1)),180);vertex(width,y2);
    endShape(CLOSE);
  }
}
void drawDisk(int i) {
  composition.placements().pointInto(i,point,0);
  float x=(float)point[0],y=(float)point[1],s=(float)(2*composition.placements().radiusAt(i));
  ring(x,y+s*.5,0,0,s*1.4,s*1.4*.2,0xff000000,60,0,true);
  ring(x,y+s*.5,0,0,s*.8,s*.8*.2,0xff000000,90,0,true);
  fill(swatch(composition.diskColor(i)));ellipse(x,y,s,s);
  ring(x,y,s,s,s*8,s*8,swatch(composition.haloColor(i)),30,0,false);
  ring(x,y,s,s,s*2,s*2,0xffffffff,8,0,false);
  ring(x,y,s,s,s*.6,s*.6,swatch(composition.innerColor(i)),14,0,false);
}
void ring(float x,float y,float w1,float h1,float w2,float h2,int rgb,float alpha1,float alpha2,boolean shadow) {
  float largest=max(max(w1,w2),max(h1,h2));
  int count=(int)Math.max(2,shadow?Math.PI*Math.pow(largest*.25,2):Math.PI*2*Math.pow(largest*.5*.06,2));
  for(int i=0;i<count;i++) {
    float t1=TWO_PI*i/count,t2=TWO_PI*(i+1)/count;
    beginShape();fill(rgb,alpha1);
    vertex(x+cos(t1)*w1*.5,y+sin(t1)*h1*.5);
    vertex(x+cos(t2)*w1*.5,y+sin(t2)*h1*.5);
    fill(rgb,alpha2);
    vertex(x+cos(t2)*w2*.5,y+sin(t2)*h2*.5);
    vertex(x+cos(t1)*w2*.5,y+sin(t1)*h2*.5);
    endShape(CLOSE);
  }
}
void loadFace(int f) {
  composition.mesh().triangleInto(f,face,0);
  composition.mesh().pointInto(face[0],a,0);composition.mesh().pointInto(face[1],b,0);
  composition.mesh().pointInto(face[2],c,0);
}
void drawSpeck(int f) {
  loadFace(f);
  float x=(float)((a[0]+b[0]+c[0])/3),y=(float)((a[1]+b[1]+c[1])/3);
  float s=(float)composition.speckSize(f),r=s*.5,t=(float)composition.speckAngle(f);
  float stretch=(float)composition.speckStretch(f);
  fill(swatch(composition.speckColor(f)));beginShape(TRIANGLES);
  vertex(x+cos(t-HALF_PI)*r,y+sin(t-HALF_PI)*r);
  vertex(x+cos(t+HALF_PI)*r,y+sin(t+HALF_PI)*r);
  vertex(x+cos(t)*r*stretch,y+sin(t)*r*stretch);endShape();
  fill(255,240);ellipse(x,y,s,s);
}
void keyPressed() {
  char k=Character.toLowerCase(key);
  if(k=='s') { if(displayedFrame!=null) displayedFrame.save(sketchPath("landscape-marks.png")); return; }
  if(k=='c') COLOR=(COLOR+1)%COLORS.length;
  else if(k=='p') UNIFORM=!UNIFORM;
  else if(k=='r') { SEED=(SEED+1)&0xffffffffL;rebuild(); }
  else if(k=='0') { SEED=42;UNIFORM=false;COLOR=0;rebuild(); }
  else return;
  redraw();
}
