package com.sahebyomak.daycompanion;

import android.os.Bundle;
import android.media.MediaScannerConnection;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    registerPlugin(MediaStoreScannerPlugin.class);
  }

  @CapacitorPlugin(name = "MediaStoreScanner")
  public static class MediaStoreScannerPlugin extends Plugin {
    @PluginMethod
    public void scanFile(PluginCall call) {
      String path = call.getString("path");
      if (path == null) {
        call.reject("Path is required");
        return;
      }
      MediaScannerConnection.scanFile(getContext(), new String[]{path}, new String[]{"image/png"}, (scanPath, uri) -> {
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("uri", uri != null ? uri.toString() : "");
        ret.put("path", scanPath);
        call.resolve(ret);
      });
    }
  }
}
