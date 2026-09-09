import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.geometry.NearestSegmentContact2D;
import org.procedurals.processing.Java2DLayers;

// Candidate workflow. N edits obstacles, C changes drawing, 0 resets, S saves the cache.
// Coordinates and colors belong to this artwork, not operation defaults.
List<List<Double>> queries;
List<List<Double>> obstacles;
NearestSegmentContact2D contacts;
PImage displayed;
boolean shifted = false;
boolean alternateColors = false;
int sourceBuilds = 0, contactBuilds = 0, displayBuilds = 0;

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() {
  queries = new ArrayList<List<Double>>();
  double[][] starts = {{60,80},{180,50},{370,50},{550,100},{590,280},
    {550,550},{370,590},{170,560},{50,390},{50,210}};
  for (double[] start : starts) queries.add(Arrays.asList(start[0], start[1], 320d, 320d));
  sourceBuilds++;
  rebuildContacts();
  noLoop();
}

void rebuildContacts() {
  // Swap these obstacle segments for retained polygon edges or another line drawing.
  double[][] corners = {{shifted ? 295d : 240d,140d},{460d,220d},{410d,470d},{180d,420d}};
  obstacles = new ArrayList<List<Double>>();
  for (int i=0;i<corners.length;i++) {
    double[] a=corners[i], b=corners[(i+1)%corners.length];
    obstacles.add(Arrays.asList(a[0],a[1],b[0],b[1]));
  }
  Map<String,Object> config = new LinkedHashMap<String,Object>();
  config.put("queries",queries); config.put("obstacles",obstacles);
  config.put("maxWork",(long)queries.size()*obstacles.size());
  contacts = NearestSegmentContact2D.find(config);
  contactBuilds++;
  rebuildDisplay();
}

void rebuildDisplay() {
  displayed = Java2DLayers.render(this,width,height,target -> {
    target.background(244,240,232);
    target.stroke(70,95,105,45); target.strokeWeight(1);
    for (List<Double> q:queries) target.line(q.get(0).floatValue(),q.get(1).floatValue(),q.get(2).floatValue(),q.get(3).floatValue());
    target.stroke(43,59,68); target.strokeWeight(3);
    for (List<Double> edge:obstacles) target.line(edge.get(0).floatValue(),edge.get(1).floatValue(),edge.get(2).floatValue(),edge.get(3).floatValue());
    int[] colors=alternateColors ? new int[]{0xff72649a,0xffaa713f,0xff3e879c,0xff719445}
      : new int[]{0xffc75146,0xffdb9555,0xff288782,0xff517293};
    for (int i=0;i<contacts.size();i++) {
      NearestSegmentContact2D.Contact hit=contacts.hitAt(i);
      if (hit==null) continue; // This piece omits misses; the query result preserves them.
      List<Double> q=queries.get(i);
      target.stroke(colors[hit.obstacleIndex]); target.strokeWeight(2.5f);
      target.line(q.get(0).floatValue(),q.get(1).floatValue(),(float)hit.x,(float)hit.y);
      target.noStroke(); target.fill(colors[hit.obstacleIndex]);
      target.ellipse((float)hit.x,(float)hit.y,10,10);
      target.fill(43,59,68);target.ellipse(q.get(0).floatValue(),q.get(1).floatValue(),4,4);
    }
  });
  displayBuilds++; redraw();
}
void draw() { image(displayed,0,0); }
void keyPressed() {
  if(key=='n'||key=='N'){shifted=!shifted;rebuildContacts();}
  else if(key=='c'||key=='C'){alternateColors=!alternateColors;rebuildDisplay();}
  else if(key=='0'){
    boolean geometryChanged=shifted;shifted=false;alternateColors=false;
    if(geometryChanged)rebuildContacts();else rebuildDisplay();
  } else if(key=='s'||key=='S')displayed.save(sketchPath("contact-marks.png"));
}
