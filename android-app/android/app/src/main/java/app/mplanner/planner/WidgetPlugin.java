package app.mplanner.planner;

import android.content.Context;

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
}
