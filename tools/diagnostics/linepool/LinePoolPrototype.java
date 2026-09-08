import processing.core.PApplet;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/*
 * Private diagnostic source-faithful transition probe for
 * AllSketchs/2019/generativos/brotes/brotes.pde at upstream commit
 * 69bdd8513e4482a5e6018e36887d4bc208660eb5.
 *
 * Derived from the active body of three().  This is not library or public API
 * code; the primitive arrays make its mutable retained-pool state observable
 * while avoiding an allocation per source Line.
 *
 * MIT License
 *
 * Copyright (c) 2020 Manolo ide
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
public final class LinePoolPrototype {
  private LinePoolPrototype() {}

  public static final class Result {
    public final float[] x1;
    public final float[] y1;
    public final float[] x2;
    public final float[] y2;
    public final boolean[] divided;
    public final int size;
    public final int successfulCuts;
    public final int skips;
    public final long elapsedNanos;

    private Result(
        float[] x1, float[] y1, float[] x2, float[] y2, boolean[] divided,
        int size, int successfulCuts, int skips, long elapsedNanos) {
      this.x1 = x1;
      this.y1 = y1;
      this.x2 = x2;
      this.y2 = y2;
      this.divided = divided;
      this.size = size;
      this.successfulCuts = successfulCuts;
      this.skips = skips;
      this.elapsedNanos = elapsedNanos;
    }
  }

  /**
   * Builds one source-equivalent pool from the fixed experiment stroke
   * (480,850) to (480,200).  The output arrays are capacity-sized; use size.
   */
  public static Result build(long seed, int attempts, float angle) {
    if (attempts < 0 || attempts > (Integer.MAX_VALUE - 1) / 2) {
      throw new IllegalArgumentException("attempts must permit 1 + 2 * attempts capacity");
    }

    final int capacity = 1 + 2 * attempts;
    final float[] x1 = new float[capacity];
    final float[] y1 = new float[capacity];
    final float[] x2 = new float[capacity];
    final float[] y2 = new float[capacity];
    final boolean[] divided = new boolean[capacity];
    x1[0] = 480.0f;
    y1[0] = 850.0f;
    x2[0] = 480.0f;
    y2[0] = 200.0f;

    final PApplet applet = new PApplet();
    applet.randomSeed(seed);
    int size = 1;
    int successfulCuts = 0;
    int skips = 0;
    final long started = System.nanoTime();

    for (int i = 0; i < attempts; i++) {
      // Source: int(random(lines.size()) * random(0.8, 1)).
      final int index = (int) (applet.random(size) * applet.random(0.8f, 1.0f));
      final float lineAngle = PApplet.atan2(y2[index] - y1[index], x2[index] - x1[index]);
      final float distance = PApplet.dist(x1[index], y1[index], x2[index], y2[index]);

      if (distance < 4.0f) {
        skips++;
        continue;
      }
      successfulCuts++;

      if (!divided[index]) {
        // Do not simplify nested random bounds: Processing returns low with no
        // third draw when low >= high, a source-observable RNG transition.
        final float multiplier = applet.random(applet.random(0.6f, 0.7f), applet.random(0.8f));
        final float nx = PApplet.lerp(x1[index], x2[index], multiplier);
        final float ny = PApplet.lerp(y1[index], y2[index], multiplier);
        x2[index] = nx;
        y2[index] = ny;

        final float angle1 = applet.random(1.2f) * applet.random(0.2f, 1.0f) * angle;
        final float angle2 = applet.random(1.2f) * applet.random(0.2f, 1.0f) * angle;
        // Active source computes range but never uses it; retain its draw.
        final float unusedRange = PApplet.lerp(angle1, angle2, applet.random(1.0f));

        final float distance1 = distance * (1.0f - multiplier) * applet.random(0.9f, 1.2f);
        final float distance2 = distance * (1.0f - multiplier) * applet.random(0.9f, 1.2f);
        final float distance3 = distance * (1.0f - multiplier) * applet.random(0.9f, 1.2f);
        final float a1 = lineAngle + angle1;
        final float a2 = lineAngle - angle2;
        final float a3 = lineAngle + applet.random(-0.1f, 0.1f);
        divided[index] = true;

        final int selection = (int) applet.random(3.0f);
        if (selection == 1) {
          size = append(x1, y1, x2, y2, divided, size, nx, ny,
              nx + PApplet.cos(a1) * distance1, ny + PApplet.sin(a1) * distance1, false);
          size = append(x1, y1, x2, y2, divided, size, nx, ny,
              nx + PApplet.cos(a2) * distance2, ny + PApplet.sin(a2) * distance2, false);
        } else if (selection == 2) {
          size = append(x1, y1, x2, y2, divided, size, nx, ny,
              nx + PApplet.cos(a3) * distance3, ny + PApplet.sin(a3) * distance3, false);
        }
        // The source contains a second unreachable `else if (sel == 2)`;
        // deliberately omitted from this active-transition probe.
      } else {
        final float multiplier = applet.random(applet.random(0.6f, 0.7f), applet.random(0.8f)) * 0.4f;
        final float nx = PApplet.lerp(x1[index], x2[index], multiplier);
        final float ny = PApplet.lerp(y1[index], y2[index], multiplier);

        size = append(x1, y1, x2, y2, divided, size, nx, ny, x2[index], y2[index], true);
        x2[index] = nx;
        y2[index] = ny;

        final float deviation = applet.random(0.1f, 0.4f)
            * ((applet.random(1.0f) < 0.5f) ? -1.0f : 1.0f) * 2.0f;
        final float branchDistance = distance * (1.0f - multiplier) * applet.random(0.9f, 1.1f);
        size = append(x1, y1, x2, y2, divided, size, nx, ny,
            nx + PApplet.cos(lineAngle + deviation) * branchDistance,
            ny + PApplet.sin(lineAngle + deviation) * branchDistance, false);
      }
    }
    final long elapsedNanos = System.nanoTime() - started;
    return new Result(x1, y1, x2, y2, divided, size, successfulCuts, skips, elapsedNanos);
  }

  private static int append(float[] x1, float[] y1, float[] x2, float[] y2, boolean[] divided,
      int size, float startX, float startY, float endX, float endY, boolean isDivided) {
    x1[size] = startX;
    y1[size] = startY;
    x2[size] = endX;
    y2[size] = endY;
    divided[size] = isDivided;
    return size + 1;
  }

  /** Command-line diagnostic only: {@code LinePoolPrototype <seed> <attempts> <angle>}. */
  public static void main(String[] arguments) {
    if (arguments.length != 3) {
      throw new IllegalArgumentException("usage: LinePoolPrototype <seed> <attempts> <angle>");
    }
    final long seed = Long.parseLong(arguments[0]);
    final int attempts = Integer.parseInt(arguments[1]);
    final float angle = Float.parseFloat(arguments[2]);
    final Result result = build(seed, attempts, angle);
    if (result.successfulCuts + result.skips != attempts || !finite(result)) {
      throw new AssertionError("invalid transition result");
    }
    System.out.println("seed=" + seed + " attempts=" + attempts + " angle=" + angle
        + " size=" + result.size + " successfulCuts=" + result.successfulCuts
        + " skips=" + result.skips + " elapsedNanos=" + result.elapsedNanos
        + " hash=" + geometryHash(result));
  }

  private static boolean finite(Result result) {
    for (int i = 0; i < result.size; i++) {
      if (!Float.isFinite(result.x1[i]) || !Float.isFinite(result.y1[i])
          || !Float.isFinite(result.x2[i]) || !Float.isFinite(result.y2[i])) {
        return false;
      }
    }
    return true;
  }

  private static String geometryHash(Result result) {
    try {
      final MessageDigest digest = MessageDigest.getInstance("SHA-256");
      final ByteBuffer bytes = ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN);
      putInt(digest, bytes, result.size);
      putInt(digest, bytes, result.successfulCuts);
      putInt(digest, bytes, result.skips);
      for (int i = 0; i < result.size; i++) {
        putInt(digest, bytes, Float.floatToIntBits(result.x1[i]));
        putInt(digest, bytes, Float.floatToIntBits(result.y1[i]));
        putInt(digest, bytes, Float.floatToIntBits(result.x2[i]));
        putInt(digest, bytes, Float.floatToIntBits(result.y2[i]));
        digest.update((byte) (result.divided[i] ? 1 : 0));
      }
      final StringBuilder text = new StringBuilder(64);
      for (byte value : digest.digest()) {
        text.append(String.format("%02x", value & 0xff));
      }
      return text.toString();
    } catch (NoSuchAlgorithmException error) {
      throw new AssertionError(error);
    }
  }

  private static void putInt(MessageDigest digest, ByteBuffer bytes, int value) {
    bytes.clear();
    bytes.putInt(value);
    digest.update(bytes.array());
  }
}
