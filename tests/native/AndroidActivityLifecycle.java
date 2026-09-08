package org.procedurals.android.internal;

import android.graphics.Bitmap;
import android.os.Build;
import android.os.Looper;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import processing.core.PApplet;

/**
 * Test-only observer for the pinned Android activity lifecycle validation.
 *
 * <p>The Activity owns actual cover/resume/destroy transitions. This helper owns only
 * adapter leases, observations, and app-private marker files. Construct and call
 * {@link #setup()} from {@code PApplet.setup()} on the animation thread; the host is
 * registered first and this observer second.</p>
 */
public final class AndroidActivityLifecycle {
    private static final Map<String,Object> ENVIRONMENT = environment(32, 24, 0x102030);
    private static final List<Object> EMPTY = Collections.emptyList();

    private interface Checked { void run(); }

    /** Tracks native clearing without changing production ownership behavior. */
    private static final class CountingSurface extends AndroidSurface {
        final String label;
        int nativeNullCalls;
        CountingSurface(String label) { this.label = label; }
        @Override public void setNative(Object nativeObject) {
            if (nativeObject == null) nativeNullCalls += 1;
            super.setNative(nativeObject);
        }
    }

    /** Test factory deliberately captures the exact allocation made for each lease. */
    private final class TrackingFactory implements Android2DFrame.Factory {
        private final String label;
        CountingSurface created;
        TrackingFactory(String label) { this.label = label; }
        @Override public AndroidSurface get(int width, int height) {
            CountingSurface surface = new CountingSurface(label);
            // This is the pinned production construction sequence, expressed in the
            // test factory solely so the lease can be observed after host cleanup.
            surface.setParent(parent);
            surface.setPrimary(false);
            surface.setSize(width, height);
            created = surface;
            return surface;
        }
    }

    private static final class Capture {
        final String label;
        final Android2DFrame frame;
        final CountingSurface surface;
        final Bitmap bitmap;
        int consumerCalls;
        int explicitReleaseCalls;
        Capture(String label, Android2DFrame frame, CountingSurface surface, Bitmap bitmap) {
            this.label = label;
            this.frame = frame;
            this.surface = surface;
            this.bitmap = bitmap;
        }
    }

    /** Immutable callback fact; it does not read or mutate host state. */
    private static final class CallbackObservation {
        final String name;
        final long threadId;
        final String threadName;
        final boolean uiThread;
        CallbackObservation(String name) {
            this.name = name;
            threadId = Thread.currentThread().getId();
            threadName = Thread.currentThread().getName();
            uiThread = Looper.myLooper() == Looper.getMainLooper();
        }
    }

    private final PApplet parent;
    private final File directory;
    private final String nonce;
    private final Object journalLock = new Object();
    private final List<Capture> captures = new ArrayList<Capture>();
    private final List<String> failures = new ArrayList<String>();
    private final AtomicInteger sequence = new AtomicInteger();
    private final AtomicInteger pauses = new AtomicInteger();
    private final AtomicInteger resumes = new AtomicInteger();
    private final AtomicInteger pres = new AtomicInteger();
    private final AtomicInteger specials = new AtomicInteger();
    private final AtomicInteger draws = new AtomicInteger();
    private final AtomicInteger inputs = new AtomicInteger();
    private final AtomicInteger completedStages = new AtomicInteger();
    private final AtomicInteger idleResumes = new AtomicInteger();
    private final AtomicInteger preAtResume = new AtomicInteger();
    private final AtomicLong inputThreadId = new AtomicLong(-1L);
    private final AtomicReference<String> inputThreadName = new AtomicReference<String>();
    private final int[] preAtEachResume = {-1, -1, -1};
    private final int[] preBeforeStage = {-1, -1, -1};
    private final Object callbackLock = new Object();
    private final List<CallbackObservation> callbackJournal = new ArrayList<CallbackObservation>();
    private AndroidFrameHost host;
    private Capture activeFirst;
    private Capture completedSecond;
    private Capture consumedThird;
    private Capture activeDestroy;
    private Capture completedDestroy;
    private boolean setup;
    private boolean resultWritten;
    private boolean observedDestroy;
    private boolean observedDispose;
    private boolean startupPublicationPending;
    private int idlePollResume;
    private int idlePolls;
    private int idlePre;
    private int idleDraw;
    private int idleFrame;
    private int awaitingInput;
    private int verifiedInputDispatches;
    private String readyAfterDispatch;
    private int dispatchResumeBefore;
    private int dispatchSpecialBefore;
    private int dispatchPreBefore;
    private int dispatchDrawBefore;
    private int dispatchFrameBefore;
    private long animationThreadId = -1L;

