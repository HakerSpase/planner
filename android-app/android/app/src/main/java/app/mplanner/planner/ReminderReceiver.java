package app.mplanner.planner;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/** Напоминание о задаче, поставленное фоновым обновлением */
public class ReminderReceiver extends BroadcastReceiver {
    static final String EXTRA_ID = "id";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    private static final String CHANNEL = "planner-reminders";

    @Override
    public void onReceive(Context context, Intent intent) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (!manager.areNotificationsEnabled()) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL, "Напоминания о задачах", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Время задачи из Planner");
            context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }

        int id = intent.getIntExtra(EXTRA_ID, 1);
        Intent open = new Intent(context, MainActivity.class);
        open.putExtra(MainActivity.EXTRA_PATH, "/i/tasks");
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(
                context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(0xFF7C5CFF)
                .setContentTitle(intent.getStringExtra(EXTRA_TITLE))
                .setContentText(intent.getStringExtra(EXTRA_BODY))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(tap);
        try {
            manager.notify(id, notification.build());
        } catch (SecurityException ignored) {
            // нет разрешения на уведомления
        }
    }
}
