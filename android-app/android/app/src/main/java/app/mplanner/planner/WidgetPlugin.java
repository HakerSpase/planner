package app.mplanner.planner;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Мост сайт → виджеты: планер присылает свежую сводку (серия, задачи, карточки),
 * мы кладём её в настройки приложения и перерисовываем виджеты на рабочем столе.
 */
@CapacitorPlugin(name = "PlannerWidget")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null || snapshot.isEmpty()) {
            call.reject("Нет сводки");
            return;
        }
        getContext()
                .getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(WidgetData.KEY, snapshot)
                .commit();
        WidgetData.refreshAll(getContext());
        call.resolve();
    }

    /** Забрать свежую сводку с сервера прямо сейчас (виджеты и напоминания) */
    @PluginMethod
    public void sync(PluginCall call) {
        SyncWorker.syncNow(getContext());
        call.resolve();
    }

    /** Есть ли у телефона токен для фонового обновления */
    @PluginMethod
    public void status(PluginCall call) {
        boolean has = getContext()
                .getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE)
                .getString(SyncWorker.KEY_TOKEN, null) != null;
        JSObject result = new JSObject();
        result.put("hasToken", has);
        call.resolve(result);
    }

    /** Токен только на чтение сводки + адрес сервера — для обновления, пока приложение закрыто */
    @PluginMethod
    public void setAuth(PluginCall call) {
        String token = call.getString("token");
        String url = call.getString("url");
        String key = call.getString("key");
        if (token == null || url == null || key == null) {
            call.reject("Нет данных");
            return;
        }
        getContext()
                .getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(SyncWorker.KEY_TOKEN, token)
                .putString(SyncWorker.KEY_URL, url)
                .putString(SyncWorker.KEY_ANON, key)
                .commit();
        SyncWorker.schedule(getContext());
        call.resolve();
    }
}
