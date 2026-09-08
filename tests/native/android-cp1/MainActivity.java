package org.procedurals.cp1probe;

import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.FrameLayout;
import androidx.fragment.app.FragmentActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.procedurals.android.internal.Android2DFragment;
import org.procedurals.android.internal.AndroidFieldMarks;
import org.procedurals.android.internal.AndroidFrameHost;
import processing.core.PApplet;

/** Test-only Android CP1 runner. It exposes no artist-facing activity or API. */
public final class MainActivity extends FragmentActivity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout container = new FrameLayout(this);
        container.setId(View.generateViewId());
        setContentView(container);
        new Android2DFragment(new Probe()).setView(container, this);
    }

    private void publish(JSONObject report) throws Exception {
        File temporary = new File(getFilesDir(), "result.tmp");
        File output = new File(getFilesDir(), "result.json");
        try (FileOutputStream stream = new FileOutputStream(temporary)) {
            stream.write(report.toString().getBytes(StandardCharsets.UTF_8));
            stream.getFD().sync();
        }
        if (!temporary.renameTo(output)) throw new IllegalStateException("CP1 result publication failed");
    }

    public final class Probe extends PApplet {
        @Override public void settings() { size(64, 64, JAVA2D); }

        @Override public void setup() {
            noLoop();
            JSONObject report = new JSONObject();
            AndroidFrameHost host = null;
            try {
                report.put("part", "cp1");
                report.put("api", Build.VERSION.SDK_INT);
                report.put("renderer", g.getClass().getName());
                host = new AndroidFrameHost(this);
                JSONObject nativeResult = AndroidFieldMarks.run(this, host,
                    new File(MainActivity.this.getFilesDir(), "cp1"));
                report.put("native", nativeResult);
                report.put("passed", nativeResult.getBoolean("passed"));
            } catch (Throwable failure) {
                try {
                    report.put("passed", false);
                    StringWriter trace = new StringWriter();
                    failure.printStackTrace(new PrintWriter(trace));
                    report.put("trace", trace.toString());
                } catch (Exception ignored) {
                    Log.e("PROCEDURALS", "Cannot record Android CP1 failure", failure);
                }
            } finally {
                if (host != null) host.dispose();
            }
            try {
                publish(report);
                Log.i("PROCEDURALS", "Android CP1 completed");
            } catch (Exception failure) {
                Log.e("PROCEDURALS", "Cannot publish Android CP1 result", failure);
            }
        }
    }
}
