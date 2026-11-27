const fs = require('fs')
const path = require('path')
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
  withMainActivity,
  withMainApplication,
  withProjectBuildGradle,
  withSettingsGradle,
} = require('expo/config-plugins')

const PERMISSIONS = [
  'android.permission.READ_SMS',
  'android.permission.RECEIVE_SMS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECORD_AUDIO',
  'android.permission.WAKE_LOCK',
  'android.permission.FOREGROUND_SERVICE',
]

function copyKotlinSources(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot
      const source = path.join(projectRoot, 'native', 'android')
      if (!fs.existsSync(source)) {
        throw new Error(`[withGuanshiNative] 找不到原生源码目录：${source}`)
      }
      const packageName = cfg.android?.package || 'com.guanshi.app'
      const target = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...packageName.split('.'),
      )
      fs.mkdirSync(target, { recursive: true })
      for (const file of fs.readdirSync(source)) {
        if (!file.endsWith('.kt')) continue
        fs.copyFileSync(path.join(source, file), path.join(target, file))
      }
      return cfg
    },
  ])
}

function patchMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg
    let source = cfg.modResults.contents
    if (!source.includes('GuanshiPackage')) {
      if (source.includes('PackageList(this).packages.apply {')) {
        source = source.replace(
          'PackageList(this).packages.apply {',
          'PackageList(this).packages.apply {\n          add(GuanshiPackage())',
        )
      } else if (source.includes('PackageList(this).packages')) {
        source = source.replace(
          'PackageList(this).packages',
          'PackageList(this).packages.apply { add(GuanshiPackage()) }',
        )
      }
    }
    cfg.modResults.contents = source
    return cfg
  })
}

function patchMainActivity(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg
    let source = cfg.modResults.contents
    if (!source.includes('GuanshiShareModule.capture')) {
      source = source.replace(
        /super\.onCreate\((null|savedInstanceState)\)/,
        (match) => `${match}\n    GuanshiShareModule.capture(this, intent)`,
      )
      if (!source.includes('override fun onNewIntent')) {
        source = source.replace(
          /(class MainActivity[^{]*\{)/,
          `$1\n\n  override fun onNewIntent(intent: Intent) {\n    super.onNewIntent(intent)\n    setIntent(intent)\n    GuanshiShareModule.capture(this, intent)\n  }\n`,
        )
      }
      if (!/import android\.content\.Intent/.test(source)) {
        source = source.replace(/(package [^\n]+\n)/, '$1\nimport android.content.Intent\n')
      }
    }
    cfg.modResults.contents = source
    return cfg
  })
}

function patchManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest
    manifest['uses-permission'] = manifest['uses-permission'] || []
    for (const permission of PERMISSIONS) {
      const exists = manifest['uses-permission'].some(
        (item) => item.$ && item.$['android:name'] === permission,
      )
      if (!exists) manifest['uses-permission'].push({ $: { 'android:name': permission } })
    }

    const application = manifest.application && manifest.application[0]
    if (!application) return cfg

    // Android 11+ 包可见性：不声明 queries 时 getLaunchIntentForPackage 一律返回 null，
    // 表现为「明明装了抖音却提示没安装」
    const visiblePackages = ['com.ss.android.ugc.aweme', 'com.xingin.xhs', 'com.tencent.mm']
    manifest.queries = manifest.queries || []
    const declared = new Set(
      manifest.queries
        .flatMap((item) => (item.package || []).map((pkg) => pkg.$ && pkg.$['android:name']))
        .filter(Boolean),
    )
    const missing = visiblePackages.filter((name) => !declared.has(name))
    if (missing.length) {
      manifest.queries.push({ package: missing.map((name) => ({ $: { 'android:name': name } })) })
    }
    // 本地调试走 http，Android 9+ 默认禁止明文流量，这里放开
    application.$ = application.$ || {}
    application.$['android:usesCleartextTraffic'] = 'true'
    application.activity = application.activity || []
    const activity = application.activity.find(
      (item) => item.$ && String(item.$['android:name']).endsWith('MainActivity'),
    )
    if (activity) {
      activity.$ = activity.$ || {}
      activity.$['android:launchMode'] = 'singleTask'
      activity['intent-filter'] = activity['intent-filter'] || []
      const hasSend = activity['intent-filter'].some((filter) => {
        const mime = filter.data?.[0]?.$?.['android:mimeType']
        return mime === 'text/plain' && filter.action?.[0]?.$?.['android:name'] === 'android.intent.action.SEND'
      })
      if (!hasSend) {
        activity['intent-filter'].push(
          {
            action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [{ $: { 'android:mimeType': 'text/plain' } }],
          },
          {
            action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [{ $: { 'android:mimeType': 'image/*' } }],
          },
          {
            action: [{ $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [{ $: { 'android:mimeType': 'image/*' } }],
          },
        )
      }
    }

    application.service = application.service || []
    const serviceName = '.GuanshiNotificationListener'
    if (!application.service.some((item) => item.$ && item.$['android:name'] === serviceName)) {
      application.service.push({
        $: {
          'android:name': serviceName,
          'android:label': '管事通知读取',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.service.notification.NotificationListenerService' } },
            ],
          },
        ],
      })
    }

    application.receiver = application.receiver || []
    const receiverName = '.GuanshiBootReceiver'
    if (!application.receiver.some((item) => item.$ && item.$['android:name'] === receiverName)) {
      application.receiver.push({
        $: { 'android:name': receiverName, 'android:enabled': 'true', 'android:exported': 'true' },
        'intent-filter': [
          { action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }] },
        ],
      })
    }

    return cfg
  })
}

/* ---------------- 华为 Push Kit ---------------- */

const HUAWEI_MAVEN = 'https://developer.huawei.com/repo/'
const AGCP_VERSION = '1.9.6.301'
const HMS_PUSH_VERSION = '6.13.0.301'

function agconnectSource(projectRoot) {
  return path.join(projectRoot, 'native', 'agconnect-services.json')
}

/** 从 React Native 的版本目录里读 AGP 版本，agcp 需要它来判断支持范围 */
function readAgpVersion(projectRoot) {
  try {
    const toml = fs.readFileSync(
      path.join(projectRoot, 'node_modules', 'react-native', 'gradle', 'libs.versions.toml'),
      'utf8',
    )
    const match = toml.match(/^agp\s*=\s*"([^"]+)"/m)
    if (match) return match[1]
  } catch {
    // 读不到就用兜底版本
  }
  return '9.2.1'
}

/**
 * agcp 会去读名为 libs 的版本目录里的 android-application 插件版本；
 * Expo 只注册了 expoLabs，这里补一个最小目录，否则 apply plugin 直接失败。
 */
function patchSettingsGradle(config) {
  return withSettingsGradle(config, (cfg) => {
    let source = cfg.modResults.contents
    if (source.includes('agcp-libs-catalog')) return cfg
    source += `
// agcp-libs-catalog: 华为 agcp 要求存在名为 libs 的版本目录
dependencyResolutionManagement {
  versionCatalogs {
    create("libs") {
      plugin("android-application", "com.android.application").version("${readAgpVersion(cfg.modRequest.projectRoot)}")
    }
  }
}
`
    cfg.modResults.contents = source
    return cfg
  })
}

