package org.procedurals.processing.internal;

import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

import org.procedurals.internal.DrawingFrameState;

import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;

/**
 * Registered lifecycle group 5 for the Processing JAVA2D adapter.
 *
 * <p>The backing images and graphics contexts are real JAVA2D objects. Phase
 * failures are deliberately injected through the adapter's package-private
 * factory seam; they are not evidence of spontaneous device or context loss.</p>
 */
public final class Java2DFrameFailures {
    private enum Fault { NONE, READINESS, INITIALIZATION, DRAW, END }

    private interface Action { void run(); }

    private static final class TrackingImage extends BufferedImage {
        int flushCalls;
        boolean throwOnFlush;

        TrackingImage(int width, int height) {
            super(width, height, BufferedImage.TYPE_INT_ARGB);
        }

        @Override public void flush() {
            flushCalls += 1;
            super.flush();
            if (throwOnFlush) throw new IllegalStateException("injected image cleanup failure");
        }
    }

    private static final class ProbeSurface extends PGraphicsJava2D {
        final Fault fault;
        final RuntimeException injected;
        TrackingImage trackingImage;
        int beginCalls;
        int lineCalls;
        int endCalls;
        int disposeCalls;
        int failLineCall = 1;
        boolean throwOnDispose;

        ProbeSurface(Fault fault) {
            this.fault = fault;
            this.injected = new IllegalStateException("injected " + fault.name().toLowerCase() + " failure");
        }

        @Override public Graphics2D checkImage() {
            if (trackingImage == null) {
                int imageWidth = width * pixelDensity + (fault == Fault.READINESS ? 1 : 0);
                trackingImage = new TrackingImage(imageWidth, height * pixelDensity);
                image = trackingImage;
            }
            return trackingImage.createGraphics();
        }

        @Override public void beginDraw() {
            beginCalls += 1;
            super.beginDraw();
            if (fault == Fault.INITIALIZATION) throw injected;
        }

        @Override public void line(float x1, float y1, float x2, float y2) {
            lineCalls += 1;
            if (fault == Fault.DRAW && lineCalls == failLineCall) throw injected;
            super.line(x1, y1, x2, y2);
        }

        @Override public void endDraw() {
            endCalls += 1;
            if (fault == Fault.END) throw injected;
            super.endDraw();
        }

        @Override public void dispose() {
            disposeCalls += 1;
            super.dispose();
            if (throwOnDispose) throw new IllegalStateException("injected surface cleanup failure");
        }
    }

    /** One-shot so the adapter's retained test factory does not retain the surface. */
    private static final class OneShotFactory implements Supplier<PGraphicsJava2D> {
        PGraphicsJava2D next;
        RuntimeException failure;
        int calls;

        OneShotFactory(PGraphicsJava2D next) { this.next = next; }
        OneShotFactory(RuntimeException failure) { this.failure = failure; }

        @Override public PGraphicsJava2D get() {
            calls += 1;
            if (failure != null) throw failure;
            PGraphicsJava2D result = next;
            next = null;
            return result;
        }
    }

    private static final Field ADAPTER_SURFACE;
    static {
        try {
            ADAPTER_SURFACE = Java2DFrame.class.getDeclaredField("surface");
            ADAPTER_SURFACE.setAccessible(true);
        } catch (ReflectiveOperationException failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }

    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        for (int i = 0; i < pairs.length; i += 2) result.put((String)pairs[i], pairs[i + 1]);
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
                   "rgb", 0xffffff, "opacity8", 255, "width", 1, "cap", "round");
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static DrawingFrameState.FrameError expect(String code, Long index, Action action) {
        try {
            action.run();
        } catch (DrawingFrameState.FrameError error) {
            check(code.equals(error.code), "expected " + code + ", got " + error.code);
            check(index == null ? error.commandIndex == null : index.equals(error.commandIndex),
                  "wrong command index for " + code + ": " + error.commandIndex);
            return error;
        }
        throw new AssertionError("expected " + code);
    }

    private static boolean hasSuppressed(Throwable primary, Throwable expected) {
        for (Throwable item : primary.getSuppressed()) if (item == expected) return true;
        return false;
    }

    private static Object retainedSurface(Java2DFrame frame) {
        try { return ADAPTER_SURFACE.get(frame); }
        catch (IllegalAccessException failure) { throw new AssertionError(failure); }
    }

    private static void checkReleased(Java2DFrame frame, ProbeSurface probe) {
        check("aborted".equals(frame.state()), "failed frame not aborted");
        check(retainedSurface(frame) == null, "adapter retained failed surface");
        check(probe.g2 == null && probe.image == null && probe.pixels == null,
              "failed surface retained native/image/pixel references");
        check(probe.trackingImage == null || probe.trackingImage.flushCalls == 1,
              "failed backing image was not flushed exactly once");
        check(probe.disposeCalls == 1, "failed surface dispose count " + probe.disposeCalls);
    }

