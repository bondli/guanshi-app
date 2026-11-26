package com.guanshi.app

import android.content.Context
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * 短信采集：ContentObserver 监听新短信；App 被杀期间错过的，用 getSince 补采。
 * 原文只在本机做正则预筛，命中后再交给 JS 上报。
 */
class GuanshiSmsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private val prefs = reactApplicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private val handler = Handler(Looper.getMainLooper())
  private var observer: ContentObserver? = null

  init {
    try {
      observer = object : ContentObserver(handler) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
          // 新短信可能连续到达，延迟一点批量取
          handler.postDelayed({ emitRecent() }, 800)
        }
      }.also {
        reactApplicationContext.contentResolver.registerContentObserver(
            Uri.parse("content://sms/"), true, it,
        )
      }
    } catch (_: Exception) {
      // 没有权限时注册失败，等待用户授权后由 JS 主动补采
    }
  }

  override fun getName(): String = "GuanshiSms"

  @ReactMethod
  fun hasPermission(promise: Promise) {
    promise.resolve(hasReadPermission())
  }

  @ReactMethod
  fun lastSeen(promise: Promise) {
    promise.resolve(prefs.getLong(KEY_LAST_SEEN, 0L).toDouble())
  }

  @ReactMethod
  fun markSeen(ts: Double) {
    prefs.edit().putLong(KEY_LAST_SEEN, ts.toLong()).apply()
  }

  @ReactMethod
  fun getSince(since: Double, promise: Promise) {
    if (!hasReadPermission()) {
      promise.reject("EPERM", "没有短信权限")
      return
    }
    try {
      promise.resolve(query(since.toLong()))
    } catch (error: Exception) {
      promise.reject("EQUERY", error.message ?: "读取短信失败")
    }
  }

  private fun emitRecent() {
    if (!hasReadPermission()) return
    val last = prefs.getLong(KEY_LAST_SEEN, 0L)
    if (last <= 0) return
    try {
      val items = query(last)
      if (items.size() == 0) return
      var newest = last
      for (i in 0 until items.size()) {
        val item = items.getMap(i) ?: continue
        if (reactApplicationContext.hasActiveReactInstance()) {
          reactApplicationContext.emitDeviceEvent(EVENT, item)
        }
        newest = maxOf(newest, (item.getDouble("date")).toLong())
      }
      prefs.edit().putLong(KEY_LAST_SEEN, newest).apply()
    } catch (_: Exception) {
      // 忽略，下次启动补采
    }
  }

  private fun query(since: Long): WritableArray {
    val result = Arguments.createArray()
    val cursor = reactApplicationContext.contentResolver.query(
        Uri.parse("content://sms/inbox"),
        arrayOf("address", "body", "date"),
        "date > ?",
        arrayOf(since.toString()),
        "date ASC",
    ) ?: return result
    cursor.use {
      val addressIndex = it.getColumnIndex("address")
      val bodyIndex = it.getColumnIndex("body")
      val dateIndex = it.getColumnIndex("date")
      var count = 0
      while (it.moveToNext() && count < 80) {
        val body = it.getString(bodyIndex) ?: continue
        val map: WritableMap = Arguments.createMap()
        map.putString("address", it.getString(addressIndex) ?: "")
        map.putString("body", body)
        map.putDouble("date", it.getLong(dateIndex).toDouble())
        result.pushMap(map)
        count += 1
      }
    }
    return result
  }

  private fun hasReadPermission(): Boolean =
      ContextCompat.checkSelfPermission(
          reactApplicationContext,
          android.Manifest.permission.READ_SMS,
      ) == PackageManager.PERMISSION_GRANTED

  override fun invalidate() {
    observer?.let {
      try {
        reactApplicationContext.contentResolver.unregisterContentObserver(it)
      } catch (_: Exception) {
        // ignore
      }
    }
    observer = null
    super.invalidate()
  }

  companion object {
    private const val PREFS = "guanshi_native"
    private const val KEY_LAST_SEEN = "sms_last_seen"
    private const val EVENT = "GuanshiSmsReceived"
  }
}
