package org.qun.node

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class NodeAgentService : Service() {
    companion object {
        @Volatile var running: Boolean = false
        @Volatile var startedAtMs: Long = 0L
        const val CHANNEL_ID = "qun_node_status"
        const val NOTIFICATION_ID = 4201
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        running = true
        startedAtMs = System.currentTimeMillis()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        running = true
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "QUN Node", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Показывает, что мобильный агент QUN Node запущен"
                }
            )
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("QUN Node — тестовый агент")
            .setContentText("Локальный режим. Публичная сеть и вознаграждения выключены.")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
}