    public AndroidActivityLifecycle(PApplet parent, File directory, String nonce) {
        if (parent == null || directory == null || nonce == null || nonce.length() == 0)
            throw new IllegalArgumentException("parent, directory, and nonce are required");
        this.parent = parent;
        this.directory = directory;
        this.nonce = nonce;
    }

    /** Constructs/registers the host, leaves the first native frame active, then stops looping. */
    public void setup() {
        if (setup) throw new IllegalStateException("setup was already called");
        setup = true;
        animationThreadId = Thread.currentThread().getId();
        host = new AndroidFrameHost(parent); // Registers first.
        String[] methods = {"pause", "resume", "pre", "onDestroy", "dispose"};
        for (String method : methods) parent.registerMethod(method, this); // Observer second.
        try {
                check(host.onAnimationThread(), "setup did not run on the host animation thread");
                activeFirst = beginActive("active-1");
                check("active".equals(activeFirst.frame.state()), "first frame is not active");
                check(host.ready(host.epoch()), "host was not accepting at active-ready");
        } catch (Throwable failure) { recordFailure(failure); }
        // PApplet's frame-zero setup leaves its initial redraw pending. The corrected
        // carrier must allow that ordinary startup dispatch; active-ready is published
        // only after its full handleDraw returns.
        parent.noLoop();
        startupPublicationPending = true;
    }

    /** The Activity can share this internal host with the pixel harness; null before setup. */
    public AndroidFrameHost host() { return host; }

    /** Called only by the real touch/key handler: it performs no adapter or bitmap work. */
    public void input() {
        recordCallback("input");
        inputThreadId.set(Thread.currentThread().getId());
        inputThreadName.set(Thread.currentThread().getName());
        inputs.incrementAndGet();
        // redraw is a scheduling request only. draw() performs all adapter calls later on
        // the captured animation thread.
        parent.redraw();
    }

    /** Called by the ordinary PApplet draw callback. */
    public void draw() {
        if (!setup) throw new IllegalStateException("setup is required before draw");
        draws.incrementAndGet();
        recordCallback("draw");
        if (!host.onAnimationThread()) {
            recordFailure(new AssertionError("ordinary draw is not on the animation thread"));
            return;
        }
        int requested = inputs.get();
        int stage = completedStages.get();
        if (requested <= stage) return;
        if (resumes.get() > 0 && (idlePollResume != resumes.get() || idlePolls < 4))
            recordFailure(new AssertionError("input stage began before idle dispatch proof"));
        awaitingInput = stage + 1;
        if (stage >= 0 && stage < preBeforeStage.length) {
            preBeforeStage[stage] = pres.get();
            if (preBeforeStage[stage] <= preAtEachResume[stage]) recordFailure(
                new AssertionError("ordinary draw stage " + stage + " did not follow its resume pre"));
        }
        if (stage == 0) {
            runChecked(new Checked() {
                @Override public void run() {
                    completedSecond = complete("completed-2");
                    check("completed".equals(completedSecond.frame.state()), "second frame did not complete");
                    assertLive(completedSecond, "completed-ready", true);
                    completedStages.incrementAndGet();
                }
            });
            readyAfterDispatch = "completed-ready";
        } else if (stage == 1) {
            runConsumeRace();
            completedStages.incrementAndGet();
        } else if (stage == 2) {
            runChecked(new Checked() {
                @Override public void run() {
                    activeDestroy = beginActive("active-destroy");
                    completedDestroy = complete("completed-destroy");
                    assertLive(activeDestroy, "destroy-ready active", false);
                    assertLive(completedDestroy, "destroy-ready completed", true);
                    completedStages.incrementAndGet();
                }
            });
            readyAfterDispatch = "destroy-ready";
        } else {
            recordFailure(new AssertionError("unexpected ordinary input stage " + requested));
        }
    }

