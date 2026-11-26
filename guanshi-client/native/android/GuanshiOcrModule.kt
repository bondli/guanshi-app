package com.guanshi.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** 端侧中文 OCR：完全离线，只把文字交给 JS，图片不出设备 */
class GuanshiOcrModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private val executor: ExecutorService = Executors.newSingleThreadExecutor()
  private val recognizer by lazy {
    TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
  }

  override fun getName(): String = "GuanshiOcr"

  @ReactMethod
  fun recognizeText(path: String, promise: Promise) {
    executor.execute {
      try {
        val cleanPath = path.removePrefix("file://")
        val file = File(cleanPath)
        if (!file.exists()) {
          promise.reject("ENOENT", "图片不存在：$cleanPath")
          return@execute
        }
        val options = BitmapFactory.Options().apply {
          inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val bitmap = BitmapFactory.decodeFile(cleanPath, options)
        if (bitmap == null) {
          promise.reject("EDECODE", "图片解码失败")
          return@execute
        }
        val image = InputImage.fromBitmap(bitmap, 0)
        recognizer
            .process(image)
            .addOnSuccessListener { result ->
              bitmap.recycle()
              val lines = Arguments.createArray()
              result.textBlocks.forEach { block ->
                block.lines.forEach { line -> lines.pushString(line.text) }
              }
              val map = Arguments.createMap()
              map.putString("text", result.text)
              map.putArray("lines", lines)
              promise.resolve(map)
            }
            .addOnFailureListener { error ->
              bitmap.recycle()
              Log.e("GuanshiOcr", "ocr failed", error)
              promise.reject("EOCR", error.message ?: "OCR 识别失败", error)
            }
      } catch (error: Exception) {
        Log.e("GuanshiOcr", "ocr exception", error)
        promise.reject("EOCR", error.message ?: "OCR 识别失败", error)
      }
    }
  }

  override fun invalidate() {
    executor.shutdown()
    try {
      recognizer.close()
    } catch (_: Exception) {
      // ignore
    }
    super.invalidate()
  }
}
