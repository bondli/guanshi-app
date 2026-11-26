package com.guanshi.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/** 注册管事自带的原生模块：分享入口、端侧 OCR、讯飞听写、短信与通知采集 */
class GuanshiPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
      listOf(
          GuanshiShareModule(reactContext),
          GuanshiOcrModule(reactContext),
          GuanshiAsrModule(reactContext),
          GuanshiSmsModule(reactContext),
          GuanshiNotifyModule(reactContext),
          GuanshiCryptoModule(reactContext),
      )

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
