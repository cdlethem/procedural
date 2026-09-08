import org.procedurals.examples.facetmarks.FacetComposition;
import org.procedurals.topology.Delaunay2D;
import org.procedurals.sampling.TrianglePoints2D;
import org.procedurals.color.CyclicPalette;
import java.util.Arrays;
import java.util.Collections;

// Turn an arrangement of points into facets, wire or grain.
// N: coarse/fine; X: disc/cell centres; R: seed; M: fill/wire/grain.
// C: palette; P: show sites; 0: reset; S: save the displayed canvas.
// These are editable piece settings, not library defaults or recommended ranges.
long SEED = 42;
boolean FINE = false, CELLS = false, ALTERNATE = false, SITES = false;
int MODE = 0;
FacetComposition composition;
CyclicPalette palette, otherPalette;
PImage displayedFrame;
double[] a = new double[2], b = new double[2], c = new double[2];
int[] face = new int[3], edge = new int[2], incidence = new int[2];

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }
void setup() {
  colorMode(RGB, 255);
  palette = CyclicPalette.create(Collections.singletonMap("colors",
    Arrays.asList(0x173F5F, 0xAF5441, 0xE9C46A, 0x347969)));
  otherPalette = CyclicPalette.create(Collections.singletonMap("colors",
    Arrays.asList(0x493657, 0xB85065, 0xE6B89C, 0x467C89)));
  rebuild();
  noLoop();
}
void rebuild() { composition = FacetComposition.create(SEED, FINE, CELLS); }
int faceColor(int index) {
  return (ALTERNATE ? otherPalette : palette).sample(index * 0.173d);
}
void draw() {
  background(243, 240, 232);
  Delaunay2D mesh = composition.mesh();
  if (MODE == 0) {
    noStroke();
    for (int i = 0; i < mesh.faceCount(); i++) {
      mesh.triangleInto(i, face, 0);
      mesh.pointInto(face[0], a, 0); mesh.pointInto(face[1], b, 0); mesh.pointInto(face[2], c, 0);
      int rgb = faceColor(i);
      fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
      triangle((float)a[0], (float)a[1], (float)b[0], (float)b[1], (float)c[0], (float)c[1]);
    }
  } else if (MODE == 1) {
    noFill(); strokeWeight(1.1f);
    // Traverse unique edges, so an interior edge is drawn once rather than twice.
    for (int i = 0; i < mesh.edgeCount(); i++) {
      mesh.edgeInto(i, edge, 0); mesh.edgeFacesInto(i, incidence, 0);
      mesh.pointInto(edge[0], a, 0); mesh.pointInto(edge[1], b, 0);
      int rgb = faceColor(incidence[0]);
      stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
      line((float)a[0], (float)a[1], (float)b[0], (float)b[1]);
    }
  } else {
    noFill(); strokeWeight(1);
    for (int i = 0; i < mesh.faceCount(); i++) {
      TrianglePoints2D grain = composition.grainAt(i);
      int rgb = faceColor(i);
      stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 170);
      for (int p = 0; p < grain.size(); p++) {
        grain.pointInto(p, a, 0);
        point((float)a[0], (float)a[1]);
      }
    }
  }
  if (SITES) {
    noStroke(); fill(30, 35, 40); ellipseMode(CENTER);
    for (int i = 0; i < mesh.vertexCount(); i++) {
      mesh.pointInto(i, a, 0);
      ellipse((float)a[0], (float)a[1], 4, 4);
    }
  }
  displayedFrame = get();
}
void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') {
    if (displayedFrame != null)
      displayedFrame.save(sketchPath("facet-marks-" + nf(frameCount, 4) + ".png"));
    return;
  }
  if (k == 'm') MODE = (MODE + 1) % 3;
  else if (k == 'c') ALTERNATE = !ALTERNATE;
  else if (k == 'p') SITES = !SITES;
  else {
    if (k == 'n') FINE = !FINE;
    else if (k == 'x') CELLS = !CELLS;
    else if (k == 'r') SEED = (SEED + 1) & 0xffffffffL;
    else if (k == '0') {
      SEED = 42; FINE = false; CELLS = false; ALTERNATE = false; SITES = false; MODE = 0;
    } else return;
    rebuild();
  }
  redraw();
}
