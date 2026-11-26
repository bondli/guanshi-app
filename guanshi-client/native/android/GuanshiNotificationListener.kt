package com.guanshi.app

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONObject

/**
 * 通知监听：只把标题与正文拼起来放进本地 spool，不保存图片、不读取敏感字段。
 * 云端拿到的是识别后的待办，而不是通知原文。
 */
class GuanshiNotificationListener : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    try {
      if (sbn.packageName == packageName) return
      if (sbn.isOngoing) return
      val notification = sbn.notification ?: return
      if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
      val extras = notification.extras ?: return
      val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
      var text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
      val big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim().orEmpty()
      if (big.length > text.length) text = big
      val combined = listOf(title, text).filter { it.isNotBlank() }.joinToString(" ").trim()
      if (combined.length < 6) return
      if (combined.contains("管事")) return

      val item = JSONObject()
          .put("packageName", sbn.packageName)
          .put("title", title)
          .put("text", text)
          .put("time", sbn.postTime)
      GuanshiNotifyModule.enqueue(applicationContext, item)
      GuanshiNotifyModule.emitToJs(item)
    } catch (error: Exception) {
      Log.w("GuanshiNotify", "read notification failed", error)
    }
  }
}
