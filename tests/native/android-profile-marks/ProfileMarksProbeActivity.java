package org.procedurals.examples.profilemarks;

import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.security.MessageDigest;
import java.util.Arrays;
import org.json.JSONArray;
import org.json.JSONObject;
import org.procedurals.mesh.RadialProfile3D;

/** Native-only observer: drives ProfileMarks' actual buttons and records a bounded ten-state run. */
public final class ProfileMarksProbeActivity extends ProfileMarksActivity {
    private static final String[] IDS = {"baseline", "waist", "pointed", "coarse", "cylinder",
        "start-open", "both-open", "palette", "trio", "reset"};
    private static final int[] DRAWN = {1088, 1088, 1024, 256, 272, 264, 256, 256, 760, 1088};
    private final JSONArray frames = new JSONArray();
    private File evidence;
    private PublishedSnapshot previous, trio;
    private ProfileComposition framesBaseline;
    private byte[] baselinePng;
    private String previousGeometry, trioGeometry;
    private int step = -1;
    private boolean failed, terminalPassed, awaitingPause, paused, resumed, awaitingTrioSave, awaitingResetSave;
    private String trioSavedUri, trioSavedHash, resetSavedUri, resetSavedHash;
    private long trioSaveFrame, resetSaveFrame;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        evidence = new File(getFilesDir(), "profile-marks-probe");
        evidence.mkdirs();
        writeStatus("running");
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!failed && !terminalPassed) fail(new AssertionError("probe deadline"));
        }, 60000);
    }

    @Override protected void onPause() {
        if (awaitingPause) { paused = true; writeStatus("awaiting-pause"); }
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (awaitingPause && paused) resumed = true;
    }

    @Override protected void onCompletedDraw(PublishedSnapshot snapshot) {
        if (failed) return;
        try {
            checkUi();
            if (awaitingPause && resumed) {
                check(snapshot.composition == trio.composition, "resume regenerated composition");
                check(geometryHash(snapshot.composition).equals(trioGeometry), "resume geometry changed");
                check(Arrays.equals(snapshot.copyPng(), trio.copyPng()), "resume image changed");
                check(snapshot.revision == trio.revision, "resume revision changed");
                awaitingPause = false;
                writePng("trio-resumed.png", snapshot.copyPng());
                writeStatus("resumed");
                awaitDisplayReview(() -> click("Reset"));
                return;
            }
            if (snapshot.frameSerial <= (previous == null ? 0 : previous.frameSerial)) return;
            int next = step + 1;
            check(next < IDS.length, "unexpected extra frame");
            check(snapshot.revision == next, "revision");
            checkOptions(snapshot, next);
            check(snapshot.drawnFaceCount == DRAWN[next], "drawn face count");
            check(snapshot.normalCalls == DRAWN[next], "normal submission count");
            check(snapshot.vertexCalls == DRAWN[next] * 3, "vertex submission count");
            check(snapshot.viewportWidth == snapshot.viewportHeight && snapshot.viewportWidth > 0, "square viewport");
            check(snapshot.retainedFaceCount == retainedFaces(snapshot.composition), "retained face count");
            checkTopology(snapshot.composition);
            String geometry = geometryHash(snapshot.composition);
            boolean retained = previous != null && snapshot.composition == previous.composition;
            boolean expectedRetained = next == 1 || next == 2 || next == 4 || next == 7 || next == 8;
            check(retained == expectedRetained, "composition retention at " + next);
            if (previous != null && expectedRetained) check(geometry.equals(previousGeometry), "retained geometry changed");
            if (next == 9) {
                check(!retained, "reset did not rebuild");
                check(geometry.equals(geometryHash(framesBaseline)), "reset geometry differs from baseline");
            }
            if (next == 6) check(meshHash(snapshot.composition.meshAt(2)).equals(meshHash(previous.composition.meshAt(2))), "pointed mesh changed for ignored end cap");
            if (previous != null && !expectedRetained && next != 9) check(!geometry.equals(previousGeometry), "rebuild did not change geometry");
            byte[] png = snapshot.copyPng();
            checkDecoded(png, snapshot.viewportWidth, snapshot.viewportHeight);
            writePng(IDS[next] + ".png", png);
            JSONObject row = new JSONObject();
            row.put("id", IDS[next]); row.put("png_sha256", sha256(png)); row.put("revision", snapshot.revision);
            row.put("frame_serial", snapshot.frameSerial); row.put("composition_identity", snapshot.compositionIdentity);
            row.put("geometry_sha256", geometry); row.put("drawn_faces", snapshot.drawnFaceCount);
            frames.put(row);
            if (next == 0) framesBaseline = snapshot.composition;
            if (next == 9) check(Arrays.equals(png, baselinePng), "reset PNG differs from baseline");
            if (next == 0) baselinePng = png.clone();
            previous = snapshot; previousGeometry = geometry; step = next;
            if (next == 8) {
                trio = snapshot; trioGeometry = geometry; awaitingTrioSave = true; trioSaveFrame = snapshot.frameSerial;
                click("Save");
                return;
            }
            if (next == 9) {
                awaitingResetSave = true; resetSaveFrame = snapshot.frameSerial;
                click("Save");
                return;
            }
            click(nextControl(next));
        } catch (Throwable error) { fail(error); }
    }

    @Override protected void onSaved(PublishedSnapshot snapshot, Uri uri, Throwable failure) {
        if (failed) return;
        try {
            checkUi(); check(failure == null && uri != null, "save failure " + failure);
            final boolean trioSave = awaitingTrioSave;
            if (!trioSave && !awaitingResetSave) throw new AssertionError("unexpected save callback");
            check(trioSave ? snapshot == trio : snapshot == previous, "saved snapshot identity");
            long quietFrame = trioSave ? trioSaveFrame : resetSaveFrame;
            check(snapshot.frameSerial == quietFrame, "saved snapshot frame");
            byte[] saved = readAll(uri);
            check(Arrays.equals(saved, snapshot.copyPng()), "MediaStore bytes differ from cached PNG");
            checkDecoded(saved, snapshot.viewportWidth, snapshot.viewportHeight);
            if (trioSave) { trioSavedUri = uri.toString(); trioSavedHash = sha256(saved); writePng("trio-saved.png", saved); }
            else { resetSavedUri = uri.toString(); resetSavedHash = sha256(saved); writePng("reset-saved.png", saved); }
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    check(currentSnapshot().frameSerial == quietFrame, "save redrew");
                    if (trioSave) { awaitingTrioSave = false; awaitingPause = true; writeStatus("awaiting-pause"); }
                    else { awaitingResetSave = false; check(paused && resumed, "pause/resume missing"); terminalPassed = true; writeStatus("passed"); }
                } catch (Throwable error) { fail(error); }
            }, 250);
        } catch (Throwable error) { fail(error); }
    }

    private static void checkOptions(PublishedSnapshot snapshot, int n) {
        State state = snapshot.options;
        int[] profiles = {0, 1, 2, 2, 0, 0, 0, 0, 0, 0};
        int[] slices = {32, 32, 32, 8, 8, 8, 8, 8, 8, 32};
        boolean[] starts = {true, true, true, true, true, false, false, false, false, true};
        boolean[] ends = {true, true, true, true, true, true, false, false, false, true};
        check(state.profile == profiles[n] && state.slices == slices[n] && state.start == starts[n] && state.end == ends[n], "settings");
        check(state.alternate == (n == 7 || n == 8) && state.trio == (n == 8), "style settings");
        check(state.forceRebuild == (n == 9), "reset setting");
    }

    private String nextControl(int current) {
        switch (current) {
            case 0: case 1: case 3: return "Profile";
            case 2: return "Slices";
            case 4: return "Start cap";
            case 5: return "End cap";
            case 6: return "Palette";
            case 7: return "Trio";
            default: throw new AssertionError("no next control");
        }
    }

    private void click(String description) {
        View button = findDescription(getWindow().getDecorView(), description);
        check(button != null, "missing button " + description);
        check(button.performClick(), "button callback absent " + description);
    }

    private static View findDescription(View view, String description) {
        if (view.getContentDescription() != null && description.contentEquals(view.getContentDescription())) return view;
        if (view instanceof android.view.ViewGroup) {
            android.view.ViewGroup group = (android.view.ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                View found = findDescription(group.getChildAt(i), description);
                if (found != null) return found;
            }
        }
        return null;
    }

    private void awaitDisplayReview(Runnable next) {
        Handler handler = new Handler(Looper.getMainLooper());
        long deadline = SystemClock.uptimeMillis() + 15000;
        handler.post(new Runnable() { @Override public void run() {
            if (failed) return;
            if (new File(evidence, "display-reviewed").isFile()) { next.run(); return; }
            if (SystemClock.uptimeMillis() > deadline) { fail(new AssertionError("display review handshake missing")); return; }
            handler.postDelayed(this, 50);
        }});
    }

    private void writeStatus(String status) {
        try {
            JSONObject result = new JSONObject(); result.put("status", status); result.put("frames", frames);
            result.put("paused", paused); result.put("resumed", resumed); result.put("step", step); result.put("trio_saved_uri", trioSavedUri); result.put("trio_saved_sha256", trioSavedHash); result.put("reset_saved_uri", resetSavedUri); result.put("reset_saved_sha256", resetSavedHash);
            PublishedSnapshot snapshot = currentSnapshot();
            if (snapshot != null) {
                View viewport = findViewport(getWindow().getDecorView(), snapshot.viewportWidth, snapshot.viewportHeight);
                if (viewport != null) { int[] xy = new int[2]; viewport.getLocationOnScreen(xy);
                    JSONArray bounds = new JSONArray(); bounds.put(xy[0]); bounds.put(xy[1]); bounds.put(xy[0] + viewport.getWidth()); bounds.put(xy[1] + viewport.getHeight()); result.put("viewport_bounds", bounds); }
            }
            writeJson(result);
        } catch (Throwable error) { fail(error); }
    }

    private static View findViewport(View view, int width, int height) {
        if (view.getWidth() == width && view.getHeight() == height) return view;
        if (view instanceof android.view.ViewGroup) { android.view.ViewGroup group = (android.view.ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) { View found = findViewport(group.getChildAt(i), width, height); if (found != null) return found; }}
        return null;
    }

    private static int retainedFaces(ProfileComposition composition) {
        return composition.meshAt(0).faceCount() + composition.meshAt(1).faceCount() + composition.meshAt(2).faceCount();
    }

    private static String meshHash(RadialProfile3D mesh) {
        try { MessageDigest digest = MessageDigest.getInstance("SHA-256"); double[] point = new double[3], normal = new double[3]; int[] triangle = new int[3];
            put(digest, mesh.vertexCount()); put(digest, mesh.faceCount());
            for (int vertex = 0; vertex < mesh.vertexCount(); vertex++) { mesh.vertexInto(vertex, point, 0); for (double value : point) put(digest, Double.doubleToRawLongBits(value)); }
            for (int face = 0; face < mesh.faceCount(); face++) { mesh.triangleInto(face, triangle, 0); mesh.normalInto(face, normal, 0); for (int index : triangle) put(digest, index); for (double value : normal) put(digest, Double.doubleToRawLongBits(value)); put(digest, mesh.bandAt(face)); put(digest, mesh.cellAt(face)); digest.update(mesh.faceKindAt(face).getBytes(java.nio.charset.StandardCharsets.UTF_8)); digest.update((byte) 0); }
            return hex(digest.digest());
        } catch (Exception error) { throw new IllegalStateException(error); }
    }

    private static void checkTopology(ProfileComposition composition) {
        for (int shape = 0; shape < 3; shape++) {
            RadialProfile3D mesh = composition.meshAt(shape); double[] point = new double[3], normal = new double[3]; int[] triangle = new int[3];
            for (int vertex = 0; vertex < mesh.vertexCount(); vertex++) { mesh.vertexInto(vertex, point, 0); for (double value : point) check(Double.isFinite(value), "nonfinite vertex"); }
            for (int face = 0; face < mesh.faceCount(); face++) { mesh.triangleInto(face, triangle, 0); mesh.normalInto(face, normal, 0);
                check(mesh.faceKindAt(face) != null && mesh.bandAt(face) >= -1 && mesh.cellAt(face) >= -1, "metadata");
                for (int index : triangle) check(index >= 0 && index < mesh.vertexCount(), "triangle index");
                for (double value : normal) check(Double.isFinite(value), "nonfinite normal"); }
        }
    }

    private static String geometryHash(ProfileComposition composition) {
        try { MessageDigest digest = MessageDigest.getInstance("SHA-256"); double[] point = new double[3], normal = new double[3]; int[] triangle = new int[3];
            for (int shape = 0; shape < 3; shape++) { RadialProfile3D mesh = composition.meshAt(shape); put(digest, mesh.vertexCount()); put(digest, mesh.faceCount());
                for (int vertex = 0; vertex < mesh.vertexCount(); vertex++) { mesh.vertexInto(vertex, point, 0); for (double value : point) put(digest, Double.doubleToRawLongBits(value)); }
                for (int face = 0; face < mesh.faceCount(); face++) { mesh.triangleInto(face, triangle, 0); mesh.normalInto(face, normal, 0);
                    for (int index : triangle) put(digest, index); for (double value : normal) put(digest, Double.doubleToRawLongBits(value));
                    put(digest, mesh.bandAt(face)); put(digest, mesh.cellAt(face)); digest.update(mesh.faceKindAt(face).getBytes(java.nio.charset.StandardCharsets.UTF_8)); digest.update((byte) 0); }}
            return hex(digest.digest());
        } catch (Exception error) { throw new IllegalStateException(error); }
    }

    private void checkDecoded(byte[] png, int width, int height) { BitmapFactory.Options options = new BitmapFactory.Options(); options.inJustDecodeBounds = true; BitmapFactory.decodeByteArray(png, 0, png.length, options); check(options.outWidth == width && options.outHeight == height, "PNG dimensions"); }
    private byte[] readAll(Uri uri) throws IOException { InputStream stream = getContentResolver().openInputStream(uri); if (stream == null) throw new IOException("MediaStore stream unavailable"); try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) { byte[] buffer = new byte[8192]; for (int read; (read = input.read(buffer)) != -1;) output.write(buffer, 0, read); return output.toByteArray(); } }
    private void writePng(String name, byte[] bytes) throws IOException { try (FileOutputStream output = new FileOutputStream(new File(evidence, name))) { output.write(bytes); } }
    private void writeJson(JSONObject object) throws IOException, org.json.JSONException { File target = new File(evidence, "result.json"), temporary = new File(evidence, "result.json.tmp"); try (FileOutputStream output = new FileOutputStream(temporary)) { output.write(object.toString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8)); output.getFD().sync(); } if (!temporary.renameTo(target)) throw new IOException("atomic result rename failed"); }
    private void fail(Throwable error) { if (failed) return; failed = true; try { JSONObject result = new JSONObject(); result.put("status", "failed"); result.put("frames", frames); StringWriter trace = new StringWriter(); error.printStackTrace(new PrintWriter(trace)); result.put("failure", trace.toString()); writeJson(result); } catch (Throwable ignored) { } }
    private static void checkUi() { check(Looper.myLooper() == Looper.getMainLooper(), "not UI thread"); }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static void put(MessageDigest digest, long value) { for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte) (value >>> shift)); }
    private static String sha256(byte[] bytes) { try { return hex(MessageDigest.getInstance("SHA-256").digest(bytes)); } catch (Exception error) { throw new IllegalStateException(error); } }
    private static String hex(byte[] bytes) { StringBuilder result = new StringBuilder(); for (byte value : bytes) result.append(String.format("%02x", value & 255)); return result.toString(); }
}
