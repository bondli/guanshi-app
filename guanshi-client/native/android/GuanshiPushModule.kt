package com.guanshi.app

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.huawei.agconnect.config.AGConnectServicesConfig
import com.huawei.hms.aaid.HmsInstanceId

/**
 * 华为 Push Kit：取推送 token 交给 JS 上报给服务端，杀进程后也能收到晨报。
 * 依赖 agconnect-services.json（AGC 下载后放到 guanshi-client/native/ 下）。
 */
class GuanshiPushModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName() = "GuanshiPush"

  /** getToken 会走网络，必须放子线程，否则主线程会抛异常 */
  @ReactMethod
  fun getToken(promise: Promise) {
    Thread {
      try {
        val appId = AGConnectServicesConfig.fromContext(context).getString("client/app_id")
        if (appId.isNullOrBlank()) {
          promise.reject("no_app_id", "缺少 agconnect-services.json 或未配置 app_id")
          return@Thread
        }
        val token = HmsInstanceId.getInstance(context).getToken(appId, "HCM")
        promise.resolve(token ?: "")
      } catch (error: Exception) {
        promise.reject("push_token_failed", error.message, error)
      }
    }.start()
  }

  @ReactMethod
  fun deleteToken(promise: Promise) {
    Thread {
      try {
        HmsInstanceId.getInstance(context).deleteToken("HCM")
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("delete_token_failed", error.message, error)
      }
    }.start()
  }
}
