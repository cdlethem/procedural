package org.procedurals.android.internal;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Rect;
import java.util.List;
import java.util.Map;
import processing.a2d.PGraphicsAndroid2D;
import processing.core.PConstants;
import org.procedurals.internal.DrawingFrameState;

/**
 * Internal fresh ANDROID2D owner for drawing.fresh-raster-2d v0.1.0.
 *
 * <p>The production allocation sequence mirrors the inspected Android
 * {@code PApplet.makeGraphics}: construct, attach the parent, mark the
 * surface non-primary, then set its size. The test factory deliberately gets
 * no repair so readiness failures remain observable.</p>
 */
public final class Android2DFrame {
    interface Factory { AndroidSurface get(int width, int height); }

    private static final class LifecycleChanged extends IllegalStateException {
        LifecycleChanged() { super("Android host lifecycle changed"); }
    }

    private final AndroidFrameHost host;
    private final Factory factory;
    private final DrawingFrameState state = new DrawingFrameState();
    private AndroidSurface surface;

    public Android2DFrame(AndroidFrameHost host) { this(host, null); }

    /** Package-private failure seam. Production construction is always fresh. */
    Android2DFrame(AndroidFrameHost host, Factory factory) {
        if (host == null) throw new IllegalArgumentException("An Android frame host is required");
        this.host = host;
        this.factory = factory;
    }

    public String state() {
        synchronized (host.lock) { return state.state(); }
    }

    public long count() {
        synchronized (host.lock) { return state.count(); }
    }

    private static int integer(Map<String,Object> values, String key) {
        return ((Number) values.get(key)).intValue();
    }

    private boolean available() {
        // PConstants.JAVA2D is the Android compatibility token in this core.
        return "processing.core.PGraphicsAndroid2D".equals(PConstants.JAVA2D) &&
            host.parent != null && host.parent.g instanceof PGraphicsAndroid2D;
    }

    private void requireAnimationThread() {
        if (host.onAnimationThread()) return;
        // FrameError's constructor is intentionally private to the portable core.
        // Abort first (unless completed), then ask the state for an impossible end.
        if (!"completed".equals(state.state())) state.abort();
        state.prepareEnd();
        throw new AssertionError("prepareEnd must reject an invalid frame state");
    }

    private void requireReady(long ticket) {
        if (!host.ready(ticket)) throw new LifecycleChanged();
    }

    private void failBegin(DrawingFrameState.BeginPlan plan, String code, Throwable cause) {
        try { state.failBegin(plan, code); }
        catch (DrawingFrameState.FrameError error) { error.addSuppressed(cause); throw error; }
    }

    private void failBatch(DrawingFrameState.BatchPlan plan, Long offset, Throwable cause) {
        try { state.failBatch(plan, offset); }
        catch (DrawingFrameState.FrameError error) { error.addSuppressed(cause); throw error; }
    }

    private void failEnd(DrawingFrameState.EndPlan plan, Throwable cause) {
        try { state.failEnd(plan); }
        catch (DrawingFrameState.FrameError error) { error.addSuppressed(cause); throw error; }
    }

    /** Detach this unfinished lease. The completed registry is never touched here. */
    private void releaseUnfinished(Throwable primary) {
        AndroidSurface owned = surface;
        surface = null;
        host.forget(this);
        AndroidFrameHost.releaseOwned(owned, primary);
    }

    private AndroidSurface acquire(DrawingFrameState.BeginPlan plan) {
        int width = integer(plan.environment, "width");
        int height = integer(plan.environment, "height");
        AndroidSurface result;
        if (factory == null) {
            result = new AndroidSurface();
            surface = result;
            result.setParent(host.parent);
            result.setPrimary(false);
            result.setSize(width, height);
        } else {
            result = factory.get(width, height);
        }
        if (result == null) throw new IllegalStateException("No Android surface");
        if (result.released || result.owner != null)
            throw new IllegalStateException("Expected a new unowned Android surface");
        surface = result;
        Canvas canvas = result.prepareCanvas();
        Object nativeValue = result.getNative();
        if (!(nativeValue instanceof Bitmap)) throw new IllegalStateException("No Android bitmap");
        Bitmap bitmap = (Bitmap) nativeValue;
        if (result.parent != host.parent || result.isPrimary() ||
            result.width != width || result.height != height || result.pixelDensity != 1 ||
            result.pixelWidth != width || result.pixelHeight != height ||
            canvas == null || result.canvas != canvas || canvas.getWidth() != width ||
            canvas.getHeight() != height || bitmap.isRecycled() || !bitmap.isMutable() ||
            bitmap.getConfig() != Bitmap.Config.ARGB_8888 || bitmap.getWidth() != width ||
            bitmap.getHeight() != height)
            throw new IllegalStateException("Android surface readiness mismatch");
        return result;
    }

