package org.procedurals.android.internal;

import android.graphics.Bitmap;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicInteger;
import processing.a2d.PGraphicsAndroid2D;
import processing.core.PApplet;

/** Internal Android ownership coordinator. Construct in PApplet.setup().
 * Motivated by pelines/ciserp; native validation is required before public exposure.
 */
public final class AndroidFrameHost {
    @FunctionalInterface public interface SurfaceConsumer { void accept(PGraphicsAndroid2D surface); }
    final Object lock = new Object();
    final PApplet parent;
    private final Object ownerToken=new Object();
    private final Thread animationThread;
    private final AtomicLong generation = new AtomicLong();
    private final AtomicInteger stops = new AtomicInteger();
    private volatile boolean accepting = true;
    private volatile boolean closed;
    private boolean resumePending;
    private final IdentityHashMap<Android2DFrame,Boolean> unfinished = new IdentityHashMap<>();
    private static final class Lease {
        final long epoch;
        boolean consuming;
        Lease(long epoch) { this.epoch=epoch; }
    }
    private final IdentityHashMap<PGraphicsAndroid2D,Lease> completed = new IdentityHashMap<>();
    private final List<Throwable> diagnostics = new ArrayList<>();

    public AndroidFrameHost(PApplet parent) {
        if (parent == null) throw new IllegalArgumentException("An explicit sketch is required");
        this.parent = parent;
        animationThread = Thread.currentThread();
        String[] methods = {"pause", "resume", "onDestroy", "dispose", "pre"};
        int registered = 0;
        try {
            for (String method : methods) { parent.registerMethod(method, this); registered++; }
        } catch (RuntimeException | Error primary) {
            for (int i=registered-1; i>=0; i--) {
                final String method = methods[i];
                attempt(primary, () -> parent.unregisterMethod(method, this));
            }
            throw primary;
        }
    }

    boolean onAnimationThread() { return Thread.currentThread() == animationThread; }
    long epoch() { return generation.get(); }
    boolean ready(long epoch) { return accepting && !closed && stops.get()==0 && generation.get() == epoch; }
    void track(Android2DFrame frame) { unfinished.put(frame, Boolean.TRUE); }
    void forget(Android2DFrame frame) { unfinished.remove(frame); }
    void transfer(Android2DFrame frame, AndroidSurface surface, long ticket, Runnable completeState) {
        // The frame still owns its pointer until registry insertion and state commit succeed.
        try {
            completed.put(surface, new Lease(ticket));
            completeState.run();
        }
        catch (RuntimeException | Error failure) { completed.remove(surface); throw failure; }
        surface.owner=ownerToken;
        unfinished.remove(frame);
    }

    /** Native callback only; consumer must not wait for another/UI thread. Always releases. */
    public void consumeCompleted(PGraphicsAndroid2D surface, SurfaceConsumer consumer) {
        synchronized (lock) {
            Lease lease=completed.get(surface);
            if (!onAnimationThread() || lease==null || lease.consuming || !ready(lease.epoch))
                throw new IllegalStateException("Completed output is unavailable on this thread/host");
            long ticket = lease.epoch;
            lease.consuming=true;
            Throwable primary = null;
            try {
                consumer.accept(surface);
                if (!ready(ticket)) throw new IllegalStateException("Lifecycle changed during output transfer");
            } catch (RuntimeException | Error error) { primary=error; throw error; }
            finally { releaseCompleted(surface, primary); }
        }
    }

    public void releaseCompleted(PGraphicsAndroid2D surface) {
        synchronized (lock) {
            if (!(surface instanceof AndroidSurface) || ((AndroidSurface)surface).owner!=ownerToken)
                throw new IllegalArgumentException("Surface does not belong to this host");
            Lease lease=completed.get(surface);
            if (lease!=null && lease.consuming) throw new IllegalStateException("Surface is being consumed");
            releaseCompleted(surface, null);
        }
    }

    private void releaseCompleted(PGraphicsAndroid2D surface, Throwable primary) {
        if (completed.remove(surface) != null) releaseOwned(surface, primary);
    }

    static void attempt(Throwable primary, Runnable action) {
        try { action.run(); }
        catch (RuntimeException | Error error) { if (error != primary) primary.addSuppressed(error); }
    }

    static void releaseOwned(PGraphicsAndroid2D surface, Throwable primary) {
        if (surface == null) return;
        if (surface instanceof AndroidSurface) {
            AndroidSurface owned=(AndroidSurface)surface;
            if (owned.released) return;
            owned.released=true;
        }
        Throwable failure = primary == null ? new IllegalStateException("Android surface cleanup failed") : primary;
        Bitmap bitmap = null;
        try { bitmap = (Bitmap) surface.getNative(); }
        catch (RuntimeException | Error error) { if (error != failure) failure.addSuppressed(error); }
        surface.canvas = null;
        surface.pixels = null;
        attempt(failure, () -> surface.setNative(null));
        attempt(failure, () -> surface.setParent(null));
        final Bitmap owned = bitmap;
        attempt(failure, () -> { if (owned != null && !owned.isRecycled()) owned.recycle(); });
        if (primary == null && failure.getSuppressed().length != 0) throw (IllegalStateException) failure;
    }

    private void stop(boolean permanently) {
        // Close admission before waiting for a bounded native operation's lock.
        stops.incrementAndGet();
        if (permanently) closed=true;
        accepting=false;
        generation.incrementAndGet();
        try {
        synchronized (lock) {
            resumePending=false;
            for (Android2DFrame frame : new ArrayList<>(unfinished.keySet())) {
                IllegalStateException cleanup = new IllegalStateException("Android lifecycle cleanup");
                attempt(cleanup, () -> frame.lifecycleAbort(cleanup));
                if (cleanup.getSuppressed().length != 0) diagnose(cleanup);
            }
            for (PGraphicsAndroid2D surface : new ArrayList<>(completed.keySet())) {
                if (completed.get(surface).consuming) continue; // Reentrant callback: consumer's finally owns release.
                try { releaseCompleted(surface, null); }
                catch (RuntimeException | Error error) { diagnose(error); }
            }
        }
        } finally { stops.decrementAndGet(); }
    }

    private void diagnose(Throwable error) {
        if (diagnostics.size()==16) diagnostics.remove(0);
        diagnostics.add(error);
    }

    public void pause() { stop(false); }
    public void onDestroy() { stop(true); }
    public void dispose() { stop(true); }
    public void resume() {
        synchronized (lock) { if (!closed) resumePending=true; }
    }
    public void pre() {
        synchronized (lock) {
            if (onAnimationThread() && resumePending && !closed && stops.get()==0) {
                resumePending=false;
                accepting=true;
            }
        }
    }
    public List<Throwable> cleanupDiagnostics() {
        synchronized (lock) { return new ArrayList<>(diagnostics); }
    }
}
