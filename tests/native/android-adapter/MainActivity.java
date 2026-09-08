package org.procedurals.nativeprobe;

import android.os.Bundle;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.widget.FrameLayout;
import androidx.fragment.app.FragmentActivity;
import processing.android.PFragment;
import processing.core.PApplet;
import org.json.JSONObject;
import org.procedurals.android.internal.AndroidFrameHost;
import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;

/** Registered suite executor; no artist UI or public package support assertion. */
public final class MainActivity extends FragmentActivity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    FrameLayout container = new FrameLayout(this);
    container.setId(View.generateViewId());
    setContentView(container);
    new PFragment(new Probe()).setView(container, this);
  }

  public final class Probe extends PApplet {
    @Override public void settings() { size(64, 64, JAVA2D); }
    @Override public void setup() {
      noLoop();
      JSONObject report = new JSONObject();
      AndroidFrameHost host = null;
      try {
        report.put("part", SelectedPart.NAME);
        report.put("api", Build.VERSION.SDK_INT);
        report.put("renderer", g.getClass().getName());
        host = new AndroidFrameHost(this);
        JSONObject nativeResult = SelectedPart.run(this, host);
        report.put("native", nativeResult);
        report.put("passed", nativeResult.getBoolean("passed"));
      } catch (Throwable failure) {
        try {
          report.put("passed", false);
          StringWriter trace = new StringWriter();
          failure.printStackTrace(new PrintWriter(trace));
          report.put("trace", trace.toString());
        } catch (Exception ignored) { Log.e("PROCEDURALS", "Cannot record failure", failure); }
      } finally {
        if (host != null) host.dispose();
      }
      try {
        File temporary = new File(MainActivity.this.getFilesDir(), "result.tmp");
        File output = new File(MainActivity.this.getFilesDir(), "result.json");
        try (FileOutputStream stream = new FileOutputStream(temporary)) {
          stream.write(report.toString().getBytes(StandardCharsets.UTF_8));
        }
        if (!temporary.renameTo(output)) throw new IllegalStateException("Result publication failed");
        Log.i("PROCEDURALS", "registered part finished: " + SelectedPart.NAME);
      } catch (Exception error) { Log.e("PROCEDURALS", "Cannot publish native report", error); }
    }
  }
}