    private static void invalidEnvironmentPrecedesCapability() {
        OneShotFactory factory = new OneShotFactory(new ProbeSurface(Fault.NONE));
        final Java2DFrame frame = new Java2DFrame(null, factory);
        Map<String,Object> invalid = environment();
        invalid.put("width", 0);
        expect("INVALID_ENVIRONMENT", null, new Action() { public void run() { frame.begin(invalid); } });
        check(factory.calls == 0, "invalid environment reached capability/allocation");
        check("aborted".equals(frame.state()) && retainedSurface(frame) == null, "invalid begin ownership");
    }

    private static void unsupportedPrecedesAllocation() {
        OneShotFactory factory = new OneShotFactory(new ProbeSurface(Fault.NONE));
        final Java2DFrame frame = new Java2DFrame(null, factory);
        expect("UNSUPPORTED_CAPABILITY", null, new Action() { public void run() { frame.begin(environment()); } });
        check(factory.calls == 0, "unsupported capability allocated a surface");
        check("aborted".equals(frame.state()) && retainedSurface(frame) == null, "unsupported begin ownership");
    }

    private static void allocationFailure() {
        RuntimeException injected = new IllegalStateException("injected allocation failure");
        OneShotFactory factory = new OneShotFactory(injected);
        final Java2DFrame frame = new Java2DFrame(new PApplet(), factory);
        DrawingFrameState.FrameError error = expect("RESOURCE_FAILURE", null,
            new Action() { public void run() { frame.begin(environment()); } });
        check(factory.calls == 1 && hasSuppressed(error, injected), "allocation cause not preserved");
        check("aborted".equals(frame.state()) && retainedSurface(frame) == null, "allocation failure ownership");
    }

    private static void readinessFailure() {
        ProbeSurface probe = new ProbeSurface(Fault.READINESS);
        OneShotFactory factory = new OneShotFactory(probe);
        final Java2DFrame frame = new Java2DFrame(new PApplet(), factory);
        DrawingFrameState.FrameError error = expect("RESOURCE_FAILURE", null,
            new Action() { public void run() { frame.begin(environment()); } });
        check(error.getSuppressed().length >= 1, "readiness cause not preserved");
        check(factory.calls == 1 && factory.next == null, "readiness factory ownership");
        checkReleased(frame, probe);
    }

    private static void initializationFailure() {
        ProbeSurface probe = new ProbeSurface(Fault.INITIALIZATION);
        final Java2DFrame frame = new Java2DFrame(new PApplet(), new OneShotFactory(probe));
        DrawingFrameState.FrameError error = expect("RENDER_FAILURE", null,
            new Action() { public void run() { frame.begin(environment()); } });
        check(hasSuppressed(error, probe.injected), "initialization cause not preserved");
        check(probe.beginCalls == 1, "initialization call count");
        checkReleased(frame, probe);
    }

    private static void invalidLaterBatchIsAtomic() {
        ProbeSurface probe = new ProbeSurface(Fault.NONE);
        final Java2DFrame frame = new Java2DFrame(new PApplet(), new OneShotFactory(probe));
        frame.begin(environment());
        frame.batch(list(segment(2, 2, 8, 2)));
        check(frame.count() == 1 && probe.lineCalls == 1, "prior batch did not commit");
        DrawingFrameState.FrameError error = expect("INVALID_COMMAND", Long.valueOf(2),
            new Action() { public void run() {
                frame.batch(list(segment(2, 4, 8, 4), segment(3, 3, 3, 3)));
            }});
        check(error.getSuppressed().length == 0, "validation failure gained native cause");
        check(frame.count() == 1 && probe.lineCalls == 1, "invalid batch drew or committed a command");
        checkReleased(frame, probe);
    }

    private static void drawFailureUsesSourceIndex() {
        ProbeSurface probe = new ProbeSurface(Fault.DRAW);
        probe.failLineCall = 2;
        final Java2DFrame frame = new Java2DFrame(new PApplet(), new OneShotFactory(probe));
        frame.begin(environment());
        frame.batch(list(segment(2, 2, 8, 2)));
        check(frame.count() == 1, "prior batch count");
        final Map<String,Object> noop = segment(1, 1, 1 + Math.pow(2, -25), 1);
        DrawingFrameState.FrameError error = expect("RENDER_FAILURE", Long.valueOf(2),
            new Action() { public void run() { frame.batch(list(noop, segment(2, 4, 8, 4))); } });
        check(hasSuppressed(error, probe.injected), "draw cause not preserved");
        check(frame.count() == 1 && probe.lineCalls == 2, "failed batch count/native attempts");
        checkReleased(frame, probe);
    }