    /**
     * Called only after Probe.handleSpecialDraw() invoked super and returned true, on the
     * animation thread. The pinned core has completed noLoop restoration precisely when
     * this same-thread observation sees !isLooping().
     */
    public void specialDrawHandled() {
        specials.incrementAndGet();
        recordCallback("special");
        try {
            check(host != null && host.onAnimationThread(), "special draw is not on animation thread");
            check(!host.ready(host.epoch()), "host reopened during a restoration-only draw");
        } catch (Throwable failure) { recordFailure(failure); }
    }

    /** Publishes the exact animation-thread noLoop-restoration transition once per resume. */
    public void restorationIdle() {
        final int resume = resumes.get();
        if (resume <= idleResumes.get()) return;
        final String phase = "restore-idle-" + resume;
        runPhase(phase, new Checked() {
            @Override public void run() {
                check(host.onAnimationThread(), "restore-idle is not on the animation thread");
                check(!parent.isLooping(), "restore-idle observed while sketch is looping");
                check(!host.ready(host.epoch()), "host reopened before ordinary pre");
                check(pres.get() == preAtResume.get(), "ordinary pre ran during restoration");
            }
        });
        idleResumes.compareAndSet(resume - 1, resume);
        idlePollResume = resume;
        idlePolls = 0;
        idlePre = pres.get();
        idleDraw = draws.get();
        idleFrame = parent.frameCount;
    }

    /** Called immediately before exactly one superclass handleDraw invocation. */
    public void observeDispatchBefore(int frameCount) {
        // Setup occurs inside the first super call. For later calls these snapshots let
        // after() exclude a restoration-changing dispatch from the four quiet polls.
        dispatchResumeBefore = resumes.get();
        dispatchSpecialBefore = specials.get();
        dispatchPreBefore = pres.get();
        dispatchDrawBefore = draws.get();
        dispatchFrameBefore = frameCount;
    }

    /** Called immediately after exactly one superclass handleDraw invocation. */
    public void observeDispatchAfter(int beforeFrameCount) {
        if (!setup || host == null) return;
        int afterFrameCount = parent.frameCount;
        boolean inputJustVerified = false;
        if (startupPublicationPending) {
            if (activeFirst != null && inputs.get() == 0 && pres.get() == 1 && draws.get() == 1 && afterFrameCount == 2 &&
                "active".equals(activeFirst.frame.state())) {
                startupPublicationPending = false;
                publish("active-ready");
            } else if (beforeFrameCount != 0 || afterFrameCount > 2 || inputs.get() != 0) {
                startupPublicationPending = false;
                recordFailure(new AssertionError("unexpected startup dispatch observations"));
                publish("active-ready");
            }
            return;
        }
        if (awaitingInput != 0) {
            int input = awaitingInput;
            awaitingInput = 0;
            if (pres.get() != dispatchPreBefore + 1 || draws.get() != dispatchDrawBefore + 1 ||
                afterFrameCount != dispatchFrameBefore + 1)
                recordFailure(new AssertionError("input " + input + " did not cause exactly one ordinary frame"));
            else { verifiedInputDispatches += 1; inputJustVerified = true; }
        }
        if (readyAfterDispatch != null) {
            String phase = readyAfterDispatch;
            readyAfterDispatch = null;
            if (!host.ready(host.epoch())) recordFailure(
                new AssertionError(phase + " lost host admission before post-dispatch marker"));
            publish(phase);
            return;
        }
        if (inputJustVerified) {
            // The same post-input dispatch must not count as one of the four quiet polls.
            return;
        }
        if (dispatchResumeBefore != resumes.get() || dispatchSpecialBefore != specials.get()) return;
        if (idlePollResume == 0 || idlePolls >= 4 || resumes.get() != idlePollResume ||
            idleResumes.get() != idlePollResume || beforeFrameCount == 0) return;
        if (pres.get() != idlePre || draws.get() != idleDraw || afterFrameCount != idleFrame ||
            host.ready(host.epoch())) {
            recordFailure(new AssertionError("idle noLoop dispatch changed frame/admission state"));
            return;
        }
        idlePolls += 1;
        if (idlePolls == 4) publish("idle-polls-" + idlePollResume);
    }

    public int resumeCount() { return resumes.get(); }
    public int specialDrawCount() { return specials.get(); }

