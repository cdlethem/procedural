import java.util.Map;
import org.procedurals.layout.BinaryPartitionProbe;

// Private CP17 study. Attempts 20/80/240 are investigation settings, not recommendations.
long seed = 42;
int attempts = 80;
int policy = 0; // 0 RANDOM, 1 LONGEST
int decoration = 0; // 0 nested outlines, 1 inset panels plus center line
BinaryPartitionProbe.Layout layout;
int[] palette = {0x264653, 0x2A9D8F, 0xE9C46A, 0xF4A261, 0xE76F51};

void settings() { size(640, 640, JAVA2D); pixelDensity(1); }

void setup() { rebuild(); noLoop(); }

public void configureRender(long suppliedSeed, Map<String, Double> parameters) {
  if (parameters == null || parameters.size() != 3 ||
      !parameters.containsKey("attempts") || !parameters.containsKey("policy") ||
      !parameters.containsKey("decoration")) throw new IllegalArgumentException("exact parameters required");
  seed = suppliedSeed;
  attempts = integerParameter(parameters.get("attempts"), 0, 2147483646);
  policy = integerParameter(parameters.get("policy"), 0, 1);
  decoration = integerParameter(parameters.get("decoration"), 0, 1);
}

int integerParameter(Double value, int minimum, int maximum) {
  if (value == null || !Double.isFinite(value) || value < minimum ||
      value > maximum || value != Math.floor(value)) throw new IllegalArgumentException("invalid parameter");
  return (int) value.doubleValue();
}

void rebuild() { layout = BinaryPartitionProbe.generate(seed, 60, 60, attempts, policy == 0 ? "RANDOM" : "LONGEST"); }

void draw() {
  background(245); noFill(); int[] bounds = new int[4];
  for (int index = 0; index < layout.size(); index++) {
    layout.boundsInto(index, bounds);
    float x = 20 + bounds[0] * 10, y = 20 + bounds[1] * 10;
    float width = (bounds[2] - bounds[0]) * 10, height = (bounds[3] - bounds[1]) * 10;
    int swatch = palette[index % palette.length];
    stroke((swatch >> 16) & 255, (swatch >> 8) & 255, swatch & 255, 210);
    if (decoration == 0) {
      float inset = 1;
      while (width - 2 * inset > 0 && height - 2 * inset > 0) {
        rect(x + inset, y + inset, width - 2 * inset, height - 2 * inset); inset += 3;
      }
    } else {
      fill((swatch >> 16) & 255, (swatch >> 8) & 255, swatch & 255, 90);
      rect(x + 2, y + 2, width - 4, height - 4);
      stroke(40, 60, 70, 180); line(x + width * 0.5, y + 3, x + width * 0.5, y + height - 3);
    }
  }
}

void keyPressed() {
  char keyValue = Character.toLowerCase(key);
  if (keyValue == 'r') seed = (seed + 1) & 0xffffffffL;
  else if (keyValue == 'a') attempts = attempts == 20 ? 80 : attempts == 80 ? 240 : 20;
  else if (keyValue == 'p') policy = 1 - policy;
  else if (keyValue == 'd') decoration = 1 - decoration;
  else return;
  if (keyValue != 'd') rebuild();
  redraw();
}
