package com.guanshi.app

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject

/**
 * 读取通知监听服务攒下的通知。App 在前台时直接推送事件，被杀时先落 spool，下次启动 drain。
 */
class GuanshiNotifyModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  init {
    activeContext = reactContext
  }

  override fun getName(): String = "GuanshiNotify"

  @ReactMethod
  fun drain(promise: Promise) {
    try {
      promise.resolve(readAndClear(reactApplicationContext))
    } catch (error: Exception) {
      promise.reject("EREAD", error.message ?: "读取通知失败")
    }
  }

  @ReactMethod
  fun isEnabled(promise: Promise) {
    val enabled = try {
      NotificationManagerCompat.getEnabledListenerPackages(reactApplicationContext)
          .contains(reactApplicationContext.packageName)
    } catch (_: Exception) {
      false
    }
    promise.resolve(enabled)
  }

  @ReactMethod
  fun openSettings() {
    try {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
    } catch (_: Exception) {
      // 部分 ROM 没有这个入口，交给 JS 打开应用设置
    }
  }

  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Int) = Unit

  override fun invalidate() {
    if (activeContext === reactApplicationContext) activeContext = null
    super.invalidate()
  }

  companion object {
    private const val PREFS = "guanshi_native"
    private const val KEY_SPOOL = "notification_spool"
    private const val MAX_ITEMS = 80
    private const val EVENT = "GuanshiNotificationPosted"

    @Volatile private var activeContext: ReactApplicationContext? = null

    fun enqueue(context: Context, item: JSONObject) {
      synchronized(this) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val array = try {
          JSONArray(prefs.getString(KEY_SPOOL, "[]"))
        } catch (_: Exception) {
          JSONArray()
        }
        array.put(item)
        while (array.length() > MAX_ITEMS) array.remove(0)
        prefs.edit().putString(KEY_SPOOL, array.toString()).apply()
      }
    }

    fun emitToJs(item: JSONObject) {
      val context = activeContext ?: return
      if (!context.hasActiveReactInstance()) return
      val map = Arguments.createMap()
      map.putString("packageName", item.optString("packageName"))
      map.putString("title", item.optString("title"))
      map.putString("text", item.optString("text"))
      map.putDouble("time", item.optLong("time").toDouble())
      context.emitDeviceEvent(EVENT, map)
    }

    fun trim(context: Context, olderThanMs: Long) {
      synchronized(this) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val array = try {
          JSONArray(prefs.getString(KEY_SPOOL, "[]"))
        } catch (_: Exception) {
          return
        }
        val now = System.currentTimeMillis()
        val kept = JSONArray()
        for (i in 0 until array.length()) {
          val item = array.optJSONObject(i) ?: continue
          if (now - item.optLong("time") <= olderThanMs) kept.put(item)
        }
        prefs.edit().putString(KEY_SPOOL, kept.toString()).apply()
      }
    }

    fun readAndClear(context: Context): WritableArray {
      val result = Arguments.createArray()
      synchronized(this) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val array = try {
          JSONArray(prefs.getString(KEY_SPOOL, "[]"))
        } catch (_: Exception) {
          JSONArray()
        }
        for (i in 0 until array.length()) {
          val item = array.optJSONObject(i) ?: continue
          val map: WritableMap = Arguments.createMap()
          map.putString("packageName", item.optString("packageName"))
          map.putString("title", item.optString("title"))
          map.putString("text", item.optString("text"))
          map.putDouble("time", item.optLong("time").toDouble())
          result.pushMap(map)
        }
        prefs.edit().putString(KEY_SPOOL, "[]").apply()
      }
      return result
    }
  }
}