    /** Observer follows AndroidFrameHost.pause(), so cleanup must already be complete. */
    public void pause() {
        recordCallback("pause");
        checkUi("pause");
        final int pause = pauses.incrementAndGet();
        if (pause == 1) runPhase("pause-1", new Checked() {
            @Override public void run() {
                assertReleased(activeFirst, "pause-1");
                check("aborted".equals(activeFirst.frame.state()), "active frame did not abort on pause");
                check(!host.ready(host.epoch()), "host accepted after first pause");
            }
        });
        else if (pause == 2) runPhase("pause-2", new Checked() {
            @Override public void run() {
                assertReleased(completedSecond, "pause-2");
                check("completed".equals(completedSecond.frame.state()), "completed frame state changed on pause");
                check(completedSecond.consumerCalls == 0, "unconsumed lease invoked its consumer");
                check(!host.ready(host.epoch()), "host accepted after second pause");
            }
        });
        else if (pause == 3) runPhase("pause-3", new Checked() {
            @Override public void run() {
                assertReleased(consumedThird, "pause-3");
                check(consumedThird.consumerCalls == 1, "race consumer count");
                check(!host.ready(host.epoch()), "host accepted after third pause");
            }
        });
        else recordEvent("pause-" + pause);
    }

    /** Observer follows host.resume(): pinned restoration must still leave it non-accepting. */
    public void resume() {
        recordCallback("resume");
        checkUi("resume");
        final int resume = resumes.incrementAndGet();
        preAtResume.set(pres.get());
        if (resume <= preAtEachResume.length) preAtEachResume[resume - 1] = pres.get();
        if (resume <= 3) runPhase("resume-" + resume, new Checked() {
            @Override public void run() {
                check(!host.ready(host.epoch()), "host accepted directly from resume");
            }
        });
        else recordEvent("resume-" + resume);
    }

    /** Observer follows host.pre(), so it proves the ordinary-frame reopen point. */
    public void pre() {
        int pre = pres.incrementAndGet();
        recordCallback("pre");
        try {
            check(host.onAnimationThread(), "pre is not on the animation thread");
            if (resumes.get() > idleResumes.get())
                throw new AssertionError("pre " + pre + " occurred before restore-idle");
            if (resumes.get() > 0) check(host.ready(host.epoch()), "host did not reopen at ordinary pre");
        } catch (Throwable failure) { recordFailure(failure); }
    }

    /** Observer follows host.onDestroy(), so both outstanding destruction leases are released. */
    public void onDestroy() {
        recordCallback("onDestroy");
        checkUi("onDestroy");
        observedDestroy = true;
        runPhase("onDestroy", new Checked() {
            @Override public void run() {
                assertReleased(activeDestroy, "onDestroy active");
                assertReleased(completedDestroy, "onDestroy completed");
                check("aborted".equals(activeDestroy.frame.state()), "destroy active frame did not abort");
                check("completed".equals(completedDestroy.frame.state()), "destroy completed frame state changed");
                check(completedDestroy.consumerCalls == 0, "destroyed completed lease invoked consumer");
                check(hostClosed(), "host is not permanently closed after onDestroy");
            }
        });
    }

    /** Observer follows host.dispose(); result.json is written once from application-owned storage. */
    public void dispose() {
        recordCallback("dispose");
        checkUi("dispose");
        observedDispose = true;
        try {
            if (activeDestroy != null) assertReleased(activeDestroy, "dispose active");
            if (completedDestroy != null) assertReleased(completedDestroy, "dispose completed");
            check(hostClosed(), "host is not permanently closed after dispose");
            check(inputs.get() == 3 && completedStages.get() == 3 && verifiedInputDispatches == 3,
                "expected three input/draw stages");
            check(resumes.get() == 3 && pauses.get() == 4, "expected three resumes and four pauses");
            check(pres.get() == 4 && draws.get() == 4 && specials.get() >= 3,
                "expected startup plus three ordinary pre/draw callbacks and restoration specials");
            check(Arrays.equals(preBeforeStage, new int[] {2, 3, 4}), "pre/draw ordering counters");
            check(observedDestroy && observedDispose, "destroy/dispose observations missing");
            check(captures.size() == 5, "expected five captured surfaces");
            for (Capture capture : captures) assertReleased(capture, "dispose " + capture.label);
            check(hostInventoryEmpty(), "host retained an unfinished or completed lease");
            check(host.cleanupDiagnostics().isEmpty(), "clean lifecycle produced host diagnostics");
            check(inputPreDrawOrdering(), "callback journal lacks input->pre->draw ordering");
        } catch (Throwable failure) { recordFailure(failure); }
        synchronized (journalLock) {
            if (!resultWritten) {
                resultWritten = true;
                write("result", marker("result"));
            }
        }
    }

