package org.procedurals.examples.fieldmarks;

import android.database.Cursor;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.os.Looper;
import android.provider.MediaStore;
import android.view.View;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Test-only observation activity for the native editable FieldMarks example.
 * It neither invokes controls nor changes rendering, saving, MediaStore, or edit state.
 */
public final class FieldMarksProbeActivity extends FieldMarksActivity {
    private File evidenceDirectory;
    private String nonce;
    private int sequence;
    private int lastComposition;
    private int lastReadyFrame = -1;
    private RenderedSnapshot lastSnapshot;
    private byte[] lastPng;
    private boolean failed;
    private final JSONArray frames = new JSONArray();
    private JSONObject savedFacts;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        nonce = UUID.randomUUID().toString();
        evidenceDirectory = new File(getFilesDir(), "field-marks-probe");
        if (!evidenceDirectory.isDirectory() && !evidenceDirectory.mkdirs())
            fail(new IOException("cannot create probe evidence directory"));
    }

    @Override protected void onFrameReady(RenderedSnapshot snapshot) {
        try {
            checkUi("onFrameReady");
            check(snapshot != null, "missing rendered snapshot");
            check(lengthButton.isEnabled() && paletteButton.isEnabled() && marksButton.isEnabled() && saveButton.isEnabled(),
                "all four controls must be enabled at frame acknowledgement");
            int count = snapshot.compositionCount;
            if (count == lastComposition) return; // A lifecycle acknowledgement may repeat the same image.
            check(count == lastComposition + 1 && count >= 1 && count <= 8,
                "unexpected composition acknowledgement " + count + " after " + lastComposition);
            boolean[][] expected = {
                {false,false,false}, {true,false,false}, {false,false,false}, {false,true,false},
                {false,false,false}, {false,false,true}, {true,false,true}, {true,true,true}
            };
            boolean[] choice=expected[count-1];
            check(snapshot.options.version == count-1 && snapshot.options.longer == choice[0]
                    && snapshot.options.neon == choice[1] && snapshot.options.bars == choice[2],
                "composition options/version differ from the registered edit sequence");
            int completed = completedFrameCount();
            check(completed == count + 1,
                "completed frame count must include startup plus composition " + count);

            byte[] png = snapshot.image.pngBytes();
            check(png.length != 0, "empty cached PNG");
            writeAtomically(new File(evidenceDirectory, "frame-" + count + ".png"), png);
            JSONObject observation = frameObservation(snapshot, png, completed);
            writeJsonAtomically(new File(evidenceDirectory, "frame-" + count + ".json"), observation);
            frames.put(observation);
            lastComposition = count;
            lastReadyFrame = completed;
            lastSnapshot = snapshot;
            lastPng = png.clone();
        } catch (Throwable failure) { fail(failure); }
    }

    @Override protected void onImageSaved(RenderedSnapshot snapshot, Uri uri) {
        try {
            checkUi("onImageSaved");
            check(snapshot != null && uri != null, "save hook is missing its snapshot or URI");
            check(snapshot.compositionCount == 8, "save must use composition eight");
            check(currentSnapshot() == snapshot && snapshot == lastSnapshot,
                "save must use the currently acknowledged snapshot");
            check(completedFrameCount() == lastReadyFrame,
                "saving advanced the composition/frame count");
            check(lastPng != null, "missing cached snapshot bytes");

            byte[] saved = readAll(uri);
            check(Arrays.equals(lastPng, saved), "saved URI bytes differ from cached snapshot PNG");
            BitmapFactory.Options dimensions = new BitmapFactory.Options();
            dimensions.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(saved, 0, saved.length, dimensions);
            check(dimensions.outWidth == 640 && dimensions.outHeight == 640,
                "saved PNG dimensions are not 640 by 640");
            writeAtomically(new File(evidenceDirectory, "saved.png"), saved);

            JSONObject row = queryRow(uri);
            put(row, "png_width", dimensions.outWidth);
            put(row, "png_height", dimensions.outHeight);
            put(row, "byte_sha256", sha256(saved));
            savedFacts = row;
            writeResult(true);
        } catch (Throwable failure) { fail(failure); }
    }

    @Override protected void onExampleFailure(Throwable failure) { fail(failure); }

    private JSONObject frameObservation(RenderedSnapshot snapshot, byte[] png, int completed) {
        JSONObject result = envelope("frame-ready");
        put(result, "composition_count", snapshot.compositionCount);
        put(result, "completed_frame_count", completed);
        put(result, "state_version", snapshot.options.version);
        put(result, "longer", snapshot.options.longer);
        put(result, "neon", snapshot.options.neon);
        put(result, "bars", snapshot.options.bars);
        put(result, "max_length", snapshot.options.maxLength());
        put(result, "model_sha256", snapshot.image.modelHash);
        put(result, "geometry_sha256", snapshot.image.geometryHash);
        put(result, "color_sha256", snapshot.image.colorHash);
        put(result, "commands", snapshot.image.commands);
        put(result, "png_sha256", sha256(png));
        put(result, "button_center_bounds", buttonBounds());
        return result;
    }

    private JSONObject queryRow(Uri uri) {
        String[] projection = {
            MediaStore.Images.Media.IS_PENDING,
            MediaStore.Images.Media.MIME_TYPE,
            MediaStore.Images.Media.RELATIVE_PATH,
            MediaStore.Images.Media.WIDTH,
            MediaStore.Images.Media.HEIGHT
        };
        try (Cursor cursor = getContentResolver().query(uri, projection, null, null, null)) {
            check(cursor != null && cursor.getCount() == 1 && cursor.moveToFirst(), "saved MediaStore row is unavailable");
            int pending = cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.IS_PENDING));
            String mime = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE));
            String relativePath = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.RELATIVE_PATH));
            check(pending == 0, "saved row remains pending");
            check("image/png".equals(mime), "saved row MIME type is not image/png");
            check("Pictures/Procedurals".equals(relativePath) || "Pictures/Procedurals/".equals(relativePath),
                "saved row has the wrong relative path");
            JSONObject result = new JSONObject();
            put(result, "uri", uri.toString());
            put(result, "is_pending", pending);
            put(result, "mime_type", mime);
            put(result, "relative_path", relativePath);
            put(result, "metadata_width", cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)));
            put(result, "metadata_height", cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)));
            return result;
        }
    }

    private JSONArray buttonBounds() {
        JSONArray values = new JSONArray();
        values.put(buttonBounds("length", lengthButton));
        values.put(buttonBounds("palette", paletteButton));
        values.put(buttonBounds("marks", marksButton));
        values.put(buttonBounds("save", saveButton));
        return values;
    }

    private static JSONObject buttonBounds(String id, View view) {
        check(view != null, "missing " + id + " button");
        int[] location = new int[2];
        view.getLocationOnScreen(location);
        check(view.getWidth() > 0 && view.getHeight() > 0, "invalid " + id + " button bounds");
        JSONObject result = new JSONObject();
        put(result, "id", id);
        put(result, "left", location[0]); put(result, "top", location[1]);
        put(result, "width", view.getWidth()); put(result, "height", view.getHeight());
        put(result, "center_x", location[0] + view.getWidth() / 2);
        put(result, "center_y", location[1] + view.getHeight() / 2);
        return result;
    }

    private byte[] readAll(Uri uri) throws IOException {
        InputStream stream = getContentResolver().openInputStream(uri);
        if (stream == null) throw new IOException("saved URI has no readable stream");
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            for (int read; (read = input.read(buffer)) != -1;) output.write(buffer, 0, read);
            return output.toByteArray();
        }
    }

    private void fail(Throwable failure) {
        if (failed) return;
        failed = true;
        try {
            JSONObject result = envelope("failure");
            put(result, "passed", false);
            put(result, "failure", failure.getClass().getName() + ": " + failure.getMessage());
            StringWriter trace = new StringWriter();
            failure.printStackTrace(new PrintWriter(trace));
            put(result, "trace", trace.toString());
            put(result, "frames", frames);
            if (savedFacts != null) put(result, "saved", savedFacts);
            writeJsonAtomically(new File(evidenceDirectory, "result.json"), result);
        } catch (Throwable ignored) { }
    }

    private void writeResult(boolean passed) throws IOException {
        JSONObject result = envelope("result");
        put(result, "passed", passed && !failed);
        put(result, "frames", frames);
        put(result, "composition_count", lastComposition);
        put(result, "completed_frame_count", completedFrameCount());
        put(result, "saved", savedFacts);
        writeJsonAtomically(new File(evidenceDirectory, "result.json"), result);
    }

    private JSONObject envelope(String event) {
        JSONObject result = new JSONObject();
        put(result, "event", event);
        put(result, "nonce", nonce);
        put(result, "sequence", ++sequence);
        put(result, "thread_id", Thread.currentThread().getId());
        put(result, "thread_name", Thread.currentThread().getName());
        return result;
    }

    private static void checkUi(String event) {
        check(Looper.myLooper() == Looper.getMainLooper(), event + " did not run on the UI thread");
    }

    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    private static String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder result = new StringBuilder();
            for (byte value : hash) result.append(String.format("%02x", value & 255));
            return result.toString();
        } catch (NoSuchAlgorithmException error) { throw new IllegalStateException("SHA-256 is unavailable", error); }
    }

    private static void writeAtomically(File destination, byte[] bytes) throws IOException {
        File directory = destination.getParentFile();
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("cannot create evidence directory");
        File temporary = new File(directory, "." + destination.getName() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temporary)) {
            output.write(bytes);
            output.getFD().sync();
        }
        if (!temporary.renameTo(destination)) throw new IOException("cannot publish " + destination.getName());
    }

    private static void writeJsonAtomically(File destination, JSONObject value) throws IOException {
        writeAtomically(destination, value.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static void put(JSONObject object, String key, Object value) {
        try { object.put(key, value); }
        catch (JSONException error) { throw new IllegalStateException("cannot construct probe JSON", error); }
    }
}
