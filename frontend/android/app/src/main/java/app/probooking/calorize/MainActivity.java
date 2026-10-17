package app.probooking.calorize;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity {

    // Sign in with Apple on Android finishes on app.probooking.calorize://apple-login?... (see AndroidManifest)
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri data = intent.getData();
        if (Intent.ACTION_VIEW.equals(intent.getAction()) && data != null && "apple-login".equals(data.getHost())) {
            PluginHandle handle = getBridge().getPlugin("SocialLogin");
            if (handle != null) {
                ((SocialLoginPlugin) handle.getInstance()).handleAppleLoginIntent(intent);
            }
        }
    }
}
