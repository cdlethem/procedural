import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.fields.GradientNoise3D01;
import org.procedurals.layout.RegularGrid;
import org.procedurals.mesh.RadialProfile3D;
import org.procedurals.color.CyclicPalette;

// Z changes depth, C recolors, M transfers to a mesh, 0 resets, S saves.
// Explicit settings are artwork choices, not library defaults or source replay.
GradientNoise3D01 field;
RegularGrid grid;
RadialProfile3D mesh;
CyclicPalette primaryPalette, alternatePalette;
double depth = 0.25;
boolean alternate = false, meshMode = false;
double[] planarSamples, meshSamples, faceCenters;
PImage displayedFrame;

void settings() { size(640, 640, P3D); pixelDensity(1); }
void setup() {
  field = GradientNoise3D01.create(42L);
  Map<String,Object> gridConfig = new LinkedHashMap<String,Object>();
  gridConfig.put("origin", Arrays.asList(32.0, 32.0));
  gridConfig.put("spacing", Arrays.asList(9.6, 9.6));
  gridConfig.put("columns", 60); gridConfig.put("rows", 60);
  grid = RegularGrid.create(gridConfig);
  primaryPalette = makePalette(new int[]{0x244451, 0x278C83, 0xD5A942, 0xC65948});
  alternatePalette = makePalette(new int[]{0x3C568A, 0x8D5193, 0xD48B58, 0x4B8465});
  makeMesh();
  rebuildSamples();
  noLoop();
}

CyclicPalette makePalette(int[] colors) {
  List<Integer> values = new ArrayList<Integer>();
  for (int ink : colors) values.add(ink);
  Map<String,Object> config = new LinkedHashMap<String,Object>();
  config.put("colors", values);
  return CyclicPalette.create(config);
}

void makeMesh() {
  // Supply a rounded profile; RadialProfile3D owns all indexed mesh topology.
  List<Object> profile = new ArrayList<Object>();
  for (int row = 0; row <= 16; row++) {
    double z = -190.0 + row * 380.0 / 16.0;
    double radius = row == 0 || row == 16 ? 0.0 : Math.sqrt(190.0 * 190.0 - z * z);
    profile.add(Arrays.asList(z, radius));
  }
  Map<String,Object> config = new LinkedHashMap<String,Object>();
  config.put("profile", profile); config.put("slices", 32);
  config.put("capStart", false); config.put("capEnd", false); config.put("maxFaces", 2000);
  mesh = RadialProfile3D.generate(config);
  faceCenters = new double[mesh.faceCount() * 3];
  int[] triangle = new int[3]; double[] point = new double[3];
  for (int face = 0; face < mesh.faceCount(); face++) {
    mesh.triangleInto(face, triangle, 0);
    for (int corner = 0; corner < 3; corner++) {
      mesh.vertexInto(triangle[corner], point, 0);
      for (int axis = 0; axis < 3; axis++) faceCenters[face * 3 + axis] += point[axis];
    }
    for (int axis = 0; axis < 3; axis++) faceCenters[face * 3 + axis] /= 3.0;
  }
}

void rebuildSamples() {
  planarSamples = new double[(int)grid.size()];
  meshSamples = new double[mesh.faceCount()];
  double[] point = new double[2];
  for (int i = 0; i < planarSamples.length; i++) {
    grid.pointInto(i, point, 0);
    planarSamples[i] = field.sample(point[0] / 96.0, point[1] / 96.0, depth);
  }
  for (int face = 0; face < meshSamples.length; face++)
    meshSamples[face] = field.sample(faceCenters[face * 3] / 96.0 + 3.0,
        faceCenters[face * 3 + 1] / 96.0 + 3.0, faceCenters[face * 3 + 2] / 96.0 + depth);
}

void draw() {
  background(247, 242, 230);
  ortho(); noLights();
  CyclicPalette palette = alternate ? alternatePalette : primaryPalette;
  if (!meshMode) {
    strokeWeight(1.4);
    double[] point = new double[2];
    for (int i = 0; i < planarSamples.length; i++) {
      grid.pointInto(i, point, 0);
      double n = planarSamples[i], angle = n * Math.PI * 2.0, length = 3.0 + 17.0 * n;
      stroke(0xFF000000 | palette.sample(0.1 + 0.6 * n), 210);
      line((float)point[0], (float)point[1],
          (float)(point[0] + Math.cos(angle) * length), (float)(point[1] + Math.sin(angle) * length));
    }
  } else {
    lights(); noStroke();
    pushMatrix(); translate(320, 320); rotateX(0.8); rotateY(0.5);
    int[] triangle = new int[3]; double[] point = new double[3], faceNormal = new double[3];
    beginShape(TRIANGLES);
    for (int face = 0; face < mesh.faceCount(); face++) {
      fill(0xFF000000 | palette.sample(0.1 + 0.6 * meshSamples[face]));
      mesh.normalInto(face, faceNormal, 0);
      normal((float)faceNormal[0], (float)faceNormal[1], (float)faceNormal[2]);
      mesh.triangleInto(face, triangle, 0);
      for (int corner = 0; corner < 3; corner++) {
        mesh.vertexInto(triangle[corner], point, 0);
        vertex((float)point[0], (float)point[1], (float)point[2]);
      }
    }
    endShape(); popMatrix();
  }
  displayedFrame = get();
}

void keyPressed() {
  char k = Character.toLowerCase(key);
  if (k == 's') { displayedFrame.save("depth-marks.png"); return; }
  if (k == 'z') { depth = depth == 0.25 ? 1.25 : 0.25; rebuildSamples(); }
  else if (k == 'c') alternate = !alternate;
  else if (k == 'm') meshMode = !meshMode;
  else if (k == '0') { depth = 0.25; alternate = false; meshMode = false; rebuildSamples(); }
  else return;
  redraw();
}
