package com.mytrade.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.Toast;

import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * The My-Trade dashboard as an app: one full-screen web view on the owner's own server, the screen kept
 * awake (the page watches the market and records the paper calls' premiums while it is open), the login's
 * tab note travelling with every page, the CSV saved to Downloads. Nothing secret lives in the app:
 * the server asks for the dashboard password like any browser, and the Dhan token never leaves the server.
 */
public class MainActivity extends Activity {
    private static final String PREFS = "my-trade";
    private static final String KEY_SERVER = "server";
    private static final String DEFAULT_SERVER = "https://my-trade-hvny.onrender.com";

    // The dashboard opens a tile's page in a new tab; in the app every page stays in this one view, so the
    // login's tab note (sessionStorage) is still there on the next page.
    private static final String SAME_VIEW_JS =
            "(function(){function fix(){document.querySelectorAll('a[target=\"_blank\"]').forEach(function(a){a.target='_self';});}"
            + "fix();new MutationObserver(fix).observe(document.documentElement,{childList:true,subtree:true});})();";

    // Download CSV makes a blob: link, which a web view cannot save by itself: read it and hand it to the app.
    private static final String BLOB_JS =
            "(function(){var x=new XMLHttpRequest();x.open('GET','%URL%',true);x.responseType='blob';"
            + "x.onload=function(){if(x.status===200){var r=new FileReader();r.onloadend=function(){"
            + "MyTradeApp.save(r.result.split(',')[1],x.response.type||'text/csv');};r.readAsDataURL(x.response);}};x.send();})();";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.addJavascriptInterface(new Downloads(), "MyTradeApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("mytrade".equals(url.getScheme())) {  // the links on the app's own error page
                    if ("server".equals(url.getHost())) askServer(); else load();
                    return true;
                }
                if (onServer(url)) return false;          // the dashboard: stays in the app
                startActivity(new Intent(Intent.ACTION_VIEW, url));  // anything else: the phone's browser
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(SAME_VIEW_JS, null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError(String.valueOf(error.getDescription()));
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                Message href = view.getHandler().obtainMessage();
                view.requestFocusNodeHref(href);
                String url = href.getData().getString("url");
                if (url != null) view.loadUrl(url);
                return false;
            }
        });

        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url.startsWith("blob:")) web.evaluateJavascript(BLOB_JS.replace("%URL%", url), null);
            else startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        });

        if (state != null) web.restoreState(state);
        else if (server() == null) askServer();
        else load();
    }

    private String server() {
        return getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_SERVER, null);
    }

    private boolean onServer(Uri url) {
        String here = server();
        return here != null && url.getHost() != null && url.getHost().equalsIgnoreCase(Uri.parse(here).getHost());
    }

    private void load() {
        web.loadUrl(server());
    }

    /** Asked once, on the first start, and from the error page: the address of the owner's dashboard. */
    private void askServer() {
        final EditText box = new EditText(this);
        box.setText(server() != null ? server() : DEFAULT_SERVER);
        box.setSingleLine(true);
        new AlertDialog.Builder(this)
                .setTitle("Dashboard address")
                .setMessage("The address of your My-Trade server. The Render link, or the laptop's address on your home network.")
                .setView(box)
                .setCancelable(server() != null)
                .setPositiveButton("Open", (dialog, which) -> {
                    String url = box.getText().toString().trim();
                    if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
                    while (url.endsWith("/")) url = url.substring(0, url.length() - 1);
                    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_SERVER, url).apply();
                    load();
                })
                .show();
    }

    private void showError(String why) {
        String html = "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"
                + "<body style='font-family:sans-serif;padding:24px;color:#0b0b0b;background:#f9f9f7'>"
                + "<h2 style='font-weight:600'>Cannot reach the dashboard</h2>"
                + "<p>" + escape(server()) + "<br><small>" + escape(why) + "</small></p>"
                + "<p>If this is the Render link, it may be waking up: wait a few seconds and try again.</p>"
                + "<p><a href='mytrade://retry' style='font-size:18px'>Try again</a><br><br>"
                + "<a href='mytrade://server'>Change the dashboard address</a></p></body>";
        web.loadDataWithBaseURL("https://my-trade.app/", html, "text/html", "utf-8", null);
    }

    private static String escape(String text) {
        return text == null ? "" : text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    /** Back goes to the previous page; on the first page it leaves the app. */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    /** Called from the page's JavaScript with the CSV's contents: saved under Downloads. */
    private class Downloads {
        @JavascriptInterface
        public void save(String base64, String mime) {
            String name = "paper-calls " + new SimpleDateFormat("yyyy-MM-dd HHmm", Locale.US).format(new Date()) + ".csv";
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, mime == null || mime.isEmpty() ? "text/csv" : mime);
                values.put(MediaStore.Downloads.RELATIVE_PATH, "Download/");
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("no place to save");
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    out.write(bytes);
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Downloads: " + name, Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Could not save the file: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }
    }
}
