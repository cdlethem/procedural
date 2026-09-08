package org.procedurals.lifecycleprobe;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.lang.ref.WeakReference;

/** Test-APK-only explicit finish control. It never retains an Activity strongly. */
public final class FinishReceiver extends BroadcastReceiver {
    public static final String ACTION = "org.procedurals.lifecycleprobe.FINISH";
    private static WeakReference<MainActivity> activity = new WeakReference<MainActivity>(null);

    static void attach(MainActivity value) { activity = new WeakReference<MainActivity>(value); }

    static void detach(MainActivity value) {
        MainActivity current = activity.get();
        if (current == value) activity = new WeakReference<MainActivity>(null);
    }

    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION.equals(intent.getAction())) return;
        final MainActivity current = activity.get();
        if (current != null) current.runOnUiThread(new Runnable() {
            @Override public void run() {
                if (!current.isFinishing()) current.finish();
            }
        });
    }
}
