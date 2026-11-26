package com.guanshi.app

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * 周期任务：清理过期通知 spool，并给系统一次拉活机会。
 * 短信补采由 JS 在下次启动时按 lastSeen 完成，避免在 headless 环境里重复上报。
 */
class GuanshiCollectWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

  override fun doWork(): Result {
    return try {
      GuanshiNotifyModule.trim(applicationContext, 7 * 24 * 3600_000L)
      Result.success()
    } catch (_: Exception) {
      Result.retry()
    }
  }

  companion object {
    private const val NAME = "guanshi-collect"

    fun schedule(context: Context) {
      val constraints = Constraints.Builder()
          .setRequiresBatteryNotLow(true)
          .build()
      val request = PeriodicWorkRequestBuilder<GuanshiCollectWorker>(30, TimeUnit.MINUTES)
          .setConstraints(constraints)
          .build()
      WorkManager.getInstance(context)
          .enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }
  }
}
