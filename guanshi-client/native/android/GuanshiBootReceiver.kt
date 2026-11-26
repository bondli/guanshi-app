package com.guanshi.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** 开机后恢复周期补采，尽量让采集链路自己醒过来 */
class GuanshiBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
    try {
      GuanshiCollectWorker.schedule(context)
    } catch (_: Exception) {
      // 忽略，用户下次打开 App 会再调度
    }
  }
}