    private void initialize(DrawingFrameState.BeginPlan plan) {
        surface.beginDraw();
        surface.resetMatrix();
        Rect clip = new Rect();
        Canvas canvas = surface.canvas;
        if (canvas == null || !canvas.getClipBounds(clip) || clip.left != 0 || clip.top != 0 ||
            clip.right != integer(plan.environment, "width") || clip.bottom != integer(plan.environment, "height"))
            throw new IllegalStateException("Fresh Android canvas does not have a full clip");
        surface.colorMode(PConstants.RGB, 255, 255, 255, 255);
        surface.blendMode(PConstants.BLEND);
        surface.noTint();
        int rgb = integer(plan.environment, "background");
        surface.background((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
    }

    public void begin(Object environment) {
        synchronized (host.lock) {
            try {
                DrawingFrameState.BeginPlan plan = state.prepareBegin(environment);
                requireAnimationThread();
                if (!available()) state.failBegin(plan, "UNSUPPORTED_CAPABILITY");
                long ticket = host.epoch();
                if (!host.ready(ticket)) state.failBegin(plan, "RENDER_FAILURE");
                host.track(this);
                try {
                    requireReady(ticket);
                    acquire(plan);
                    requireReady(ticket);
                } catch (LifecycleChanged changed) {
                    failBegin(plan, "RENDER_FAILURE", changed);
                } catch (RuntimeException | Error failure) {
                    failBegin(plan, "RESOURCE_FAILURE", failure);
                }
                try {
                    requireReady(ticket);
                    initialize(plan);
                    requireReady(ticket);
                } catch (LifecycleChanged changed) {
                    failBegin(plan, "RENDER_FAILURE", changed);
                } catch (RuntimeException | Error failure) {
                    failBegin(plan, "RENDER_FAILURE", failure);
                }
                state.activate(plan);
            } catch (RuntimeException | Error failure) {
                releaseUnfinished(failure);
                throw failure;
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void draw(Map<String,Object> command) {
        List<Number> channels = (List<Number>) command.get("channels");
        float red = channels.get(0).floatValue();
        float green = channels.get(1).floatValue();
        float blue = channels.get(2).floatValue();
        float alpha = ((Number) command.get("opacity8")).floatValue();
        List<List<Number>> points = (List<List<Number>>) command.get("points");
        if ("segment2".equals(command.get("kind"))) {
            surface.noFill();
            surface.stroke(red, green, blue, alpha);
            surface.strokeWeight(((Number) command.get("width")).floatValue());
            surface.strokeCap(PConstants.ROUND);
            surface.line(points.get(0).get(0).floatValue(), points.get(0).get(1).floatValue(),
                         points.get(1).get(0).floatValue(), points.get(1).get(1).floatValue());
        } else {
            surface.noStroke();
            surface.fill(red, green, blue, alpha);
            surface.beginShape();
            for (List<Number> point : points)
                surface.vertex(point.get(0).floatValue(), point.get(1).floatValue());
            surface.endShape(PConstants.CLOSE);
        }
    }

    public void batch(Object commands) {
        synchronized (host.lock) {
            try {
                requireAnimationThread();
                DrawingFrameState.BatchPlan plan = state.prepareBatch(commands);
                long ticket = host.epoch();
                try {
                    // This first and final check deliberately also covers empty/no-op batches.
                    requireReady(ticket);
                    for (DrawingFrameState.Slot slot : plan.slots) {
                        if ("noop".equals(slot.command.get("outcome"))) continue;
                        try {
                            requireReady(ticket);
                            draw(slot.command);
                            requireReady(ticket);
                        } catch (LifecycleChanged changed) {
                            failBatch(plan, Long.valueOf(slot.sourceOffset), changed);
                        } catch (RuntimeException | Error failure) {
                            failBatch(plan, Long.valueOf(slot.sourceOffset), failure);
                        }
                    }
                    requireReady(ticket);
                } catch (LifecycleChanged changed) {
                    failBatch(plan, null, changed);
                }
                state.commitBatch(plan);
            } catch (RuntimeException | Error failure) {
                releaseUnfinished(failure);
                throw failure;
            }
        }
    }

    public PGraphicsAndroid2D end() {
        synchronized (host.lock) {
            try {
                requireAnimationThread();
                DrawingFrameState.EndPlan plan = state.prepareEnd();
                long ticket = host.epoch();
                try {
                    requireReady(ticket);
                    surface.endDraw();
                    requireReady(ticket);
                    host.transfer(this, surface, ticket, () -> state.completeEnd(plan));
                } catch (LifecycleChanged changed) {
                    failEnd(plan, changed);
                } catch (RuntimeException | Error failure) {
                    failEnd(plan, failure);
                }
                AndroidSurface completed = surface;
                surface = null;
                return completed;
            } catch (RuntimeException | Error failure) {
                releaseUnfinished(failure);
                throw failure;
            }
        }
    }

    public void abort() {
        synchronized (host.lock) {
            try {
                requireAnimationThread();
                state.abort();
                IllegalStateException cleanup = new IllegalStateException("Android surface cleanup failed");
                releaseUnfinished(cleanup);
                if (cleanup.getSuppressed().length != 0) throw cleanup;
            } catch (RuntimeException | Error failure) {
                releaseUnfinished(failure);
                throw failure;
            }
        }
    }

    /** Host-only lifecycle resolution; completed state/output stays owned by the host. */
    void lifecycleAbort(Throwable primary) {
        synchronized (host.lock) {
            if ("completed".equals(state.state())) return;
            try { state.abort(); }
            catch (RuntimeException | Error failure) { if (failure != primary) primary.addSuppressed(failure); }
            releaseUnfinished(primary);
        }
    }
}