    private void runConsumeRace() {
        final boolean[] consumerMarker = new boolean[1];
        try {
                // First prove that pause-2 removed the old lease before any consumption.
                completedSecond.explicitReleaseCalls += 1;
                try {
                    host.consumeCompleted(completedSecond.surface, new AndroidFrameHost.SurfaceConsumer() {
                        @Override public void accept(processing.a2d.PGraphicsAndroid2D ignored) {
                            throw new AssertionError("released lease entered consumer");
                        }
                    });
                    throw new AssertionError("released completed surface was consumable");
                } catch (IllegalStateException expected) {
                    check("Completed output is unavailable on this thread/host".equals(expected.getMessage()),
                        "old completed lease had the wrong failure: " + expected.getMessage());
                }
                catch (RuntimeException unexpected) { throw unexpected; }
                host.releaseCompleted(completedSecond.surface); // Explicit idempotent release route.
                assertReleased(completedSecond, "post-pause old lease");

                consumedThird = complete("completed-3");
                final long ticket = host.epoch();
                try {
                    host.consumeCompleted(consumedThird.surface, new AndroidFrameHost.SurfaceConsumer() {
                        @Override public void accept(processing.a2d.PGraphicsAndroid2D surface) {
                            consumedThird.consumerCalls += 1;
                            assertLive(consumedThird, "consumer entry", true);
                            consumerMarker[0] = true;
                            publish("consumer-entered");
                            long deadline = System.nanoTime() + 30000000000L;
                            while (host.ready(ticket) && System.nanoTime() < deadline) {
                                try { Thread.sleep(1L); }
                                catch (InterruptedException interrupted) {
                                    Thread.currentThread().interrupt();
                                    throw new AssertionError("consumer admission poll interrupted", interrupted);
                                }
                            }
                            check(!host.ready(ticket), "pause admission change was not observed by consumer");
                            assertLive(consumedThird, "consumer after admission close", true);
                        }
                    });
                    throw new AssertionError("consume race completed despite lifecycle change");
                } catch (IllegalStateException expected) {
                    check("Lifecycle changed during output transfer".equals(expected.getMessage()),
                        "consume lifecycle failure was wrong: " + expected.getMessage());
                }
                catch (RuntimeException unexpected) { throw unexpected; }
                assertReleased(consumedThird, "consume race final release");
                check(consumedThird.consumerCalls == 1, "consume race callback count");
        } catch (Throwable failure) { recordFailure(failure); }
        // If setup failed before the callback, publish the runner-visible phase once with
        // the recorded failure. A successful callback already wrote it while holding the
        // completed lease, before the runner begins the cover transition.
        if (!consumerMarker[0]) publish("consumer-entered");
    }

    private Capture beginActive(String label) {
        TrackingFactory factory = new TrackingFactory(label);
        Android2DFrame frame = new Android2DFrame(host, factory);
        frame.begin(ENVIRONMENT);
        return capture(label, frame, factory);
    }

    private Capture complete(String label) {
        TrackingFactory factory = new TrackingFactory(label);
        Android2DFrame frame = new Android2DFrame(host, factory);
        frame.begin(ENVIRONMENT);
        frame.batch(EMPTY);
        frame.end();
        return capture(label, frame, factory);
    }

    private Capture capture(String label, Android2DFrame frame, TrackingFactory factory) {
        check(factory.created != null, label + " factory did not create a surface");
        Object nativeValue = factory.created.getNative();
        check(nativeValue instanceof Bitmap, label + " did not allocate a bitmap");
        Capture capture = new Capture(label, frame, factory.created, (Bitmap) nativeValue);
        captures.add(capture);
        return capture;
    }

