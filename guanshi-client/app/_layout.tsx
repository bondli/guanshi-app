import 'react-native-gesture-handler'
import React, { useEffect, useRef, useState } from 'react'
import { Animated, AppState, Easing, Image, Linking, Platform, Text, View } from 'react-native'
import { Stack, router, usePathname } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import * as NavigationBar from 'expo-navigation-bar'
import * as SystemUI from 'expo-system-ui'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useApp } from '@/src/lib/store'
import {
  REMINDER_CHANNEL,
  ensureNotificationPermission,
  getPendingShare,
  onShareReceived,
  readClipboardText,
} from '@/src/lib/native'
import { usePalette, useResolvedTheme } from '@/src/theme/tokens'
import { ConfirmDialog, ToastView } from '@/src/ui'

void SplashScreen.preventAutoHideAsync().catch(() => undefined)

try {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // 晨报要能叫醒人，其余提醒保持安静
      const kind = (notification.request.content.data as { kind?: string } | undefined)?.kind
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: kind === 'briefing',
        shouldSetBadge: false,
      }
    },
  })
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: '管事提醒',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => undefined)
  }
} catch {
  // 通知模块在部分环境不可用，忽略
}

function openMessage(messageId?: string): void {
  router.push(messageId ? { pathname: '/chat', params: { messageId } } : '/chat')
}

/* ---------------- 剪贴板识别（微信 / 抖音） ---------------- */

const CLIPBOARD_SOURCES: {
  source: string
  pattern: RegExp
  title?: (raw: string, url: string) => string
}[] = [
  { source: '微信', pattern: /https?:\/\/mp\.weixin\.qq\.com\/[^\s"'<>）)】]+/ },
  {
    source: '抖音',
    pattern: /https?:\/\/(?:v\.douyin\.com\/[A-Za-z0-9_-]+\/?|www\.douyin\.com\/video\/\d+)/,
    title: douyinTitle,
  },
  {
    source: '小红书',
    pattern:
      /https?:\/\/(?:xhslink\.(?:cn|com)\/[^\s"'<>）)】]+|www\.xiaohongshu\.com\/explore\/[A-Za-z0-9]+)/,
    title: xhsTitle,
  },
]

const SOURCE_LABEL: Record<string, string> = {
  微信: '一篇微信文章',
  抖音: '一条抖音视频',
  小红书: '一篇小红书笔记',
}

interface ClipboardArticle {
  url: string
  source: string
  title: string
}

/** 记下处理过的链接，冷启动也不再重复询问 */
const CLIPBOARD_KEY = 'guanshi.clipboard.v1'

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

/**
 * 抖音分享文案自带标题，形如：
 * 1.20 复制打开抖音，看看【拉力小叶的作品】你不骑拉力… # 贝纳利552... https://v.douyin.com/xxx/ 04/24 :7pm …
 * 取【作者的作品】和 URL 之间的文案，拼成「作者：文案」。
 */
function douyinTitle(raw: string): string {
  const matched = raw.match(/【([^】]+)】([\s\S]*?)(?=https?:\/\/|$)/)
  if (!matched) return ''
  const author = matched[1].replace(/的作品$/, '').trim()
  const desc = matched[2].replace(/^[，,：:\s]+/, '').trim()
  const text = author ? `${author}：${desc}` : desc
  return text.replace(/\s+/g, ' ').slice(0, 60)
}

/** 小红书分享文案里标题在链接前面：…标题… https://xhslink.cn/xxx 拷走文字，去【小红书】… */
function xhsTitle(raw: string, url: string): string {
  const index = raw.indexOf(url)
  const before = index > 0 ? raw.slice(0, index) : ''
  return before
    .replace(/^[\d.\s]*复制打开小红书[，,]?\s*/, '')
    .replace(/^看看/, '')
    .replace(/\s+/g, ' ')
    .replace(/[~～\s]+$/, '')
    .trim()
    .slice(0, 60)
}

function detectClipboardArticle(raw: string): ClipboardArticle | null {
  for (const item of CLIPBOARD_SOURCES) {
    const url = raw.match(item.pattern)?.[0]
    if (!url) continue
    return { url, source: item.source, title: item.title?.(raw, url) || '' }
  }
  return null
}

/** 尽力抓文章标题，失败就用日期兜底；不阻塞主流程 */
async function fetchArticleTitle(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36' },
    })
    if (!response.ok) return ''
    const html = await response.text()
    const og =
      html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
    const raw = og?.[1] || html.match(/<title>([^<]+)<\/title>/i)?.[1] || ''
    return decodeEntities(raw).trim().slice(0, 60)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

/** 首屏启动画面，和 demo 的 splash 保持一致：底色 + 顶部暖光 + 图标 + 名称 + 副标 */
function BootSplash({ onFinish }: { onFinish: () => void }) {
  const p = usePalette()
  const fade = useRef(new Animated.Value(0)).current
  const pop = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(pop, {
      toValue: 1,
      duration: 460,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start()
    const animation = Animated.sequence([
      Animated.timing(fade, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(1460),
      Animated.timing(fade, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ])
    animation.start(({ finished }) => {
      if (finished) onFinish()
    })
    return () => animation.stop()
  }, [fade, pop, onFinish])

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 99,
        backgroundColor: p.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fade,
      }}
    >
      <Svg style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '46%' }}>
        <Defs>
          <RadialGradient id="splashGlow" cx="50%" cy="52%" rx="42%" ry="46%">
            <Stop offset="0" stopColor={p.brand} stopOpacity="0.20" />
            <Stop offset="1" stopColor={p.brand} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#splashGlow)" />
      </Svg>
      <Animated.Image
        source={require('../assets/icon.png')}
        style={{
          width: 88,
          height: 88,
          borderRadius: 24,
          shadowColor: '#c9522a',
          shadowOpacity: 0.45,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 16 },
          elevation: 8,
          opacity: pop,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        }}
      />
      <Text style={{ marginTop: 14, fontFamily: 'serif', fontSize: 26, fontWeight: '600', color: p.fg }}>
        管事
      </Text>
      <Text style={{ marginTop: 4, fontSize: 11.5, color: p.muted }}>你的事，我来管</Text>
      <Text
        style={{
          position: 'absolute',
          bottom: 46,
          fontSize: 9,
          letterSpacing: 1.8,
          color: p.muted2,
        }}
      >
        CLOUD AGENT · 云端常驻
      </Text>
    </Animated.View>
  )
}

