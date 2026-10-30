package app.mplanner.planner;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Сводка для виджетов. Её присылает планер, пока он открыт; если с тех пор
 * наступил новый день — сдвигаем неделю и проверяем, жива ли серия.
 */
public class WidgetData {
    static final String PREFS = "planner_widget";
    static final String KEY = "snapshot";

    boolean hasData;
    /** Сколько дней прошло со сводки: 0 — она сегодняшняя */
    int staleDays;
    int streak;
    int best;
    boolean todayActive;
    boolean[] week = new boolean[7];
    int tasksDone;
    int tasksTotal;
    int overdue;
    int cardsDue;
    String nextTitle = "";
    String nextTime = "";

    static WidgetData load(Context context) {
        WidgetData data = new WidgetData();
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
        if (raw == null) return data;
        try {
            JSONObject json = new JSONObject(raw);
            data.hasData = true;
            data.streak = json.optInt("streak");
            data.best = json.optInt("best");
            data.todayActive = json.optBoolean("todayActive");
            JSONArray week = json.optJSONArray("week");
            for (int i = 0; week != null && i < 7 && i < week.length(); i++) data.week[i] = week.optBoolean(i);
            data.tasksDone = json.optInt("tasksDone");
            data.tasksTotal = json.optInt("tasksTotal");
            data.overdue = json.optInt("overdue");
            data.cardsDue = json.optInt("cardsDue");
            data.nextTitle = json.optString("nextTitle", "");
            data.nextTime = json.optString("nextTime", "");
            data.staleDays = daysSince(json.optString("date", ""));
        } catch (Exception e) {
            data.hasData = false;
            return data;
        }

        if (data.staleDays > 0) {
            // Серия жива, только если в день сводки уже была активность и прошёл ровно день
            data.streak = data.staleDays == 1 && data.todayActive ? data.streak : 0;
            data.todayActive = false;
            boolean[] shifted = new boolean[7];
            for (int i = 0; i < 7; i++) {
                int from = i + data.staleDays;
                shifted[i] = from < 7 && data.week[from];
            }
            data.week = shifted;
        }
        return data;
    }

    private static int daysSince(String date) {
        try {
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            Date then = format.parse(date);
            if (then == null) return 0;
            Calendar a = Calendar.getInstance();
            a.setTime(then);
            Calendar b = Calendar.getInstance();
            int days = 0;
            while (a.get(Calendar.YEAR) < b.get(Calendar.YEAR)
                    || (a.get(Calendar.YEAR) == b.get(Calendar.YEAR)
                    && a.get(Calendar.DAY_OF_YEAR) < b.get(Calendar.DAY_OF_YEAR))) {
                a.add(Calendar.DAY_OF_YEAR, 1);
                if (++days > 30) break;
            }
            return days;
        } catch (Exception e) {
            return 0;
        }
    }

    /** «1 день», «3 дня», «7 дней» */
    static String plural(int n, String one, String few, String many) {
        int mod10 = n % 10;
        int mod100 = n % 100;
        if (mod10 == 1 && mod100 != 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
    }

    /** Буквы дней недели для последних 7 дней, сегодня — последняя */
    static String[] weekLetters() {
        String[] letters = {"В", "П", "В", "С", "Ч", "П", "С"}; // Calendar.SUNDAY = 1
        String[] out = new String[7];
        Calendar day = Calendar.getInstance();
        day.add(Calendar.DAY_OF_YEAR, -6);
        for (int i = 0; i < 7; i++) {
            out[i] = letters[day.get(Calendar.DAY_OF_WEEK) - 1];
            day.add(Calendar.DAY_OF_YEAR, 1);
        }
        return out;
    }

    /** Нажатие на виджет — открыть нужный раздел планера */
    static PendingIntent open(Context context, String path, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra(MainActivity.EXTRA_PATH, path);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
                context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Точки недели и подписи — общие для обоих виджетов */
    static void renderWeek(RemoteViews views, WidgetData data) {
        int[] dots = {R.id.dot0, R.id.dot1, R.id.dot2, R.id.dot3, R.id.dot4, R.id.dot5, R.id.dot6};
        int[] labels = {R.id.day0, R.id.day1, R.id.day2, R.id.day3, R.id.day4, R.id.day5, R.id.day6};
        String[] letters = weekLetters();
        for (int i = 0; i < 7; i++) {
            boolean today = i == 6;
            int drawable = data.week[i]
                    ? R.drawable.widget_dot_on
                    : today ? R.drawable.widget_dot_today : R.drawable.widget_dot_off;
            views.setImageViewResource(dots[i], drawable);
            views.setTextViewText(labels[i], letters[i]);
            views.setTextColor(labels[i], today ? 0xFFE8E6F0 : 0xFF6E6B7B);
        }
    }

    static void renderStreak(RemoteViews views, WidgetData data) {
        views.setTextViewText(R.id.streak_value, String.valueOf(data.streak));
        views.setImageViewResource(
                R.id.streak_flame,
                data.todayActive ? R.drawable.widget_flame : data.streak > 0 ? R.drawable.widget_flame_wait : R.drawable.widget_flame_off);
        String label;
        if (!data.hasData) label = "открой Planner";
        else if (data.todayActive) label = plural(data.streak, "день подряд", "дня подряд", "дней подряд");
        else if (data.streak > 0) label = "продли сегодня";
        else label = "начни серию";
        views.setTextViewText(R.id.streak_label, label);
        views.setTextColor(R.id.streak_label, !data.todayActive && data.streak > 0 ? 0xFFFFB37A : 0xFF9A98A8);
    }

    /** Перерисовать все виджеты сразу — напрямую, без широковещательных сообщений */
    static void refreshAll(Context context) {
        Context app = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(app);
        int[] streak = manager.getAppWidgetIds(new ComponentName(app, StreakWidget.class));
        if (streak.length > 0) StreakWidget.render(app, manager, streak);
        int[] today = manager.getAppWidgetIds(new ComponentName(app, TodayWidget.class));
        if (today.length > 0) TodayWidget.render(app, manager, today);
    }
}
