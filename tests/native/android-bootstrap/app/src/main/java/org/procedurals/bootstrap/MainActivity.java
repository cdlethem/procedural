package org.procedurals.bootstrap;

import android.os.Bundle;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.widget.FrameLayout;
import androidx.fragment.app.FragmentActivity;
import processing.android.PFragment;
import processing.core.PApplet;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** Independently written runtime probe, not a drawing capability implementation. */
public final class MainActivity extends FragmentActivity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    FrameLayout container = new FrameLayout(this);
    container.setId(View.generateViewId());
    setContentView(container);
    new PFragment(new Probe()).setView(container, this);
  }

  public final class Probe extends PApplet {
    @Override public void settings() { size(32, 24, JAVA2D); }
    @Override public void setup() {
      noLoop();
      try {
        JSONObject result = new JSONObject();
        result.put("renderer", g.getClass().getName());
        result.put("api", Build.VERSION.SDK_INT);
        result.put("width", width);
        result.put("height", height);
        result.put("passed", width == 32 && height == 24 &&
            g.getClass().getName().equals("processing.a2d.PGraphicsAndroid2D"));
        byte[] bytes = result.toString().getBytes(StandardCharsets.UTF_8);
        File output = new File(MainActivity.this.getFilesDir(), "bootstrap.json");
        try (FileOutputStream stream = new FileOutputStream(output)) { stream.write(bytes); }
        Log.i("PROCEDURALS", result.toString());
      } catch (Exception error) { Log.e("PROCEDURALS", "bootstrap failed", error); }
    }
  }
}
