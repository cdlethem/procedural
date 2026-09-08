package org.procedurals.android.internal;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.procedurals.internal.DrawingFrameState;
import processing.a2d.PGraphicsAndroid2D;
import processing.core.PApplet;
import processing.core.PGraphics;

/**
 * Registered injected lifecycle group for Android2DFrame.
 *
 * <p>All supplied surfaces are real AndroidSurface/PGraphicsAndroid2D objects.
 * Their canvas allocation therefore creates real ARGB_8888 Bitmaps; individual
 * wrapper calls are overridden only to deterministically inject a fault. This
 * is not an actual activity lifecycle or spontaneous device-failure probe.</p>
 */
public final class AndroidFrameFailures {
    private enum Fault { NONE, READINESS, INITIALIZATION, DRAW, END }
    private interface Checked { void run(); }

    private static final Map<String,Object> ENVIRONMENT = environment();

    private AndroidFrameFailures() { }

    private static final class ProbeSurface extends AndroidSurface {
        final Fault fault;
        final RuntimeException injected;
        Bitmap backing;
        int lineCalls;
        int setNativeNullCalls;
        int failLineCall = 1;
        boolean cleanupSetNativeFailure;
        Runnable reentry;

        ProbeSurface(Fault fault, RuntimeException injected) {
            this.fault = fault;
            this.injected = injected;
        }

        @Override Canvas prepareCanvas() {
            Canvas result = super.prepareCanvas();
            Object value = getNative();
            if (value instanceof Bitmap) backing = (Bitmap) value;
            if (fault == Fault.READINESS) throw injected;
            return result;
        }

        @Override public void beginDraw() {
            super.beginDraw();
            if (fault == Fault.INITIALIZATION) throw injected;
        }

        @Override public void line(float x1, float y1, float x2, float y2) {
            lineCalls++;
            if (reentry != null) {
                Runnable callback = reentry;
                reentry = null;
                callback.run();
                return;
            }
            if (fault == Fault.DRAW && lineCalls == failLineCall) throw injected;
            super.line(x1, y1, x2, y2);
        }

        @Override public void endDraw() {
            super.endDraw();
            if (fault == Fault.END) throw injected;
        }

        @Override public void setNative(Object nativeObject) {
            if (nativeObject == null) setNativeNullCalls++;
            super.setNative(nativeObject);
            if (cleanupSetNativeFailure && nativeObject == null)
                throw new IllegalStateException("injected cleanup setNative failure");
        }
    }

