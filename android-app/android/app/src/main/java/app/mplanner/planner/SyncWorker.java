package app.mplanner.planner;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

/**
 * Фоновое обновление, пока приложение закрыто: раз в 15 минут забирает с сервера
 * короткую сводку (по личному токену только на чтение), перерисовывает виджеты
 * и ставит напоминания о задачах — даже если их добавили на компьютере.
 */
public class SyncWorker extends Worker {
    static final String KEY_TOKEN = "sync_token";
    static final String KEY_URL = "sync_url";
    static final String KEY_ANON = "sync_key";
    private static final String KEY_ALARMS = "scheduled_alarms";
    private static final String UNIQUE = "planner-sync";

    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    /** Включить периодическое обновление и сразу выполнить одно */
    static void schedule(Context context) {
        Constraints network = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager manager = WorkManager.getInstance(context.getApplicationContext());
        manager.enqueueUniquePeriodicWork(
                UNIQUE,
                ExistingPeriodicWorkPolicy.KEEP,
                new PeriodicWorkRequest.Builder(SyncWorker.class, 15, TimeUnit.MINUTES).setConstraints(network).build());
        syncNow(context);
    }

    static void syncNow(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE);
        if (prefs.getString(KEY_TOKEN, null) == null) return;
        Constraints network = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager.getInstance(context.getApplicationContext()).enqueueUniqueWork(
                UNIQUE + "-now",
                ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(SyncWorker.class).setConstraints(network).build());
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE);
        String token = prefs.getString(KEY_TOKEN, null);
        String base = prefs.getString(KEY_URL, null);
        String anon = prefs.getString(KEY_ANON, null);
        if (token == null || base == null || anon == null) return Result.success();

        try {
            String body = post(base + "/rest/v1/rpc/widget_snapshot", anon, "{\"p_token\":\"" + token + "\"}");
            if (body == null) return Result.retry();
            if (body.trim().equals("null")) {
                // Токен больше не действует — приложение выдаст новый при следующем открытии
                prefs.edit().remove(KEY_TOKEN).apply();
                return Result.success();
            }
            JSONObject server = new JSONObject(body);
            JSONObject snapshot = toSnapshot(server, prefs.getString(WidgetData.KEY, null));
            prefs.edit().putString(WidgetData.KEY, snapshot.toString()).commit();
            WidgetData.refreshAll(context);
            scheduleReminders(context, prefs, server.optJSONArray("reminders"));
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private static String post(String address, String anonKey, String json) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("apikey", anonKey);
        connection.setRequestProperty("Authorization", "Bearer " + anonKey);
        try (OutputStream out = connection.getOutputStream()) {
            out.write(json.getBytes(StandardCharsets.UTF_8));
        }
        int code = connection.getResponseCode();
        if (code < 200 || code >= 300) return null;
        try (InputStream in = connection.getInputStream()) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = in.read(chunk)) != -1) buffer.write(chunk, 0, read);
            return buffer.toString("UTF-8");
        } finally {
            connection.disconnect();
        }
    }

    /** Ответ сервера → сводка в том же виде, что присылает открытое приложение */
    private static JSONObject toSnapshot(JSONObject server, String previousRaw) throws Exception {
        SimpleDateFormat day = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        String today = server.optString("date", day.format(new Date()));
        Set<String> active = new HashSet<>();
        JSONArray days = server.optJSONArray("active");
        for (int i = 0; days != null && i < days.length(); i++) active.add(days.optString(i));

        Calendar cursor = Calendar.getInstance();
        cursor.setTime(day.parse(today));
        boolean todayActive = active.contains(today);
        boolean[] week = new boolean[7];
        Calendar w = (Calendar) cursor.clone();
        w.add(Calendar.DAY_OF_YEAR, -6);
        for (int i = 0; i < 7; i++) {
            week[i] = active.contains(day.format(w.getTime()));
            w.add(Calendar.DAY_OF_YEAR, 1);
        }
        // Серия: сегодня пусто — считаем со вчерашнего дня
        Calendar s = (Calendar) cursor.clone();
        if (!todayActive) s.add(Calendar.DAY_OF_YEAR, -1);
        int streak = 0;
        while (active.contains(day.format(s.getTime()))) {
            streak++;
            s.add(Calendar.DAY_OF_YEAR, -1);
        }
        int best = 0;
        int run = 0;
        Calendar b = (Calendar) cursor.clone();
        b.add(Calendar.DAY_OF_YEAR, -130);
        for (int i = 0; i <= 130; i++) {
            run = active.contains(day.format(b.getTime())) ? run + 1 : 0;
            best = Math.max(best, run);
            b.add(Calendar.DAY_OF_YEAR, 1);
        }

        JSONObject snapshot = new JSONObject();
        snapshot.put("date", today);
        snapshot.put("streak", streak);
        snapshot.put("best", best);
        snapshot.put("todayActive", todayActive);
        JSONArray weekJson = new JSONArray();
        for (boolean value : week) weekJson.put(value);
        snapshot.put("week", weekJson);
        snapshot.put("tasksDone", server.optInt("tasksDone"));
        snapshot.put("tasksTotal", server.optInt("tasksTotal"));
        snapshot.put("overdue", server.optInt("overdue"));

        String nextTitle = "";
        String nextTime = "";
        JSONObject next = server.optJSONObject("next");
        if (next != null) {
            nextTitle = next.optString("name", "");
            Date due = parseIso(next.optString("dueAt", ""));
            if (due != null) nextTime = describeDue(due);
        }
        snapshot.put("nextTitle", nextTitle);
        snapshot.put("nextTime", nextTime);

        // Новые карточки сервер не видит (они живут в тексте листов) — берём число из приложения
        int cards = server.optInt("cardsReviewDue");
        if (previousRaw != null) {
            try {
                cards = Math.max(cards, new JSONObject(previousRaw).optInt("cardsDue"));
            } catch (Exception ignored) {
            }
        }
        snapshot.put("cardsDue", cards);
        snapshot.put("updatedAt", System.currentTimeMillis());
        return snapshot;
    }

    static Date parseIso(String value) {
        if (value == null || value.isEmpty()) return null;
        String normalized = value.replaceAll("\\.\\d+", "").replaceAll("([+-]\\d{2}):(\\d{2})$", "$1$2").replace("Z", "+0000");
        try {
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", Locale.US);
            format.setTimeZone(TimeZone.getTimeZone("UTC"));
            return format.parse(normalized);
        } catch (Exception e) {
            return null;
        }
    }

    private static String clock(Date date) {
        return new SimpleDateFormat("HH:mm", Locale.US).format(date);
    }

    /** «18:00», «завтра 09:30», «5 нояб. 18:00» — как в приложении */
    private static String describeDue(Date due) {
        Calendar now = Calendar.getInstance();
        Calendar then = Calendar.getInstance();
        then.setTime(due);
        Calendar a = (Calendar) now.clone();
        int diff = 0;
        while (diff < 400 && (a.get(Calendar.YEAR) != then.get(Calendar.YEAR)
                || a.get(Calendar.DAY_OF_YEAR) != then.get(Calendar.DAY_OF_YEAR))) {
            a.add(Calendar.DAY_OF_YEAR, 1);
            diff++;
        }
        if (diff == 0) return clock(due);
        if (diff == 1) return "завтра " + clock(due);
        return new SimpleDateFormat("d MMM", new Locale("ru")).format(due) + " " + clock(due);
    }

    /* ---------- Напоминания ---------- */

    // Тот же номер уведомления, что и у приложения, — чтобы одно напоминание не пришло дважды
    static int notificationId(String key) {
        int hash = 7;
        for (int i = 0; i < key.length(); i++) hash = hash * 31 + key.charAt(i);
        return Math.abs(hash % 2_000_000_000) + 10;
    }

    private static String describeReminder(int offset, Date due) {
        String time = clock(due);
        if (offset == 0) return "Сейчас · " + time;
        if (offset < 60) return "Через " + offset + " мин · в " + time;
        int hours = offset / 60;
        int minutes = offset % 60;
        return "Через " + hours + " ч" + (minutes > 0 ? " " + minutes + " мин" : "") + " · в " + time;
    }

    private static void scheduleReminders(Context context, SharedPreferences prefs, JSONArray reminders) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null || reminders == null) return;
        Set<String> previous = new HashSet<>(prefs.getStringSet(KEY_ALARMS, new HashSet<>()));
        Set<String> current = new HashSet<>();
        long now = System.currentTimeMillis();

        for (int i = 0; i < reminders.length(); i++) {
            JSONObject item = reminders.optJSONObject(i);
            if (item == null) continue;
            String dueRaw = item.optString("dueAt", "");
            Date due = parseIso(dueRaw);
            if (due == null) continue;
            int offset = item.optInt("offset");
            long at = due.getTime() - offset * 60_000L;
            if (at <= now) continue;
            String key = item.optString("taskId") + ":" + dueRaw + ":" + offset;
            int id = notificationId(key);
            String title = item.optString("name", "");
            if (title.isEmpty()) title = "Задача";

            Intent intent = new Intent(context, ReminderReceiver.class);
            intent.putExtra(ReminderReceiver.EXTRA_ID, id);
            intent.putExtra(ReminderReceiver.EXTRA_TITLE, title);
            intent.putExtra(ReminderReceiver.EXTRA_BODY, describeReminder(offset, due));
            PendingIntent pending = PendingIntent.getBroadcast(
                    context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms();
            if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
            current.add(String.valueOf(id));
        }

        // Задачу удалили, выполнили или перенесли — старое напоминание снимаем
        for (String old : previous) {
            if (current.contains(old)) continue;
            int id = Integer.parseInt(old);
            PendingIntent pending = PendingIntent.getBroadcast(
                    context, id, new Intent(context, ReminderReceiver.class),
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (pending != null) alarms.cancel(pending);
        }
        prefs.edit().putStringSet(KEY_ALARMS, current).apply();
    }
}