    private static void endFailure() {
        ProbeSurface probe = new ProbeSurface(Fault.END);
        final Java2DFrame frame = new Java2DFrame(new PApplet(), new OneShotFactory(probe));
        frame.begin(environment());
        DrawingFrameState.FrameError error = expect("RENDER_FAILURE", null,
            new Action() { public void run() { frame.end(); } });
        check(hasSuppressed(error, probe.injected), "end cause not preserved");
        check(probe.endCalls == 1, "end invocation count");
        checkReleased(frame, probe);
    }

    private static void explicitAbortIsIdempotent() {
        ProbeSurface probe = new ProbeSurface(Fault.NONE);
        Java2DFrame frame = new Java2DFrame(new PApplet(), new OneShotFactory(probe));
        frame.begin(environment());
        frame.abort();
        checkReleased(frame, probe);
        frame.abort();
        check(probe.trackingImage.flushCalls == 1 && probe.disposeCalls == 1,
              "repeated abort repeated cleanup");
    }

    private static void cleanupFailuresPreservePrimary() {
        ProbeSurface probe = new ProbeSurface(Fault.DRAW);
        probe.throwOnDispose = true;
        final Java2DFrame frame = new Java2DFrame(new PApplet(), new OneShotFactory(probe));
        frame.begin(environment());
        probe.trackingImage.throwOnFlush = true;
        DrawingFrameState.FrameError error = expect("RENDER_FAILURE", Long.valueOf(0),
            new Action() { public void run() { frame.batch(list(segment(2, 2, 8, 2))); } });
        check(hasSuppressed(error, probe.injected), "primary native cause lost");
        check(error.getSuppressed().length == 3, "cleanup failures were not preserved");
        check("aborted".equals(frame.state()) && retainedSurface(frame) == null, "cleanup-failure ownership");
        check(probe.g2 == null && probe.image == null && probe.pixels == null, "cleanup failure retained fields");
        check(probe.trackingImage.flushCalls == 1 && probe.disposeCalls == 1, "cleanup failure call counts");
    }

    private static void successfulTransferAndRelease() {
        ProbeSurface probe = new ProbeSurface(Fault.NONE);
        final Java2DFrame frame = new Java2DFrame(new PApplet(), new OneShotFactory(probe));
        frame.begin(environment());
        PGraphicsJava2D completed = frame.end();
        check(completed == probe && retainedSurface(frame) == null, "success did not transfer exact surface");
        check("completed".equals(frame.state()) && completed.image == probe.trackingImage,
              "completed state/backing image");
        check(completed.pixels != null && completed.pixels.length == 32 * 24,
              "completed pixels unavailable before integration release");
        check(completed.pixels[0] == 0xff123456, "completed surface unreadable after transfer");

        expect("INVALID_STATE", null, new Action() { public void run() { frame.end(); } });
        expect("INVALID_STATE", null, new Action() { public void run() { frame.abort(); } });
        check(completed.image == probe.trackingImage && probe.trackingImage.flushCalls == 0 && probe.disposeCalls == 0,
              "completed misuse disposed transferred output");

        Java2DFrame.releaseCompleted(completed);
        check(completed.g2 == null && completed.image == null && completed.pixels == null,
              "completed release retained resources");
        check(probe.trackingImage.flushCalls == 1 && probe.disposeCalls == 1,
              "completed release counts");
        Java2DFrame.releaseCompleted(completed);
        check(probe.trackingImage.flushCalls == 1 && probe.disposeCalls == 1,
              "completed release was not idempotent");
    }

    private static String quote(String text) {
        return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"")
            .replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }

    private static void runAll() {
        invalidEnvironmentPrecedesCapability();
        unsupportedPrecedesAllocation();
        allocationFailure();
        readinessFailure();
        initializationFailure();
        invalidLaterBatchIsAtomic();
        drawFailureUsesSourceIndex();
        endFailure();
        explicitAbortIsIdempotent();
        cleanupFailuresPreservePrimary();
        successfulTransferAndRelease();
    }

    public static void main(String[] args) {
        try {
            runAll();
            System.out.println("{\"profile\":\"drawing.fresh-raster-2d\",\"group\":\"5-lifecycle\","
                + "\"passed\":true,\"cases\":11,"
                + "\"scope\":\"real JAVA2D resources with deterministic injected phase failures; "
                + "not spontaneous device or context loss evidence\"}");
        } catch (Throwable failure) {
            System.out.println("{\"profile\":\"drawing.fresh-raster-2d\",\"group\":\"5-lifecycle\","
                + "\"passed\":false,\"failure\":" + quote(failure.getClass().getName() + ": " + failure.getMessage())
                + ",\"scope\":\"injected lifecycle failure harness\"}");
            failure.printStackTrace(System.err);
            System.exit(1);
        }
    }
}
