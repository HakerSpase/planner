package app.mplanner.planner;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/** Виджет 2×2 «Серия»: сколько дней подряд ты что-то делаешь и неделя точками */
public class StreakWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetData data = WidgetData.load(context);
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_streak);
            WidgetData.renderStreak(views, data);
            WidgetData.renderWeek(views, data);
            views.setOnClickPendingIntent(R.id.widget_root, WidgetData.open(context, "/i", 1));
            manager.updateAppWidget(id, views);
        }
    }
}
