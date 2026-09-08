package org.procedurals.processing.internal;

import java.util.List;
import java.util.Map;
import java.awt.Graphics2D;
import java.awt.Image;
import java.util.function.Supplier;
import processing.core.PApplet;
import processing.core.PConstants;
import processing.awt.PGraphicsJava2D;
import org.procedurals.internal.DrawingFrameState;

/** Internal adapter for drawing.fresh-raster-2d v0.1.0; native validation pending.
 * Call synchronously on the sketch thread. The returned completed surface belongs to
 * the caller; no active surface is exposed. Motivating work: pelines and ciserp.
 */
public final class Java2DFrame {
    private final PApplet parent;
    private final Supplier<PGraphicsJava2D> factory;
    private final DrawingFrameState state = new DrawingFrameState();
    private PGraphicsJava2D surface;

    public Java2DFrame(PApplet parent) { this(parent, PGraphicsJava2D::new); }
    // Package-private fault-injection seam. Production always creates a fresh JAVA2D.
    Java2DFrame(PApplet parent, Supplier<PGraphicsJava2D> factory) {
        this.parent = parent;
        this.factory = factory;
    }
    public String state() { return state.state(); }
    public long count() { return state.count(); }

    private static int integer(Map<String,Object> values, String key) {
        return ((Number)values.get(key)).intValue();
    }

    /** Releases only an owned unfinished surface, preserving the primary failure. */
    private void release(Throwable primary) {
        PGraphicsJava2D owned = surface;
        surface = null;
        if (owned == null) return;
        Graphics2D graphics = owned.g2;
        Image image = owned.image;
        owned.g2 = null;
        owned.image = null;
        owned.pixels = null;
        try { if (graphics != null) graphics.dispose(); }
        catch (RuntimeException | Error failure) { primary.addSuppressed(failure); }
        try { if (image != null) image.flush(); }
        catch (RuntimeException | Error failure) { primary.addSuppressed(failure); }
        try { owned.dispose(); }
        catch (RuntimeException | Error failure) { primary.addSuppressed(failure); }
    }

    public void begin(Object environment) {
        try {
            DrawingFrameState.BeginPlan plan = state.prepareBegin(environment);
            if (parent == null) state.failBegin(plan, "UNSUPPORTED_CAPABILITY");
            try {
                surface = factory.get();
                surface.setParent(parent);
                surface.setPrimary(false);
                surface.pixelDensity = 1;
                surface.setSize(integer(plan.environment,"width"), integer(plan.environment,"height"));
                Graphics2D probe = surface.checkImage();
                if (probe == null) throw new IllegalStateException("No backing graphics");
                probe.dispose();
                if (surface.width != integer(plan.environment,"width") ||
                    surface.height != integer(plan.environment,"height") || surface.pixelDensity != 1 ||
                    surface.pixelWidth != surface.width || surface.pixelHeight != surface.height ||
                    surface.image == null || surface.image.getWidth(null) != surface.width ||
                    surface.image.getHeight(null) != surface.height)
                    throw new IllegalStateException("Backing surface mismatch");
            } catch (RuntimeException | Error failure) {
                try { state.failBegin(plan,"RESOURCE_FAILURE"); }
                catch (DrawingFrameState.FrameError error) { error.addSuppressed(failure); throw error; }
            }
            try {
                surface.beginDraw();
                surface.resetMatrix();
                surface.noClip();
                surface.colorMode(PConstants.RGB,255,255,255,255);
                surface.blendMode(PConstants.BLEND);
                surface.noTint();
                int rgb = integer(plan.environment,"background");
                surface.background((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
            } catch (RuntimeException | Error failure) {
                try { state.failBegin(plan,"RENDER_FAILURE"); }
                catch (DrawingFrameState.FrameError error) { error.addSuppressed(failure); throw error; }
            }
            state.activate(plan);
        } catch (RuntimeException | Error failure) { release(failure); throw failure; }
    }

    @SuppressWarnings("unchecked")
    private void draw(Map<String,Object> command) {
        List<Number> channels = (List<Number>) command.get("channels");
        float r=channels.get(0).floatValue(), g=channels.get(1).floatValue(), b=channels.get(2).floatValue();
        float alpha=((Number)command.get("opacity8")).floatValue();
        List<List<Number>> points = (List<List<Number>>) command.get("points");
        if ("segment2".equals(command.get("kind"))) {
            surface.noFill();
            surface.stroke(r,g,b,alpha);
            surface.strokeWeight(((Number)command.get("width")).floatValue());
            surface.strokeCap(PConstants.ROUND);
            surface.line(points.get(0).get(0).floatValue(),points.get(0).get(1).floatValue(),
                         points.get(1).get(0).floatValue(),points.get(1).get(1).floatValue());
        } else {
            surface.noStroke();
            surface.fill(r,g,b,alpha);
            surface.beginShape();
            for (List<Number> point : points) surface.vertex(point.get(0).floatValue(),point.get(1).floatValue());
            surface.endShape(PConstants.CLOSE);
        }
    }

    public void batch(Object commands) {
        try {
            DrawingFrameState.BatchPlan plan = state.prepareBatch(commands);
            for (DrawingFrameState.Slot slot : plan.slots) {
                if ("noop".equals(slot.command.get("outcome"))) continue;
                try { draw(slot.command); }
                catch (RuntimeException | Error failure) {
                    try { state.failBatch(plan,Long.valueOf(slot.sourceOffset)); }
                    catch (DrawingFrameState.FrameError error) { error.addSuppressed(failure); throw error; }
                }
            }
            state.commitBatch(plan);
        } catch (RuntimeException | Error failure) { release(failure); throw failure; }
    }

    public PGraphicsJava2D end() {
        try {
            DrawingFrameState.EndPlan plan = state.prepareEnd();
            try { surface.endDraw(); }
            catch (RuntimeException | Error failure) {
                try { state.failEnd(plan); }
                catch (DrawingFrameState.FrameError error) { error.addSuppressed(failure); throw error; }
            }
            state.completeEnd(plan);
            PGraphicsJava2D result = surface;
            surface = null;
            return result;
        } catch (RuntimeException | Error failure) { release(failure); throw failure; }
    }

    /** Finish integration ownership after display/save. Idempotent on this surface.
     * The caller must not draw into or reuse a released surface. Call on its sketch
     * thread, after successful end; never use this helper on a caller-owned renderer.
     */
    public static void releaseCompleted(PGraphicsJava2D completed) {
        Image image = completed.image;
        if (image == null) return;
        completed.image = null;
        completed.pixels = null;
        completed.g2 = null; // endDraw already disposed the completed graphics context.
        try { image.flush(); }
        finally { completed.dispose(); }
    }

    public void abort() {
        state.abort();
        RuntimeException cleanup = new IllegalStateException("Surface cleanup failed");
        release(cleanup);
        if (cleanup.getSuppressed().length != 0) throw cleanup;
    }
}
