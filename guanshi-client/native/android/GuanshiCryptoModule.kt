package com.guanshi.app

import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyFactory
import java.security.spec.MGF1ParameterSpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource

/**
 * 用服务端下发的 RSA 公钥加密模型 Key。
 * 明文只在内存里存在一瞬间，网络上是密文，服务端解密后也只用于本次请求。
 */
class GuanshiCryptoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "GuanshiCrypto"

  @ReactMethod
  fun encrypt(publicKeyPem: String, plaintext: String, promise: Promise) {
    try {
      val body = publicKeyPem
          .replace("-----BEGIN PUBLIC KEY-----", "")
          .replace("-----END PUBLIC KEY-----", "")
          .replace("\\s".toRegex(), "")
      val der = Base64.decode(body, Base64.DEFAULT)
      val key = KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(der))
      // 必须显式指定 MGF1(SHA-256)，否则 Android 默认 SHA-1，与 Node 端不兼容
      val spec = OAEPParameterSpec(
          "SHA-256",
          "MGF1",
          MGF1ParameterSpec.SHA256,
          PSource.PSpecified.DEFAULT,
      )
      val cipher = Cipher.getInstance("RSA/ECB/OAEPPadding")
      cipher.init(Cipher.ENCRYPT_MODE, key, spec)
      val encrypted = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
      promise.resolve(Base64.encodeToString(encrypted, Base64.NO_WRAP))
    } catch (error: Exception) {
      promise.reject("ECRYPTO", error.message ?: "加密失败", error)
    }
  }
}