function patchRootBuildGradle(config) {
  return withProjectBuildGradle(config, (cfg) => {
    let source = cfg.modResults.contents
    if (!source.includes(HUAWEI_MAVEN)) {
      source = source.replace(
        /(buildscript\s*\{\s*repositories\s*\{)/,
        `$1\n    maven { url '${HUAWEI_MAVEN}' }`,
      )
      source = source.replace(
        /(allprojects\s*\{\s*repositories\s*\{)/,
        `$1\n    maven { url '${HUAWEI_MAVEN}' }`,
      )
    }
    if (!source.includes('com.huawei.agconnect:agcp')) {
      source = source.replace(
        /(buildscript\s*\{[\s\S]*?dependencies\s*\{)/,
        `$1\n    classpath 'com.huawei.agconnect:agcp:${AGCP_VERSION}'`,
      )
    }
    cfg.modResults.contents = source
    return cfg
  })
}

function patchHuaweiPush(config) {
  return withAppBuildGradle(config, (cfg) => {
    let source = cfg.modResults.contents
    if (!source.includes('com.huawei.hms:push')) {
      source = source.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n    implementation("com.huawei.hms:push:${HMS_PUSH_VERSION}")`,
      )
    }
    // agcp 插件必须在 agconnect-services.json 存在时才应用，否则构建直接失败
    if (
      fs.existsSync(agconnectSource(cfg.modRequest.projectRoot)) &&
      !source.includes("com.huawei.agconnect'")
    ) {
      source = source.replace(
        /apply plugin: "com\.android\.application"/,
        (match) => `${match}\napply plugin: 'com.huawei.agconnect'`,
      )
    }
    cfg.modResults.contents = source
    return cfg
  })
}

function copyAgconnectConfig(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const from = agconnectSource(cfg.modRequest.projectRoot)
      if (!fs.existsSync(from)) {
        console.warn(
          '[withGuanshiNative] 未找到 native/agconnect-services.json，华为推送不会生效（前台通道不受影响）',
        )
        return cfg
      }
      fs.copyFileSync(from, path.join(cfg.modRequest.platformProjectRoot, 'app', 'agconnect-services.json'))
      return cfg
    },
  ])
}

function patchGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg
    let source = cfg.modResults.contents
    const deps = [
      'com.google.mlkit:text-recognition-chinese:16.0.1',
      'androidx.work:work-runtime-ktx:2.9.1',
    ]
    for (const dep of deps) {
      if (!source.includes(dep)) {
        source = source.replace(
          /dependencies\s*\{/,
          (match) => `${match}\n    implementation("${dep}")\n`,
        )
      }
    }
    cfg.modResults.contents = source
    return cfg
  })
}

// Expo 58 默认开启 R8，当前 expo-modules-core 版本会在 minify 阶段缺类，
// 本地打包先关掉，等上游修好再打开
function patchGradleProperties(config) {
  return withGradleProperties(config, (cfg) => {
    const key = 'android.enableMinifyInReleaseBuilds'
    const existing = cfg.modResults.find((item) => item.type === 'property' && item.key === key)
    if (existing) existing.value = 'false'
    else cfg.modResults.push({ type: 'property', key, value: 'false' })

    // 只编译 arm64（真机与 Apple Silicon 模拟器），其余 ABI 不参与构建
    const abiKey = 'reactNativeArchitectures'
    const abi = cfg.modResults.find((item) => item.type === 'property' && item.key === abiKey)
    const abiValue = 'arm64-v8a'
    if (abi) abi.value = abiValue
    else cfg.modResults.push({ type: 'property', key: abiKey, value: abiValue })

    return cfg
  })
}

// 按 ABI 拆包：只打 arm64，一个包只带一套 so，体积从 146MB 降到 50MB 出头
function patchAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg
    let source = cfg.modResults.contents
    if (!source.includes('splits {')) {
      source = source.replace(
        /(^|\n)android\s*\{/,
        (match) => `${match}
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a"
            universalApk false
        }
    }`,
      )
    }
    cfg.modResults.contents = source
    return cfg
  })
}

module.exports = function withGuanshiNative(config) {
  config = copyKotlinSources(config)
  config = patchMainApplication(config)
  config = patchMainActivity(config)
  config = patchManifest(config)
  config = patchGradle(config)
  config = patchGradleProperties(config)
  config = patchAbiSplits(config)
  config = patchRootBuildGradle(config)
  config = patchSettingsGradle(config)
  config = patchHuaweiPush(config)
  config = copyAgconnectConfig(config)
  return config
}
