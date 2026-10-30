package app.mplanner.planner;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/** Виджет 4×2 «Сегодня»: серия, задачи дня с прогрессом, ближайшая задача и что повторить */
public class TodayWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
    }

    static void render(Context context, AppWidgetManager manager, int[] ids) {
        WidgetData data = WidgetData.load(context);
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
            WidgetData.renderStreak(views, data);
            WidgetData.renderWeek(views, data);
            renderTasks(views, data);
            views.setOnClickPendingIntent(R.id.widget_root, WidgetData.open(context, "/i/tasks", 2));
            views.setOnClickPendingIntent(R.id.streak_column, WidgetData.open(context, "/i", 3));
            manager.updateAppWidget(id, views);
        }
    }

    private static void renderTasks(RemoteViews views, WidgetData data) {
        boolean fresh = data.hasData && data.staleDays == 0;
        views.setViewVisibility(R.id.tasks_block, fresh ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.stale_text, fresh ? View.GONE : View.VISIBLE);
        if (!fresh) {
            views.setTextViewText(
                    R.id.stale_text,
                    data.hasData ? "Новый день — открой Planner, и задачи обновятся" : "Открой Planner — здесь появится сводка дня");
            return;
        }

        // Всё сделано — вместо фиолетовой полоски зелёная, без лишних надписей
        boolean allDone = data.tasksTotal > 0 && data.tasksDone == data.tasksTotal;
        views.setViewVisibility(R.id.tasks_progress, allDone ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.tasks_progress_done, allDone ? View.VISIBLE : View.GONE);

        if (data.tasksTotal > 0) {
            views.setTextViewText(R.id.tasks_count, data.tasksDone + " из " + data.tasksTotal);
            views.setTextViewText(R.id.tasks_caption, WidgetData.plural(data.tasksTotal, "задача", "задачи", "задач"));
            views.setProgressBar(R.id.tasks_progress, data.tasksTotal, data.tasksDone, false);
        } else {
            views.setTextViewText(R.id.tasks_count, "Свободно");
            views.setTextViewText(R.id.tasks_caption, "задач на сегодня нет");
            views.setProgressBar(R.id.tasks_progress, 1, 0, false);
        }

        if (!data.nextTitle.isEmpty()) {
            views.setTextViewText(R.id.next_time, data.nextTime);
            views.setTextViewText(R.id.next_title, data.nextTitle);
            views.setViewVisibility(R.id.next_time, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.next_time, View.GONE);
            views.setTextViewText(R.id.next_title, "Ближайших дел по времени нет");
        }

        views.setViewVisibility(R.id.chip_overdue, data.overdue > 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.chip_overdue, data.overdue + " " + WidgetData.plural(data.overdue, "просрочена", "просрочены", "просрочено"));
        views.setViewVisibility(R.id.chip_cards, data.cardsDue > 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.chip_cards, data.cardsDue + " " + WidgetData.plural(data.cardsDue, "карточка", "карточки", "карточек"));
    }
}