    private static Map<String,Object> map(Object... values) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        for (int index = 0; index < values.length; index += 2)
            result.put((String) values[index], values[index + 1]);
        return result;
    }

    private static List<Object> list(Object... values) {
        return new ArrayList<Object>(Arrays.asList(values));
    }

    private static Map<String,Object> environment() {
        return map("width", 32, "height", 24, "density", 1, "background", 0x123456);
    }

    private static Map<String,Object> segment(double x1, double y1, double x2, double y2) {
        return map("kind", "segment2", "from", list(x1, y1), "to", list(x2, y2),
            "rgb", 0xaa3311, "opacity8", 180, "width", 2, "cap", "round");
    }

    private static Map<String,Object> noop() {
        return map("kind", "segment2", "from", list(1, 1), "to", list(1 + Math.pow(2, -25), 1),
            "rgb", 0xaa3311, "opacity8", 180, "width", 1, "cap", "round");
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static DrawingFrameState.FrameError expect(String code, Long index, Checked action) {
        try {
            action.run();
        } catch (DrawingFrameState.FrameError error) {
            check(code.equals(error.code), "expected " + code + ", got " + error.code);
            check(index == null ? error.commandIndex == null : index.equals(error.commandIndex),
                "wrong command index " + error.commandIndex);
            return error;
        }
        throw new AssertionError("expected " + code);
    }

    private static boolean hasSuppressed(Throwable primary, Throwable expected) {
        for (Throwable item : primary.getSuppressed()) if (item == expected) return true;
        return false;
    }

    /** Obtain a different portable error without accessing its package-private constructor. */
    private static DrawingFrameState.FrameError misleadingFrameError() {
        DrawingFrameState independent = new DrawingFrameState();
        try {
            Map<String,Object> invalid = environment();
            invalid.put("width", 0);
            independent.prepareBegin(invalid);
        } catch (DrawingFrameState.FrameError error) {
            check("INVALID_ENVIRONMENT".equals(error.code), "independent misleading error code");
            return error;
        }
        throw new AssertionError("independent state did not create FrameError");
    }

    private static Android2DFrame.Factory prepared(final AndroidFrameHost host, final ProbeSurface surface) {
        return new Android2DFrame.Factory() {
            @Override public AndroidSurface get(int width, int height) {
                surface.setParent(host.parent);
                surface.setPrimary(false);
                surface.setSize(width, height);
                return surface;
            }
        };
    }

    private static Android2DFrame frame(AndroidFrameHost host, ProbeSurface surface) {
        return new Android2DFrame(host, prepared(host, surface));
    }

    private static void checkReleased(ProbeSurface surface) {
        check(surface.backing != null, "fault surface did not allocate a real Bitmap");
        check(surface.canvas == null && surface.pixels == null && surface.parent == null &&
            surface.getNative() == null && surface.backing.isRecycled(), "surface was not detached/recycled");
        check(surface.setNativeNullCalls == 1, "surface release was not idempotent");
    }

    private static void cleanup(AndroidFrameHost host, Android2DFrame frame, PGraphicsAndroid2D completed) {
        try {
            if (completed != null) host.releaseCompleted(completed);
            else if (!"completed".equals(frame.state())) frame.abort();
        } catch (RuntimeException ignored) {
            // The assertion for the primary error is recorded by its group.
        }
    }

    private static void invalidEnvironmentBeforeFactory(final AndroidFrameHost host) {
        final int[] calls = new int[1];
        Android2DFrame.Factory factory = new Android2DFrame.Factory() {
            @Override public AndroidSurface get(int width, int height) { calls[0]++; return new AndroidSurface(); }
        };
        PGraphics original = host.parent.g;
        try {
            // Controlled static absence: restore the real primary before leaving this group.
            host.parent.g = null;
            Android2DFrame invalidFrame = new Android2DFrame(host, factory);
            Map<String,Object> invalid = environment();
            invalid.put("width", 0);
            expect("INVALID_ENVIRONMENT", null, new Checked() {
                @Override public void run() { invalidFrame.begin(invalid); }
            });
            Android2DFrame unavailableFrame = new Android2DFrame(host, factory);
            expect("UNSUPPORTED_CAPABILITY", null, new Checked() {
                @Override public void run() { unavailableFrame.begin(ENVIRONMENT); }
            });
            check(calls[0] == 0 && "aborted".equals(invalidFrame.state()) &&
                "aborted".equals(unavailableFrame.state()), "static capability reached factory");
        } finally { host.parent.g = original; }
    }

    private static void allocationFailure(final AndroidFrameHost host, final RuntimeException injected) {
        Android2DFrame frame = new Android2DFrame(host, new Android2DFrame.Factory() {
            @Override public AndroidSurface get(int width, int height) { throw injected; }
        });
        DrawingFrameState.FrameError error = expect("RESOURCE_FAILURE", null,
            new Checked() { @Override public void run() { frame.begin(ENVIRONMENT); } });
        check(hasSuppressed(error, injected) && "aborted".equals(frame.state()), "allocation cause/state");
    }

    private static void suppliedReadinessNoRepair(final AndroidFrameHost host) {
        final ProbeSurface supplied = new ProbeSurface(Fault.NONE, new IllegalStateException("unused"));
        Android2DFrame frame = new Android2DFrame(host, new Android2DFrame.Factory() {
            @Override public AndroidSurface get(int width, int height) {
                // It has a real bitmap allocation but intentionally lacks the required parent.
                supplied.setSize(width, height);
                return supplied;
            }
        });
        expect("RESOURCE_FAILURE", null, new Checked() { @Override public void run() { frame.begin(ENVIRONMENT); } });
        checkReleased(supplied);

        final ProbeSurface densityTwo = new ProbeSurface(Fault.NONE, new IllegalStateException("unused"));
        Android2DFrame densityFrame = new Android2DFrame(host, new Android2DFrame.Factory() {
            @Override public AndroidSurface get(int width, int height) {
                densityTwo.setParent(host.parent);
                densityTwo.setPrimary(false);
                densityTwo.pixelDensity = 2;
                densityTwo.setSize(width, height);
                return densityTwo;
            }
        });
        expect("RESOURCE_FAILURE", null, new Checked() { @Override public void run() { densityFrame.begin(ENVIRONMENT); } });
        check(densityTwo.pixelDensity == 2, "injected density was repaired");
        checkReleased(densityTwo);
    }

    private static void phaseFailure(final AndroidFrameHost host, Fault fault, RuntimeException injected,
                                     String expected, Long index) {
        ProbeSurface probe = new ProbeSurface(fault, injected);
        Android2DFrame frame = frame(host, probe);
        try {
            if (fault == Fault.DRAW) frame.begin(ENVIRONMENT);
            DrawingFrameState.FrameError error = expect(expected, index, new Checked() {
                @Override public void run() {
                    if (fault == Fault.DRAW) frame.batch(list(segment(4, 8, 24, 8)));
                    else if (fault == Fault.END) { frame.begin(ENVIRONMENT); frame.end(); }
                    else frame.begin(ENVIRONMENT);
                }
            });
            check(hasSuppressed(error, injected), "phase cause was not retained");
            check("aborted".equals(frame.state()), "phase failure state");
            checkReleased(probe);
        } finally {
            cleanup(host, frame, null);
        }
    }

    private static void atomicAndAbsoluteIndex(final AndroidFrameHost host) {
        ProbeSurface atomicProbe = new ProbeSurface(Fault.NONE, new IllegalStateException("unused"));
        Android2DFrame atomic = frame(host, atomicProbe);
        try {
            atomic.begin(ENVIRONMENT);
            expect("INVALID_COMMAND", Long.valueOf(1), new Checked() {
                @Override public void run() { atomic.batch(list(segment(4, 8, 24, 8), segment(3, 3, 3, 3))); }
            });
            check(atomic.count() == 0 && atomicProbe.lineCalls == 0, "invalid batch emitted or committed");
            checkReleased(atomicProbe);
        } finally { cleanup(host, atomic, null); }

        final RuntimeException injected = new IllegalStateException("injected second line");
        ProbeSurface probe = new ProbeSurface(Fault.DRAW, injected);
        probe.failLineCall = 2;
        Android2DFrame indexed = frame(host, probe);
        try {
            indexed.begin(ENVIRONMENT);
            indexed.batch(list(segment(4, 8, 24, 8)));
            expect("RENDER_FAILURE", Long.valueOf(2), new Checked() {
                @Override public void run() { indexed.batch(list(noop(), segment(4, 10, 24, 10))); }
            });
            check(indexed.count() == 1 && probe.lineCalls == 2, "prior batch/noop index accounting");
            checkReleased(probe);
        } finally { cleanup(host, indexed, null); }
    }

    private static void wrongThread(final AndroidFrameHost host) {
        final ProbeSurface probe = new ProbeSurface(Fault.NONE, new IllegalStateException("unused"));
        final Android2DFrame frame = frame(host, probe);
        final Throwable[] result = new Throwable[1];
        try {
            frame.begin(ENVIRONMENT);
            Thread worker = new Thread(new Runnable() {
                @Override public void run() {
                    try { frame.batch(list()); }
                    catch (Throwable failure) { result[0] = failure; }
                }
            }, "procedurals-android-wrong-thread");
            worker.setDaemon(true);
            worker.start();
            // This join is intentionally outside host.lock: frame.batch owns that monitor.
            worker.join(15000);
            check(!worker.isAlive(), "wrong-thread call blocked");
            check(result[0] instanceof DrawingFrameState.FrameError, "wrong thread did not return FrameError");
            DrawingFrameState.FrameError error = (DrawingFrameState.FrameError) result[0];
            check("INVALID_STATE".equals(error.code) && error.commandIndex == null, "wrong-thread code/index");
            check("aborted".equals(frame.state()), "wrong-thread state");
            checkReleased(probe);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new AssertionError("wrong-thread join interrupted", error);
        } finally { cleanup(host, frame, null); }
    }

    private static void frameReentry(final AndroidFrameHost host) {
        ProbeSurface probe = new ProbeSurface(Fault.NONE, new IllegalStateException("unused"));
        Android2DFrame frame = frame(host, probe);
        try {
            frame.begin(ENVIRONMENT);
            probe.reentry = new Runnable() { @Override public void run() { frame.end(); } };
            expect("INVALID_STATE", null, new Checked() {
                @Override public void run() { frame.batch(list(segment(4, 8, 24, 8))); }
            });
            check("aborted".equals(frame.state()), "reentry state");
            checkReleased(probe);
        } finally { cleanup(host, frame, null); }
    }

    private static void cleanupPrimary(final AndroidFrameHost host) {
        RuntimeException injected = new IllegalStateException("injected draw primary");
        ProbeSurface probe = new ProbeSurface(Fault.DRAW, injected);
        probe.cleanupSetNativeFailure = true;
        Android2DFrame frame = frame(host, probe);
        try {
            frame.begin(ENVIRONMENT);
            DrawingFrameState.FrameError error = expect("RENDER_FAILURE", Long.valueOf(0), new Checked() {
                @Override public void run() { frame.batch(list(segment(4, 8, 24, 8))); }
            });
            check(hasSuppressed(error, injected) && error.getSuppressed().length >= 2,
                "cleanup replaced primary native error");
            checkReleased(probe);
        } finally { cleanup(host, frame, null); }
    }

    private static void abortAndCompletedOwnership(final AndroidFrameHost host) {
        ProbeSurface abortedProbe = new ProbeSurface(Fault.NONE, new IllegalStateException("unused"));
        Android2DFrame aborted = frame(host, abortedProbe);
        try {
            aborted.begin(ENVIRONMENT);
            aborted.abort();
            expect("INVALID_STATE", null, new Checked() { @Override public void run() { aborted.end(); } });
            checkReleased(abortedProbe);
        } finally { cleanup(host, aborted, null); }

        ProbeSurface probe = new ProbeSurface(Fault.NONE, new IllegalStateException("unused"));
        Android2DFrame frame = frame(host, probe);
        PGraphicsAndroid2D completed = null;
        try {
            frame.begin(ENVIRONMENT);
            completed = frame.end();
            check(probe.backing != null && !probe.backing.isRecycled() && completed.getNative() == probe.backing,
                "completed output is not live");
            expect("INVALID_STATE", null, new Checked() { @Override public void run() { frame.end(); } });
            expect("INVALID_STATE", null, new Checked() { @Override public void run() { frame.abort(); } });
            check(!probe.backing.isRecycled(), "completed misuse recycled output");
            host.releaseCompleted(completed);
            checkReleased(probe);
            host.releaseCompleted(completed);
            checkReleased(probe);
        } finally { cleanup(host, frame, completed); }
    }

    private static void consumeReentryAndFailure(final AndroidFrameHost host) {
        ProbeSurface probe = new ProbeSurface(Fault.NONE, new IllegalStateException("unused"));
        Android2DFrame frame = frame(host, probe);
        PGraphicsAndroid2D completed = null;
        try {
            frame.begin(ENVIRONMENT);
            completed = frame.end();
            final PGraphicsAndroid2D output = completed;
            host.consumeCompleted(output, new AndroidFrameHost.SurfaceConsumer() {
                @Override public void accept(PGraphicsAndroid2D surface) {
                    try { host.releaseCompleted(surface); throw new AssertionError("release reentry accepted"); }
                    catch (IllegalStateException expected) { }
                    try { host.consumeCompleted(surface, new AndroidFrameHost.SurfaceConsumer() {
                        @Override public void accept(PGraphicsAndroid2D ignored) { }
                    }); throw new AssertionError("consume reentry accepted"); }
                    catch (IllegalStateException expected) { }
                }
            });
            checkReleased(probe);
            check("completed".equals(frame.state()), "consume reentry state");
            completed = null;

            ProbeSurface failedProbe = new ProbeSurface(Fault.NONE, new IllegalStateException("unused"));
            Android2DFrame failedFrame = frame(host, failedProbe);
            PGraphicsAndroid2D failedOutput = null;
            try {
                failedFrame.begin(ENVIRONMENT);
                failedOutput = failedFrame.end();
                final RuntimeException injected = new IllegalStateException("injected consumer failure");
                try {
                    host.consumeCompleted(failedOutput, new AndroidFrameHost.SurfaceConsumer() {
                        @Override public void accept(PGraphicsAndroid2D surface) { throw injected; }
                    });
                    throw new AssertionError("consumer failure did not propagate");
                } catch (IllegalStateException error) {
                    check(error == injected, "consumer primary changed");
                }
                check("completed".equals(failedFrame.state()) && failedProbe.backing.isRecycled(),
                    "consumer failure state/release");
                failedOutput = null;
            } finally { cleanup(host, failedFrame, failedOutput); }
        } finally { cleanup(host, frame, completed); }
    }

    /** Focused coordinator transaction fault, separate from native allocation failures. */
    private static void transferRollback(final AndroidFrameHost host) {
        ProbeSurface probe = new ProbeSurface(Fault.NONE, new IllegalStateException("unused"));
        Android2DFrame frame = frame(host, probe);
        try {
            frame.begin(ENVIRONMENT);
            final RuntimeException injected = new IllegalStateException("injected completion callback failure");
            try {
                synchronized (host.lock) {
                    host.transfer(frame, probe, host.epoch(), new Runnable() {
                        @Override public void run() { throw injected; }
                    });
                }
                throw new AssertionError("host transfer did not propagate completion failure");
            } catch (IllegalStateException error) {
                check(error == injected, "transfer rollback changed primary failure");
            }
            try {
                host.consumeCompleted(probe, new AndroidFrameHost.SurfaceConsumer() {
                    @Override public void accept(PGraphicsAndroid2D surface) { }
                });
                throw new AssertionError("rolled-back surface was consumable");
            } catch (IllegalStateException expected) { }
            try {
                host.releaseCompleted(probe);
                throw new AssertionError("rolled-back surface was releasable through completed registry");
            } catch (IllegalArgumentException expected) { }
            check("active".equals(frame.state()) && probe.owner == null && !probe.backing.isRecycled(),
                "rollback changed frame ownership/state");
            frame.abort();
            checkReleased(probe);
        } finally { cleanup(host, frame, null); }
    }

    private static void put(JSONObject object, String key, Object value) {
        try { object.put(key, value); }
        catch (JSONException error) { throw new IllegalStateException("Cannot construct failure JSON", error); }
    }

    private static JSONObject group(String id, boolean injected, Checked action) {
        JSONObject result = new JSONObject();
        put(result, "id", id);
        put(result, "injected", injected);
        try {
            action.run();
            put(result, "passed", true);
        } catch (Throwable failure) {
            put(result, "passed", false);
            put(result, "failure", failure.getClass().getName() + ": " + failure.getMessage());
            StringWriter trace = new StringWriter();
            failure.printStackTrace(new PrintWriter(trace));
            put(result, "trace", trace.toString());
        }
        return result;
    }

    /** Runs registered Android lifecycle/failure group only; it does not start Android work. */
    public static JSONObject run(final PApplet parent, final AndroidFrameHost host) {
        if (parent == null || host == null || host.parent != parent)
            throw new IllegalArgumentException("matching parent and AndroidFrameHost are required");
        JSONArray groups = new JSONArray();
        groups.put(group("5-invalid-environment-before-static-capability", true,
            new Checked() { @Override public void run() { invalidEnvironmentBeforeFactory(host); } }));
        groups.put(group("5-allocation-resource", true,
            new Checked() { @Override public void run() { allocationFailure(host, new IllegalStateException("injected allocation")); } }));
        groups.put(group("5-allocation-misleading-frame-error", true,
            new Checked() { @Override public void run() { allocationFailure(host, misleadingFrameError()); } }));
        groups.put(group("5-supplied-readiness-no-repair", true,
            new Checked() { @Override public void run() { suppliedReadinessNoRepair(host); } }));
        groups.put(group("5-readiness-resource", true,
            new Checked() { @Override public void run() { phaseFailure(host, Fault.READINESS,
                new IllegalStateException("injected readiness"), "RESOURCE_FAILURE", null); } }));
        groups.put(group("5-readiness-misleading-frame-error", true,
            new Checked() { @Override public void run() { phaseFailure(host, Fault.READINESS,
                misleadingFrameError(), "RESOURCE_FAILURE", null); } }));
        groups.put(group("5-initialization-render", true,
            new Checked() { @Override public void run() { phaseFailure(host, Fault.INITIALIZATION,
                new IllegalStateException("injected initialization"), "RENDER_FAILURE", null); } }));
        groups.put(group("5-initialization-misleading-frame-error", true,
            new Checked() { @Override public void run() { phaseFailure(host, Fault.INITIALIZATION,
                misleadingFrameError(), "RENDER_FAILURE", null); } }));
        groups.put(group("5-draw-render", true,
            new Checked() { @Override public void run() { phaseFailure(host, Fault.DRAW,
                new IllegalStateException("injected draw"), "RENDER_FAILURE", Long.valueOf(0)); } }));
        groups.put(group("5-draw-misleading-frame-error", true,
            new Checked() { @Override public void run() { phaseFailure(host, Fault.DRAW,
                misleadingFrameError(), "RENDER_FAILURE", Long.valueOf(0)); } }));
        groups.put(group("5-end-render", true,
            new Checked() { @Override public void run() { phaseFailure(host, Fault.END,
                new IllegalStateException("injected end"), "RENDER_FAILURE", null); } }));
        groups.put(group("5-end-misleading-frame-error", true,
            new Checked() { @Override public void run() { phaseFailure(host, Fault.END,
                misleadingFrameError(), "RENDER_FAILURE", null); } }));
        groups.put(group("5-batch-atomicity-and-absolute-index", true,
            new Checked() { @Override public void run() { atomicAndAbsoluteIndex(host); } }));
        groups.put(group("5-wrong-thread", false,
            new Checked() { @Override public void run() { wrongThread(host); } }));
        groups.put(group("5-frame-reentry", true,
            new Checked() { @Override public void run() { frameReentry(host); } }));
        groups.put(group("5-cleanup-primary", true,
            new Checked() { @Override public void run() { cleanupPrimary(host); } }));
        groups.put(group("5-abort-completed-idempotent-release", false,
            new Checked() { @Override public void run() { abortAndCompletedOwnership(host); } }));
        groups.put(group("5-consume-release-reentry-consumer-failure", true,
            new Checked() { @Override public void run() { consumeReentryAndFailure(host); } }));
        groups.put(group("5-host-transfer-transaction-rollback", true,
            new Checked() { @Override public void run() { transferRollback(host); } }));
        int failures = 0;
        for (int index = 0; index < groups.length(); index++) {
            try { if (!groups.getJSONObject(index).optBoolean("passed")) failures++; }
            catch (JSONException error) { throw new IllegalStateException("Cannot read failure JSON", error); }
        }
        JSONObject result = new JSONObject();
        put(result, "passed", failures == 0);
        put(result, "profile", "drawing.fresh-raster-2d");
        put(result, "adapter", "Processing Android ANDROID2D Android2DFrame");
        put(result, "scope", "registered injected failure/ownership group 5 with real AndroidSurface Bitmaps; activity lifecycle races remain separate");
        put(result, "limitations", "The focused transfer rollback invokes AndroidFrameHost's package-visible transaction directly; it is not a native allocation failure. Host diagnostic-list fault injection remains unavailable.");
        put(result, "failures", failures);
        put(result, "groups", groups);
        return result;
    }
}
