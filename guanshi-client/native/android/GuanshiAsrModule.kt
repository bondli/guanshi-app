package com.guanshi.app

import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * 语音听写：
 * 1. 讯飞 IAT 流式版（16k PCM 经 WebSocket 上送），配置凭证时优先；
 * 2. Android SpeechRecognizer 兜底。
 * 结果通过 GuanshiSpeechPartial 事件抛给 JS，最终文本由 Promise 结算。
 */
class GuanshiAsrModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private val mainHandler = Handler(Looper.getMainLooper())
  private var pending: Promise? = null
  private var backend: String? = null

  private var recognizer: SpeechRecognizer? = null
  private var lastText = ""
  private var readyForSpeech = false
  private var startTimeout: Runnable? = null
  private var stopTimeout: Runnable? = null

  private var httpClient: OkHttpClient? = null
  private var socket: WebSocket? = null
  private var recorder: AudioRecord? = null
  private var recordThread: Thread? = null
  private val cloudText = StringBuilder()
  private var sequence = 0
  private var connectTimeout: Runnable? = null
  private var idleTimeout: Runnable? = null
  private var finishGuard: Runnable? = null
  @Volatile private var stopRequested = false
  @Volatile private var finalSent = false
  @Volatile private var firstFrameSent = false
  @Volatile private var socketOpen = false

  override fun getName(): String = NAME

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactApplicationContext))
  }

  @ReactMethod
  fun start(promise: Promise) {
    if (pending != null) {
      promise.reject("EBUSY", "正在聆听中")
      return
    }
    if (!SpeechRecognizer.isRecognitionAvailable(reactApplicationContext)) {
      promise.reject("EUNAVAILABLE", "设备没有语音识别服务")
      return
    }
    pending = promise
    backend = "system"
    lastText = ""
    mainHandler.post {
      try {
        destroyRecognizer()
        val host: Context = reactApplicationContext.currentActivity ?: reactApplicationContext
        val instance = SpeechRecognizer.createSpeechRecognizer(host)
        recognizer = instance
        instance.setRecognitionListener(listener)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN")
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }
        instance.startListening(intent)
        scheduleStartTimeout()
      } catch (error: Exception) {
        fail("ESTART", error.message ?: "无法启动语音识别")
      }
    }
  }

  @ReactMethod
  fun startCloud(appId: String?, apiKey: String?, apiSecret: String?, promise: Promise) {
    if (pending != null) {
      promise.reject("EBUSY", "正在聆听中")
      return
    }
    if (appId.isNullOrBlank() || apiKey.isNullOrBlank() || apiSecret.isNullOrBlank()) {
      promise.reject("ENOCRED", "缺少讯飞语音识别凭证")
      return
    }
    pending = promise
    backend = "cloud"
    val session = ++sequence
    cloudText.setLength(0)
    stopRequested = false
    finalSent = false
    firstFrameSent = false
    socketOpen = false
    mainHandler.post {
      try {
        startRecorder(session, appId)
        val request = Request.Builder().url(buildAuthUrl(apiKey, apiSecret)).build()
        socket = client().newWebSocket(request, cloudListener(session))
        scheduleConnectTimeout(session)
      } catch (error: Exception) {
        fail("ESTART", error.message ?: "无法连接语音识别服务")
      }
    }
  }

  @ReactMethod
  fun stop() {
    mainHandler.post {
      if (backend == "cloud") {
        if (pending == null) return@post
        stopRequested = true
        sendFinalFrame()
        return@post
      }
      val instance = recognizer
      if (instance == null) {
        settle(lastText)
        return@post
      }
      try {
        instance.stopListening()
      } catch (_: Exception) {
        destroyRecognizer()
        settle(lastText)
        return@post
      }
      clearStopTimeout()
      stopTimeout = Runnable {
        if (pending != null) {
          val text = lastText
          destroyRecognizer()
          emit(text, final = true)
          settle(text)
        }
      }.also { mainHandler.postDelayed(it, 1_500) }
    }
  }

  @ReactMethod
  fun cancel() {
    mainHandler.post {
      val promise = pending
      pending = null
      sequence += 1
      cleanupCloud()
      destroyRecognizer()
      clearTimeouts()
      lastText = ""
      backend = null
      promise?.resolve("")
    }
  }

  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Int) = Unit

  override fun invalidate() {
    mainHandler.post {
      sequence += 1
      cleanupCloud()
      destroyRecognizer()
      clearTimeouts()
      pending?.resolve("")
      pending = null
      backend = null
    }
    super.invalidate()
  }

  // ---------------- 讯飞云听写 ----------------

  private fun client(): OkHttpClient =
      httpClient ?: OkHttpClient.Builder()
          .connectTimeout(10, TimeUnit.SECONDS)
          .readTimeout(0, TimeUnit.MILLISECONDS)
          .build()
          .also { httpClient = it }

  private fun buildAuthUrl(apiKey: String, apiSecret: String): String {
    val host = "iat-api.xfyun.cn"
    val path = "/v2/iat"
    val date = SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US)
        .apply { timeZone = TimeZone.getTimeZone("GMT") }
        .format(Date())
    val origin = "host: $host\ndate: $date\nGET $path HTTP/1.1"
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(apiSecret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
    val signature = Base64.encodeToString(mac.doFinal(origin.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
    val authOrigin =
        "api_key=\"$apiKey\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"$signature\""
    val authorization = Base64.encodeToString(authOrigin.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
    return "wss://$host$path?authorization=${encode(authorization)}&date=${encode(date)}&host=${encode(host)}"
  }

  private fun encode(value: String): String =
      URLEncoder.encode(value, "UTF-8").replace("+", "%20")

  private fun cloudListener(session: Int) = object : WebSocketListener() {
    override fun onOpen(webSocket: WebSocket, response: Response) {
      mainHandler.post {
        if (session != sequence || pending == null) return@post
        socketOpen = true
        clearConnectTimeout()
        scheduleIdleTimeout(session)
      }
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
      mainHandler.post {
        if (session != sequence) return@post
        handleCloudMessage(session, text)
      }
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
      mainHandler.post {
        if (session != sequence || pending == null) return@post
        val text = cloudText.toString().trim()
        if (text.isNotEmpty()) {
          cleanupCloud()
          emit(text, final = true)
          settle(text)
        } else {
          fail("ENETWORK", "语音识别连接失败，请检查网络")
        }
      }
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
      mainHandler.post {
        if (session != sequence || pending == null) return@post
        finishCloud()
      }
    }
  }

  private fun startRecorder(session: Int, appId: String) {
    if (recorder != null) return
    val minBuffer = AudioRecord.getMinBufferSize(
        SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
    )
    val bufferSize = maxOf(minBuffer, FRAME_BYTES * 4)
    val record = try {
      AudioRecord(
          MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE,
          AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize,
      )
    } catch (error: Exception) {
      fail("EAUDIO", "无法打开麦克风")
      return
    }
    if (record.state != AudioRecord.STATE_INITIALIZED) {
      record.release()
      fail("EAUDIO", "麦克风不可用")
      return
    }
    recorder = record
    try {
      record.startRecording()
    } catch (error: Exception) {
      record.release()
      recorder = null
      fail("EAUDIO", "麦克风启动失败")
      return
    }

    recordThread = Thread {
      val buffer = ByteArray(FRAME_BYTES)
      val queue = ArrayDeque<String>()
      fun drain() {
        while (queue.isNotEmpty()) {
          val audio = queue.removeFirst()
          val payload = if (firstFrameSent) frame(1, audio) else firstFrame(appId, audio)
          firstFrameSent = true
          socket?.send(payload)
        }
      }
      try {
        while (!stopRequested && session == sequence) {
          val read = record.read(buffer, 0, buffer.size)
          if (read > 0) {
            queue.addLast(Base64.encodeToString(buffer, 0, read, Base64.NO_WRAP))
            while (queue.size > MAX_BUFFER_FRAMES) queue.removeFirst()
            if (socketOpen) drain()
          } else if (read < 0) {
            break
          }
        }
      } catch (_: Exception) {
        // 录音释放时忽略
      } finally {
        if (socketOpen && session == sequence) drain()
        sendFinalFrame()
      }
    }.also { it.start() }
  }

  private fun firstFrame(appId: String, audio: String): String {
    val common = JSONObject().put("app_id", appId)
    val business = JSONObject()
        .put("language", "zh_cn").put("domain", "iat")
        .put("accent", "mandarin").put("vad_eos", 3000).put("nunum", 0)
    val data = JSONObject()
        .put("status", 0).put("format", "audio/L16;rate=16000")
        .put("encoding", "raw").put("audio", audio)
    return JSONObject().put("common", common).put("business", business).put("data", data).toString()
  }

  private fun frame(status: Int, audio: String): String =
      JSONObject().put(
          "data",
          JSONObject().put("status", status).put("format", "audio/L16;rate=16000")
              .put("encoding", "raw").put("audio", audio),
      ).toString()

  private fun sendFinalFrame() {
    synchronized(this) {
      if (finalSent) return
      finalSent = true
    }
    if (!firstFrameSent) {
      mainHandler.post { if (pending != null) finishCloud() }
      return
    }
    socket?.send(frame(2, ""))
    mainHandler.post { scheduleFinishGuard() }
  }

  private fun handleCloudMessage(session: Int, text: String) {
    val json = try {
      JSONObject(text)
    } catch (_: Exception) {
      return
    }
    val code = json.optInt("code", -1)
    if (code != 0) {
      fail(asrCode(code), asrMessage(code, json.optString("message")))
      return
    }
    val data = json.optJSONObject("data") ?: return
    val result = data.optJSONObject("result")
    if (result != null) {
      val piece = readPiece(result)
      if (piece.isNotEmpty()) {
        if (result.optString("pgs") == "rpl") {
          val rg = result.optJSONArray("rg")
          val from = rg?.optInt(0, 0) ?: 0
          val to = rg?.optInt(1, 0) ?: 0
          if (from in 0..to && to <= cloudText.length) {
            cloudText.delete(from, to)
            cloudText.insert(from, piece)
          } else {
            cloudText.append(piece)
          }
        } else {
          cloudText.append(piece)
        }
        emit(cloudText.toString(), final = false)
        scheduleIdleTimeout(session)
      }
    }
    if (data.optInt("status", 0) == 2) finishCloud()
  }

  private fun readPiece(result: JSONObject): String {
    val ws = result.optJSONArray("ws") ?: return ""
    val builder = StringBuilder()
    for (i in 0 until ws.length()) {
      val cw = ws.optJSONObject(i)?.optJSONArray("cw") ?: continue
      for (j in 0 until cw.length()) {
        val word = cw.optJSONObject(j)?.optString("w") ?: ""
        if (word.isNotEmpty()) builder.append(word)
      }
    }
    return builder.toString()
  }

  private fun finishCloud() {
    val text = cloudText.toString().trim()
    cleanupCloud()
    if (text.isEmpty()) fail("ENORESULT", "没有识别到语音")
    else {
      emit(text, final = true)
      settle(text)
    }
  }

  private fun cleanupCloud() {
    stopRequested = true
    clearTimeouts()
    try { socket?.cancel() } catch (_: Exception) { }
    socket = null
    try { recorder?.stop() } catch (_: Exception) { }
    try { recorder?.release() } catch (_: Exception) { }
    recorder = null
    recordThread?.interrupt()
    recordThread = null
    socketOpen = false
  }

  private fun scheduleConnectTimeout(session: Int) {
    clearConnectTimeout()
    connectTimeout = Runnable {
      if (session == sequence && !socketOpen && pending != null) {
        fail("ENETWORK", "语音识别服务连接超时，请检查网络")
      }
    }.also { mainHandler.postDelayed(it, 10_000) }
  }

  private fun scheduleIdleTimeout(session: Int) {
    clearIdleTimeout()
    idleTimeout = Runnable {
      if (session != sequence || pending == null) return@Runnable
      if (cloudText.isEmpty()) fail("ETIMEOUT", "语音识别没有响应") else finishCloud()
    }.also { mainHandler.postDelayed(it, 12_000) }
  }

  private fun scheduleFinishGuard() {
    clearFinishGuard()
    finishGuard = Runnable { if (pending != null) finishCloud() }
        .also { mainHandler.postDelayed(it, 2_500) }
  }

  private fun clearConnectTimeout() {
    connectTimeout?.let { mainHandler.removeCallbacks(it) }
    connectTimeout = null
  }

  private fun clearIdleTimeout() {
    idleTimeout?.let { mainHandler.removeCallbacks(it) }
    idleTimeout = null
  }

  private fun clearFinishGuard() {
    finishGuard?.let { mainHandler.removeCallbacks(it) }
    finishGuard = null
  }

  private fun asrCode(code: Int): String = when (code) {
    10105, 10106, 10107, 10110, 10111, 10313 -> "EAUTH"
    10114 -> "ENETWORK"
    10163, 11200, 11201 -> "EQUOTA"
    else -> "EASR"
  }

  private fun asrMessage(code: Int, raw: String): String = when (asrCode(code)) {
    "EAUTH" -> "讯飞凭证无效，请检查 APPID / APIKey / APISecret"
    "ENETWORK" -> "语音识别服务连接失败，请检查网络"
    "EQUOTA" -> "讯飞语音识别额度不足或已过期"
    else -> raw.ifBlank { "语音识别失败（$code）" }
  }

  // ---------------- 系统识别兜底 ----------------

  private val listener = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) { readyForSpeech = true }
    override fun onBeginningOfSpeech() { readyForSpeech = true }
    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit
    override fun onEndOfSpeech() = Unit
    override fun onEvent(eventType: Int, params: Bundle?) = Unit

    override fun onError(error: Int) {
      fail(errorCode(error), errorMessage(error))
    }

    override fun onResults(results: Bundle?) {
      val text = best(results) ?: lastText
      val promise = pending
      pending = null
      clearTimeouts()
      destroyRecognizer()
      backend = null
      emit(text, final = true)
      if (text.isBlank()) promise?.reject("ENORESULT", "没有识别到语音")
      else promise?.resolve(text)
    }

    override fun onPartialResults(partialResults: Bundle?) {
      val text = best(partialResults)
      if (!text.isNullOrBlank()) {
        lastText = text
        if (pending != null) scheduleStartTimeout()
        emit(text, final = false)
      }
    }
  }

  private fun best(bundle: Bundle?): String? =
      bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
          ?.firstOrNull()?.trim()?.takeIf { it.isNotEmpty() }

  private fun emit(text: String, final: Boolean) {
    if (!reactApplicationContext.hasActiveReactInstance()) return
    val map = Arguments.createMap()
    map.putString("text", text)
    map.putBoolean("final", final)
    reactApplicationContext.emitDeviceEvent(EVENT, map)
  }

  private fun fail(code: String, message: String) {
    sequence += 1
    cleanupCloud()
    destroyRecognizer()
    clearTimeouts()
    backend = null
    val promise = pending
    pending = null
    if (reactApplicationContext.hasActiveReactInstance()) {
      val map = Arguments.createMap()
      map.putString("text", lastText)
      map.putBoolean("error", true)
      map.putString("code", code)
      map.putString("message", message)
      reactApplicationContext.emitDeviceEvent(EVENT, map)
    }
    promise?.reject(code, message)
  }

  private fun destroyRecognizer() {
    try { recognizer?.destroy() } catch (_: Exception) { }
    recognizer = null
  }

  private fun scheduleStartTimeout() {
    clearStartTimeout()
    startTimeout = Runnable { fail("ETIMEOUT", "语音识别超时") }
        .also { mainHandler.postDelayed(it, 15_000) }
  }

  private fun clearStartTimeout() {
    startTimeout?.let { mainHandler.removeCallbacks(it) }
    startTimeout = null
  }

  private fun clearStopTimeout() {
    stopTimeout?.let { mainHandler.removeCallbacks(it) }
    stopTimeout = null
  }

  private fun clearTimeouts() {
    clearStartTimeout()
    clearStopTimeout()
    clearConnectTimeout()
    clearIdleTimeout()
    clearFinishGuard()
  }

  private fun settle(text: String) {
    clearTimeouts()
    backend = null
    val promise = pending
    pending = null
    if (text.isBlank()) promise?.reject("ENORESULT", "没有识别到语音")
    else promise?.resolve(text)
  }

  private fun errorCode(error: Int): String = when (error) {
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "EPERM"
    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "ENOSPEECH"
    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "ENETWORK"
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "EBUSY"
    SpeechRecognizer.ERROR_AUDIO -> "EAUDIO"
    else -> "ERECOGNIZER"
  }

  private fun errorMessage(error: Int): String = when (error) {
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "没有麦克风权限"
    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "没有听清，再试一次"
    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "语音识别需要网络"
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "识别服务忙，请稍后"
    SpeechRecognizer.ERROR_AUDIO -> "录音失败"
    else -> "语音识别失败"
  }

  companion object {
    private const val NAME = "GuanshiAsr"
    private const val EVENT = "GuanshiSpeechPartial"
    private const val SAMPLE_RATE = 16_000
    private const val FRAME_BYTES = 1_280
    private const val MAX_BUFFER_FRAMES = 75
  }
}
