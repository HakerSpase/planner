package app.mplanner.planner;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Planner для Android: сайт в WebView плюс то, чего у сайта нет.
 *
 * - Вход через Google: Google не пускает в WebView, поэтому вход идёт во внешней
 *   вкладке Chrome, а код возвращается сюда по ссылке app.mplanner.planner://auth.
 *   Обмен кода на сессию делаем уже в WebView — там лежит PKCE-ключ входа.
 * - «Поделиться → Planner»: текст или ссылка из любого приложения открываются
 *   как новая задача.
 */
public class MainActivity extends BridgeActivity {
    private static final String SITE = "https://mplanner-dun.vercel.app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String target = null;

        Uri data = intent.getData();
        if (Intent.ACTION_VIEW.equals(intent.getAction()) && data != null
                && "app.mplanner.planner".equals(data.getScheme())
                && "auth".equals(data.getHost())) {
            String code = data.getQueryParameter("code");
            String error = data.getQueryParameter("error");
            if (!TextUtils.isEmpty(code)) {
                target = SITE + "/auth/callback?code=" + Uri.encode(code);
            } else {
                target = SITE + "/auth?error=" + Uri.encode(TextUtils.isEmpty(error) ? "no_code" : error);
            }
        } else if (Intent.ACTION_SEND.equals(intent.getAction())
                && "text/plain".equals(intent.getType())) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            String shared = TextUtils.isEmpty(subject) || (text != null && text.contains(subject))
                    ? text
                    : subject + " " + (text == null ? "" : text);
            if (!TextUtils.isEmpty(shared)) {
                target = SITE + "/i/tasks?share=" + Uri.encode(shared.trim());
            }
        }

        if (target == null || getBridge() == null) return;
        final String url = target;
        final WebView webView = getBridge().getWebView();
        webView.post(() -> webView.loadUrl(url));
    }
}