    private static Map<String,Object> environment(int width, int height, int background) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        result.put("width", width); result.put("height", height); result.put("density", 1);
        result.put("background", background);
        return result;
    }

    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    private static void assertLive(Capture capture, String phase, boolean requirePixels) {
        check(capture != null, phase + " has no capture");
        check(!capture.bitmap.isRecycled(), phase + " bitmap is already recycled");
        check(capture.surface.canvas != null, phase + " canvas is detached before lifecycle stop");
        if (requirePixels) check(capture.surface.pixels != null,
            phase + " completed surface has no pixel snapshot");
        check(capture.surface.getNative() == capture.bitmap && capture.surface.parent != null,
            phase + " surface does not own its original native bitmap/parent");
        check(capture.surface.nativeNullCalls == 0, phase + " cleared native bitmap early");
    }

    private static void assertReleased(Capture capture, String phase) {
        check(capture != null, phase + " has no capture");
        check(capture.bitmap.isRecycled(), phase + " bitmap was not recycled");
        check(capture.surface.canvas == null && capture.surface.pixels == null,
            phase + " canvas/pixels were not detached");
        check(capture.surface.getNative() == null && capture.surface.parent == null,
            phase + " bitmap/parent were not detached");
        check(capture.surface.nativeNullCalls == 1, phase + " native bitmap was not cleared exactly once");
    }

    private boolean hostClosed() {
        if (host == null) return false;
        try {
            Field field = AndroidFrameHost.class.getDeclaredField("closed");
            field.setAccessible(true);
            return field.getBoolean(host);
        } catch (ReflectiveOperationException error) {
            recordFailure(error);
            return false;
        }
    }

    private boolean hostInventoryEmpty() {
        if (host == null) return false;
        try {
            Field unfinished = AndroidFrameHost.class.getDeclaredField("unfinished");
            Field completed = AndroidFrameHost.class.getDeclaredField("completed");
            unfinished.setAccessible(true); completed.setAccessible(true);
            synchronized (host.lock) {
                return ((Map<?,?>) unfinished.get(host)).isEmpty() &&
                    ((Map<?,?>) completed.get(host)).isEmpty();
            }
        } catch (ReflectiveOperationException error) {
            recordFailure(error);
            return false;
        }
    }

    private void checkUi(String callback) {
        if (Looper.myLooper() != Looper.getMainLooper())
            recordFailure(new AssertionError(callback + " did not run on Android's UI looper"));
    }

    private void recordCallback(String name) {
        synchronized (callbackLock) { callbackJournal.add(new CallbackObservation(name)); }
    }

    private boolean inputPreDrawOrdering() {
        synchronized (callbackLock) {
            int cursor = 0;
            for (int stage = 0; stage < 3; stage++) {
                while (cursor < callbackJournal.size() && !"input".equals(callbackJournal.get(cursor).name)) cursor += 1;
                if (cursor == callbackJournal.size() || !callbackJournal.get(cursor).uiThread ||
                    callbackJournal.get(cursor).threadId == animationThreadId) return false;
                cursor += 1;
                while (cursor < callbackJournal.size() && !"pre".equals(callbackJournal.get(cursor).name)) cursor += 1;
                if (cursor == callbackJournal.size() || callbackJournal.get(cursor).threadId != animationThreadId) return false;
                cursor += 1;
                while (cursor < callbackJournal.size() && !"draw".equals(callbackJournal.get(cursor).name)) cursor += 1;
                if (cursor == callbackJournal.size() || callbackJournal.get(cursor).threadId != animationThreadId) return false;
                cursor += 1;
            }
            return true;
        }
    }

    private void recordEvent(String phase) { publish(phase); }

    private void runPhase(String phase, Checked checked) {
        runChecked(checked);
        publish(phase);
    }

    private void runChecked(Checked checked) {
        try { checked.run(); }
        catch (Throwable failure) { recordFailure(failure); }
    }

    private void recordFailure(Throwable failure) {
        String message = failure.getClass().getName() + ": " + failure.getMessage();
        synchronized (journalLock) { failures.add(message); }
    }

    private void publish(String phase) {
        synchronized (journalLock) { write(phase, marker(phase)); }
    }

    private JSONObject marker(String phase) {
        JSONObject result = new JSONObject();
        put(result, "phase", phase);
        put(result, "nonce", nonce);
        put(result, "sequence", sequence.incrementAndGet());
        put(result, "thread_id", Thread.currentThread().getId());
        put(result, "thread_name", Thread.currentThread().getName());
        put(result, "api", Build.VERSION.SDK_INT);
        put(result, "renderer", parent.g == null ? JSONObject.NULL : parent.g.getClass().getName());
        put(result, "frame_state", capturesState());
        put(result, "host_epoch", host == null ? JSONObject.NULL : host.epoch());
        put(result, "host_ready", host != null && host.ready(host.epoch()));
        put(result, "counts", counts());
        put(result, "idle_poll_resume", idlePollResume);
        put(result, "idle_polls", idlePolls);
        put(result, "idle_frame_count", idleFrame);
        put(result, "verified_input_dispatches", verifiedInputDispatches);
        if (host != null && host.onAnimationThread())
            put(result, "animation_frame_count", parent.frameCount);
        put(result, "surfaces", surfaces());
        JSONArray errors = new JSONArray();
        for (String failure : failures) errors.put(failure);
        put(result, "failures", errors);
        put(result, "input_thread_id", inputThreadId.get());
        put(result, "input_thread_name", inputThreadName.get() == null ? JSONObject.NULL : inputThreadName.get());
        put(result, "pre_at_resume", array(preAtEachResume));
        put(result, "pre_before_stage", array(preBeforeStage));
        put(result, "callback_journal", callbackJournal());
        put(result, "passed", failures.isEmpty());
        return result;
    }

    private JSONObject counts() {
        JSONObject result = new JSONObject();
        put(result, "pause", pauses.get()); put(result, "resume", resumes.get());
        put(result, "pre", pres.get()); put(result, "special", specials.get());
        put(result, "draw", draws.get()); put(result, "input", inputs.get());
        put(result, "completed_stages", completedStages.get());
        return result;
    }

    private static JSONArray array(int[] values) {
        JSONArray result = new JSONArray();
        for (int value : values) result.put(value);
        return result;
    }

    private JSONArray callbackJournal() {
        JSONArray result = new JSONArray();
        synchronized (callbackLock) {
            for (CallbackObservation observation : callbackJournal) {
                JSONObject value = new JSONObject();
                put(value, "name", observation.name);
                put(value, "thread_id", observation.threadId);
                put(value, "thread_name", observation.threadName);
                result.put(value);
            }
        }
        return result;
    }

    private String capturesState() {
        if (captures.isEmpty()) return "new";
        return captures.get(captures.size() - 1).frame.state();
    }

    private JSONArray surfaces() {
        JSONArray result = new JSONArray();
        for (Capture capture : captures) {
            JSONObject value = new JSONObject();
            put(value, "label", capture.label);
            put(value, "frame_state", capture.frame.state());
            put(value, "surface_identity", System.identityHashCode(capture.surface));
            put(value, "bitmap_identity", System.identityHashCode(capture.bitmap));
            put(value, "width", capture.surface.width); put(value, "height", capture.surface.height);
            put(value, "pixel_width", capture.surface.pixelWidth); put(value, "pixel_height", capture.surface.pixelHeight);
            put(value, "bitmap_recycled", capture.bitmap.isRecycled());
            put(value, "canvas_present", capture.surface.canvas != null);
            put(value, "pixels_present", capture.surface.pixels != null);
            put(value, "native_present", capture.surface.getNative() != null);
            put(value, "parent_present", capture.surface.parent != null);
            put(value, "native_null_calls", capture.surface.nativeNullCalls);
            put(value, "consumer_calls", capture.consumerCalls);
            put(value, "explicit_release_calls", capture.explicitReleaseCalls);
            result.put(value);
        }
        return result;
    }

    private void write(String phase, JSONObject marker) {
        if (!directory.exists() && !directory.mkdirs()) {
            recordFailure(new IOException("cannot create marker directory " + directory));
            return;
        }
        File temporary = new File(directory, "." + phase + "." + nonce + ".tmp");
        File destination = new File(directory, phase + ".json");
        try (FileOutputStream stream = new FileOutputStream(temporary)) {
            stream.write(marker.toString().getBytes(StandardCharsets.UTF_8));
            stream.getFD().sync();
        } catch (IOException error) {
            recordFailure(error);
            return;
        }
        if (!temporary.renameTo(destination)) recordFailure(new IOException("cannot rename marker " + phase));
    }

    private static void put(JSONObject object, String key, Object value) {
        try { object.put(key, value); }
        catch (JSONException error) { throw new IllegalStateException("cannot construct lifecycle JSON", error); }
    }
}
