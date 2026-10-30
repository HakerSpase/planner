package app.mplanner.planner;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.graphics.Rect;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
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
    /** Раздел, который открыть по нажатию на виджет */
    static final String EXTRA_PATH = "planner_path";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Свой плагин регистрируем до старта моста
        registerPlugin(WidgetPlugin.class);
        registerPlugin(UiPlugin.class);
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
        // Фоновое обновление виджетов и напоминаний (если токен уже выдан)
        SyncWorker.schedule(this);
    }

    /* ---------- Системная плашка выделения ---------- */

    private volatile boolean selectionMenuHidden = false;
    private ActionMode selectionMode;

    /** Сайт сообщает: выделение в редактируемой заметке — системную плашку прячем */
    void setSelectionMenuHidden(boolean hidden) {
        if (selectionMenuHidden == hidden) return;
        selectionMenuHidden = hidden;
        runOnUiThread(() -> {
            // Пересобрать меню текущей плашки: обёртка ниже очистит его или вернёт как было
            if (selectionMode != null) selectionMode.invalidate();
        });
    }

    @Override
    public ActionMode onWindowStartingActionMode(ActionMode.Callback callback, int type) {
        return super.onWindowStartingActionMode(new HidingCallback(callback), type);
    }

    @Override
    public void onActionModeStarted(ActionMode mode) {
        super.onActionModeStarted(mode);
        selectionMode = mode;
    }

    @Override
    public void onActionModeFinished(ActionMode mode) {
        super.onActionModeFinished(mode);
        if (selectionMode == mode) selectionMode = null;
    }

    /** Обёртка над плашкой WebView: пустое меню — плашка не показывается, выделение остаётся */
    private class HidingCallback extends ActionMode.Callback2 {
        private final ActionMode.Callback inner;

        HidingCallback(ActionMode.Callback inner) {
            this.inner = inner;
        }

        @Override
        public boolean onCreateActionMode(ActionMode mode, Menu menu) {
            boolean result = inner.onCreateActionMode(mode, menu);
            if (selectionMenuHidden) menu.clear();
            return result;
        }

        @Override
        public boolean onPrepareActionMode(ActionMode mode, Menu menu) {
            boolean result = inner.onPrepareActionMode(mode, menu);
            if (selectionMenuHidden) {
                menu.clear();
                return true;
            }
            return result;
        }

        @Override
        public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
            return inner.onActionItemClicked(mode, item);
        }

        @Override
        public void onDestroyActionMode(ActionMode mode) {
            inner.onDestroyActionMode(mode);
        }

        @Override
        public void onGetContentRect(ActionMode mode, View view, Rect outRect) {
            if (inner instanceof ActionMode.Callback2) {
                ((ActionMode.Callback2) inner).onGetContentRect(mode, view, outRect);
            } else {
                super.onGetContentRect(mode, view, outRect);
            }
        }
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

        String path = intent.getStringExtra(EXTRA_PATH);
        if (path != null && path.startsWith("/")) {
            target = SITE + path;
            intent.removeExtra(EXTRA_PATH);
        }

        Uri data = intent.getData();
        if (target == null && Intent.ACTION_VIEW.equals(intent.getAction()) && data != null
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
