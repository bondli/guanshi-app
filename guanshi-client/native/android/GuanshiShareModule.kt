package com.guanshi.app

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.util.UUID

/**
 * 接收其他 App 分享进来的链接/文字/图片。
 * 冷启动由 JS 调 getPendingShare 拉取；热启动通过 DeviceEventEmitter 推送。
 */
class GuanshiShareModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var pickPromise: Promise? = null

  private val activityListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
    ) {
      if (requestCode != PICK_REQUEST) return
      val promise = pickPromise ?: return
      pickPromise = null
      if (resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return
      }
      val uri = data?.data ?: return promise.resolve(null)
      val mime = activity.contentResolver.getType(uri) ?: "image/jpeg"
      val path = copyImage(activity, uri, mime)
      if (path == null) promise.reject("ECOPY", "读取图片失败")
      else promise.resolve(payload("image", null, path, mime, System.currentTimeMillis()))
    }
  }

  init {
    reactApplicationContext.addActivityEventListener(activityListener)
    instance = this
  }

  override fun getName(): String = NAME

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(activityListener)
    if (instance === this) instance = null
    super.invalidate()
  }

  // NativeEventEmitter 兼容；实际事件走 DeviceEventEmitter
  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Int) = Unit

  @ReactMethod
  fun getPendingShare(promise: Promise) {
    promise.resolve(pending)
  }

  @ReactMethod
  fun clearPendingShare() {
    pending = null
  }

  /**
   * 读剪贴板文本。
   * 微信文章没有系统分享入口，只能「复制链接」再回到本应用，由 JS 侧识别。
   * Android 10+ 只允许前台应用读取，调用方需确保应用已获得焦点。
   */
  @ReactMethod
  fun readClipboard(promise: Promise) {
    try {
      val manager =
          reactApplicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val clip = manager.primaryClip
      val text =
          if (clip != null && clip.itemCount > 0) {
            clip.getItemAt(0)?.coerceToText(reactApplicationContext)?.toString()
          } else {
            null
          }
      promise.resolve(text)
    } catch (error: Exception) {
      Log.w("GuanshiShare", "read clipboard failed", error)
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun pickImage(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("EACTIVITY", "当前没有可用页面")
      return
    }
    if (pickPromise != null) {
      promise.reject("EBUSY", "已有图片选择进行中")
      return
    }
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "image/*"
    }
    pickPromise = promise
    try {
      activity.startActivityForResult(intent, PICK_REQUEST)
    } catch (error: Exception) {
      pickPromise = null
      promise.reject("EINTENT", error.message ?: "无法打开图片选择器", error)
    }
  }

  /** 把原文写回剪贴板，配合 openApp 实现「复制原内容 → 打开 App」 */
  @ReactMethod
  fun writeClipboard(text: String, promise: Promise) {
    try {
      val manager =
          reactApplicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      manager.setPrimaryClip(ClipData.newPlainText("guanshi", text))
      promise.resolve(true)
    } catch (error: Exception) {
      Log.w("GuanshiShare", "write clipboard failed", error)
      promise.resolve(false)
    }
  }

  /** 按包名启动已安装的 App；没装返回 false */
  @ReactMethod
  fun openApp(packageName: String, promise: Promise) {
    try {
      val intent = reactApplicationContext.packageManager.getLaunchIntentForPackage(packageName)
      if (intent == null) {
        promise.resolve(false)
        return
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      Log.w("GuanshiShare", "open app failed package=$packageName", error)
      promise.resolve(false)
    }
  }

  private fun emit(map: WritableMap) {
    if (reactApplicationContext.hasActiveReactInstance()) {
      reactApplicationContext.emitDeviceEvent(EVENT, map)
    }
  }

  companion object {
    private const val NAME = "GuanshiShare"
    private const val EVENT = "GuanshiShareReceived"
    private const val PICK_REQUEST = 61231

    private var instance: GuanshiShareModule? = null
    private var pending: WritableMap? = null

    /** MainActivity 收到 ACTION_SEND 后调用 */
    fun capture(activity: Activity, intent: Intent?) {
      if (intent == null) return
      if (intent.action != Intent.ACTION_SEND && intent.action != Intent.ACTION_SEND_MULTIPLE) return
      val map = buildPayload(activity, intent) ?: return
      val module = instance
      if (module != null && module.reactApplicationContext.hasActiveReactInstance()) {
        pending = null
        module.emit(map)
      } else {
        pending = map
      }
    }

    private fun buildPayload(context: Context, intent: Intent): WritableMap? {
      val type = intent.type ?: ""
      if (type.startsWith("image/")) {
        val uri = streamUri(intent) ?: return null
        val path = copyImage(context, uri, type) ?: return null
        return payload("image", null, path, type, System.currentTimeMillis())
      }
      if (type.startsWith("text/") || type.isEmpty()) {
        val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim()
        if (text.isNullOrEmpty()) return null
        return payload("text", text, null, type.ifEmpty { "text/plain" }, System.currentTimeMillis())
      }
      return null
    }

    private fun streamUri(intent: Intent): Uri? {
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            ?: intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)?.firstOrNull()
      } else {
        @Suppress("DEPRECATION")
        (intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri)
            ?: @Suppress("DEPRECATION")
            (intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.firstOrNull())
      }
    }

    private fun copyImage(context: Context, uri: Uri, mime: String): String? {
      return try {
        val dir = File(context.filesDir, "shares")
        if (!dir.exists() && !dir.mkdirs()) return null
        val ext = when {
          mime.contains("png", true) -> "png"
          mime.contains("webp", true) -> "webp"
          mime.contains("gif", true) -> "gif"
          else -> "jpg"
        }
        val target = File(dir, "${UUID.randomUUID()}.$ext")
        context.contentResolver.openInputStream(uri)?.use { input ->
          target.outputStream().use { output -> input.copyTo(output) }
        } ?: return null
        Log.d("GuanshiShare", "copied ${target.absolutePath} size=${target.length()} mime=$mime")
        target.absolutePath
      } catch (error: Exception) {
        Log.e("GuanshiShare", "copy image failed uri=$uri", error)
        null
      }
    }

    private fun payload(
        kind: String,
        text: String?,
        path: String?,
        mime: String?,
        receivedAt: Long,
    ): WritableMap {
      val map = Arguments.createMap()
      map.putString("kind", kind)
      if (text != null) map.putString("text", text)
      if (path != null) map.putString("path", path)
      if (mime != null) map.putString("mimeType", mime)
      map.putDouble("receivedAt", receivedAt.toDouble())
      return map
    }
  }
}
