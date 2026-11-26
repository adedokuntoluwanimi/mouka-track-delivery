package com.terracode.moukadriver;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private static final String PAGE = "file:///android_asset/index.html";
    private WebView web;
    private JSONArray assignments;
    private String requestedTrip;
    private String requestedAction;
    private boolean visible;
    private volatile String note = "";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) {
            requestedTrip = state.getString("trip");
            requestedAction = state.getString("action");
        }
        try {
            assignments = new JSONArray(asset("trips.json"));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot read bundled assignments", e);
        }
        web = new WebView(this);
        web.setBackgroundColor(0xfff5f8f5);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setBlockNetworkLoads(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !PAGE.equals(request.getUrl().toString());
            }
        });
        web.addJavascriptInterface(new DriverBridge(), "Driver");
        android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        root.setBackgroundColor(0xfff5f8f5);
        root.addView(web, new android.widget.FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 35) {
            int barsAppearance = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            getWindow().getInsetsController().setSystemBarsAppearance(barsAppearance, barsAppearance);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars()
                    | android.view.WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
        setContentView(root);
        web.loadUrl(PAGE);
    }

    private String asset(String name) throws Exception {
        try (InputStream input = getAssets().open(name);
             java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int length;
            while ((length = input.read(buffer)) != -1) bytes.write(buffer, 0, length);
            return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    @Override protected void onResume() {
        super.onResume();
        visible = true;
        SyncJob.schedule(this);
        finishPermissionRequest();
    }

    @Override protected void onPause() {
        visible = false;
        super.onPause();
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        state.putString("trip", requestedTrip);
        state.putString("action", requestedAction);
    }

    private JSONObject trip(String id) {
        for (int i = 0; i < assignments.length(); i++) {
            JSONObject record = assignments.optJSONObject(i);
            if (record != null && record.optString("id").equals(id)) return record;
        }
        return null;
    }

    public final class DriverBridge {
        @JavascriptInterface public String snapshot() {
            try {
                return Store.get(MainActivity.this).snapshot(TrackingService.tracking, note)
                    .put("assignments", assignments).put("syncConfigured", SyncJob.configured()).toString();
            } catch (org.json.JSONException e) {
                throw new IllegalStateException(e);
            }
        }

        @JavascriptInterface public void act(String id, String action, int stopIndex) {
            runOnUiThread(() -> dispatch(id, action, stopIndex));
        }
    }

    private void dispatch(String id, String action, int stopIndex) {
        JSONObject assignment = trip(id);
        if (!visible || assignment == null) {
            refresh();
            return;
        }
        note = "";
        Store store = Store.get(this);
        int stops = assignment.optJSONArray("stops").length();
        switch (action) {
            case "start":
            case "resume":
                if (!TrackingService.hasLocation(this)) {
                    requestedTrip = id;
                    requestedAction = action;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION}, 1);
                    break;
                }
                android.location.LocationManager locations = getSystemService(android.location.LocationManager.class);
                if (!locations.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)
                    && !locations.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER)) {
                    note = "Turn on Location in Android settings, then try again.";
                    break;
                }
                if ("start".equals(action) && !store.transition(id, action, stops, -1)) {
                    note = "Finish the active trip before starting another.";
                    break;
                }
                if (!id.equals(store.activeTrip())) break;
                try {
                    startForegroundService(new Intent(this, TrackingService.class));
                    if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                        && !getPreferences(0).getBoolean("notificationPrompt", false)) {
                        getPreferences(0).edit().putBoolean("notificationPrompt", true).apply();
                        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2);
                    }
                } catch (IllegalStateException | SecurityException failure) {
                    note = "Tracking could not start. Keep the app open and tap Resume tracking.";
                }
                break;
            case "confirm":
                if (!store.transition(id, action, stops, stopIndex)) note = "This stop has already changed.";
                break;
            case "end":
                if (store.transition(id, action, stops, -1)) {
                    stopService(new Intent(this, TrackingService.class));
                } else {
                    note = "Confirm all delivery stops before ending the trip.";
                }
                break;
            default:
                return;
        }
        SyncJob.schedule(this);
        refresh();
    }

    private void refresh() {
        web.evaluateJavascript("window.refreshDriver && window.refreshDriver()", null);
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(code, permissions, grants);
        if (code != 1) return;
        if (TrackingService.hasLocation(this)) {
            finishPermissionRequest();
        } else {
            requestedTrip = null;
            requestedAction = null;
            note = "Allow location access in Android settings to start tracking.";
            refresh();
        }
    }

    private void finishPermissionRequest() {
        if (!visible || requestedTrip == null || requestedAction == null || !TrackingService.hasLocation(this)) return;
        String id = requestedTrip;
        String action = requestedAction;
        requestedTrip = null;
        requestedAction = null;
        dispatch(id, action, -1);
    }

    @Override protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("Driver");
            web.destroy();
        }
        super.onDestroy();
    }
}