export default function RootLayout() {
  const p = usePalette()
  const hydrated = useApp((s) => s.hydrated)
  const onboarded = useApp((s) => s.settings.onboarded)
  const theme = useApp((s) => s.settings.theme)
  const pathname = usePathname()
  const resolvedTheme = useResolvedTheme()
  const [splashDone, setSplashDone] = useState(false)

  // 应用内可以手动切暗色，系统导航栏不会跟着变，这里主动同步，避免底部安全区留一条浅色
  useEffect(() => {
    if (Platform.OS !== 'android') return
    void SystemUI.setBackgroundColorAsync(p.bg).catch(() => undefined)
    NavigationBar.setStyle(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [p.bg, resolvedTheme])

  useEffect(() => {
    void useApp.getState().hydrate()
  }, [])

  useEffect(() => {
    if (!hydrated) return
    void SplashScreen.hideAsync().catch(() => undefined)
    void useApp.getState().ingestDeviceData()
    // Android 13+ 默认不授予通知权限，不主动申请的话晨报、提醒只会静默失败
    void ensureNotificationPermission()
  }, [hydrated])

  useEffect(() => {
    if (hydrated && !onboarded && pathname !== '/onboarding') {
      router.replace('/onboarding')
    }
  }, [hydrated, onboarded, pathname])

  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return
        const data = response.notification.request.content.data as { messageId?: string } | undefined
        void useApp.getState().refresh().then(() => openMessage(data?.messageId))
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void getPendingShare().then((payload) => {
      if (payload) void useApp.getState().handleShare(payload)
    })
    const offShare = onShareReceived((payload) => {
      void useApp.getState().handleShare(payload)
      router.push('/fav')
    })
    const offNotification = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { messageId?: string } | undefined
      void useApp.getState().refresh().then(() => openMessage(data?.messageId))
    })
    const handleUrl = (url: string) => {
      const match = url.match(/[?&]messageId=([^&]+)/)
      if (url.includes('assistant') || url.includes('/chat')) {
        openMessage(match ? decodeURIComponent(match[1]) : undefined)
      }
    }
    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url)
    })
    const linking = Linking.addEventListener('url', (event) => handleUrl(event.url))
    return () => {
      offShare()
      offNotification.remove()
      linking.remove()
    }
  }, [])

  // 微信、抖音都没有系统分享入口：回到前台读剪贴板，发现链接就提示收藏
  const lastClipboard = useRef('')
  useEffect(() => {
    if (!hydrated || !onboarded) return
    let disposed = false
    const check = async () => {
      const raw = (await readClipboardText()).trim()
      if (disposed || !raw) return
      const article = detectClipboardArticle(raw)
      if (!article || article.url === lastClipboard.current) return
      const state = useApp.getState()
      const handled = await AsyncStorage.getItem(CLIPBOARD_KEY)
      if (article.url === handled) return
      lastClipboard.current = article.url
      // 已经收藏过同一条就不再打扰
      if (state.collections.some((item) => item.url === article.url)) {
        await AsyncStorage.setItem(CLIPBOARD_KEY, article.url)
        return
      }
      const ok = await state.confirm({
        title: `发现${SOURCE_LABEL[article.source] || '一个链接'}`,
        message: '要收进管事的收藏吗？之后可以在收藏里回看。',
        confirmText: '收进收藏',
        cancelText: '忽略',
      })
      // 用户做过选择才记下来，避免弹窗被打断后这条链接再也提示不出来
      await AsyncStorage.setItem(CLIPBOARD_KEY, article.url)
      if (!ok || disposed) return
      // 抓回来的标题如果只是站点名或太短，不如用自己的兜底文案
      const fetched = article.title ? '' : await fetchArticleTitle(article.url)
      const clean = fetched && fetched !== article.source && fetched.length >= 4 ? fetched : ''
      const title =
        article.title ||
        clean ||
        `${article.source}内容 · ${new Date().getMonth() + 1}/${new Date().getDate()}`
      const collection = await state.addCollection({
        title,
        type: 'link',
        source: article.source,
        excerpt: article.title ? '' : article.url,
        url: article.url,
        meta: `剪贴板 · ${article.source}`,
        clip: raw,
      })
      if (collection) state.showToast(`已收进收藏 · 来自${article.source}`)
    }
    const first = setTimeout(() => void check(), 1500)
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setTimeout(() => void check(), 500)
    })
    return () => {
      disposed = true
      clearTimeout(first)
      sub.remove()
    }
  }, [hydrated, onboarded])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: p.bg }}>
          <StatusBar style={theme === 'dark' ? 'light' : theme === 'system' ? 'auto' : 'dark'} />
          {hydrated ? (
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: p.bg },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="duty/[id]" />
              <Stack.Screen name="collection/[id]" />
              <Stack.Screen name="settings/[page]" />
            </Stack>
          ) : null}
          {!splashDone ? <BootSplash onFinish={() => setSplashDone(true)} /> : null}
          <ConfirmDialog />
          <ToastView />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
